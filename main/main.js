import { 
  db, 
  rtdb, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  writeBatch,
  ref, 
  set, 
  get, 
  remove,
  update,
  authReady
} from './firebase-config.js';
import { prepareImage, uploadAvatar, describeError } from '../upload.js';
const C = {
  LOGIN: '../index.html',
  K: { t: 'mcr_token', u: 'mcr_user', n: 'mcr_nav' },
  ROLE: { OWNER: 'المالك', Admen: 'أدمن', Moderator: 'موديريتور' },
  STAT: { m3lk: 'معلق', done: 'مفعل', ban: 'محظور', active: 'نشط', inactive: 'متوقف' },
  KIND: { trial: 'كود تجريبي', regular: 'كود حقيقي', recharge: 'شحن' },
  RESELLER_BASE: 'http://52.21.185.77:3000/api/v1/reseller'
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
const S = { user: null, view: '' };
const isOwner = () => S.user && S.user.role === 'OWNER';
const leave = () => {
  store.del(C.K.t);
  store.del(C.K.u);
  location.replace(C.LOGIN);
};
const toast = (msg, tone = 'ok') => {
  const el = $('#toast');
  if (!el) return;
  el.textContent = msg;
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
    stage(`<div class="fault"><p class="msg">حدث خطأ أثناء تحميل الصفحة</p></div>`);
  }
};
const mirror = async (uid, data) => {
  try {
    await update(ref(rtdb, 'users/' + uid), data);
  } catch (e) {
    console.warn(e);
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
const views = {
  async overview() {
    stage(`${head('نظرة عامة', 'إحصائيات من Firebase')}
<div class="kpis" id="ov-kpis"><div class="kpi"><span>جاري التحميل...</span></div></div>
<div class="panel"><h3>أحدث النشاطات</h3><div class="list" id="ov-recent"></div></div>`);
    const actSnap = await getDocs(query(collection(db, 'activity'), orderBy('time', 'desc')));
    const usersSnap = await getDocs(collection(db, 'users'));
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
    const recentHtml = acts.slice(0, 10).map(a => `
      <div class="item">
        <div class="info">
          <b>${esc(a.name || 'عضو')} <span class="pill">${esc(C.KIND[a.kind] || a.kind)}</span></b>
          <small>${esc(a.key || '-')} · ${num(a.credits)} نقطة · ${when(a.time)}</small>
        </div>
      </div>
    `).join('');
    $('#ov-recent').innerHTML = recentHtml || '<p class="empty">لا يوجد نشاط مسجل بعد</p>';
  },
  async keys() {
    const priv = S.user.role !== 'Moderator';
    stage(`${head('الأكواد', 'إنشاء الأكواد وإدارتها ومتابعتها')}
<div class="panel">
  <h3>إنشاء كود جديد</h3>
  <div class="pb">
    <div class="seg">
      <button type="button" id="type-trial" class="btn" aria-pressed="true">تجريبي</button>
      <button type="button" id="type-regular" class="btn ghost" aria-pressed="false">حقيقي</button>
    </div>
    <div class="form">
      <div class="f"><label for="k-name">اسم العميل</label><input id="k-name" maxlength="60"></div>
      <div class="f"><label for="k-mail">إيميل العميل</label><input id="k-mail" type="email" maxlength="80" dir="ltr"></div>
      <div class="f reg" hidden><label for="k-cr">النقاط</label><input id="k-cr" type="number" min="50" value="200" dir="ltr"></div>
    </div>
    <div class="row end"><button type="button" class="btn" id="k-go"><i class="fa-solid fa-plus"></i><span>إنشاء الكود</span></button></div>
    <p id="k-msg" class="msg"></p>
    <div id="k-out"></div>
  </div>
</div>
<div class="panel">
  <h3>سجل الأكواد المسجلة في Firebase</h3>
  <div class="list" id="k-list"></div>
</div>`);
    let currentType = 'trial';
    $('#type-trial').onclick = () => {
      currentType = 'trial';
      $('#type-trial').className = 'btn';
      $('#type-regular').className = 'btn ghost';
      $$('.reg').forEach(e => e.hidden = true);
    };
    $('#type-regular').onclick = () => {
      currentType = 'regular';
      $('#type-regular').className = 'btn';
      $('#type-trial').className = 'btn ghost';
      $$('.reg').forEach(e => e.hidden = false);
    };
    const loadList = async () => {
      let qy = query(collection(db, 'activity'), orderBy('time', 'desc'));
      if (!priv) {
        qy = query(collection(db, 'activity'), where('uid', '==', S.user.id));
      }
      const snap = await getDocs(qy);
      const rows = [];
      snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
      $('#k-list').innerHTML = rows.length ? rows.map(k => `
        <div class="item">
          <div class="info">
            <b class="latin">${esc(k.key || 'كود')} <span class="pill ${esc(k.kind)}">${esc(C.KIND[k.kind] || k.kind)}</span></b>
            <small>بواسطة: ${esc(k.name)} · النقاط: ${num(k.credits)} · ${when(k.time)}</small>
          </div>
          <div class="acts">
            ${k.key ? `<button type="button" class="btn ghost sm" data-copy="${esc(k.key)}"><i class="fa-regular fa-copy"></i>نسخ</button>` : ''}
          </div>
        </div>
      `).join('') : '<p class="empty">لا توجد أكواد مسجلة</p>';
      $$('[data-copy]').forEach(b => {
        b.onclick = () => copy(b.dataset.copy);
      });
    };
    $('#k-go').onclick = async () => {
      const cName = $('#k-name').value.trim();
      const credits = currentType === 'regular' ? (Number($('#k-cr').value) || 200) : 0;
      const keyGen = 'MC-' + currentType.toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase() + '-' + Date.now().toString().slice(-4);
      const actDoc = {
        time: new Date().toISOString(),
        uid: S.user.id,
        name: S.user.name,
        kind: currentType,
        key: keyGen,
        credits: credits,
        cost: currentType === 'regular' ? Math.round(credits * 0.1) : 0,
        customer_name: cName,
        customer_email: $('#k-mail').value.trim()
      };
      try {
        await setDoc(doc(collection(db, 'activity')), actDoc);
        toast('تم إنشاء الكود وحفظه بنجاح');
        $('#k-out').innerHTML = `<div class="keybox"><code>${esc(keyGen)}</code><button type="button" class="btn ghost sm" id="k-cp-btn">نسخ</button></div>`;
        $('#k-cp-btn').onclick = () => copy(keyGen);
        loadList();
      } catch (e) {
        console.error(e);
        toast('تعذر حفظ الكود', 'err');
      }
    };
    loadList();
  },
  async team() {
    const owner = isOwner();
    stage(`${head(owner ? 'كل الحسابات' : 'الموديريتورز')}
<div class="panel scroll" id="t-box"><p class="empty">جاري تحميل الفريق...</p></div>`);
    const snap = await getDocs(collection(db, 'users'));
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
            await mirror(uid, { stat: newStat });
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
    stage(`${head('مكان التخزين (قاعدة بيانات Firebase)', 'مراقبة استهلاك المساحة والتحكم الكامل في مسح وتصدير البيانات')}
<div class="kpis">
  <div class="kpi"><span><i class="fa-solid fa-hard-drive"></i>الحجم المستخدم تقريبياً</span><b id="st-size">جاري الحساب...</b></div>
  <div class="kpi"><span><i class="fa-solid fa-list-check"></i>إجمالي سجلات الأكواد</span><b id="st-act-count">-</b></div>
  <div class="kpi"><span><i class="fa-solid fa-users"></i>إجمالي المستخدمين</span><b id="st-usr-count">-</b></div>
</div>
<div class="panel">
  <h3><i class="fa-solid fa-download"></i> تصدير ونسخ البيانات</h3>
  <div class="pb">
    <p class="sec">يمكنك تحميل نسخة احتياطية كاملة من قاعدة البيانات بصيغة JSON تشمل المستخدمين والنشاطات والأكواد.</p>
    <button type="button" class="btn" id="btn-export"><i class="fa-solid fa-file-arrow-down"></i> تحميل نسخة احتياطية (JSON Backup)</button>
  </div>
</div>
<div class="panel">
  <h3><i class="fa-solid fa-trash-can"></i> قسم المسح المقسم (من قاعدة البيانات فقط بدون لمس الـ API)</h3>
  <div class="pb">
    <p class="sec" style="color:var(--warn)">تنبيه: العمليات هنا تقوم بحذف السجلات من Firestore و Realtime Database دون المساس بالـ API أو السيرفر الخارجي.</p>
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
  <h3><i class="fa-solid fa-table"></i> استعراض تفصيلي لسجلات الأكواد في قاعدة البيانات</h3>
  <div class="list" id="st-acts-table"></div>
</div>`);
    const actSnap = await getDocs(collection(db, 'activity'));
    const usrSnap = await getDocs(collection(db, 'users'));
    const codeSnap = await getDocs(collection(db, 'scr_code'));
    const activities = [];
    actSnap.forEach(d => activities.push({ id: d.id, ...d.data() }));
    const users = [];
    usrSnap.forEach(d => users.push({ id: d.id, ...d.data() }));
    const codes = [];
    codeSnap.forEach(d => codes.push({ id: d.id, ...d.data() }));
    const allData = {
      activity: activities,
      users: users.map(({ password, ...rest }) => rest),
      scr_code: codes
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
      if (!confirm('هل أنت متأكد من مسح جميع أكواد هذا العضو من قاعدة البيانات؟')) return;
      try {
        await wipe(ids);
        toast(`تم مسح ${ids.length} كود من قاعدة البيانات`);
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
      if (!confirm('هل تريد فعلاً مسح كل الأكواد التي أنشأها الموديريتورز من قاعدة البيانات؟')) return;
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
          <button type="button" class="btn danger sm" data-del-act="${esc(a.id)}"><i class="fa-solid fa-trash"></i> مسح من الداتا بيز</button>
        </div>
      </div>
    `).join('') : '<p class="empty">لا توجد سجلات</p>';
    $$('[data-del-act]').forEach(b => {
      b.onclick = async () => {
        if (!confirm('مسح هذا الكود فقط من قاعدة البيانات؟')) return;
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
        await mirror(S.user.id, { img_url: url });
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
const boot = async () => {
  const token = store.get(C.K.t);
  if (!token) return leave();
  try {
    const snap = await getDoc(doc(db, 'users', token));
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
