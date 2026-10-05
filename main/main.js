import {
  auth,
  authReady,
  db,
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  signOut
} from './firebase-config.js';
import { api, describeApiError } from '../api.js';
import { prepareImage, uploadAvatar, describeError } from '../upload.js';
const C = {
  LOGIN: '../index.html',
  K: { n: 'mcr_nav' },
  ROLE: { OWNER: 'المالك', Admen: 'أدمن', Moderator: 'موديريتور' },
  STAT: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور', active: 'نشط', inactive: 'متوقف' },
  KIND: { trial: 'كود تجريبي', regular: 'كود حقيقي', recharge: 'شحن' },
  COOLDOWNS: [{ s: 180, t: '3 دقائق' }, { s: 300, t: '5 دقائق' }, { s: 600, t: '10 دقائق' }, { s: 900, t: '15 دقيقة' }, { s: 1800, t: '30 دقيقة' }, { s: 3600, t: 'ساعة' }],
  PAGE: 25,
  LOW_TEXT: 'نفد الرصيد، تواصل مع الإدارة'
};
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const when = v => v ? new Date(v).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '-';
const store = {
  get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { return; } }
};
const S = { user: null, view: '' };
const isOwner = () => S.user && S.user.role === 'OWNER';
const leave = async () => {
  try { await signOut(auth); } catch (e) { console.warn(e); }
  location.replace(C.LOGIN);
};
const toast = (msg, tone = 'ok') => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
  el.dataset.tone = tone;
  el.className = 'toast ' + tone;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 3200);
};
const NAV = {
  overview: { icon: 'fa-chart-line', label: 'نظرة عامة', roles: ['OWNER'] },
  keys: { icon: 'fa-key', label: 'الأكواد', roles: ['Moderator', 'Admen', 'OWNER'] },
  team: { icon: 'fa-users', label: 'الفريق', roles: ['Admen', 'OWNER'] },
  storage: { icon: 'fa-database', label: 'مكان التخزين', roles: ['OWNER'] },
  profile: { icon: 'fa-user', label: 'الملف الشخصي', roles: ['Moderator', 'Admen', 'OWNER'] }
};
const mobile = () => matchMedia('(max-width:760px)').matches;
const setNav = open => {
  $('#nav').dataset.open = String(open);
  $('#nav-tg').setAttribute('aria-expanded', String(open));
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
  $('#me-fb').textContent = initial(u.name);
  const img = $('#me-img');
  img.onerror = () => { img.hidden = true; };
  img.hidden = !u.img_url;
  if (u.img_url) img.src = u.img_url;
};
const stage = html => { $('#stage').innerHTML = html; };
const head = (title, sub = '') => `<div class="ph"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div></div>`;
const go = async name => {
  if (!NAV[name] || !NAV[name].roles.includes(S.user.role)) name = 'profile';
  S.view = name;
  $$('[data-go]').forEach(b => b.setAttribute('aria-current', String(b.dataset.go === name)));
  stage('<div class="skel"><span class="sk w"></span><span class="sk h"></span></div>');
  try {
    await views[name]();
  } catch (e) {
    console.error(e);
    stage(`<div class="fault"><p class="msg">تعذر تحميل الصفحة، حاول مرة أخرى</p></div>`);
  }
};
const initial = name => (Array.from(name || '')[0] || '').toUpperCase();
const face = m => `<span class="ava sm"><span>${esc(initial(m.name))}</span>${m.img_url ? `<img src="${esc(m.img_url)}" alt="" referrerpolicy="no-referrer">` : ''}</span>`;
const wipe = async ids => {
  for (let i = 0; i < ids.length; i += 400) {
    const batch = writeBatch(db);
    ids.slice(i, i + 400).forEach(id => batch.delete(doc(db, 'activity', id)));
    await batch.commit();
  }
};
const copy = async text => {
  try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch (e) { toast('تعذر النسخ', 'err'); }
};
const dlgOpen = (title, body, okLabel, onOk, cancelLabel = 'إلغاء') => {
  const dlg = $('#dlg');
  const ok = $('#dlg-ok');
  const cancel = $('#dlg-cancel');
  const err = $('#dlg-err');
  $('#dlg-title').textContent = title;
  $('#dlg-body').innerHTML = body;
  err.textContent = '';
  ok.hidden = !onOk;
  ok.textContent = okLabel || 'تأكيد';
  ok.disabled = false;
  cancel.textContent = cancelLabel;
  cancel.onclick = () => dlg.close();
  ok.onclick = async () => {
    ok.disabled = true;
    err.textContent = '';
    try {
      const keep = await onOk();
      if (keep !== false) dlg.close();
    } catch (e) {
      err.textContent = describeApiError(e);
    } finally {
      ok.disabled = false;
    }
  };
  if (!dlg.open) dlg.showModal();
  return dlg;
};
const statusPill = s => (s === 'active' || s === 'inactive') ? `<span class="pill ${s}">${C.STAT[s]}</span>` : '';
const cooldownText = sec => {
  const n = Number(sec) || 0;
  if (!n) return '';
  return n % 60 === 0 ? (n / 60) + ' د' : n + ' ث';
};
const views = {
  async overview() {
    stage(`${head('نظرة عامة', 'إحصائيات الحسابات والأكواد')}
<div class="kpis" id="ov-kpis"><div class="kpi"><span>جاري التحميل...</span></div></div>
<div class="kpis" id="ov-srv"></div>
<div class="panel"><h3>أحدث النشاطات</h3><div class="list" id="ov-recent"></div></div>`);
    const [actSnap, usersSnap] = await Promise.all([
      getDocs(query(collection(db, 'activity'), orderBy('time', 'desc'))),
      getDocs(collection(db, 'users'))
    ]);
    let trialCount = 0;
    let regularCount = 0;
    let totalCredits = 0;
    const acts = [];
    actSnap.forEach(d => {
      const a = d.data();
      acts.push(a);
      if (a.kind === 'trial') trialCount++;
      if (a.kind === 'regular') regularCount++;
      totalCredits += (Number(a.credits) || 0);
    });
    $('#ov-kpis').innerHTML = `
      <div class="kpi"><span><i class="fa-solid fa-bolt"></i>أكواد تجريبية</span><b>${num(trialCount)}</b></div>
      <div class="kpi"><span><i class="fa-solid fa-key"></i>أكواد حقيقية</span><b>${num(regularCount)}</b></div>
      <div class="kpi"><span><i class="fa-solid fa-coins"></i>إجمالي النقاط</span><b>${num(totalCredits)}</b></div>
      <div class="kpi"><span><i class="fa-solid fa-users"></i>إجمالي الأعضاء</span><b>${num(usersSnap.size)}</b></div>
    `;
    $('#ov-recent').innerHTML = acts.slice(0, 10).map(a => `
      <div class="item">
        <div class="info">
          <b>${esc(a.name || 'عضو')} <span class="pill">${esc(C.KIND[a.kind] || a.kind)}</span></b>
          <small class="latin">${esc(a.key || '-')} · ${num(a.credits)} · ${when(a.time)}</small>
        </div>
      </div>
    `).join('') || '<p class="empty">لا يوجد نشاط مسجل بعد</p>';
    try {
      const b = await api('/balance');
      $('#ov-srv').innerHTML = `
        <div class="kpi"><span><i class="fa-solid fa-wallet"></i>رصيد الحساب</span><b>${num(b.balance)}</b></div>
        <div class="kpi"><span><i class="fa-solid fa-gift"></i>النقاط التجريبية</span><b>${num(b.trial)}</b></div>
        <div class="kpi"><span><i class="fa-solid fa-layer-group"></i>إجمالي الأكواد</span><b>${num(b.total_keys)}</b></div>
        <div class="kpi"><span><i class="fa-solid fa-laptop"></i>الأجهزة النشطة</span><b>${num(b.active_devices)}</b></div>
      `;
    } catch (e) {
      $('#ov-srv').innerHTML = `<div class="kpi"><span><i class="fa-solid fa-wallet"></i>رصيد الحساب</span><b>-</b></div>`;
    }
  },
  async keys() {
    const owner = isOwner();
    const cool = C.COOLDOWNS.map(o => `<option value="${o.s}">${o.t}</option>`).join('');
    const switches = [5, 6, 7, 8, 9, 10, 11, 12].map(n => `<option value="${n}">${n}</option>`).join('');
    stage(`${head('الأكواد', owner ? 'كل الأكواد وإدارتها' : 'الأكواد التي أنشأتها')}
<div class="panel">
  <h3>إنشاء كود جديد <small>الرصيد: <b id="k-bal" class="latin">...</b></small></h3>
  <div class="pb">
    <div class="seg">
      <button type="button" id="type-trial" aria-pressed="true">تجريبي</button>
      <button type="button" id="type-regular" aria-pressed="false">حقيقي</button>
    </div>
    <div class="form">
      <div class="f"><label for="k-name">اسم العميل</label><input id="k-name" maxlength="60"></div>
      <div class="f"><label for="k-mail">إيميل العميل</label><input id="k-mail" type="email" maxlength="80" dir="ltr"></div>
      <div class="f reg" hidden><label for="k-cr">النقاط</label><input id="k-cr" type="number" min="50" value="200" dir="ltr"></div>
      <div class="f reg" hidden><label for="k-dev">عدد الأجهزة</label><input id="k-dev" type="number" min="1" max="20" value="1" dir="ltr"></div>
      <div class="f reg" hidden><label for="k-sw">التبديل اليومي</label><select id="k-sw">${switches}</select></div>
      <div class="f reg" hidden><label for="k-cd">مدة الانتظار بين التبديلات</label><select id="k-cd">${cool}</select></div>
    </div>
    <div class="row end"><button type="button" class="btn" id="k-go"><i class="fa-solid fa-plus"></i><span>إنشاء الكود</span></button></div>
    <p id="k-low" class="msg" hidden>${C.LOW_TEXT}</p>
    <p id="k-msg" class="msg"></p>
    <div id="k-out"></div>
  </div>
</div>
<div class="panel">
  <h3>${owner ? 'كل الأكواد' : 'أكوادي'}</h3>
  <div class="tools">
    <input id="k-find" type="search" placeholder="بحث بالكود أو الاسم" maxlength="60">
    <select id="k-state"><option value="">كل الحالات</option><option value="active">نشط</option><option value="inactive">متوقف</option></select>
    <button type="button" class="btn ghost" id="k-refresh"><i class="fa-solid fa-rotate"></i><span>تحديث</span></button>
  </div>
  <div class="list" id="k-list"></div>
  <div class="more" id="k-more" hidden><button type="button" class="btn ghost" id="k-more-btn">عرض المزيد</button></div>
</div>`);
    let currentType = 'trial';
    let rows = [];
    let offset = 0;
    let timer = 0;
    const setType = t => {
      currentType = t;
      $('#type-trial').setAttribute('aria-pressed', String(t === 'trial'));
      $('#type-regular').setAttribute('aria-pressed', String(t === 'regular'));
      $$('.reg').forEach(e => { e.hidden = t !== 'regular'; });
    };
    $('#type-trial').onclick = () => setType('trial');
    $('#type-regular').onclick = () => setType('regular');
    const paintBalance = async () => {
      try {
        const b = await api('/balance');
        $('#k-bal').textContent = num(b.balance);
        $('#k-low').hidden = b.balance > 0;
      } catch (e) {
        $('#k-bal').textContent = '-';
      }
    };
    const paintRows = () => {
      $('#k-list').innerHTML = rows.length ? rows.map(k => `
        <div class="item">
          <div class="info">
            <b class="latin">${esc(k.key)} ${statusPill(k.status)}</b>
            <small>${esc(k.customer_name || 'بدون اسم')} · النقاط: ${num(k.credits)}${k.max_devices ? ` · الأجهزة: ${num(k.device_count)}/${num(k.max_devices)}` : ''}${k.daily_switch_limit ? ` · التبديل: ${num(k.daily_switch_limit)} يوميا` : ''}${cooldownText(k.switch_cooldown_seconds) ? ` · الانتظار: ${cooldownText(k.switch_cooldown_seconds)}` : ''}${owner && k.by ? ` · بواسطة: ${esc(k.by)}` : ''}</small>
          </div>
          <div class="acts">
            <button type="button" class="btn ghost sm" data-act="copy" data-key="${esc(k.key)}"><i class="fa-regular fa-copy"></i>نسخ</button>
            <button type="button" class="btn ghost sm" data-act="charge" data-key="${esc(k.key)}"><i class="fa-solid fa-bolt"></i>شحن</button>
            <button type="button" class="btn ghost sm" data-act="rename" data-key="${esc(k.key)}"><i class="fa-solid fa-pen"></i>الاسم</button>
            <button type="button" class="btn ghost sm" data-act="devices" data-key="${esc(k.key)}"><i class="fa-solid fa-laptop"></i>الأجهزة</button>
            <button type="button" class="btn ${k.status === 'inactive' ? '' : 'danger'} sm" data-act="toggle" data-key="${esc(k.key)}" data-to="${k.status === 'inactive' ? 'active' : 'inactive'}"><i class="fa-solid fa-power-off"></i>${k.status === 'inactive' ? 'تفعيل' : 'تعطيل'}</button>
          </div>
        </div>
      `).join('') : '<p class="empty">لا توجد أكواد</p>';
    };
    const load = async more => {
      if (!more) { offset = 0; rows = []; }
      const q = new URLSearchParams({ limit: String(C.PAGE), offset: String(offset) });
      const find = $('#k-find').value.trim();
      const state = $('#k-state').value;
      if (find) q.set('search', find);
      if (state) q.set('status', state);
      try {
        const res = await api('/keys?' + q.toString());
        rows = rows.concat(res.items);
        offset += res.items.length;
        $('#k-more').hidden = !res.has_more;
        paintRows();
      } catch (e) {
        $('#k-list').innerHTML = `<p class="empty">${esc(describeApiError(e))}</p>`;
        $('#k-more').hidden = true;
      }
    };
    const reload = () => Promise.all([load(false), paintBalance()]);
    const rowOf = key => rows.find(r => r.key === key) || { key };
    $('#k-list').onclick = e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const key = b.dataset.key;
      const row = rowOf(key);
      const act = b.dataset.act;
      if (act === 'copy') return copy(key);
      if (act === 'charge') {
        dlgOpen('شحن الكود', `<p class="latin">${esc(key)}</p><div class="f"><label for="d-cr">عدد النقاط</label><input id="d-cr" type="number" min="1" value="100" dir="ltr"></div>`, 'شحن', async () => {
          const credits = Number($('#d-cr').value);
          await api('/keys/' + encodeURIComponent(key) + '/recharge', { method: 'POST', body: { credits } });
          toast('تم شحن الكود');
          reload();
        });
        return;
      }
      if (act === 'rename') {
        dlgOpen('تعديل اسم العميل', `<p class="latin">${esc(key)}</p><div class="f"><label for="d-nm">الاسم</label><input id="d-nm" maxlength="60" value="${esc(row.customer_name || '')}"></div>`, 'حفظ', async () => {
          await api('/keys/' + encodeURIComponent(key) + '/update', { method: 'POST', body: { customer_name: $('#d-nm').value.trim() } });
          toast('تم حفظ الاسم');
          load(false);
        });
        return;
      }
      if (act === 'toggle') {
        const to = b.dataset.to;
        dlgOpen(to === 'inactive' ? 'تعطيل الكود' : 'تفعيل الكود', `<p class="latin">${esc(key)}</p><p>${to === 'inactive' ? 'سيتوقف الكود عن العمل حتى يتم تفعيله مرة أخرى.' : 'سيعود الكود للعمل مباشرة.'}</p>`, 'تأكيد', async () => {
          await api('/keys/' + encodeURIComponent(key) + '/update', { method: 'POST', body: { status: to } });
          toast(to === 'inactive' ? 'تم تعطيل الكود' : 'تم تفعيل الكود');
          load(false);
        });
        return;
      }
      if (act === 'devices') {
        const paint = async () => {
          const body = $('#dlg-body');
          try {
            const res = await api('/keys/' + encodeURIComponent(key) + '/devices');
            body.innerHTML = `<p class="latin">${esc(key)}</p>` + (res.items.length ? `<div class="list dev-list">${res.items.map(d => `
              <div class="item"><div class="info"><b class="latin">${esc(d.hwid)}</b><small>${esc([d.label, d.seen].filter(Boolean).join(' · '))}</small></div>
              <div class="acts"><button type="button" class="btn danger sm" data-hw="${esc(d.hwid)}">فصل</button></div></div>`).join('')}</div>` : '<p class="empty">لا توجد أجهزة متصلة</p>');
            $('#dlg-ok').hidden = !res.items.length;
            $$('[data-hw]', body).forEach(x => {
              x.onclick = async () => {
                x.disabled = true;
                try {
                  await api('/keys/' + encodeURIComponent(key) + '/devices/remove', { method: 'POST', body: { hwid: x.dataset.hw } });
                  toast('تم فصل الجهاز');
                  paint();
                  load(false);
                } catch (err) {
                  x.disabled = false;
                  $('#dlg-err').textContent = describeApiError(err);
                }
              };
            });
          } catch (err) {
            body.innerHTML = `<p class="empty">${esc(describeApiError(err))}</p>`;
            $('#dlg-ok').hidden = true;
          }
        };
        dlgOpen('الأجهزة المتصلة', '<p class="empty">جاري التحميل...</p>', 'فصل كل الأجهزة', async () => {
          await api('/keys/' + encodeURIComponent(key) + '/devices/remove', { method: 'POST', body: { reset_all: true } });
          toast('تم فصل كل الأجهزة');
          await paint();
          load(false);
          return false;
        }, 'إغلاق');
        paint();
      }
    };
    $('#k-go').onclick = async () => {
      const btn = $('#k-go');
      const msg = $('#k-msg');
      msg.textContent = '';
      $('#k-out').innerHTML = '';
      const body = {
        type: currentType,
        customer_name: $('#k-name').value.trim(),
        customer_email: $('#k-mail').value.trim()
      };
      if (currentType === 'regular') {
        body.credits = Number($('#k-cr').value);
        body.max_devices = Number($('#k-dev').value);
        body.daily_switches = Number($('#k-sw').value);
        body.switch_cooldown_seconds = Number($('#k-cd').value);
        if (!Number.isInteger(body.credits) || body.credits < 50) {
          msg.textContent = 'أقل عدد نقاط هو 50';
          return;
        }
      }
      btn.disabled = true;
      try {
        const res = await api('/keys', { method: 'POST', body });
        toast('تم إنشاء الكود بنجاح');
        $('#k-out').innerHTML = `<div class="keybox"><code>${esc(res.key)}</code><button type="button" class="btn ghost sm" id="k-cp-btn">نسخ</button></div>`;
        $('#k-cp-btn').onclick = () => copy(res.key);
        $('#k-name').value = '';
        $('#k-mail').value = '';
        reload();
      } catch (e) {
        msg.textContent = e && e.code === 'no_credit' ? '' : describeApiError(e);
        if (e && e.code === 'no_credit') $('#k-low').hidden = false;
        paintBalance();
      } finally {
        btn.disabled = false;
      }
    };
    $('#k-find').oninput = () => { clearTimeout(timer); timer = setTimeout(() => load(false), 400); };
    $('#k-state').onchange = () => load(false);
    $('#k-refresh').onclick = reload;
    $('#k-more-btn').onclick = () => load(true);
    reload();
  },
  async team() {
    const owner = isOwner();
    stage(`${head(owner ? 'كل الحسابات' : 'الموديريتورز')}
<div class="panel scroll" id="t-box"><p class="empty">جاري تحميل الفريق...</p></div>`);
    const snap = await getDocs(owner ? collection(db, 'users') : query(collection(db, 'users'), where('role', '==', 'Moderator')));
    const members = [];
    snap.forEach(d => {
      const m = { id: d.id, ...d.data() };
      if (owner || m.role === 'Moderator') members.push(m);
    });
    const draw = () => {
      $('#t-box').innerHTML = `
        <table class="tbl">
          <thead>
            <tr>
              <th>العضو</th>
              <th>الدور</th>
              <th>الحالة</th>
              <th>إجراءات</th>
            </tr>
          </thead>
          <tbody>
            ${members.map(m => `
              <tr>
                <td><span style="display:inline-flex;align-items:center;gap:10px">${face(m)}<span><b>${esc(m.name)}</b> <small>(${num(m.age)} سنة)</small></span></span></td>
                <td><span class="badge" data-role="${esc(m.role)}">${esc(C.ROLE[m.role] || m.role)}</span></td>
                <td><span class="pill ${esc(m.stat)}">${esc(C.STAT[m.stat] || m.stat)}</span></td>
                <td>
                  <div class="acts">
                    ${owner && m.stat !== 'done' ? `<button type="button" class="btn sm" data-stat="done" data-id="${esc(m.id)}">موافقة</button>` : ''}
                    ${owner && m.stat === 'done' ? `<button type="button" class="btn ghost sm" data-stat="m3lk" data-id="${esc(m.id)}">تعليق</button>` : ''}
                    ${owner && m.stat !== 'ban' ? `<button type="button" class="btn danger sm" data-stat="ban" data-id="${esc(m.id)}">حظر</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
      $$('[data-stat]').forEach(b => {
        b.onclick = async () => {
          const uid = b.dataset.id;
          const newStat = b.dataset.stat;
          try {
            await updateDoc(doc(db, 'users', uid), { stat: newStat });
            toast('تم تحديث حالة الحساب');
            views.team();
          } catch (e) {
            toast('تعذر التحديث', 'err');
          }
        };
      });
    };
    draw();
  },
  async storage() {
    if (!isOwner()) return go('profile');
    stage(`${head('مكان التخزين', 'متابعة حجم البيانات وإدارة السجلات')}
<div class="kpis">
  <div class="kpi"><span><i class="fa-solid fa-hard-drive"></i>الحجم المستخدم تقريبياً</span><b id="st-size">جاري الحساب...</b></div>
  <div class="kpi"><span><i class="fa-solid fa-list-check"></i>إجمالي سجلات الأكواد</span><b id="st-act-count">-</b></div>
  <div class="kpi"><span><i class="fa-solid fa-users"></i>إجمالي المستخدمين</span><b id="st-usr-count">-</b></div>
</div>
<div class="panel">
  <h3><i class="fa-solid fa-download"></i> تصدير ونسخ البيانات</h3>
  <div class="pb">
    <p class="sec">يمكنك تحميل نسخة احتياطية تشمل الأعضاء وسجلات النشاط.</p>
    <button type="button" class="btn" id="btn-export"><i class="fa-solid fa-file-arrow-down"></i> تحميل نسخة احتياطية</button>
  </div>
</div>
<div class="panel">
  <h3><i class="fa-solid fa-trash-can"></i> مسح السجلات</h3>
  <div class="pb">
    <p class="sec" style="color:var(--warn)">تنبيه: العمليات هنا تحذف سجلات النشاط من اللوحة فقط ولا تؤثر على الأكواد الفعلية للعملاء.</p>
    <div class="form" style="margin-top:1rem;">
      <div class="f">
        <label for="del-moderator">مسح أكواد مستخدم معين (موديريتور أو أدمن):</label>
        <div class="row">
          <select id="del-moderator"><option value="">اختر العضو...</option></select>
          <button type="button" class="btn danger" id="btn-del-user-acts"><i class="fa-solid fa-trash"></i> مسح أكواد هذا العضو</button>
        </div>
      </div>
      <div class="f" style="margin-top:1.5rem;">
        <label>مسح جماعي بحسب الرتبة:</label>
        <div class="row">
          <button type="button" class="btn danger" id="btn-del-all-mods"><i class="fa-solid fa-user-xmark"></i> مسح كل أكواد الموديريتورز فقط</button>
          <button type="button" class="btn danger" id="btn-del-all-acts"><i class="fa-solid fa-dumpster-fire"></i> مسح جميع سجلات الأكواد بالكامل</button>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="panel">
  <h3><i class="fa-solid fa-table"></i> سجلات النشاط</h3>
  <div class="list" id="st-acts-table"></div>
</div>`);
    const actSnap = await getDocs(collection(db, 'activity'));
    const usrSnap = await getDocs(collection(db, 'users'));
    const activities = [];
    actSnap.forEach(d => activities.push({ id: d.id, ...d.data() }));
    const users = [];
    usrSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
    const allData = {
      activity: activities,
      users
    };
    const jsonStr = JSON.stringify(allData);
    const bytes = new Blob([jsonStr]).size;
    let sizeFormatted = bytes + ' بايت';
    if (bytes > 1048576) {
      sizeFormatted = (bytes / 1048576).toFixed(2) + ' ميجابايت (MB)';
    } else if (bytes > 1024) {
      sizeFormatted = (bytes / 1024).toFixed(2) + ' كيلوبايت (KB)';
    }
    $('#st-size').textContent = sizeFormatted;
    $('#st-act-count').textContent = num(activities.length);
    $('#st-usr-count').textContent = num(users.length);
    const modSelect = $('#del-moderator');
    users.filter(u => u.role !== 'OWNER').forEach(u => {
      const opt = document.createElement('option');
      opt.value = u.id;
      opt.textContent = `${u.name} (${u.role})`;
      modSelect.appendChild(opt);
    });
    $('#btn-export').onclick = () => {
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MC_Ai_R_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast('تم بدء تحميل النسخة الاحتياطية');
    };
    $('#btn-del-user-acts').onclick = async () => {
      const targetUid = modSelect.value;
      if (!targetUid) return toast('يرجى اختيار عضو أولاً', 'err');
      const ids = activities.filter(a => a.uid === targetUid).map(a => a.id);
      if (!ids.length) return toast('لا توجد أكواد مسجلة لهذا العضو');
      if (!confirm('هل أنت متأكد من مسح جميع أكواد هذا العضو من اللوحة؟')) return;
      try {
        await wipe(ids);
        toast(`تم مسح ${ids.length} كود من اللوحة`);
        views.storage();
      } catch (e) {
        console.error(e);
        toast('تعذر المسح', 'err');
      }
    };
    $('#btn-del-all-mods').onclick = async () => {
      const modUids = new Set(users.filter(u => u.role === 'Moderator').map(u => u.id));
      const ids = activities.filter(a => modUids.has(a.uid)).map(a => a.id);
      if (!ids.length) return toast('لا توجد أكواد للموديريتورز');
      if (!confirm('هل تريد فعلاً مسح كل الأكواد التي أنشأها الموديريتورز من اللوحة؟')) return;
      try {
        await wipe(ids);
        toast(`تم مسح ${ids.length} كود للموديريتورز`);
        views.storage();
      } catch (e) {
        console.error(e);
        toast('تعذر المسح', 'err');
      }
    };
    $('#btn-del-all-acts').onclick = async () => {
      if (!activities.length) return toast('لا توجد سجلات');
      if (!confirm('تحذير نهائي: هل تريد مسح جميع سجلات الأكواد في قاعدة البيانات بالكامل؟')) return;
      try {
        await wipe(activities.map(a => a.id));
        toast('تم مسح جميع سجلات الأكواد بالكامل');
        views.storage();
      } catch (e) {
        console.error(e);
        toast('تعذر المسح', 'err');
      }
    };
    $('#st-acts-table').innerHTML = activities.length ? activities.map(a => `
      <div class="item">
        <div class="info">
          <b>${esc(a.key || 'كود')} <span class="pill">${esc(a.kind)}</span></b>
          <small>أنشأه: ${esc(a.name)} (${esc(a.uid)}) · التاريخ: ${when(a.time)}</small>
        </div>
        <div class="acts">
          <button type="button" class="btn danger sm" data-del-act="${esc(a.id)}"><i class="fa-solid fa-trash"></i> مسح</button>
        </div>
      </div>
    `).join('') : '<p class="empty">لا توجد سجلات</p>';
    $$('[data-del-act]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('مسح هذا الكود فقط من اللوحة؟')) return;
        try {
          await deleteDoc(doc(db, 'activity', b.dataset.delAct));
          toast('تم مسح السجل');
          views.storage();
        } catch (e) {
          toast('تعذر المسح', 'err');
        }
      };
    });
  },
  async profile() {
    const u = S.user;
    stage(`<div class="prof">
      <div class="panel">
        <div class="hero">
          <span class="ava big"><span>${esc(initial(u.name))}</span><img id="pf-img" alt="" referrerpolicy="no-referrer" hidden></span>
          <div>
            <h1>${esc(u.name)}</h1>
            <div class="chips">
              <span class="badge" data-role="${esc(u.role)}">${esc(C.ROLE[u.role] || u.role)}</span>
              <span class="chip">${num(u.age)} سنة</span>
              <span class="pill ${esc(u.stat)}">${esc(C.STAT[u.stat] || u.stat)}</span>
            </div>
          </div>
        </div>
        <div class="pb">
          <input id="pf-file" type="file" accept="image/*" hidden>
          <div class="row"><button type="button" class="btn ghost sm" id="pf-up"><i class="fa-solid fa-arrow-up-from-bracket"></i><span>رفع صورة شخصية</span></button></div>
          <p id="pf-msg" class="msg" aria-live="polite"></p>
        </div>
      </div>
    </div>`);
    const img = $('#pf-img');
    const paintPhoto = () => {
      img.onerror = () => { img.hidden = true; };
      img.hidden = !S.user.img_url;
      if (S.user.img_url) img.src = S.user.img_url;
      $('#pf-up').hidden = Boolean(S.user.img_url);
    };
    paintPhoto();
    $('#pf-up').onclick = () => $('#pf-file').click();
    $('#pf-file').onchange = async e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      const msg = $('#pf-msg');
      const btn = $('#pf-up');
      msg.removeAttribute('data-tone');
      msg.textContent = '';
      btn.disabled = true;
      try {
        const fresh = await getDoc(doc(db, 'users', S.user.id));
        if (fresh.exists() && fresh.data().img_url) {
          S.user.img_url = fresh.data().img_url;
          paintMe();
          paintPhoto();
          msg.textContent = 'تم رفع صورة لهذا الحساب من قبل ولا يمكن تغييرها';
          return;
        }
        const blob = await prepareImage(file);
        const url = await uploadAvatar(blob);
        await updateDoc(doc(db, 'users', S.user.id), { img_url: url });
        S.user.img_url = url;
        paintMe();
        paintPhoto();
        toast('تم رفع الصورة');
      } catch (err) {
        console.error(err);
        msg.textContent = err && err.code === 'permission-denied' ? 'لا توجد صلاحية لحفظ الصورة' : describeError(err);
      } finally {
        btn.disabled = false;
      }
    };
  }
};
const boot = async user => {
  if (!user) return leave();
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return leave();
    const u = snap.data();
    u.id = snap.id;
    if (u.stat !== 'done') return leave();
    S.user = u;
    paintMe();
    buildNav();
    go(isOwner() ? 'overview' : 'keys');
  } catch (e) {
    console.error(e);
    leave();
  }
};
authReady.then(boot);
