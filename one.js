const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbxG1EEHjQf3UtagnjmhS1ntUPZujXOp5wYsMWhraFbxw3yZ6UxO0n2UHivAZ2kXL99V/exec',
  API_HOST_PATTERN: '^https://script\\.google\\.com/',
  HOME_URL: 'main/main.html',
  STORAGE_KEYS: { token: 'mcr_token', user: 'mcr_user', checked: 'mcr_checked' },
  FRESH_MS: 45000,
  PRECOMPUTE_DELAY_MS: 350,
  PBKDF2: { iterations: 150000, saltSuffix: ':mc_ai_r:v1' },
  TIMEOUT_MS: 30000,
  AVATAR: {
    size: 320,
    quality: 0.86,
    maxBytes: 10485760,
    animatedMax: 2000000
  },
  PRIVILEGED_ROLES: ['OWNER', 'Admen'],
  RULES: {
    passMin: 8,
    passMax: 64,
    ageMin: 10,
    ageMax: 100,
    namePattern: '^[\\p{L}\\p{N}][\\p{L}\\p{N}._-]{2,23}$'
  },
  TEXT: {
    fillAll: 'اكتب الاسم وكلمة المرور',
    badName: 'الاسم من 3 إلى 24 حرفا: حروف وأرقام ونقطة وشرطة فقط',
    badPass: 'كلمة المرور من 8 إلى 64 حرفا',
    badAge: 'العمر يجب أن يكون بين 10 و100',
    needCode: 'اكتب كود الصلاحية',
    network: 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مرة أخرى',
    notConfigured: 'رابط الخادم غير مضبوط في ملف one.js',
    cryptoMissing: 'المتصفح لا يدعم التشفير المطلوب. استخدم متصفحا حديثا',
    generic: 'حدث خطأ غير متوقع',
    sessionExpired: 'انتهت الجلسة. سجل الدخول من جديد',
    badImage: 'تعذر استخدام هذه الصورة. جرّب صورة أخرى',
    imageDone: 'تم تحديث الصورة',
    loginBusy: 'جار التحقق',
    registerBusy: 'جار إنشاء الحساب',
    avatarBusy: 'جار الرفع',
    avatarAdd: 'رفع صورة شخصية',
    avatarChange: 'تغيير الصورة',
    showSecret: 'إظهار',
    hideSecret: 'إخفاء',
    yearsSuffix: 'سنة',
    stat: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور' },
    states: { pending: 'm3lk', approved: 'done', banned: 'ban' }
  }
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

const nameRule = new RegExp(CONFIG.RULES.namePattern, 'u');
const apiRule = new RegExp(CONFIG.API_HOST_PATTERN);

const state = { tab: 'login', busy: false, uploading: false, draft: '' };

const views = {
  loading: $('#view-loading'),
  auth: $('#view-auth'),
  account: $('#view-account')
};

const storage = {
  read(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (error) {
      return null;
    }
  },
  write(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (error) {
      return;
    }
  },
  remove(key) {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      return;
    }
  }
};

const session = {
  token() {
    return storage.read(CONFIG.STORAGE_KEYS.token);
  },
  user() {
    try {
      const raw = storage.read(CONFIG.STORAGE_KEYS.user);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  },
  checkedAt() {
    return Number(storage.read(CONFIG.STORAGE_KEYS.checked) || 0);
  },
  save(token, user) {
    if (token) storage.write(CONFIG.STORAGE_KEYS.token, token);
    if (user) {
      storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(user));
      storage.write(CONFIG.STORAGE_KEYS.checked, String(Date.now()));
    }
  },
  clear() {
    Object.values(CONFIG.STORAGE_KEYS).forEach(key => storage.remove(key));
  }
};

const api = async (action, payload = {}) => {
  if (!apiRule.test(CONFIG.API_URL)) return { ok: false, error: CONFIG.TEXT.notConfigured };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CONFIG.TIMEOUT_MS);
  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      signal: controller.signal,
      credentials: 'omit',
      cache: 'no-store'
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: CONFIG.TEXT.network, network: true };
  } finally {
    clearTimeout(timer);
  }
};

const toHex = buffer => Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, '0')).join('');

const derive = async (name, password) => {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(password.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: encoder.encode(name.trim().toLowerCase() + CONFIG.PBKDF2.saltSuffix),
      iterations: CONFIG.PBKDF2.iterations
    },
    key,
    256
  );
  return toHex(bits);
};

const hasCrypto = () => Boolean(window.crypto && window.crypto.subtle);

const warm = { key: '', promise: null, timer: 0 };

