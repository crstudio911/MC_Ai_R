import { 
  db, 
  rtdb, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where,
  ref,
  set,
  get,
  update,
  authReady,
  authStatus
} from './firebase-config.js';
import { prepareImage, uploadAvatar, describeError } from './upload.js';
import { derivePasswordHash } from './hash.js';
const CONFIG = {
  HOME_URL: 'main/main.html',
  STORAGE_KEYS: { token: 'mcr_token', user: 'mcr_user' },
  PBKDF2: { iterations: 100000, saltSuffix: ':mc_ai_r:firebase:v1' },
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
    wrongCode: 'كود الصلاحية غير صحيح',
    nameTaken: 'هذا الاسم مستخدم بالفعل',
    badLogin: 'الاسم أو كلمة المرور غير صحيحة',
    blocked: 'تم حظر هذا الحساب',
    generic: 'حدث خطأ غير متوقع',
    photoOnce: 'تم رفع صورة لهذا الحساب من قبل ولا يمكن تغييرها',
    photoDone: 'تم رفع الصورة بنجاح',
    photoLater: 'تم إنشاء الحساب لكن تعذر رفع الصورة، يمكنك رفعها لاحقا من حسابك',
    photoBusy: 'جار رفع الصورة...',
    noAccess: 'تعذر الاتصال بقاعدة البيانات: تأكد من مفتاح apiKey وتفعيل الدخول المجهول (Anonymous) في Firebase',
    keyMissing: 'مفتاح Firebase غير مضبوط: ضع الـ apiKey الحقيقي (يبدأ بـ AIza) داخل firebase-config.js',
    anonOff: 'الدخول المجهول غير مفعل: فعّل Anonymous من Firebase Authentication ثم Sign-in method',
    offline: 'تعذر الوصول إلى خوادم Firebase: تأكد من الاتصال بالإنترنت',
    loginBusy: 'جار التحقق...',
    registerBusy: 'جار إنشاء الحساب...',
    stat: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور' }
  }
};
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
const nameRule = new RegExp(CONFIG.RULES.namePattern, 'u');
const storage = {
  read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
  remove(k) { try { localStorage.removeItem(k); } catch (e) {} }
};
function hashPassword(username, password) {
  return derivePasswordHash(password, username.toLowerCase() + CONFIG.PBKDF2.saltSuffix, CONFIG.PBKDF2.iterations);
}
const state = { user: null, regBlob: null, regPreview: '' };
const views = {
  loading: $('#view-loading'),
  auth: $('#view-auth'),
  account: $('#view-account')
};
function showView(name) {
  Object.keys(views).forEach(k => {
    if (views[k]) views[k].hidden = (k !== name);
  });
}
function accessText() {
  let text = CONFIG.TEXT.noAccess;
  if (authStatus.error === 'key') text = CONFIG.TEXT.keyMissing;
  if (authStatus.error === 'anonymous') text = CONFIG.TEXT.anonOff;
  if (authStatus.error === 'network') text = CONFIG.TEXT.offline;
  return authStatus.code ? text + ' [' + authStatus.code + ']' : text;
}
function setMsg(id, text, isOk = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = isOk ? 'var(--ok, #4cc38a)' : 'var(--danger, #ff7b7b)';
}
function initTabs() {
  const tabs = $('.tabs');
  const tabLogin = $('#tab-login');
  const tabReg = $('#tab-register');
  const formLogin = $('#form-login');
  const formReg = $('#form-register');
  const codeReveal = $('#code-reveal');
  const select = name => {
    const isLogin = name === 'login';
    tabs.dataset.active = name;
    tabLogin.setAttribute('aria-selected', String(isLogin));
    tabLogin.tabIndex = isLogin ? 0 : -1;
    tabReg.setAttribute('aria-selected', String(!isLogin));
    tabReg.tabIndex = isLogin ? -1 : 0;
    formLogin.hidden = !isLogin;
    formReg.hidden = isLogin;
  };
  if (tabs && tabLogin && tabReg) {
    tabLogin.onclick = () => select('login');
    tabReg.onclick = () => select('register');
  }
  $$('input[name="role"]').forEach(r => {
    r.onchange = () => {
      const isPriv = CONFIG.PRIVILEGED_ROLES.includes(r.value);
      if (codeReveal) {
        codeReveal.dataset.open = String(isPriv);
        codeReveal.inert = !isPriv;
      }
    };
  });
  $$('[data-toggle]').forEach(btn => {
    btn.onclick = () => {
      const targetId = btn.dataset.toggle;
      const input = $('#' + targetId);
      if (input) {
        input.type = input.type === 'password' ? 'text' : 'password';
      }
    };
  });
}
function initAvatars() {
  const regInput = $('#reg-avatar-input');
  const regBtn = $('#reg-avatar-btn');
  const regImg = $('#reg-avatar-img');
  const regFallback = $('#reg-avatar-fallback');
  regBtn.onclick = () => regInput.click();
  regInput.onchange = async () => {
    const file = regInput.files[0];
    regInput.value = '';
    if (!file) return;
    setMsg('#register-status', '');
    try {
      const blob = await prepareImage(file);
      if (state.regPreview) URL.revokeObjectURL(state.regPreview);
      state.regBlob = blob;
      state.regPreview = URL.createObjectURL(blob);
      regImg.src = state.regPreview;
      regImg.hidden = false;
      regFallback.hidden = true;
    } catch (err) {
      console.error(err);
      setMsg('#register-status', describeError(err));
    }
  };
  const accBtn = $('#avatar-btn');
  const accAction = $('#avatar-action');
  const accInput = $('#avatar-input');
  const askFile = () => {
    const u = state.user;
    if (!u) return;
    if (u.img_url) return setMsg('#account-status', CONFIG.TEXT.photoOnce);
    accInput.click();
  };
  accBtn.onclick = askFile;
  accAction.onclick = askFile;
  accInput.onchange = async () => {
    const file = accInput.files[0];
    accInput.value = '';
    const u = state.user;
    if (!file || !u) return;
    const busy = $('#avatar-busy');
    setMsg('#account-status', CONFIG.TEXT.photoBusy, true);
    busy.hidden = false;
    accAction.disabled = true;
    try {
      const fresh = await getDoc(doc(db, 'users', u.id));
      if (fresh.exists() && fresh.data().img_url) {
        u.img_url = fresh.data().img_url;
        storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(u));
        renderAccountView(u);
        return setMsg('#account-status', CONFIG.TEXT.photoOnce);
      }
      const blob = await prepareImage(file);
      const url = await uploadAvatar(blob);
      await updateDoc(doc(db, 'users', u.id), { img_url: url });
      await mirror(u.id, { img_url: url });
      u.img_url = url;
      storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(u));
      renderAccountView(u);
      setMsg('#account-status', CONFIG.TEXT.photoDone, true);
    } catch (err) {
      console.error(err);
      setMsg('#account-status', err && err.code === 'permission-denied' ? CONFIG.TEXT.noAccess : describeError(err));
    } finally {
      busy.hidden = true;
      accAction.disabled = false;
    }
  };
}
async function mirror(uid, data) {
  try {
    await update(ref(rtdb, 'users/' + uid), data);
  } catch (e) {
    console.warn(e);
  }
}
function publicUser(u) {
  const copy = { ...u };
  delete copy.password;
  return copy;
}
async function verifyAccessCode(role, code) {
  if (!code) return false;
  const wanted = code.trim().toUpperCase();
  try {
    const q = query(collection(db, 'scr_code'), where('role', '==', role));
    const snap = await getDocs(q);
    if (snap.empty) {
      const rSnap = await get(ref(rtdb, 'scr_code/' + role));
      return rSnap.exists() && String(rSnap.val()).trim().toUpperCase() === wanted;
    }
    let matched = false;
    snap.forEach(d => {
      if (String(d.data().code || '').trim().toUpperCase() === wanted) matched = true;
    });
    return matched;
  } catch (e) {
    console.error('Code verification error:', e);
    if (e && e.code === 'permission-denied') return null;
    return false;
  }
}
async function handleLogin(e) {
  e.preventDefault();
  const name = $('#login-name').value.trim();
  const pass = $('#login-pass').value;
  setMsg('#login-status', '');
  if (!name || !pass) {
    return setMsg('#login-status', CONFIG.TEXT.fillAll);
  }
  setMsg('#login-status', CONFIG.TEXT.loginBusy, true);
  try {
    const hash = await hashPassword(name, pass);
    const q = query(collection(db, 'users'), where('name', '==', name));
    const snap = await getDocs(q);
    if (snap.empty) {
      return setMsg('#login-status', CONFIG.TEXT.badLogin);
    }
    let user = null;
    let uid = null;
    snap.forEach(d => {
      user = d.data();
      uid = d.id;
    });
    if (!user || user.password !== hash) {
      return setMsg('#login-status', CONFIG.TEXT.badLogin);
    }
    if (user.stat === 'ban') {
      return setMsg('#login-status', CONFIG.TEXT.blocked);
    }
    user.id = uid;
    storage.write(CONFIG.STORAGE_KEYS.token, uid);
    storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(publicUser(user)));
    if (user.stat === 'done') {
      location.replace(CONFIG.HOME_URL);
    } else {
      renderAccountView(user);
    }
  } catch (err) {
    console.error(err);
    setMsg('#login-status', err && err.code === 'permission-denied' ? CONFIG.TEXT.noAccess : CONFIG.TEXT.generic);
  }
}
async function handleRegister(e) {
  e.preventDefault();
  const name = $('#reg-name').value.trim();
  const pass = $('#reg-pass').value;
  const age = Number($('#reg-age').value);
  const role = ($('input[name="role"]:checked') || {}).value || 'Moderator';
  const code = role !== 'Moderator' ? $('#reg-code').value.trim() : '';
  setMsg('#register-status', '');
  if (!nameRule.test(name)) return setMsg('#register-status', CONFIG.TEXT.badName);
  if (pass.length < CONFIG.RULES.passMin || pass.length > CONFIG.RULES.passMax) return setMsg('#register-status', CONFIG.TEXT.badPass);
  if (!Number.isInteger(age) || age < CONFIG.RULES.ageMin || age > CONFIG.RULES.ageMax) return setMsg('#register-status', CONFIG.TEXT.badAge);
  if (CONFIG.PRIVILEGED_ROLES.includes(role)) {
    if (!code) return setMsg('#register-status', CONFIG.TEXT.needCode);
    const ok = await verifyAccessCode(role, code);
    if (ok === null) return setMsg('#register-status', CONFIG.TEXT.noAccess);
    if (!ok) return setMsg('#register-status', CONFIG.TEXT.wrongCode);
  }
  setMsg('#register-status', CONFIG.TEXT.registerBusy, true);
  try {
    const q = query(collection(db, 'users'), where('name', '==', name));
    const existSnap = await getDocs(q);
    if (!existSnap.empty) {
      return setMsg('#register-status', CONFIG.TEXT.nameTaken);
    }
    const hash = await hashPassword(name, pass);
    const uid = 'usr_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const initialStat = role === 'OWNER' ? 'done' : 'm3lk';
    let imgUrl = '';
    let photoFailed = false;
    if (state.regBlob) {
      setMsg('#register-status', CONFIG.TEXT.photoBusy, true);
      try {
        imgUrl = await uploadAvatar(state.regBlob);
      } catch (upErr) {
        console.error(upErr);
        photoFailed = true;
      }
    }
    const newUser = {
      id: uid,
      name,
      password: hash,
      age,
      role,
      stat: initialStat,
      img_url: imgUrl,
      msg: '',
      msg2: '',
      msg3: '',
      created_at: new Date().toISOString()
    };
    await setDoc(doc(db, 'users', uid), newUser);
    try {
      await set(ref(rtdb, 'users/' + uid), newUser);
    } catch (rtErr) {
      console.warn(rtErr);
    }
    storage.write(CONFIG.STORAGE_KEYS.token, uid);
    storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(publicUser(newUser)));
    if (newUser.stat === 'done') {
      location.replace(CONFIG.HOME_URL);
    } else {
      renderAccountView(newUser);
      if (photoFailed) setMsg('#account-status', CONFIG.TEXT.photoLater);
    }
  } catch (err) {
    console.error(err);
    setMsg('#register-status', err && err.code === 'permission-denied' ? CONFIG.TEXT.noAccess : CONFIG.TEXT.generic);
  }
}
function renderAccountView(u) {
  state.user = u;
  showView('account');
  $('#acc-name').textContent = u.name;
  $('#acc-role').textContent = u.role;
  $('#acc-role').dataset.role = u.role;
  $('#avatar-btn').dataset.role = u.role;
  $('#acc-age').textContent = u.age + ' سنة';
  $('#acc-stat').textContent = CONFIG.TEXT.stat[u.stat] || u.stat;
  $('#acc-stat').dataset.stat = u.stat;
  $('#avatar-fallback').textContent = (Array.from(u.name)[0] || '').toUpperCase();
  const img = $('#avatar-img');
  img.onerror = () => { img.hidden = true; };
  img.hidden = !u.img_url;
  if (u.img_url) img.src = u.img_url;
  $('#avatar-action').hidden = Boolean(u.img_url);
  $('#pending-note').hidden = (u.stat === 'done');
  $('#enter-link').hidden = (u.stat !== 'done');
  const msgs = [u.msg, u.msg2, u.msg3].filter(Boolean);
  const list = $('#msg-list');
  list.replaceChildren(...msgs.map(m => { const li = document.createElement('li'); li.textContent = m; return li; }));
  $('#msg-empty').hidden = msgs.length > 0;
  $('#logout-btn').onclick = () => {
    storage.remove(CONFIG.STORAGE_KEYS.token);
    storage.remove(CONFIG.STORAGE_KEYS.user);
    location.reload();
  };
}
async function checkStoredSession() {
  const token = storage.read(CONFIG.STORAGE_KEYS.token);
  if (!token) {
    showView('auth');
    return;
  }
  try {
    const snap = await getDoc(doc(db, 'users', token));
    if (snap.exists()) {
      const u = snap.data();
      u.id = snap.id;
      if (u.stat === 'ban') {
        storage.remove(CONFIG.STORAGE_KEYS.token);
        storage.remove(CONFIG.STORAGE_KEYS.user);
        showView('auth');
        setMsg('#login-status', CONFIG.TEXT.blocked);
        return;
      }
      storage.write(CONFIG.STORAGE_KEYS.user, JSON.stringify(publicUser(u)));
      if (u.stat === 'done') {
        location.replace(CONFIG.HOME_URL);
        return;
      }
      renderAccountView(u);
    } else {
      showView('auth');
    }
  } catch (e) {
    console.warn(e);
    showView('auth');
    if (e && e.code === 'permission-denied') setMsg('#login-status', CONFIG.TEXT.noAccess);
  }
}
initTabs();
initAvatars();
$('#form-login').onsubmit = handleLogin;
$('#form-register').onsubmit = handleRegister;
authReady.then(user => {
  if (!user) {
    showView('auth');
    setMsg('#login-status', accessText());
    setMsg('#register-status', accessText());
    return;
  }
  checkStoredSession();
});
