const C = {
  API: 'https://script.google.com/macros/s/AKfycbxHbBkEpV9a7xVqjFBBSxXdt8Ii5mTCieN03dtNch3IHCz2HA9qo5EXgGhg0lEjt2vk/exec',
  LOGIN: '../index.html',
  K: { t: 'mcr_token', u: 'mcr_user', c: 'mcr_checked', a: 'mcr_auto', n: 'mcr_nav' },
  WARM_MS: 300000,
  HOST: 'https://i.ibb.co/',
  NET: 'تعذر الاتصال بالخادم',
  ROLE: { OWNER: 'المالك', Admen: 'أدمن', Moderator: 'موديريتور' },
  STAT: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور', active: 'نشط', inactive: 'متوقف' },
  KIND: { trial: 'كود تجريبي', regular: 'كود حقيقي', recharge: 'شحن' }
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const when = v => v ? new Date(v).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { return; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { return; } }
};
const S = { user: null, view: '', timer: 0, auto: false };
const isOwner = () => S.user.role === 'OWNER';

const leave = () => {
  Object.values(C.K).forEach(k => store.del(k));
  location.replace(C.LOGIN);
};

const api = async (action, payload = {}) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 30000);
  try {
    const r = await fetch(C.API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, token: store.get(C.K.t), ...payload }),
      signal: ctl.signal,
      credentials: 'omit',
      cache: 'no-store'
    });
    const out = await r.json();
    if (out.auth) leave();
    return out;
  } catch (e) {
    return { ok: false, error: C.NET };
  } finally {
    clearTimeout(t);
  }
};
const rs = (op, p = {}) => api('rs', { op, ...p });

const derive = async (name, pass) => {
  const e = new TextEncoder();
  const k = await crypto.subtle.importKey('raw', e.encode(pass.normalize('NFC')), 'PBKDF2', false, ['deriveBits']);
  const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: e.encode(name.trim().toLowerCase() + ':mc_ai_r:v1'), iterations: 150000 }, k, 256);
  return Array.from(new Uint8Array(b), x => x.toString(16).padStart(2, '0')).join('');
};

const toast = (text, tone = 'ok') => {
  const el = $('#toast');
  el.textContent = text;
  el.dataset.tone = tone;
  el.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => { el.hidden = true; }, 3400);
};

const dlg = $('#dlg');
const modal = (title, body, ok, run) => new Promise(done => {
  $('#dlg-title').textContent = title;
  $('#dlg-body').innerHTML = body;
  $('#dlg-err').textContent = '';
  const okBtn = $('#dlg-ok');
  okBtn.textContent = ok || 'تأكيد';
  okBtn.hidden = !run;
  okBtn.disabled = false;
  const close = v => { dlg.close(); done(v); };
  okBtn.onclick = async () => {
    okBtn.disabled = true;
    const msg = await run(dlg);
    okBtn.disabled = false;
    if (msg) $('#dlg-err').textContent = msg;
    else close(true);
  };
  $('#dlg-cancel').onclick = () => close(false);
  dlg.oncancel = () => done(false);
  dlg.showModal();
});

const avatar = (u, cls = '') => {
  const ok = typeof u.img === 'string' && u.img.startsWith(C.HOST);
  const letter = (Array.from(u.name || '')[0] || '').toUpperCase();
  return `<span class="ava ${cls}"><span>${esc(letter)}</span>${ok ? `<img src="${esc(u.img)}" alt="" referrerpolicy="no-referrer">` : ''}</span>`;
};

const NAV = {
  overview: { icon: 'fa-gauge-high', label: 'نظرة عامة', roles: ['OWNER'] },
  keys: { icon: 'fa-key', label: 'الأكواد', roles: ['Moderator', 'Admen', 'OWNER'] },
  team: { icon: 'fa-users', label: 'الفريق', roles: ['Admen', 'OWNER'] },
  server: { icon: 'fa-server', label: 'السيرفر', roles: ['OWNER'] },
  profile: { icon: 'fa-user', label: 'الملف الشخصي', roles: ['Moderator', 'Admen', 'OWNER'] }
};

const setNav = open => {
  $('#nav').dataset.open = String(open);
  $('#nav-tg').setAttribute('aria-expanded', String(open));
  $('#nav-tg').setAttribute('aria-label', open ? 'طي القائمة' : 'توسيع القائمة');
  $('#scrim').hidden = !(open && matchMedia('(max-width:760px)').matches);
  store.set(C.K.n, open ? '1' : '0');
};