const deriveCached = (name, pass) => {
  const key = `${name.trim().toLowerCase()}\u0000${pass}`;
  if (warm.key !== key) {
    warm.key = key;
    warm.promise = derive(name, pass).catch(error => {
      warm.key = '';
      warm.promise = null;
      throw error;
    });
  }
  return warm.promise;
};

const dropWarm = () => {
  clearTimeout(warm.timer);
  warm.key = '';
  warm.promise = null;
};

const schedulePrecompute = mode => {
  clearTimeout(warm.timer);
  warm.timer = setTimeout(() => {
    if (!hasCrypto()) return;
    const prefix = mode === 'login' ? '#login' : '#reg';
    const name = $(`${prefix}-name`).value.trim();
    const pass = $(`${prefix}-pass`).value;
    const rules = CONFIG.RULES;
    if (!name || !pass) return;
    if (mode === 'register' && (!nameRule.test(name) || pass.length < rules.passMin || pass.length > rules.passMax)) return;
    deriveCached(name, pass).catch(() => {});
  }, CONFIG.PRECOMPUTE_DELAY_MS);
};

const setStatus = (element, text, tone = 'error') => {
  element.textContent = text || '';
  element.dataset.tone = text ? tone : '';
};

const setBusy = (form, busy, label) => {
  state.busy = busy;
  const button = $('button[type="submit"]', form);
  const text = $('.label', button);
  if (!button.dataset.label) button.dataset.label = text.textContent;
  button.disabled = busy;
  button.setAttribute('aria-busy', String(busy));
  text.textContent = busy ? label : button.dataset.label;
};

const flag = (statusElement, text, input) => {
  setStatus(statusElement, text);
  if (input) {
    input.setAttribute('aria-invalid', 'true');
    input.focus();
  }
};

const showView = (name, focus = false) => {
  Object.entries(views).forEach(([key, element]) => {
    element.hidden = key !== name;
  });
  if (!focus) return;
  if (name === 'account') $('#acc-name').focus({ preventScroll: true });
  if (name === 'auth') $(`#tab-${state.tab}`).focus({ preventScroll: true });
};

const setTab = name => {
  state.tab = name;
  $('.tabs').dataset.active = name;
  $$('[data-tab]').forEach(button => {
    const active = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(active));
    button.tabIndex = active ? 0 : -1;
  });
  $('#form-login').hidden = name !== 'login';
  $('#form-register').hidden = name !== 'register';
  setStatus($('#login-status'), '');
  setStatus($('#register-status'), '');
};

const syncRole = () => {
  const role = $('input[name="role"]:checked').value;
  const open = CONFIG.PRIVILEGED_ROLES.includes(role);
  const reveal = $('#code-reveal');
  reveal.dataset.open = String(open);
  reveal.inert = !open;
  if (!open) $('#reg-code').value = '';
};

const fileError = file => !file || !/^image\//.test(file.type) || file.size > CONFIG.AVATAR.maxBytes || (file.type === 'image/gif' && file.size > CONFIG.AVATAR.animatedMax);

const readFile = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

const prepareAvatar = async file => {
  if (file.type === 'image/gif') return readFile(file);
  const bitmap = await createImageBitmap(file);
  const size = CONFIG.AVATAR.size;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  if (typeof bitmap.close === 'function') bitmap.close();
  return canvas.toDataURL('image/jpeg', CONFIG.AVATAR.quality);
};

const setAvatar = (src, name) => {
  const image = $('#avatar-img');
  const fallback = $('#avatar-fallback');
  fallback.textContent = (Array.from(name || '')[0] || '').toUpperCase();
  if (src) {
    image.src = src;
    image.hidden = false;
    fallback.hidden = true;
  } else {
    image.removeAttribute('src');
    image.hidden = true;
    fallback.hidden = false;
  }
};

const renderAvatar = user => {
  const usable = typeof user.img === 'string' && /^https:\/\//.test(user.img);
  setAvatar(usable ? user.img : '', user.name);
  $('#avatar-btn').dataset.role = user.role;
  $('#avatar-action .label').textContent = CONFIG.TEXT.avatarAdd;
  $('#avatar-action').hidden = usable;
  $('#avatar-btn').disabled = usable;
  $('#avatar-btn .avatar-badge').hidden = usable;
};

const setAvatarBusy = busy => {
  state.uploading = busy;
  $('#avatar-busy').hidden = !busy;
  $('#avatar-action').disabled = busy;
  if (busy) $('#avatar-action .label').textContent = CONFIG.TEXT.avatarBusy;
};

