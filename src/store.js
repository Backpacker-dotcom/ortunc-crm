// Veri katmanı: iki sürücü — yerel (demo, bu cihaz) ve Firebase (ekip, canlı)
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signOut, sendPasswordResetEmail, updateProfile,
} from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore,
  collection, doc, onSnapshot, setDoc, deleteDoc, getDoc, writeBatch,
} from 'firebase/firestore';

export const COLS = ['accounts', 'guests', 'opps', 'weddings', 'activities', 'tasks', 'files', 'blacklist', 'reports', 'targets', 'visits'];

export function newId() {
  const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const a = new Uint8Array(20);
  crypto.getRandomValues(a);
  return Array.from(a, (x) => c[x % c.length]).join('');
}

function clean(o) {
  // Firestore undefined kabul etmez
  return JSON.parse(JSON.stringify(o, (k, v) => (v === undefined ? null : (k && k[0] === '_' ? undefined : v))));
}

/* ---------------- Yerel sürücü ---------------- */
export function localStore() {
  const KEY = 'ortunc-crm.local.v1';
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { mem = {}; }
  const subs = {};
  let persistErr = false;
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(mem)); persistErr = false; } catch (e) { persistErr = true; } };
  const emit = (col) => (subs[col] || []).forEach((cb) => cb(Object.values(mem[col] || {})));
  const user = { uid: 'local', name: 'Demo Yönetici', email: '', role: 'yonetici', active: true };
  return {
    kind: 'local',
    async init(onUser) { onUser({ state: 'in', user }); },
    subscribe(col, cb) { (subs[col] = subs[col] || []).push(cb); cb(Object.values(mem[col] || {})); },
    subscribeDoc(col, id, cb) {
      const f = (list) => { const d = list.find((x) => x.id === id); cb(d || null); };
      (subs[col] = subs[col] || []).push(f); f(Object.values(mem[col] || {}));
    },
    async save(col, obj) {
      if (!obj.id) obj.id = newId();
      (mem[col] = mem[col] || {})[obj.id] = clean(obj);
      persist(); if (persistErr) { delete mem[col][obj.id]; throw new Error('Demo modunda bu cihazda yer kalmadı.'); }
      emit(col); return obj.id;
    },
    async saveMany(col, arr) {
      mem[col] = mem[col] || {};
      arr.forEach((o) => { if (!o.id) o.id = newId(); mem[col][o.id] = clean(o); });
      persist(); emit(col);
    },
    async remove(col, id) { if (mem[col]) delete mem[col][id]; persist(); emit(col); },
    async get(col, id) { const d = mem[col] && mem[col][id]; return d ? JSON.parse(JSON.stringify(d)) : null; },
    async wipe() { mem = {}; persist(); Object.keys(subs).forEach(emit); },
    async signOut() {},
  };
}

