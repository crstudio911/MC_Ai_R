const C = {
  API: 'https://script.google.com/macros/s/AKfycbyqKl78c111_LF-4IGXkwoi0meKeltJ9il03To0uFVZYS-yB6tes0XuHE4R9jYEIxmL/exec',
  LOGIN: '../index.html',
  K: { t: 'mcr_token', u: 'mcr_user', c: 'mcr_checked', a: 'mcr_auto', n: 'mcr_nav' },
  WARM_MS: 300000,
  NET: 'تعذر الاتصال بالخادم',
  ERR: { off: 'لا يوجد اتصال بالإنترنت', slow: 'الخادم تأخر في الرد، حاول مرة أخرى', busy: 'الخادم مشغول حاليا، حاول بعد لحظات', net: 'تعذر الاتصال بالخادم' },
  ROLE: { OWNER: 'المالك', Admen: 'أدمن', Moderator: 'موديريتور' },
  STAT: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور', active: 'نشط', inactive: 'متوقف' },
  KIND: { trial: 'كود تجريبي', regular: 'كود حقيقي', recharge: 'شحن' }
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const when = v => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { return; } },
  del: k => { try { localStorage.removeItem(k); } catch (e) { return; } }
};
const memo = {
  get: k => { try { return JSON.parse(sessionStorage.getItem('mcr_c:' + k)); } catch (e) { return null; } },
  set: (k, v) => { try { sessionStorage.setItem('mcr_c:' + k, JSON.stringify(v)); } catch (e) { return; } }
};
const S = { user: null, view: '', timer: 0, auto: false };
const isOwner = () => S.user.role === 'OWNER';

const leave = () => {
  Object.values(C.K).forEach(k => store.del(k));
  try { sessionStorage.clear(); } catch (e) { }
  location.replace(C.LOGIN);
};

const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(14)), n => (n % 36).toString(36)).join('');
const wait = ms => new Promise(r => setTimeout(r, ms));
const gate = { n: 0, q: [] };
const slot = () => new Promise(res => {
  const take = () => { gate.n += 1; res(); };
  if (gate.n < 3) take(); else gate.q.push(take);
});
const free = () => {
  gate.n -= 1;
  const next = gate.q.shift();
  if (next) next();
};

const once = async (body, ms) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(C.API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body, signal: ctl.signal, credentials: 'omit', cache: 'no-store' });
    const text = await r.text();
    try { return { out: JSON.parse(text) }; } catch (e) { return { fail: 'busy' }; }
  } catch (e) {
    return { fail: ctl.signal.aborted ? 'slow' : 'net' };
  } finally {
    clearTimeout(t);
  }
};

const api = async (action, payload = {}) => {
  const body = JSON.stringify({ action, token: store.get(C.K.t), rid: rid(), ...payload });
  await slot();
  try {
    let last = 'net';
    for (let i = 0; i < 4; i += 1) {
      if (i) await wait(700 * i + Math.random() * 300);
      if (navigator.onLine === false) { last = 'off'; continue; }
      const x = await once(body, 45000);
      if (x.out) {
        if (x.out.pending) { last = 'busy'; continue; }
        if (x.out.auth) leave();
        return x.out;
      }
      last = x.fail;
      if (last === 'slow' && i >= 1) break;
    }
    return { ok: false, error: C.ERR[last] || C.NET };
  } finally {
    free();
  }
};
const rs = (op, p = {}) => api('rs', { op, ...p });

const forget = (...ks) => ks.forEach(k => memo.set(k + ':' + S.user.id, null));

const live = async (key, load, paint) => {
  const k = key + ':' + S.user.id;
  const view = S.view;
  const old = memo.get(k);
  if (old) paint(old);
  const fresh = await load();
  if (S.view !== view) return;
  if (fresh.ok) {
    memo.set(k, fresh);
    paint(fresh);
  } else if (!old) {
    paint(fresh);
  }
};

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
  toast.t = setTimeout(() => { el.hidden = true; }, 3200);
};

