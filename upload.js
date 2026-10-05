import { db, doc, getDoc } from './firebase-config.js';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 512;
const ENDPOINT = 'https://api.imgbb.com/1/upload';

const TEXT = {
  noFile: 'اختر صورة أولا',
  notImage: 'الملف المختار ليس صورة',
  tooBig: 'حجم الصورة أكبر من 8 ميجابايت',
  unreadable: 'تعذر قراءة الصورة، جرب صيغة JPG أو PNG',
  encode: 'تعذر تجهيز الصورة للرفع',
  noAccess: 'تعذر قراءة إعدادات الرفع: تأكد من تسجيل الدخول المجهول وقواعد Firestore',
  noKey: 'مفتاح imgbb_api_key غير موجود في app_config/keys',
  network: 'تعذر الاتصال بخدمة رفع الصور',
  failed: 'فشل رفع الصورة',
  generic: 'حدث خطأ أثناء رفع الصورة'
};

export class UploadError extends Error {}

const fail = message => {
  throw new UploadError(message);
};

let cachedKey = '';

const readKey = async () => {
  if (cachedKey) return cachedKey;
  let snap;
  try {
    snap = await getDoc(doc(db, 'app_config', 'keys'));
  } catch (err) {
    console.error(err);
    return fail(TEXT.noAccess);
  }
  const key = snap.exists() ? String(snap.data().imgbb_api_key || '').trim() : '';
  if (!key) fail(TEXT.noKey);
  cachedKey = key;
  return key;
};

export const prepareImage = async file => {
  if (!file) fail(TEXT.noFile);
  if (!/^image\//.test(file.type)) fail(TEXT.notImage);
  if (file.size > MAX_BYTES) fail(TEXT.tooBig);
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch (err) {
    console.error(err);
    return fail(TEXT.unreadable);
  }
  const side = Math.min(bitmap.width, bitmap.height);
  const size = Math.min(side, MAX_SIDE);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  if (typeof bitmap.close === 'function') bitmap.close();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.88));
  if (!blob) fail(TEXT.encode);
  return blob;
};

export const uploadAvatar = async blob => {
  const key = await readKey();
  const body = new FormData();
  body.append('image', blob, 'avatar.jpg');
  let res;
  try {
    res = await fetch(ENDPOINT + '?key=' + encodeURIComponent(key), { method: 'POST', body });
  } catch (err) {
    console.error(err);
    return fail(TEXT.network);
  }
  let json = null;
  try {
    json = await res.json();
  } catch (err) {
    json = null;
  }
  const url = json && json.success && json.data ? (json.data.url || json.data.display_url) : '';
  if (!res.ok || !url) {
    const detail = json && json.error && json.error.message ? ': ' + json.error.message : '';
    fail(TEXT.failed + detail);
  }
  return url;
};

export const describeError = err => (err instanceof UploadError ? err.message : TEXT.generic);