/* ---------------- Firebase sürücüsü ---------------- */
export function firebaseStore(config) {
  const app = initializeApp(config);
  const auth = getAuth(app);
  let db;
  try {
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (e) { db = getFirestore(app); }
  let unsubs = [];
  let onErr = () => {};
  const stopAll = () => { unsubs.forEach((u) => { try { u(); } catch (e) { /* yok */ } }); unsubs = []; };

  return {
    kind: 'firebase',
    onError(cb) { onErr = cb; },
    async init(onUser) {
      onAuthStateChanged(auth, async (fu) => {
        stopAll();
        if (!fu) {
          let setup = false;
          try { setup = (await getDoc(doc(db, 'meta', 'setup'))).exists(); } catch (e) { setup = true; }
          onUser({ state: setup ? 'out' : 'setup' });
          return;
        }
        // Kullanıcı kaydını canlı izle: rol değişince / pasifleşince anında yansır
        let timer = null;
        const u = onSnapshot(doc(db, 'users', fu.uid), (snap) => {
          if (!snap.exists()) {
            // İlk kurulum sırasında kayıt birazdan yazılacak olabilir; kısa süre bekle
            if (!timer) timer = setTimeout(() => onUser({ state: 'noaccess', email: fu.email }), 3000);
            return;
          }
          if (timer) { clearTimeout(timer); timer = null; }
          const d = snap.data();
          if (d.active === false) { onUser({ state: 'noaccess', email: fu.email }); return; }
          onUser({ state: 'in', user: { uid: fu.uid, email: fu.email, ...d } });
        }, () => onUser({ state: 'noaccess', email: fu.email }));
        unsubs.push(u);
      });
    },
    subscribe(col, cb) {
      const u = onSnapshot(collection(db, col), (qs) => cb(qs.docs.map((d) => ({ ...d.data(), id: d.id }))), (e) => onErr(e, col));
      unsubs.push(u);
    },
    subscribeDoc(col, id, cb) {
      const u = onSnapshot(doc(db, col, id), (s) => cb(s.exists() ? s.data() : null), (e) => onErr(e, col));
      unsubs.push(u);
    },
    async save(col, obj) {
      if (!obj.id) obj.id = newId();
      const { id, ...rest } = obj;
      await setDoc(doc(db, col, id), clean(rest));
      return id;
    },
    async saveMany(col, arr) {
      for (let i = 0; i < arr.length; i += 400) {
        const b = writeBatch(db);
        arr.slice(i, i + 400).forEach((o) => {
          if (!o.id) o.id = newId();
          const { id, ...rest } = o;
          b.set(doc(db, col, id), clean(rest));
        });
        await b.commit();
      }
    },
    async remove(col, id) { await deleteDoc(doc(db, col, id)); },
    async get(col, id) { const sn = await getDoc(doc(db, col, id)); return sn.exists() ? { ...sn.data(), id: sn.id } : null; },
    async signIn(email, pass) { await signInWithEmailAndPassword(auth, email, pass); },
    async signOut() { stopAll(); await signOut(auth); },
    async resetPassword(email) { await sendPasswordResetEmail(auth, email); },
    // İlk yönetici: hesap + users kaydı + kurulum işareti tek seferde
    async setupAdmin(name, email, pass) {
      const cred = await createUserWithEmailAndPassword(auth, email, pass);
      try { await updateProfile(cred.user, { displayName: name }); } catch (e) { /* önemli değil */ }
      const b = writeBatch(db);
      b.set(doc(db, 'users', cred.user.uid), { name, email, role: 'yonetici', active: true, createdAt: Date.now() });
      b.set(doc(db, 'meta', 'setup'), { by: cred.user.uid, at: Date.now() });
      await b.commit();
    },
    // Yönetici oturumu bozulmadan yeni kullanıcı açmak için ikinci, geçici uygulama
    async createUser(name, email, pass, role) {
      const app2 = initializeApp(config, 'user-create-' + Date.now());
      try {
        const a2 = getAuth(app2);
        const cred = await createUserWithEmailAndPassword(a2, email, pass);
        await setDoc(doc(db, 'users', cred.user.uid), { name, email, role, active: true, createdAt: Date.now() });
        await signOut(a2);
      } finally { try { await deleteApp(app2); } catch (e) { /* yok */ } }
    },
  };
}

export function authMessage(e) {
  const c = (e && e.code) || '';
  const m = {
    'auth/invalid-credential': 'E-posta ya da şifre hatalı.',
    'auth/wrong-password': 'E-posta ya da şifre hatalı.',
    'auth/user-not-found': 'E-posta ya da şifre hatalı.',
    'auth/invalid-email': 'E-posta adresi geçersiz.',
    'auth/email-already-in-use': 'Bu e-posta ile zaten bir hesap var.',
    'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
    'auth/too-many-requests': 'Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.',
    'auth/network-request-failed': 'İnternet bağlantısı kurulamadı.',
    'auth/operation-not-allowed': 'Firebase\'de E-posta/Şifre girişi açık değil (Authentication › Sign-in method).',
    'auth/api-key-not-valid.-please-pass-a-valid-api-key.': 'Firebase API anahtarı geçersiz.',
    'permission-denied': 'Bu işlem için yetkiniz yok.',
    'unavailable': 'Sunucuya ulaşılamadı; bağlantı gelince eşitlenecek.',
  };
  return m[c] || ('Hata: ' + ((e && e.message) || c || 'bilinmiyor'));
}