const dlg = $('#dlg');
const modal = (title, body, ok, run) => new Promise(done => {
  $('#dlg-title').textContent = title;
  $('#dlg-body').innerHTML = body;
  $('#dlg-err').textContent = '';
  const okBtn = $('#dlg-ok');
  okBtn.textContent = ok || 'تأكيد';
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

const imgOk = u => typeof u === 'string' && /^https:\/\//.test(u);
const avatar = (u, cls = '') => `<span class="ava ${cls}"><span>${esc((Array.from(u.name || '')[0] || '').toUpperCase())}</span>${imgOk(u.img) ? `<img src="${esc(u.img)}" alt="" referrerpolicy="no-referrer">` : ''}</span>`;
document.addEventListener('error', e => {
  const t = e.target;
  if (t && t.tagName === 'IMG' && t.closest('.ava')) t.hidden = true;
}, true);

const NAV = {
  overview: { icon: 'fa-chart-line', label: 'نظرة عامة', roles: ['OWNER'] },
  keys: { icon: 'fa-key', label: 'الأكواد', roles: ['Moderator', 'Admen', 'OWNER'] },
  team: { icon: 'fa-users', label: 'الفريق', roles: ['Admen', 'OWNER'] },
  server: { icon: 'fa-server', label: 'السيرفر', roles: ['OWNER'] },
  profile: { icon: 'fa-user', label: 'الملف الشخصي', roles: ['Moderator', 'Admen', 'OWNER'] }
};

const mobile = () => matchMedia('(max-width:760px)').matches;
const setNav = open => {
  $('#nav').dataset.open = String(open);
  $('#nav-tg').setAttribute('aria-expanded', String(open));
  $('#nav-tg').setAttribute('aria-label', open ? 'طي القائمة' : 'توسيع القائمة');
  $('#scrim').hidden = !(open && mobile());
  store.set(C.K.n, open ? '1' : '0');
};

const buildNav = () => {
  $('#nav-items').innerHTML = Object.entries(NAV).filter(([, v]) => v.roles.includes(S.user.role))
    .map(([k, v]) => `<button type="button" data-go="${k}" title="${v.label}"><i class="fa-solid ${v.icon}"></i><span>${v.label}</span></button>`).join('')
    + '<span class="sp"></span><button type="button" class="out" id="out" title="تسجيل الخروج"><i class="fa-solid fa-right-from-bracket"></i><span>تسجيل الخروج</span></button>';
  $$('[data-go]').forEach(b => { b.onclick = () => { go(b.dataset.go); if (mobile()) setNav(false); }; });
  $('#out').onclick = leave;
  $('#nav-tg').onclick = () => setNav($('#nav').dataset.open !== 'true');
  $('#scrim').onclick = () => setNav(false);
  setNav(!mobile() && store.get(C.K.n) === '1');
};

const paintMe = () => {
  const u = S.user;
  $('#me-name').textContent = u.name;
  const r = $('#me-role');
  r.textContent = C.ROLE[u.role] || u.role;
  r.dataset.role = u.role;
  $('#me-fb').textContent = (Array.from(u.name)[0] || '').toUpperCase();
  const img = $('#me-img');
  img.hidden = !imgOk(u.img);
  if (imgOk(u.img)) img.src = u.img;
};

const polish = () => requestAnimationFrame(() => requestAnimationFrame(() => $$('[data-w]').forEach(e => { e.style.width = e.dataset.w + '%'; })));
const stage = html => { $('#stage').innerHTML = html; $('#stage').onclick = null; polish(); };
const skeleton = () => stage('<div class="skel"><span class="sk w"></span><span class="sk h"></span><span class="sk h"></span></div>');
const fault = r => `<div class="fault"><p class="msg">${esc((r && r.error) || C.NET)}</p><button type="button" class="btn ghost sm" data-retry><i class="fa-solid fa-rotate"></i>إعادة المحاولة</button></div>`;
const head = (title, sub = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;

const go = async name => {
  if (!NAV[name] || !NAV[name].roles.includes(S.user.role)) name = 'profile';
  S.view = name;
  $$('[data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === name)));
  skeleton();
  try {
    await views[name]();
  } catch (e) {
    if (S.view === name) stage(fault({ error: C.NET }));
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

const kpi = (icon, label, value, cls = '') => `<div class="kpi"><span><i class="fa-solid ${icon}"></i>${label}</span><b class="${cls}">${num(value)}</b></div>`;

const chartSvg = d => {
  const W = 640, H = 180, L = 30, P = 8;
  const max = Math.max(4, ...d.map(x => x.trial + x.regular));
  const top = Math.ceil(max / 4) * 4;
  const bw = (W - L - P) / d.length;
  const grid = [0, 1, 2, 3, 4].map(i => {
    const y = H - (i / 4) * H;
    return `<line class="gl" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="ay" x="${L - 6}" y="${y + 4}">${num(top * i / 4)}</text>`;
  }).join('');
  const bars = d.map((x, i) => {
    const h1 = x.regular / top * H, h2 = x.trial / top * H, X = L + i * bw + bw * .2, w = bw * .6;
    const tip = `${x.d}: حقيقي ${x.regular} · تجريبي ${x.trial}`;
    return `<g><title>${esc(tip)}</title><rect class="b1" x="${X}" y="${H - h1}" width="${w}" height="${h1}" rx="2"/><rect class="b2" x="${X}" y="${H - h1 - h2}" width="${w}" height="${h2}" rx="2"/><text class="ax" x="${X + w / 2}" y="${H + 18}">${esc(x.d.slice(8))}</text></g>`;
  }).join('');
  return `<svg class="chart" viewBox="0 -8 ${W} ${H + 32}" role="img" aria-label="نشاط آخر 14 يوما">${grid}${bars}</svg>`;
};

const keyRow = k => `<div class="item"><div class="info"><b class="latin">${esc(k.key)} <span class="pill ${esc(k.status)}">${esc(C.STAT[k.status] || k.status)}</span></b><small>${esc(k.customer_name || '-')} · ${num(k.credits)} نقطة · تبديل ${num(k.daily_switch_limit)} / ${num(k.switch_cooldown_seconds)}ث</small></div>
<div class="acts"><button type="button" class="btn ghost sm" data-a="copy" data-k="${esc(k.key)}"><i class="fa-regular fa-copy"></i>نسخ</button>
<button type="button" class="btn ghost sm" data-a="charge" data-k="${esc(k.key)}"><i class="fa-solid fa-bolt"></i>شحن</button>
<button type="button" class="btn ghost sm" data-a="edit" data-k="${esc(k.key)}" data-n="${esc(k.customer_name || '')}"><i class="fa-solid fa-pen"></i>تعديل</button>
<button type="button" class="btn ${k.status === 'active' ? 'danger' : 'ghost'} sm" data-a="tog" data-k="${esc(k.key)}" data-s="${esc(k.status)}">${k.status === 'active' ? 'إيقاف' : 'تفعيل'}</button></div></div>`;

const passDialog = m => modal('كلمة مرور جديدة', `<p class="sec">${esc(m.name)}</p><div class="f"><label for="m-pw">كلمة المرور (8 إلى 64 حرفا)</label><input id="m-pw" type="text" dir="ltr" maxlength="64" autocomplete="off" spellcheck="false"></div><button type="button" class="btn ghost sm" id="m-gen"><i class="fa-solid fa-dice"></i>توليد عشوائي</button>`, 'تغيير', async () => {
  const pw = $('#m-pw').value;
  if (pw.length < 8 || pw.length > 64) return 'كلمة المرور من 8 إلى 64 حرفا';
  const hex = await derive(m.name, pw);
  const r = await api('resetPass', { id: m.id, pw: hex });
  if (!r.ok) return r.error || C.NET;
  copy(pw);
  return '';
}).then(ok => ok && toast('تم التغيير ونسخ كلمة المرور الجديدة'));

document.addEventListener('click', e => {
  if (e.target.closest('#m-gen')) {
    const abc = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const buf = crypto.getRandomValues(new Uint32Array(14));
    $('#m-pw').value = Array.from(buf, n => abc[n % abc.length]).join('');
  }
});

const views = {
  async overview() {
    const draw = ({ t, me }) => {
      const a = (me && me.data && me.data.reseller) || {};
      const st = a.stats || {};
      const tt = t.totals || {};
      const c = t.counts || {};
      const top = (t.members || []).slice().sort((x, y) => (y.trial + y.regular) - (x.trial + x.regular)).slice(0, 5);
      const topMax = Math.max(1, ...top.map(m => m.trial + m.regular));
      const sum = Math.max(1, (c.done || 0) + (c.m3lk || 0) + (c.ban || 0));
      const cells = (me && me.ok ? kpi('fa-wallet', 'رصيد لوحة الـ API', a.credits_balance) + kpi('fa-flask', 'نقاط تجريبية', a.trial_credits) + kpi('fa-key', 'إجمالي المفاتيح', st.total_keys) : '')
        + (t.ok ? kpi('fa-vial', 'أكواد تجريبية', tt.trial) + kpi('fa-certificate', 'أكواد حقيقية', tt.regular) + kpi('fa-coins', 'نقاط مصروفة', tt.credits) + kpi('fa-receipt', 'إجمالي التكلفة', tt.cost) + kpi('fa-hourglass-half', 'حسابات معلقة', c.m3lk, c.m3lk ? 'warn' : '') : '');
      stage(`${head('نظرة عامة', 'ملخص النشاط والحسابات والرصيد')}
${cells ? `<div class="panel kpis">${cells}</div>` : ''}
${me && !me.ok ? `<div class="panel"><div class="pb">${fault(me)}</div></div>` : ''}
${t.ok ? `<div class="cols"><div class="panel"><h3>نشاط آخر 14 يوما</h3><div class="pb"><div class="legend"><span><i class="k-reg"></i>حقيقي</span><span><i class="k-tri"></i>تجريبي</span></div>${chartSvg(t.daily)}</div></div>
<div class="panel"><h3>الحسابات <small>${num(sum === 1 && !c.done && !c.m3lk && !c.ban ? 0 : sum)}</small></h3><div class="pb"><div class="split"><i class="k-done" data-w="${Math.round((c.done || 0) / sum * 100)}"></i><i class="k-m3lk" data-w="${Math.round((c.m3lk || 0) / sum * 100)}"></i><i class="k-ban" data-w="${Math.round((c.ban || 0) / sum * 100)}"></i></div>
<dl class="dl"><div><dt><i class="k-done"></i>مفعل</dt><dd>${num(c.done)}</dd></div><div><dt><i class="k-m3lk"></i>معلق</dt><dd>${num(c.m3lk)}</dd></div><div><dt><i class="k-ban"></i>محظور</dt><dd>${num(c.ban)}</dd></div></dl></div></div></div>
<div class="cols"><div class="panel"><h3>الأكثر نشاطا</h3><div class="pb"><div class="rank">${top.length ? top.map(m => `<div class="r"><div><span>${esc(m.name)}</span><b>${num(m.trial + m.regular)}</b></div><div class="bar"><i data-w="${Math.round((m.trial + m.regular) / topMax * 100)}"></i></div></div>`).join('') : '<p class="empty">لا يوجد نشاط</p>'}</div></div></div>
<div class="panel"><h3>آخر العمليات</h3><div class="pb"><div class="feed">${t.recent.length ? t.recent.map(e => `<div class="e"><i class="fa-solid ${e.kind === 'trial' ? 'fa-vial' : e.kind === 'regular' ? 'fa-certificate' : 'fa-bolt'}"></i><div><b>${esc(e.name)} · ${esc(C.KIND[e.kind] || e.kind)}</b><small>${esc(when(e.time))}${e.cost != null ? ' · تكلفة ' + num(e.cost) : ''}</small></div></div>`).join('') : '<p class="empty">لا توجد عمليات</p>'}</div></div></div></div>` : `<div class="panel"><div class="pb">${fault(t)}</div></div>`}`);
    };
    await live('overview', async () => {
      const [t, me] = await Promise.all([api('team'), rs('me')]);
      return { ok: t.ok, t, me };
    }, draw);
  },

  async keys() {
    const priv = S.user.role !== 'Moderator';
    stage(`${head('الأكواد', 'إنشاء الأكواد وإدارتها')}
<div class="panel"><div class="pb bal"><span>الرصيد المتاح</span><b id="bal-v">...</b></div></div>
<p class="note-bad" id="bal-w" hidden><i class="fa-solid fa-circle-exclamation"></i><span>عندما يكون الرصيد غير كافٍ لإنشاء كود حقيقي، تواصل مع الإدارة</span></p>
<div class="panel"><h3>إنشاء كود جديد</h3><div class="pb">
<div class="seg"><button type="button" data-type="trial" aria-pressed="true">تجريبي</button><button type="button" data-type="regular" aria-pressed="false">حقيقي</button></div>
<div class="form">
<div class="f"><label for="k-name">اسم العميل</label><input id="k-name" maxlength="60"></div>
<div class="f"><label for="k-mail">إيميل العميل</label><input id="k-mail" type="email" maxlength="80" dir="ltr"></div>
<div class="f reg" hidden><label for="k-cr">النقاط (50 فأكثر)</label><input id="k-cr" type="number" min="50" value="200" dir="ltr"></div>
<div class="f reg" hidden><label for="k-dev">عدد الأجهزة</label><input id="k-dev" type="number" min="1" max="20" value="1" dir="ltr"></div>
<div class="f reg" hidden><label for="k-sw">التبديل اليومي (5 إلى 12)</label><input id="k-sw" type="number" min="5" max="12" value="5" dir="ltr"></div>
<div class="f reg" hidden><label for="k-cd">وقت التبديل (ثانية)</label><input id="k-cd" type="number" min="0" value="180" dir="ltr"></div>
</div>
<div class="row end"><button type="button" class="btn" id="k-go"><i class="fa-solid fa-plus"></i><span>إنشاء</span></button></div>
<p id="k-msg" class="msg" aria-live="polite"></p><div id="k-out"></div></div></div>
<div class="panel"><h3>${priv ? 'كل الأكواد' : 'أكوادي'}</h3><div class="pb"><div class="form"><div class="f"><label for="q-s">بحث</label><input id="q-s" maxlength="60"></div>
<div class="f"><label for="q-t">الحالة</label><select id="q-t"><option value="">الكل</option><option value="active">نشط</option><option value="inactive">متوقف</option></select></div></div></div>
<div class="list" id="k-list"></div><div class="row end pb" id="k-pg" hidden><button type="button" class="btn ghost sm" id="pg-p"><i class="fa-solid fa-angle-right"></i>السابق</button><button type="button" class="btn ghost sm" id="pg-n">التالي<i class="fa-solid fa-angle-left"></i></button></div></div>`);
    let type = 'trial', offset = 0, busy = false, balance = null;
    const warn = () => {
      const w = $('#bal-w');
      if (!w) return;
      const need = type === 'regular' ? Math.max(50, Number($('#k-cr').value) || 50) : 50;
      w.hidden = balance === null || balance >= need;
    };
    const showBal = r => {
      if (!$('#bal-v')) return;
      const v = r.ok && r.data && r.data.reseller ? Number(r.data.reseller.credits_balance) : NaN;
      balance = Number.isFinite(v) ? v : null;
      $('#bal-v').textContent = balance === null ? '-' : num(balance);
      warn();
    };
    const loadBal = () => live('bal', () => rs('balance'), showBal);
    $$('[data-type]').forEach(b => {
      b.onclick = () => {
        type = b.dataset.type;
        $$('[data-type]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
        $$('.reg').forEach(x => { x.hidden = type !== 'regular'; });
        warn();
      };
    });
    const paintList = r => {
      const box = $('#k-list');
      if (!box) return;
      if (!r.ok) { box.innerHTML = `<div class="pb">${fault(r)}</div>`; return; }
      const d = r.data || {};
      const keys = d.keys || d.data || [];
      $('#k-pg').hidden = !priv;
      box.innerHTML = keys.length ? keys.map(keyRow).join('') : '<p class="empty">لا توجد أكواد</p>';
    };
    const list = async () => {
      const q = $('#q-s').value, st = $('#q-t').value;
      const load = () => rs('list', { search: q, status: st, offset });
      if (!offset && !q && !st) return live('keys', load, paintList);
      $('#k-list').innerHTML = '<p class="empty"><span class="sk"></span></p>';
      const r = await load();
      paintList(r);
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
        forget('keys');
        return list();
      }
      if (a === 'charge') {
        const ok = await modal('شحن الكود', '<div class="f"><label for="m-cr">عدد النقاط</label><input id="m-cr" type="number" min="1" value="100" dir="ltr"></div>', 'شحن', async () => {
          const r = await rs('recharge', { key, credits: Number($('#m-cr').value) });
          return r.ok ? '' : r.error || C.NET;
        });
        if (ok) { toast('تم الشحن'); forget('keys', 'bal', 'overview'); list(); loadBal(); }
        return;
      }
      if (a === 'edit') {
        const ok = await modal('تعديل اسم العميل', `<div class="f"><label for="m-n">الاسم</label><input id="m-n" maxlength="60" value="${esc(b.dataset.n)}"></div>`, 'حفظ', async () => {
          const r = await rs('update', { key, customer_name: $('#m-n').value });
          return r.ok ? '' : r.error || C.NET;
        });
        if (ok) { toast('تم الحفظ'); forget('keys'); list(); }
      }
    };
    $('#q-s').oninput = () => { clearTimeout(S.timer); S.timer = setTimeout(() => { offset = 0; list(); }, 350); };
    $('#q-t').onchange = () => { offset = 0; list(); };
    $('#k-cr').oninput = warn;
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
      forget('keys', 'bal', 'overview', 'team');
      list();
      loadBal();
    };
    list();
    loadBal();
  },

  async team() {
    const owner = isOwner();
    let data = null, q = '', f = '';
    stage(`${head(owner ? 'كل الحسابات' : 'الموديريتورز', '<span id="t-n"></span>')}
<div class="panel"><div class="pb"><div class="form"><div class="f"><label for="t-q">بحث بالاسم</label><input id="t-q" maxlength="24"></div></div>
${owner ? `<div class="chips"><button type="button" class="chip" data-f="" aria-pressed="true">الكل</button><button type="button" class="chip" data-f="m3lk" aria-pressed="false">معلق</button><button type="button" class="chip" data-f="done" aria-pressed="false">مفعل</button><button type="button" class="chip" data-f="ban" aria-pressed="false">محظور</button></div>` : ''}</div></div>
<div class="panel scroll" id="t-box"></div>`);
    const draw = () => {
      const box = $('#t-box');
      if (!box || !data) return;
      if (!data.ok) { box.innerHTML = `<div class="pb">${fault(data)}</div>`; return; }
      $('#t-n').textContent = `${num(data.members.length)} حساب`;
      const rows = data.members.filter(m => (!f || m.stat === f) && (!q || m.name.toLowerCase().includes(q)));
      box.innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>العضو</th><th>الدور</th><th>الحالة</th><th class="num">تجريبي</th><th class="num">حقيقي</th><th class="num">النقاط</th>${owner ? '<th class="num">التكلفة</th>' : ''}<th>آخر نشاط</th><th></th></tr></thead><tbody>${rows.map(m => `<tr><td class="who"><div class="mem">${avatar(m, 'sm')}<div class="info"><b>${esc(m.name)}</b><small>${num(m.age)} سنة</small></div></div></td>
<td data-l="الدور"><span class="badge" data-role="${esc(m.role)}">${esc(C.ROLE[m.role] || m.role)}</span></td><td data-l="الحالة"><span class="pill ${esc(m.stat)}">${esc(C.STAT[m.stat] || m.stat)}</span></td>
<td class="num" data-l="تجريبي">${num(m.trial)}</td><td class="num" data-l="حقيقي">${num(m.regular)}</td><td class="num" data-l="النقاط">${num(m.credits)}</td>${owner ? `<td class="num" data-l="التكلفة">${num(m.cost)}</td>` : ''}<td data-l="آخر نشاط">${esc(when(m.last))}</td>
<td><div class="acts">${owner && m.stat !== 'done' ? `<button type="button" class="btn sm" data-id="${esc(m.id)}" data-s="done">موافقة</button>` : ''}${owner && m.stat === 'done' ? `<button type="button" class="btn ghost sm" data-id="${esc(m.id)}" data-s="m3lk">تعليق</button>` : ''}${owner && m.stat !== 'ban' ? `<button type="button" class="btn danger sm" data-id="${esc(m.id)}" data-s="ban">حظر</button>` : ''}<button type="button" class="btn ghost sm" data-pw="${esc(m.id)}"><i class="fa-solid fa-key"></i>كلمة مرور</button></div></td></tr>`).join('')}</tbody></table>` : '<p class="empty">لا توجد حسابات</p>';
    };
    $('#t-q').oninput = e => { q = e.target.value.trim().toLowerCase(); draw(); };
    $$('[data-f]').forEach(b => {
      b.onclick = () => { f = b.dataset.f; $$('[data-f]').forEach(x => x.setAttribute('aria-pressed', String(x === b))); draw(); };
    });
    $('#stage').onclick = async e => {
      const p = e.target.closest('[data-pw]');
      if (p) return passDialog(data.members.find(m => m.id === p.dataset.pw));
      const b = e.target.closest('[data-id]');
      if (!b) return;
      b.disabled = true;
      const x = await api('setStat', { id: b.dataset.id, stat: b.dataset.s });
      toast(x.ok ? 'تم التحديث' : x.error || C.NET, x.ok ? 'ok' : 'err');
      forget('team', 'overview');
      views.team();
    };
    await live('team', () => api('team'), r => { data = r; draw(); });
  },

  async server() {
    const paint = s => {
      if (!$('#w-live')) return;
      $('#w-live').dataset.on = String(s.installed);
      $('#w-info').textContent = s.installed ? `المشغل الدائم يعمل كل ${s.every || 5} دقائق` : 'المشغل الدائم متوقف';
      $('#w-last').textContent = s.at ? `آخر تشغيل: ${when(s.at)}` : 'لم يتم التشغيل بعد';
      if (s.every) $('#w-ev').value = String(s.every);
      const b = $('#w-auto');
      b.setAttribute('aria-pressed', String(S.auto));
      b.innerHTML = S.auto ? '<i class="fa-solid fa-stop"></i>إيقاف التشغيل من المتصفح' : '<i class="fa-solid fa-play"></i>تشغيل من المتصفح كل 5 دقائق';
    };
    stage(`${head('السيرفر', 'إبقاء الخادم نشطا لتسريع الاستجابة')}
<div class="panel"><h3>المشغل الدائم</h3><div class="pb">
<p><span class="live" id="w-live" data-on="false"></span><b id="w-info">...</b></p><p class="sec" id="w-last"></p>
<div class="form"><div class="f"><label for="w-ev">التكرار</label><select id="w-ev"><option value="1">كل دقيقة</option><option value="5" selected>كل 5 دقائق</option><option value="10">كل 10 دقائق</option><option value="15">كل 15 دقيقة</option><option value="30">كل 30 دقيقة</option></select></div></div>
<div class="row end"><button type="button" class="btn" id="w-on">تفعيل المشغل</button><button type="button" class="btn danger" id="w-off">إيقاف المشغل</button><button type="button" class="btn ghost" id="w-now"><i class="fa-solid fa-rotate"></i>تشغيل الآن</button></div>
<p class="msg" id="w-err"></p></div></div>
<div class="panel"><h3>تشغيل من المتصفح</h3><div class="pb"><p class="sec">يبقى السيرفر نشطا طالما هذه الصفحة مفتوحة</p><button type="button" class="btn ghost" id="w-auto" aria-pressed="false"></button></div></div>`);
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
    stage(`<div class="prof"><div class="panel"><div class="hero">${avatar(u, 'big')}<div><h1>${esc(u.name)}</h1>
<div class="chips"><span class="badge" data-role="${esc(u.role)}">${esc(C.ROLE[u.role] || u.role)}</span><span class="chip">${num(u.age)} سنة</span><span class="pill ${esc(u.stat)}">${esc(C.STAT[u.stat] || u.stat)}</span></div></div></div></div>
<div class="panel"><h3>الرسائل</h3><div class="list">${msgs.length ? msgs.map(m => `<div class="item">${esc(m)}</div>`).join('') : '<p class="empty">لا توجد رسائل</p>'}</div></div></div>`);
  }
};

const autoWarm = () => {
  clearInterval(autoWarm.t);
  if (S.auto && isOwner()) autoWarm.t = setInterval(() => api('warmNow'), C.WARM_MS);
};

const start = () => {
  paintMe();
  buildNav();
  autoWarm();
  go(isOwner() ? 'overview' : 'keys');
};

const boot = async () => {
  if (!store.get(C.K.t)) return leave();
  S.auto = store.get(C.K.a) === '1';
  let cached = null;
  try { cached = JSON.parse(store.get(C.K.u)); } catch (e) { cached = null; }
  const pending = api('session');
  if (cached && cached.stat === 'done' && cached.id && NAV.profile.roles.includes(cached.role)) {
    S.user = cached;
    start();
  }
  const r = await pending;
  if (!r.ok) {
    if (!r.auth && !S.user) stage(`<div class="panel"><div class="pb">${fault(r)}</div></div>`);
    return;
  }
  if (r.token) store.set(C.K.t, r.token);
  store.set(C.K.u, JSON.stringify(r.user));
  if (r.user.stat !== 'done') return location.replace(C.LOGIN);
  const changed = !S.user || S.user.role !== r.user.role || S.user.id !== r.user.id;
  S.user = r.user;
  if (changed) start();
  else paintMe();
};

document.addEventListener('click', e => {
  if (e.target.closest('[data-retry]')) {
    if (S.user) go(S.view);
    else location.reload();
  }
});
window.addEventListener('online', () => {
  if ($('[data-retry]')) {
    if (S.user) go(S.view);
    else location.reload();
  }
});
setInterval(() => { if (!document.hidden && store.get(C.K.t)) api('warm'); }, 240000);
document.addEventListener('visibilitychange', () => { if (!document.hidden && store.get(C.K.t)) api('warm'); });

boot();
