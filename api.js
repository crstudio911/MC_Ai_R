import { auth } from './firebase-config.js';
import { SITE } from './site-config.js';

const TEXT = {
  login: 'يجب تسجيل الدخول أولا',
  offline: 'تعذر الاتصال بالخادم، تحقق من الإنترنت',
  generic: 'حدث خطأ غير متوقع، حاول مرة أخرى'
};

export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const api = async (path, options = {}) => {
  const user = auth.currentUser;
  if (!user) throw new ApiError(TEXT.login, 401);
  let token;
  try {
    token = await user.getIdToken();
  } catch (e) {
    throw new ApiError(TEXT.offline);
  }
  const headers = { authorization: 'Bearer ' + token };
  let body;
  if (options.form) {
    body = options.form;
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let res;
  try {
    res = await fetch(SITE.API_BASE + path, { method: options.method || 'GET', headers, body });
  } catch (e) {
    throw new ApiError(TEXT.offline);
  }
  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }
  if (!res.ok || !data || data.ok !== true) {
    throw new ApiError((data && data.message) || TEXT.generic, res.status, (data && data.code) || '');
  }
  return data;
};

export const describeApiError = err => (err instanceof ApiError ? err.message : TEXT.generic);
