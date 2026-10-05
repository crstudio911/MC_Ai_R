import { api, ApiError } from './api.js';

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_SIDE = 512;

const TEXT = {
  noFile: 'اختر صورة أولا',
  notImage: 'الملف المختار ليس صورة',
  tooBig: 'حجم الصورة أكبر من 8 ميجابايت',
  unreadable: 'تعذر قراءة الصورة، جرب صيغة JPG أو PNG',
  encode: 'تعذر تجهيز الصورة للرفع',
  failed: 'تعذر رفع الصورة، حاول مرة أخرى',
  generic: 'حدث خطأ أثناء رفع الصورة'
};

export class UploadError extends Error {}

const fail = message => {
  throw new UploadError(message);
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
  const form = new FormData();
  form.append('image', blob, 'avatar.jpg');
  try {
    const data = await api('/upload', { method: 'POST', form });
    return data.url;
  } catch (err) {
    console.error(err);
    return fail(err instanceof ApiError ? err.message : TEXT.failed);
  }
};

export const describeError = err => (err instanceof UploadError ? err.message : TEXT.generic);