const renderMessages = messages => {
  const list = $('#msg-list');
  list.replaceChildren();
  messages.forEach(message => {
    const item = document.createElement('li');
    const icon = document.createElement('i');
    icon.className = 'fa-regular fa-envelope';
    icon.setAttribute('aria-hidden', 'true');
    const text = document.createElement('span');
    text.textContent = message;
    item.append(icon, text);
    list.append(item);
  });
  $('#msg-empty').hidden = messages.length > 0;
  list.hidden = messages.length === 0;
};

const renderAccount = user => {
  $('#acc-name').textContent = user.name;
  const role = $('#acc-role');
  role.textContent = user.role;
  role.dataset.role = user.role;
  $('#acc-age').textContent = `${user.age} ${CONFIG.TEXT.yearsSuffix}`;
  const stat = $('#acc-stat');
  stat.textContent = CONFIG.TEXT.stat[user.stat] || user.stat;
  stat.dataset.stat = user.stat;
  const approved = user.stat === CONFIG.TEXT.states.approved;
  $('#pending-note').hidden = approved;
  const enter = $('#enter-link');
  if (approved) {
    enter.setAttribute('href', CONFIG.HOME_URL);
    enter.removeAttribute('aria-disabled');
    enter.removeAttribute('tabindex');
  } else {
    enter.removeAttribute('href');
    enter.setAttribute('aria-disabled', 'true');
    enter.setAttribute('tabindex', '-1');
  }
  renderAvatar(user);
  renderMessages(Array.isArray(user.msgs) ? user.msgs : []);
};

const clearDraft = () => {
  state.draft = '';
  $('#reg-avatar-img').removeAttribute('src');
  $('#reg-avatar-img').hidden = true;
  $('#reg-avatar-fallback').hidden = false;
};

const uploadAvatar = async dataUrl => {
  if (state.uploading) return;
  const status = $('#account-status');
  const user = session.user();
  setStatus(status, '');
  setAvatarBusy(true);
  setAvatar(dataUrl, user ? user.name : '');
  const result = await api('avatar', { token: session.token(), image: dataUrl.split(',')[1] });
  setAvatarBusy(false);
  if (result.ok) {
    session.save(null, result.user);
    renderAccount(result.user);
    setStatus(status, CONFIG.TEXT.imageDone, 'ok');
    return;
  }
  if (user) renderAvatar(user);
  if (result.auth) return expire(result.error);
  setStatus(status, result.error || CONFIG.TEXT.generic);
};

const finishAuth = result => {
  const draft = state.draft;
  session.save(result.token, result.user);
  dropWarm();
  $$('form').forEach(form => form.reset());
  clearDraft();
  syncRole();
  renderAccount(result.user);
  showView('account', true);
  if (draft) uploadAvatar(draft);
};

const expire = message => {
  session.clear();
  dropWarm();
  setTab('login');
  showView('auth', true);
  setStatus($('#login-status'), message || CONFIG.TEXT.sessionExpired, 'info');
};

const onLogin = async event => {
  event.preventDefault();
  if (state.busy) return;
  const form = event.currentTarget;
  const status = $('#login-status');
  const nameInput = $('#login-name');
  const passInput = $('#login-pass');
  const name = nameInput.value.trim();
  const pass = passInput.value;
  setStatus(status, '');
  if (!name) return flag(status, CONFIG.TEXT.fillAll, nameInput);
  if (!pass) return flag(status, CONFIG.TEXT.fillAll, passInput);
  if (!hasCrypto()) return setStatus(status, CONFIG.TEXT.cryptoMissing);
  setBusy(form, true, CONFIG.TEXT.loginBusy);
  try {
    const pw = await deriveCached(name, pass);
    const result = await api('login', { name, pw });
    if (!result.ok) return setStatus(status, result.error || CONFIG.TEXT.generic);
    finishAuth(result);
  } finally {
    setBusy(form, false);
  }
};

const onRegister = async event => {
  event.preventDefault();
  if (state.busy) return;
  const form = event.currentTarget;
  const status = $('#register-status');
  const nameInput = $('#reg-name');
  const passInput = $('#reg-pass');
  const ageInput = $('#reg-age');
  const codeInput = $('#reg-code');
  const name = nameInput.value.trim();
  const pass = passInput.value;
  const age = Number(ageInput.value);
  const role = $('input[name="role"]:checked', form).value;
  const code = codeInput.value.trim();
  const rules = CONFIG.RULES;
  setStatus(status, '');
  if (!nameRule.test(name)) return flag(status, CONFIG.TEXT.badName, nameInput);
  if (pass.length < rules.passMin || pass.length > rules.passMax) return flag(status, CONFIG.TEXT.badPass, passInput);
  if (!Number.isInteger(age) || age < rules.ageMin || age > rules.ageMax) return flag(status, CONFIG.TEXT.badAge, ageInput);
  const privileged = CONFIG.PRIVILEGED_ROLES.includes(role);
  if (privileged && !code) return flag(status, CONFIG.TEXT.needCode, codeInput);
  if (!hasCrypto()) return setStatus(status, CONFIG.TEXT.cryptoMissing);
  setBusy(form, true, CONFIG.TEXT.registerBusy);
  try {
    const pw = await deriveCached(name, pass);
    const payload = { name, pw, age, role };
    if (privileged) payload.code = code;
    const result = await api('register', payload);
    if (!result.ok) return setStatus(status, result.error || CONFIG.TEXT.generic);
    finishAuth(result);
  } finally {
    setBusy(form, false);
  }
};

