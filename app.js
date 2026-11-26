// صفحات — كل المنطق المشترك بملف واحد (Firebase + الجهاز + القارئ + الحماية)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js';
import { initializeAuth, onAuthStateChanged, indexedDBLocalPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js';


// ───── config.js ─────
// إعدادات Firebase (مفتاح الـ apiKey عام بطبيعته، الحماية بالقواعد والسيرفر)
// تأكد أن القيم مطابقة لما في Firebase Console → Project settings → Your apps
export const firebaseConfig = {
  apiKey: 'AIzaSyBUHE5yg_zgLqaKJ80FiB2HKo2q0whfhqc',
  authDomain: 'pages-3de60.firebaseapp.com',
  projectId: 'pages-3de60',
  storageBucket: 'pages-3de60.firebasestorage.app',
  messagingSenderId: '1000051011629',
  appId: '1:1000051011629:web:0565d9da5d056c21fd88a4',
};



// ───── firebase.js ─────




export const app = initializeApp(firebaseConfig);
// تسجيل دخول دائم: يبقى المستخدم داخلاً حتى يضغط "خروج" (IndexedDB ثم localStorage كاحتياط)
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
// اطلب من المتصفح (سفاري/كروم) عدم مسح بيانات الموقع تلقائياً
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* تجاهل */ }

try { if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {}); } catch (e) { /* تجاهل */ }

// ───── الدخول برقم الهاتف (بدون SMS): الرقم يتحول داخلياً لبريد وهمي ─────
const PHONE_DOMAIN = '@phone.safhat.app';
/** يقبل بريداً أو رقم هاتف أردنياً (079… / +962… / 00962…) ويرجع البريد المستخدم للدخول، أو null إذا غير صالح */
export function toLoginEmail(v) {
  v = String(v || '').trim();
  if (v.includes('@')) return v.toLowerCase();
  let d = v.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('0')) d = '962' + d.slice(1);
  if (!/^\d{10,15}$/.test(d)) return null;
  return 'p' + d + PHONE_DOMAIN;
}
/** الاسم المعروض للمستخدم (رقم الهاتف أو البريد) */
export function displayId(email) {
  email = email || '';
  const m = email.match(/^p(\d+)@phone\.safhat\.app$/);
  return m ? '+' + m[1] : email;
}
export const db = getFirestore(app);

/** يحل مرة واحدة بحالة المستخدم الأولى (null إذا غير مسجل) */
export const ready = new Promise((resolve) => {
  const off = onAuthStateChanged(auth, (u) => { off(); resolve(u); });
});

// ───── fingerprint.js ─────
// بصمة الجهاز = SHA-256 لـ (User-Agent مبسّط + دقة الشاشة + المنطقة الزمنية + Canvas)
// تُحفظ محلياً بعد أول حساب كي لا تتغير مع تحديث المتصفح أو "حماية البصمة" في Brave/Firefox.
const KEY = 'safhat_dev_v1';

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function uaInfo() {
  const u = navigator.userAgent || '';
  let b = 'Other';
  if (/Edg\//.test(u)) b = 'Edge';
  else if (/OPR\/|Opera/.test(u)) b = 'Opera';
  else if (/SamsungBrowser/.test(u)) b = 'Samsung';
  else if (/Firefox|FxiOS/.test(u)) b = 'Firefox';
  else if (/Chrome|CriOS/.test(u)) b = 'Chrome';
  else if (/Safari/.test(u)) b = 'Safari';
  let o = 'Other';
  if (/Windows/.test(u)) o = 'Windows';
  else if (/Android/.test(u)) o = 'Android';
  else if (/iPhone|iPad|iPod/.test(u)) o = 'iOS';
  else if (/Mac OS X|Macintosh/.test(u)) o = 'macOS';
  else if (/Linux/.test(u)) o = 'Linux';
  return { browser: b, os: o };
}

function canvasPrint() {
  try {
    const c = document.createElement('canvas');
    c.width = 240; c.height = 60;
    const x = c.getContext('2d');
    x.textBaseline = 'top';
    x.font = "16px 'Arial'";
    x.fillStyle = '#f60'; x.fillRect(100, 5, 80, 30);
    x.fillStyle = '#069'; x.fillText('Safhat صفحات 2026 ★', 4, 10);
    x.fillStyle = 'rgba(102,204,0,.7)'; x.fillText('Safhat صفحات 2026 ★', 6, 22);
    return c.toDataURL();
  } catch (e) { return 'no-canvas'; }
}

export async function getDevice() {
  const { browser, os } = uaInfo();
  const label = `${browser} · ${os}`;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && /^[a-f0-9]{64}$/.test(saved.fp)) return { fp: saved.fp, label };
  } catch (e) { /* تجاهل */ }

  const dims = [screen.width || 0, screen.height || 0].sort((a, b) => a - b); // مستقل عن تدوير الشاشة
  const parts = [
    browser, os,
    dims.join('x'), screen.colorDepth || 0,
    Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    canvasPrint(),
  ];
  const fp = await sha256Hex(parts.join('|'));
  try { localStorage.setItem(KEY, JSON.stringify({ fp, t: Date.now() })); } catch (e) { /* تجاهل */ }
  return { fp, label };
}

// ───── session.js ─────



const MAX_DEVICES = 5;
export const LIMIT_MSG = 'تم الوصول للحد الأقصى للأجهزة المسموح بها لهذا الحساب - 5 أجهزة كحد أقصى';
export const clearSession = () => {};

const coded = (code, msg) => { const e = new Error(msg); e.code = code; return e; };