const buildNav = () => {
  $('#nav-items').innerHTML = Object.entries(NAV).filter(([, v]) => v.roles.includes(S.user.role))
    .map(([k, v]) => `<button type="button" data-go="${k}" title="${v.label}"><i class="fa-solid ${v.icon}"></i><span>${v.label}</span></button>`).join('')
    + '<span class="sp"></span><button type="button" class="out" id="out" title="تسجيل الخروج"><i class="fa-solid fa-right-from-bracket"></i><span>تسجيل الخروج</span></button>';
  $$('[data-go]').forEach(b => b.onclick = () => { go(b.dataset.go); if (matchMedia('(max-width:760px)').matches) setNav(false); });
  $('#out').onclick = leave;
  $('#nav-tg').onclick = () => setNav($('#nav').dataset.open !== 'true');
  $('#scrim').onclick = () => setNav(false);
  setNav(!matchMedia('(max-width:760px)').matches && store.get(C.K.n) === '1');
};

const paintMe = () => {
  const u = S.user;
  $('#me-name').textContent = u.name;
  const r = $('#me-role');
  r.textContent = C.ROLE[u.role] || u.role;
  r.dataset.role = u.role;
  const ok = typeof u.img === 'string' && u.img.startsWith(C.HOST);
  $('#me-fb').textContent = (Array.from(u.name)[0] || '').toUpperCase();
  const img = $('#me-img');
  img.hidden = !ok;
  if (ok) img.src = u.img;
};

const countUp = el => {
  const to = Number(el.dataset.n) || 0;
  const t0 = performance.now();
  const step = t => {
    const p = Math.min(1, (t - t0) / 900);
    el.textContent = num(to * (1 - Math.pow(1 - p, 3)));
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
};
const polish = () => {
  $$('[data-n]').forEach(countUp);
  requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]').forEach(e => { e.style.width = e.dataset.w + '%'; })));
};
const stage = html => { $('#stage').innerHTML = html; $('#stage').onclick = null; polish(); };
const loading = () => stage('<p class="empty"><span class="spin"></span></p>');
const fault = r => `<p class="msg">${esc((r && r.error) || C.NET)}</p>`;