const onDraftPick = async event => {
  const input = event.currentTarget;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file) return;
  const status = $('#register-status');
  if (fileError(file)) return setStatus(status, CONFIG.TEXT.badImage);
  try {
    const dataUrl = await prepareAvatar(file);
    state.draft = dataUrl;
    const image = $('#reg-avatar-img');
    image.src = dataUrl;
    image.hidden = false;
    $('#reg-avatar-fallback').hidden = true;
    setStatus(status, '');
  } catch (error) {
    setStatus(status, CONFIG.TEXT.badImage);
  }
};

const onAvatarPick = async event => {
  const input = event.currentTarget;
  const file = input.files && input.files[0];
  input.value = '';
  if (!file || state.uploading) return;
  const status = $('#account-status');
  if (fileError(file)) return setStatus(status, CONFIG.TEXT.badImage);
  try {
    uploadAvatar(await prepareAvatar(file));
  } catch (error) {
    setStatus(status, CONFIG.TEXT.badImage);
  }
};

const onLogout = () => {
  session.clear();
  dropWarm();
  $$('form').forEach(form => form.reset());
  clearDraft();
  syncRole();
  setStatus($('#account-status'), '');
  setTab('login');
  showView('auth', true);
};

const onToggle = event => {
  const button = event.currentTarget;
  const input = document.getElementById(button.dataset.toggle);
  const reveal = input.type === 'password';
  input.type = reveal ? 'text' : 'password';
  button.setAttribute('aria-label', reveal ? CONFIG.TEXT.hideSecret : CONFIG.TEXT.showSecret);
  button.firstElementChild.className = reveal ? 'fa-regular fa-eye-slash fa-fw' : 'fa-regular fa-eye fa-fw';
};

const onTabKeys = event => {
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
  const next = state.tab === 'login' ? 'register' : 'login';
  setTab(next);
  $(`#tab-${next}`).focus();
};

const bind = () => {
  $$('[data-tab]').forEach(button => button.addEventListener('click', () => setTab(button.dataset.tab)));
  $('.tabs').addEventListener('keydown', onTabKeys);
  $('#form-login').addEventListener('submit', onLogin);
  $('#form-register').addEventListener('submit', onRegister);
  $('#form-login').addEventListener('input', () => schedulePrecompute('login'));
  $('#form-register').addEventListener('input', () => schedulePrecompute('register'));
  $$('input[name="role"]').forEach(radio => radio.addEventListener('change', syncRole));
  $$('[data-toggle]').forEach(button => button.addEventListener('click', onToggle));
  $('#reg-avatar-btn').addEventListener('click', () => $('#reg-avatar-input').click());
  $('#reg-avatar-input').addEventListener('change', onDraftPick);
  $('#avatar-btn').addEventListener('click', () => $('#avatar-input').click());
  $('#avatar-action').addEventListener('click', () => $('#avatar-input').click());
  $('#avatar-input').addEventListener('change', onAvatarPick);
  $('#logout-btn').addEventListener('click', onLogout);
  $('#avatar-img').addEventListener('error', () => {
    $('#avatar-img').hidden = true;
    $('#avatar-fallback').hidden = false;
  });
  document.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement) event.target.removeAttribute('aria-invalid');
  });
};

const boot = async () => {
  bind();
  syncRole();
  const token = session.token();
  const cached = session.user();
  if (token && cached) {
    renderAccount(cached);
    showView('account');
    if (Date.now() - session.checkedAt() < CONFIG.FRESH_MS) return;
    const result = await api('session', { token });
    if (result.ok) {
      session.save(result.token, result.user);
      renderAccount(result.user);
    } else if (result.auth) {
      expire(result.error);
    }
    return;
  }
  if (token) {
    const result = await api('session', { token });
    if (result.ok) {
      session.save(result.token, result.user);
      renderAccount(result.user);
      showView('account');
      return;
    }
    if (result.auth) session.clear();
  }
  showView('auth');
  api('warm');
};

boot();