/** تسجيل/التحقق من الجهاز. القاعدة نفسها بـ firestore.rules تمنع الجهاز الثالث. */
export async function getSession() {
  const u = auth.currentUser;
  if (!u) throw coded('NO_AUTH', 'سجّل الدخول أولاً');
  const { fp, label } = await getDevice();
  const ref = doc(db, 'user_devices', u.uid);
  const snap = await getDoc(ref);
  const devices = snap.exists() ? snap.data().devices || {} : {};
  const now = Date.now();
  if (devices[fp]) {
    await setDoc(ref, { devices: { [fp]: { ...devices[fp], last_login: now } } }, { merge: true });
    return true;
  }
  if (Object.keys(devices).length >= MAX_DEVICES) throw coded('DEVICE_LIMIT', LIMIT_MSG);
  try {
    await setDoc(ref, { devices: { [fp]: { label, created_at: now, last_login: now } } }, { merge: true });
  } catch (e) {
    if (e.code === 'permission-denied') throw coded('DEVICE_LIMIT', LIMIT_MSG);
    throw e;
  }
  return true;
}

/** يجلب أجزاء الـ PDF من Firestore ويجمعها بالذاكرة (لا يوجد رابط ملف أبداً). */
export async function loadPdfBytes(storyId, story, sample, onProgress) {
  const col = sample ? 'pdf_sample' : 'pdf_chunks';
  const n = (sample ? story.sampleChunks : story.chunks) || 0;
  if (!n) throw coded('NO_FILE', 'ملف القصة غير متوفر بعد');
  const parts = new Array(n);
  let next = 0, done = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= n) return;
      let s;
      try { s = await getDoc(doc(db, col, storyId, 'parts', String(i))); }
      catch (e) {
        if (e.code === 'permission-denied') throw coded(sample ? 'NO_AUTH' : 'NOT_PURCHASED', 'لم تشترِ هذه القصة بعد');
        throw e;
      }
      if (!s.exists()) throw coded('NO_FILE', 'ملف القصة غير مكتمل');
      parts[i] = s.data().b.toUint8Array();
      if (onProgress) onProgress(++done, n);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, n) }, worker));
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}

export async function loadAudioBytes(storyId, story, onProgress) {
  const n = story.audioChunks || 0;
  if (!n) throw coded('NO_FILE', 'الصوت غير متوفر');
  const parts = new Array(n);
  let next = 0, done = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= n) return;
      let s;
      try { s = await getDoc(doc(db, 'audio_chunks', storyId, 'parts', String(i))); }
      catch (e) {
        if (e.code === 'permission-denied') throw coded('NOT_PURCHASED', 'لم تشترِ هذه القصة بعد');
        throw e;
      }
      if (!s.exists()) throw coded('NO_FILE', 'ملف الصوت غير مكتمل');
      parts[i] = s.data().b.toUint8Array();
      if (onProgress) onProgress(++done, n);
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, n) }, worker));
  return parts;
}

export function friendly(e) {
  const c = e && e.code;
  const map = {
    'auth/invalid-credential': 'رقم الهاتف/البريد أو كلمة السر غير صحيحة',
    'auth/wrong-password': 'رقم الهاتف/البريد أو كلمة السر غير صحيحة',
    'auth/user-not-found': 'رقم الهاتف/البريد أو كلمة السر غير صحيحة',
    'auth/invalid-email': 'صيغة البريد غير صحيحة',
    'auth/email-already-in-use': 'هذا الحساب مسجل مسبقاً، جرّب تسجيل الدخول',
    'auth/weak-password': 'كلمة السر ضعيفة (6 أحرف على الأقل)',
    'auth/too-many-requests': 'محاولات كثيرة، انتظر قليلاً ثم أعد المحاولة',
    'auth/network-request-failed': 'مشكلة بالاتصال بالإنترنت',
    'permission-denied': 'لا تملك صلاحية لهذا الإجراء',
    'unavailable': 'مشكلة بالاتصال، أعد المحاولة',
  };
  return map[c] || (e && e.message) || 'حدث خطأ غير متوقع';
}

// ───── protect.js ─────
// حماية واجهة القارئ (ردع للمستخدم العادي؛ الحماية الحقيقية من السيرفر)
export function enableProtection() {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); return false; };

  ['contextmenu', 'dragstart', 'selectstart', 'copy', 'cut', 'dragover', 'drop'].forEach((t) =>
    document.addEventListener(t, stop, true)
  );

  document.addEventListener('keydown', (e) => {
    const c = e.ctrlKey || e.metaKey;
    const code = e.code || '';
    const blocked =
      code === 'F12' ||
      code === 'PrintScreen' ||
      (c && ['KeyS', 'KeyP', 'KeyU', 'KeyC', 'KeyA'].includes(code)) ||            // حفظ/طباعة/مصدر/نسخ
      (c && e.shiftKey && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(code)) ||       // أدوات المطور
      (e.metaKey && e.altKey && ['KeyI', 'KeyJ', 'KeyU', 'KeyC'].includes(code));   // ماك
    if (blocked) stop(e);
  }, true);

  // لقطة الشاشة: امسح الحافظة وأخفِ الصفحات لحظياً
  document.addEventListener('keyup', (e) => {
    if (e.code !== 'PrintScreen') return;
    try { navigator.clipboard.writeText(' '); } catch (err) { /* تجاهل */ }
    const p = document.getElementById('pages');
    if (p) { p.style.visibility = 'hidden'; setTimeout(() => { p.style.visibility = ''; }, 1500); }
  }, true);

  // الطباعة: أخفِ كل شيء (يعززها CSS @media print)
  window.addEventListener('beforeprint', () => { document.body.style.display = 'none'; });
  window.addEventListener('afterprint', () => { document.body.style.display = ''; });
}