const go = async name => {
  if (!NAV[name] || !NAV[name].roles.includes(S.user.role)) name = 'profile';
  S.view = name;
  $$('[data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === name)));
  loading();
  try {
    await views[name]();
  } catch (e) {
    stage(`<p class="msg">${esc(C.NET)}</p>`);
  }
};

const copy = async text => {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch (e) { toast('تعذر النسخ', 'err'); }
};

const pickKey = d => {
  if (!d) return '';
  const n = d.data || d.license || d.key_data || {};
  return d.key || d.license_key || n.key || n.license_key || '';
};

const stat = (icon, label, value, tone = '') => `<div class="stat" data-t="${tone}"><span class="ic"><i class="fa-solid ${icon}"></i></span><div><span>${label}</span><b data-n="${Number(value) || 0}">0</b></div></div>`;

const chartSvg = d => {
  const W = 640, H = 190, P = 14;
  const max = Math.max(1, ...d.map(x => x.trial + x.regular));
  const bw = (W - P * 2) / d.length;
  const grid = [0, .5, 1].map(f => `<line class="gl" x1="0" x2="${W}" y1="${H - f * H}" y2="${H - f * H}"/>`).join('');
  const bars = d.map((x, i) => {
    const h1 = x.regular / max * H, h2 = x.trial / max * H, X = P + i * bw + bw * .17, w = bw * .66;
    return `<rect x="${X}" y="${H - h1}" width="${w}" height="${h1}" rx="5" fill="url(#cg1)"/><rect x="${X}" y="${H - h1 - h2}" width="${w}" height="${h2}" rx="5" fill="url(#cg2)"/><text class="ax" x="${X + w / 2}" y="${H + 18}">${esc(x.d.slice(8))}</text>`;
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H + 26}" role="img" aria-label="نشاط آخر 14 يوما"><defs><linearGradient id="cg1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa2ff"/><stop offset="1" stop-color="#6a5cff" stop-opacity=".5"/></linearGradient><linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4de1c1"/><stop offset="1" stop-color="#4de1c1" stop-opacity=".4"/></linearGradient></defs>${grid}${bars}</svg>`;
};

const donutSvg = c => {
  const parts = [['done', '#4de1c1'], ['m3lk', '#f2c46d'], ['ban', '#ff8a8a']];
  const total = parts.reduce((a, [k]) => a + (c[k] || 0), 0);
  const R = 42, L = 2 * Math.PI * R;
  let off = 0;
  const segs = total ? parts.map(([k, col]) => {
    const len = (c[k] || 0) / total * L;
    const s = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${col}" stroke-width="14" stroke-dasharray="${len} ${L - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"/>`;
    off += len;
    return s;
  }).join('') : '';
  return `<div class="donut"><svg viewBox="0 0 120 120" role="img" aria-label="حالات الحسابات"><circle cx="60" cy="60" r="${R}" fill="none" stroke="#ffffff14" stroke-width="14"/>${segs}<text class="tx" x="60" y="68">${num(total)}</text></svg><ul>${parts.map(([k, col]) => `<li><i class="k-${k}"></i>${C.STAT[k]}: <b>${num(c[k])}</b></li>`).join('')}</ul></div>`;
};

const keyRow = k => `<div class="item"><div class="info"><b class="latin">${esc(k.key)} <span class="pill ${esc(k.status)}">${esc(C.STAT[k.status] || k.status)}</span></b><small>${esc(k.customer_name || '-')} · ${num(k.credits)} نقطة · تبديل ${num(k.daily_switch_limit)} / ${num(k.switch_cooldown_seconds)}ث</small></div>
<div class="acts"><button type="button" class="btn ghost sm" data-a="copy" data-k="${esc(k.key)}"><i class="fa-regular fa-copy"></i>نسخ</button>
<button type="button" class="btn ghost sm" data-a="charge" data-k="${esc(k.key)}"><i class="fa-solid fa-bolt"></i>شحن</button>
<button type="button" class="btn ghost sm" data-a="edit" data-k="${esc(k.key)}" data-n="${esc(k.customer_name || '')}"><i class="fa-solid fa-pen"></i>تعديل</button>
<button type="button" class="btn ${k.status === 'active' ? 'danger' : 'ghost'} sm" data-a="tog" data-k="${esc(k.key)}" data-s="${esc(k.status)}">${k.status === 'active' ? 'إيقاف' : 'تفعيل'}</button></div></div>`;

const passDialog = m => modal('كلمة مرور جديدة', `<p class="empty">${esc(m.name)}</p><div class="f"><label for="m-pw">كلمة المرور (8 إلى 64 حرفا)</label><input id="m-pw" type="text" dir="ltr" maxlength="64" autocomplete="off" spellcheck="false"></div><button type="button" class="btn ghost sm" id="m-gen"><i class="fa-solid fa-dice"></i>توليد عشوائي</button>`, 'تغيير', async () => {
  const pw = $('#m-pw').value;
  if (pw.length < 8 || pw.length > 64) return 'كلمة المرور من 8 إلى 64 حرفا';
  const hex = await derive(m.name, pw);
  const r = await api('resetPass', { id: m.id, pw: hex });
  if (!r.ok) return r.error || C.NET;
  copy(pw);
  return '';
}).then(ok => ok && toast('تم التغيير ونسخ كلمة المرور الجديدة'));

const views = {
  async overview() {
    const [t, me] = await Promise.all([api('team'), rs('me')]);
    const a = (me.data && me.data.reseller) || {};
    const st = a.stats || {};
    const tt = t.totals || {};
    const c = t.counts || {};
    const top = (t.members || []).filter(m => m.role !== 'OWNER').sort((x, y) => (y.trial + y.regular) - (x.trial + x.regular)).slice(0, 5);
    const topMax = Math.max(1, ...top.map(m => m.trial + m.regular));
    const hour = new Date().getHours();
    stage(`<div class="hero-b"><h2>${hour < 12 ? 'صباح الخير' : 'مساء الخير'} ${esc(S.user.name)}</h2><p>هذه صورة كاملة عن المنصة الآن</p></div>
<div class="grid">${me.ok ? stat('fa-wallet', 'رصيد لوحة الـ API', a.credits_balance, 'g') + stat('fa-flask', 'نقاط تجريبية', a.trial_credits) + stat('fa-key', 'إجمالي المفاتيح', st.total_keys) : ''}
${t.ok ? stat('fa-vial', 'أكواد تجريبية', tt.trial) + stat('fa-certificate', 'أكواد حقيقية', tt.regular, 'g') + stat('fa-coins', 'نقاط مصروفة', tt.credits, 'w') + stat('fa-money-bill-trend-up', 'إجمالي التكلفة', tt.cost, 'r') + stat('fa-hourglass-half', 'حسابات معلقة', c.m3lk, 'w') : ''}</div>
${me.ok ? '' : `<div class="card">${fault(me)}</div>`}
${t.ok ? `<div class="cols"><div class="card"><h3><i class="fa-solid fa-chart-column"></i>نشاط آخر 14 يوما</h3><div class="legend"><span><i class="k-reg"></i>حقيقي</span><span><i class="k-tri"></i>تجريبي</span></div>${chartSvg(t.daily)}</div>
<div class="card"><h3><i class="fa-solid fa-chart-pie"></i>الحسابات</h3>${donutSvg(c)}</div></div>
<div class="cols"><div class="card"><h3><i class="fa-solid fa-trophy"></i>الأكثر نشاطا</h3><div class="rank">${top.length ? top.map(m => `<div class="r"><div><span>${esc(m.name)}</span><b>${num(m.trial + m.regular)}</b></div><div class="bar"><i data-w="${Math.round((m.trial + m.regular) / topMax * 100)}"></i></div></div>`).join('') : '<p class="empty">لا يوجد نشاط</p>'}</div></div>
<div class="card"><h3><i class="fa-solid fa-clock-rotate-left"></i>آخر العمليات</h3><div class="feed">${t.recent.length ? t.recent.map(e => `<div class="e"><i class="fa-solid ${e.kind === 'trial' ? 'fa-vial' : e.kind === 'regular' ? 'fa-certificate' : 'fa-bolt'}"></i><div><b>${esc(e.name)} · ${esc(C.KIND[e.kind] || e.kind)}</b><small>${esc(when(e.time))}${e.cost != null ? ' · تكلفة ' + num(e.cost) : ''}</small></div></div>`).join('') : '<p class="empty">لا توجد عمليات</p>'}</div></div></div>` : `<div class="card">${fault(t)}</div>`}`);
  },

  async keys() {
    const priv = S.user.role !== 'Moderator';
    stage(`<h2><i class="fa-solid fa-key"></i>الأكواد</h2>
<div class="card"><div class="stat" data-t="g"><span class="ic"><i class="fa-solid fa-wallet"></i></span><div><span>الرصيد المتاح</span><b id="bal-v">...</b></div></div><p class="msg" id="bal-w" hidden>عندما يكون الرصيد غير كافٍ لإنشاء كود حقيقي، تواصل مع الإدارة</p></div>
<div class="card"><h3><i class="fa-solid fa-wand-magic-sparkles"></i>إنشاء كود جديد</h3>
<div class="seg"><button type="button" data-type="trial" aria-pressed="true">تجريبي</button><button type="button" data-type="regular" aria-pressed="false">حقيقي</button></div>
<div class="form">
<div class="f"><label for="k-name">اسم العميل</label><input id="k-name" maxlength="60"></div>
<div class="f"><label for="k-mail">إيميل العميل</label><input id="k-mail" type="email" maxlength="80" dir="ltr"></div>
<div class="f reg" hidden><label for="k-cr">النقاط (50 فأكثر)</label><input id="k-cr" type="number" min="50" value="200" dir="ltr"></div>
<div class="f reg" hidden><label for="k-dev">عدد الأجهزة</label><input id="k-dev" type="number" min="1" max="20" value="1" dir="ltr"></div>
<div class="f reg" hidden><label for="k-sw">التبديل اليومي (5 إلى 12)</label><input id="k-sw" type="number" min="5" max="12" value="5" dir="ltr"></div>
<div class="f reg" hidden><label for="k-cd">وقت التبديل (ثانية)</label><input id="k-cd" type="number" min="0" value="180" dir="ltr"></div>
</div>
<div class="row end"><button type="button" class="btn" id="k-go"><i class="fa-solid fa-wand-magic-sparkles"></i><span>إنشاء</span></button></div>
<p id="k-msg" class="msg" aria-live="polite"></p><div id="k-out"></div></div>
<div class="card"><h3><i class="fa-solid fa-list"></i>${priv ? 'كل الأكواد' : 'أكوادي'}</h3>
<div class="form"><div class="f"><label for="q-s">بحث</label><input id="q-s" maxlength="60"></div>
<div class="f"><label for="q-t">الحالة</label><select id="q-t"><option value="">الكل</option><option value="active">نشط</option><option value="inactive">متوقف</option></select></div></div>
<div id="k-list"></div><div class="row end" id="k-pg" hidden><button type="button" class="btn ghost sm" id="pg-p"><i class="fa-solid fa-angle-right"></i>السابق</button><button type="button" class="btn ghost sm" id="pg-n">التالي<i class="fa-solid fa-angle-left"></i></button></div></div>`);
    let type = 'trial', offset = 0, busy = false;
    let balance = null;
    const warn = () => {
      const w = $('#bal-w');
      if (!w) return;
      const need = type === 'regular' ? Math.max(50, Number($('#k-cr').value) || 50) : 50;
      w.hidden = balance === null || balance >= need;
    };
    const loadBal = async () => {
      const r = await rs('balance');
      if (!$('#bal-v')) return;
      const v = r.ok && r.data && r.data.reseller ? Number(r.data.reseller.credits_balance) : NaN;
      balance = Number.isFinite(v) ? v : null;
      $('#bal-v').textContent = balance === null ? '-' : num(balance);
      warn();
    };
    $$('[data-type]').forEach(b => b.onclick = () => {
      type = b.dataset.type;
      $$('[data-type]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      $$('.reg').forEach(x => { x.hidden = type !== 'regular'; });
      warn();
    });
    const list = async () => {
      const box = $('#k-list');
      if (!box) return;
      box.innerHTML = '<p class="empty"><span class="spin"></span></p>';
      const r = await rs('list', { search: $('#q-s').value, status: $('#q-t').value, offset });
      if (!$('#k-list')) return;
      if (!r.ok) { box.innerHTML = fault(r); return; }
      const d = r.data || {};
      const keys = d.keys || d.data || [];
      $('#k-pg').hidden = !priv;
      box.innerHTML = keys.length ? keys.map(keyRow).join('') : '<p class="empty">لا توجد أكواد</p>';
    };
    $('#k-list').onclick = async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const key = b.dataset.k;
      const a = b.dataset.a;
      if (a === 'copy') return copy(key);
      if (a === 'tog') {
        const r = await rs('update', { key, status: b.dataset.s === 'active' ? 'inactive' : 'active' });
        toast(r.ok ? 'تم التحديث' : r.error || C.NET, r.ok ? 'ok' : 'err');
        return list();
      }
      if (a === 'charge') {
        const ok = await modal('شحن الكود', '<div class="f"><label for="m-cr">عدد النقاط</label><input id="m-cr" type="number" min="1" value="100" dir="ltr"></div>', 'شحن', async () => {
          const r = await rs('recharge', { key, credits: Number($('#m-cr').value) });
          return r.ok ? '' : r.error || C.NET;
        });
        if (ok) { toast('تم الشحن'); list(); }
        return;
      }
      if (a === 'edit') {
        const ok = await modal('تعديل اسم العميل', `<div class="f"><label for="m-n">الاسم</label><input id="m-n" maxlength="60" value="${esc(b.dataset.n)}"></div>`, 'حفظ', async () => {
          const r = await rs('update', { key, customer_name: $('#m-n').value });
          return r.ok ? '' : r.error || C.NET;
        });
        if (ok) { toast('تم الحفظ'); list(); }
      }
    };
    $('#k-cr').oninput = warn;
    $('#q-s').oninput = () => { clearTimeout(S.timer); S.timer = setTimeout(() => { offset = 0; list(); }, 350); };
    $('#q-t').onchange = () => { offset = 0; list(); };
    $('#pg-n').onclick = () => { offset += 25; list(); };
    $('#pg-p').onclick = () => { offset = Math.max(0, offset - 25); list(); };
    $('#k-go').onclick = async () => {
      if (busy) return;
      const msg = $('#k-msg');
      msg.textContent = '';
      msg.dataset.tone = '';
      const body = { type, customer_name: $('#k-name').value, customer_email: $('#k-mail').value };
      if (type === 'regular') Object.assign(body, { credits: Number($('#k-cr').value), max_devices: Number($('#k-dev').value), daily_switches: Number($('#k-sw').value), switch_cooldown_seconds: Number($('#k-cd').value) });
      busy = true;
      $('#k-go').disabled = true;
      const r = await rs('create', body);
      busy = false;
      if (!$('#k-go')) return;
      $('#k-go').disabled = false;
      if (!r.ok) { msg.textContent = r.error || C.NET; return; }
      const key = pickKey(r.data);
      msg.dataset.tone = 'ok';
      msg.textContent = 'تم إنشاء الكود';
      $('#k-out').innerHTML = key ? `<div class="keybox"><code>${esc(key)}</code><button type="button" class="btn ghost sm" id="k-cp">نسخ</button></div>` : `<div class="keybox"><code>${esc(JSON.stringify(r.data))}</code></div>`;
      if (key) $('#k-cp').onclick = () => copy(key);
      list();
      loadBal();
    };
    list();
    loadBal();
  },

  async team() {
    const r = await api('team');
    if (!r.ok) return stage(fault(r));
    const owner = isOwner();
    let q = '', f = '';
    const draw = () => {
      const rows = r.members.filter(m => (!f || m.stat === f) && (!q || m.name.toLowerCase().includes(q)));
      $('#t-list').innerHTML = rows.length ? rows.map(m => `<div class="item"><div class="mem">${avatar(m, 'sm')}<div class="info"><b>${esc(m.name)} <span class="badge" data-role="${esc(m.role)}">${esc(C.ROLE[m.role] || m.role)}</span> <span class="pill ${esc(m.stat)}">${esc(C.STAT[m.stat] || m.stat)}</span></b><small>${num(m.age)} سنة · تجريبي ${num(m.trial)} · حقيقي ${num(m.regular)} · نقاط ${num(m.credits)}${owner ? ' · تكلفة ' + num(m.cost) : ''} · آخر نشاط ${esc(when(m.last))}</small></div></div>
<div class="acts">${owner && m.stat !== 'done' ? `<button type="button" class="btn sm" data-id="${esc(m.id)}" data-s="done"><i class="fa-solid fa-check"></i>موافقة</button>` : ''}${owner && m.stat !== 'ban' ? `<button type="button" class="btn danger sm" data-id="${esc(m.id)}" data-s="ban"><i class="fa-solid fa-ban"></i>حظر</button>` : ''}${owner && m.stat === 'done' ? `<button type="button" class="btn ghost sm" data-id="${esc(m.id)}" data-s="m3lk">تعليق</button>` : ''}<button type="button" class="btn ghost sm" data-pw="${esc(m.id)}"><i class="fa-solid fa-key"></i>كلمة مرور</button></div></div>`).join('') : '<p class="empty">لا توجد حسابات</p>';
    };
    stage(`<h2><i class="fa-solid fa-users"></i>${owner ? 'كل الحسابات' : 'الموديريتورز'} <small>${num(r.members.length)}</small></h2>
<div class="card"><div class="form"><div class="f"><label for="t-q">بحث بالاسم</label><input id="t-q" maxlength="24"></div></div>
${owner ? `<div class="chips"><button type="button" class="chip" data-f="" aria-pressed="true">الكل</button><button type="button" class="chip" data-f="m3lk" aria-pressed="false">معلق</button><button type="button" class="chip" data-f="done" aria-pressed="false">مفعل</button><button type="button" class="chip" data-f="ban" aria-pressed="false">محظور</button></div>` : ''}
<div id="t-list"></div></div>`);
    draw();
    $('#t-q').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    $$('[data-f]').forEach(b => b.onclick = () => { f = b.dataset.f; $$('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); });
    $('#stage').onclick = async e => {
      const p = e.target.closest('[data-pw]');
      if (p) return passDialog(r.members.find(m => m.id === p.dataset.pw));
      const b = e.target.closest('[data-id]');
      if (!b) return;
      b.disabled = true;
      const x = await api('setStat', { id: b.dataset.id, stat: b.dataset.s });
      toast(x.ok ? 'تم التحديث' : x.error || C.NET, x.ok ? 'ok' : 'err');
      views.team();
    };
  },

  async server() {
    const paint = s => {
      $('#w-live').dataset.on = String(s.installed);
      $('#w-info').textContent = s.installed ? `المشغل الدائم يعمل كل ${s.every || 5} دقائق` : 'المشغل الدائم متوقف';
      $('#w-last').textContent = s.at ? `آخر تشغيل: ${when(s.at)}` : 'لم يتم التشغيل بعد';
      if (s.every) $('#w-ev').value = String(s.every);
      const b = $('#w-auto');
      b.setAttribute('aria-pressed', String(S.auto));
      b.innerHTML = S.auto ? '<i class="fa-solid fa-stop"></i>إيقاف التشغيل من المتصفح' : '<i class="fa-solid fa-play"></i>تشغيل من المتصفح كل 5 دقائق';
    };
    stage(`<h2><i class="fa-solid fa-server"></i>السيرفر</h2>
<div class="card"><h3><i class="fa-solid fa-heart-pulse"></i>إبقاء السيرفر شغالا</h3>
<p><span class="live" id="w-live" data-on="false"></span><b id="w-info">...</b></p><p class="msg" id="w-last" data-tone="ok"></p>
<div class="form"><div class="f"><label for="w-ev">التكرار</label><select id="w-ev"><option value="1">كل دقيقة</option><option value="5" selected>كل 5 دقائق</option><option value="10">كل 10 دقائق</option><option value="15">كل 15 دقيقة</option><option value="30">كل 30 دقيقة</option></select></div></div>
<div class="row end"><button type="button" class="btn" id="w-on"><i class="fa-solid fa-bolt"></i>تفعيل المشغل الدائم</button><button type="button" class="btn danger" id="w-off">إيقاف المشغل</button><button type="button" class="btn ghost" id="w-now"><i class="fa-solid fa-rotate"></i>تشغيل الآن</button></div>
<p class="msg" id="w-err"></p></div>
<div class="card"><h3><i class="fa-solid fa-globe"></i>تشغيل من المتصفح</h3><p class="empty">يبقى السيرفر نشطا طالما هذه الصفحة مفتوحة</p><div class="row"><button type="button" class="btn ghost" id="w-auto" aria-pressed="false"></button></div></div>`);
    const run = async (op, extra = {}) => {
      $('#w-err').textContent = '';
      const x = await api('warmCtl', { op, ...extra });
      if (!$('#w-live')) return;
      if (!x.ok) { $('#w-err').textContent = x.error || C.NET; return; }
      paint(x);
      toast(op === 'run' ? 'تم التشغيل' : 'تم الحفظ');
    };
    $('#w-on').onclick = () => run('install', { every: Number($('#w-ev').value) });
    $('#w-off').onclick = () => run('remove');
    $('#w-now').onclick = () => run('run');
    $('#w-auto').onclick = () => {
      S.auto = !S.auto;
      store.set(C.K.a, S.auto ? '1' : '0');
      autoWarm();
      paint({ installed: $('#w-live').dataset.on === 'true', every: 0, at: '' });
      if (S.auto) api('warmNow');
    };
    paint({ installed: false, every: 0, at: '' });
    const s = await api('warmCtl', { op: 'status' });
    if ($('#w-live')) s.ok ? paint(s) : ($('#w-err').textContent = s.error || C.NET);
  },

  async profile() {
    const u = S.user;
    const msgs = u.msgs || [];
    stage(`<div class="prof"><div class="hero"><div class="cover"></div>${avatar(u, 'big')}<h2>${esc(u.name)}</h2>
<div class="chips"><span class="badge" data-role="${esc(u.role)}">${esc(C.ROLE[u.role] || u.role)}</span><span class="chip">${num(u.age)} سنة</span><span class="pill ${esc(u.stat)}">${esc(C.STAT[u.stat] || u.stat)}</span></div></div>
<div class="card"><h3><i class="fa-regular fa-envelope"></i>الرسائل</h3>${msgs.length ? msgs.map(m => `<div class="item">${esc(m)}</div>`).join('') : '<p class="empty">لا توجد رسائل</p>'}</div></div>`);
  }
};

const autoWarm = () => {
  clearInterval(autoWarm.t);
  if (S.auto && isOwner()) autoWarm.t = setInterval(() => api('warmNow'), C.WARM_MS);
};

const boot = async () => {
  if (!store.get(C.K.t)) return leave();
  const r = await api('session');
  if (!r.ok) return r.auth ? leave() : toast(r.error || C.NET, 'err');
  if (r.token) store.set(C.K.t, r.token);
  store.set(C.K.u, JSON.stringify(r.user));
  if (r.user.stat !== 'done') return location.replace(C.LOGIN);
  S.user = r.user;
  S.auto = store.get(C.K.a) === '1';
  paintMe();
  buildNav();
  autoWarm();
  go(isOwner() ? 'overview' : 'keys');
};

boot();
