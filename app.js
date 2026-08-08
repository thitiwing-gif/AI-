import { Api } from './api-client.js';

let user = null;
let layoutMode = localStorage.getItem('aps_layout') || 'auto'; // auto | mobile | desktop
let deferredInstall = null;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = 'toast ' + (type === 'success' ? 'ok' : type === 'error' ? 'err' : 'info');
  el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function setLoading(btn, on) {
  if (!btn) return;
  if (on) {
    btn.disabled = true;
    btn.dataset._h = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>';
  } else {
    btn.disabled = false;
    if (btn.dataset._h) btn.innerHTML = btn.dataset._h;
  }
}

function applyLayout() {
  document.body.classList.remove('force-mobile', 'force-desktop');
  const icon = $('#layout-icon');
  const label = $('#layout-label');
  if (layoutMode === 'mobile') {
    document.body.classList.add('force-mobile');
    if (icon) icon.className = 'fas fa-desktop';
    if (label) label.textContent = 'คอม';
  } else if (layoutMode === 'desktop') {
    document.body.classList.add('force-desktop');
    if (icon) icon.className = 'fas fa-mobile-screen';
    if (label) label.textContent = 'มือถือ';
  } else {
    if (icon) icon.className = 'fas fa-mobile-screen';
    if (label) label.textContent = 'อัตโนมัติ';
  }
}

// ─── Auth UI ─────────────────────────────────────
async function probeHealth() {
  const bar = $('#backend-bar');
  if (!bar) return;
  bar.classList.remove('ok', 'bad');
  bar.querySelector('.txt').textContent = 'กำลังเชื่อมต่อ...';
  const base = Api.getBase();
  const input = $('#api-base-input');
  if (input && base) input.value = base;
  try {
    const r = await Api.get('/api/health');
    bar.classList.add('ok');
    const where = base ? ' (remote)' : '';
    bar.querySelector('.txt').textContent = 'Backend พร้อม' + where + ' v' + (r.version || '1');
  } catch (e) {
    bar.classList.add('bad');
    bar.querySelector('.txt').textContent = base
      ? 'Backend ไม่ตอบที่ URL ที่ตั้งไว้'
      : 'Backend ไม่พร้อม — ตั้ง URL Backend หรือรัน server-lite.js';
  }
}

function showAuth(which) {
  $('#auth-view').classList.remove('hidden');
  $('#main-view').classList.add('hidden');
  ['view-login', 'view-register', 'view-admin-gate', 'view-admin-login'].forEach((id) => {
    $(`#${id}`).classList.toggle('hidden', id !== 'view-' + which);
  });
  if (which === 'login') probeHealth();
}

function showMain() {
  $('#auth-view').classList.add('hidden');
  $('#main-view').classList.remove('hidden');
  $('#sb-uname').textContent = user.username;
  $('#sb-urole').textContent = user.role;
  $('#sb-avatar').textContent = (user.username || 'U')[0].toUpperCase();
  $$('.admin-only').forEach((el) => el.classList.toggle('hidden', !['owner', 'admin'].includes(user.role)));
  updateChips();
}

async function updateChips() {
  try {
    const me = await Api.get('/api/auth/me');
    user = me.data;
    $('#quota-chip').textContent = `${user.quota_used}/${user.quota_limit}`;
  } catch { /* */ }
  try {
    const pr = await Api.get('/api/providers/status');
    const all = Object.values(pr.providers || {});
    const ok = all.filter((p) => p.status === 'CONNECTED').length;
    const chip = $('#provider-chip');
    if (ok === all.length && ok > 0) {
      chip.textContent = 'AI: OK';
      chip.className = 'chip ok';
    } else if (ok > 0) {
      chip.textContent = `AI: ${ok}/${all.length}`;
      chip.className = 'chip warn';
    } else {
      chip.textContent = 'AI: NOT CONFIGURED';
      chip.className = 'chip bad';
    }
  } catch {
    $('#provider-chip').textContent = 'AI: —';
  }
}

// ─── Router ──────────────────────────────────────
const TITLES = {
  dashboard: 'หน้าแรก', create: 'สร้าง Content', analyze: 'วิเคราะห์สินค้า', projects: 'โปรเจกต์', products: 'สินค้า',
  characters: 'ตัวละคร / นางแบบ', 'ai-studio': 'AI Studio', videos: 'วิดีโอ',
  media: 'สื่อของฉัน', templates: 'เทมเพลต', jobs: 'งาน', downloads: 'ดาวน์โหลด',
  settings: 'ตั้งค่า', admin: 'ผู้ดูแลระบบ',
};

async function navigate() {
  const route = (location.hash || '#dashboard').replace(/^#/, '') || 'dashboard';

  if (!user) {
    if (['register', 'secure-admin-login', 'admin-account-login'].includes(route)) {
      showAuth(route === 'register' ? 'register' : route === 'secure-admin-login' ? 'admin-gate' : route === 'admin-account-login' ? 'admin-login' : 'login');
      return;
    }
    showAuth('login');
    return;
  }

  if (['login', 'register', 'secure-admin-login', 'admin-account-login'].includes(route)) {
    location.hash = '#dashboard';
    return;
  }

  if (route === 'admin' && !['owner', 'admin'].includes(user.role)) {
    toast('ไม่มีสิทธิ์', 'error');
    location.hash = '#dashboard';
    return;
  }

  showMain();
  $('#top-title').textContent = TITLES[route] || route;
  $$('.nav-link, .bn-item').forEach((a) => {
    a.classList.toggle('active', a.dataset.route === route);
  });
  $('#sidebar').classList.remove('open');

  const page = $('#page');
  page.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
  try {
    const fn = Pages[route] || Pages.dashboard;
    await fn(page);
  } catch (e) {
    page.innerHTML = `<div class="empty"><i class="fas fa-triangle-exclamation"></i><p>${esc(e.message)}</p></div>`;
    toast(e.message, 'error');
  }
}

// ─── Pages ───────────────────────────────────────
const Pages = {
  async dashboard(el) {
    let projects = [], jobs = [], providers = {};
    try {
      const [p, j, pr] = await Promise.all([
        Api.get('/api/projects'),
        Api.get('/api/jobs'),
        Api.get('/api/providers/status'),
      ]);
      projects = p.data || [];
      jobs = j.data || [];
      providers = pr.providers || {};
    } catch (e) {
      toast(e.message, 'error');
    }

    const pct = user.quota_limit ? Math.round((user.quota_used / user.quota_limit) * 100) : 0;

    el.innerHTML = `
      <div class="welcome">ยินดีต้อนรับกลับ, ${esc(user.username)} 👋</div>
      <div class="sub">วันนี้คุณพร้อมสร้างสรรค์อะไรบ้าง?</div>

      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <span style="font-size:.85rem;color:var(--muted)">โควตาของคุณ</span>
          <span class="badge badge-ok">${esc(user.package || 'free')}</span>
        </div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div style="font-size:.8rem;color:var(--muted);margin-top:6px">ใช้ไปแล้ว ${user.quota_used} / ${user.quota_limit} เครดิต</div>
      </div>

      <div class="grid grid-4" style="margin-bottom:16px">
        <div class="stat"><div class="lbl">โปรเจกต์ทั้งหมด</div><div class="val">${projects.length}</div></div>
        <div class="stat"><div class="lbl">งานที่เกี่ยวข้อง</div><div class="val">${jobs.length}</div></div>
        <div class="stat"><div class="lbl">งานที่เสร็จสิ้น</div><div class="val">${jobs.filter(j=>j.status==='completed').length}</div></div>
        <div class="stat"><div class="lbl">กำลังทำ</div><div class="val">${jobs.filter(j=>j.status==='processing'||j.status==='queued').length}</div></div>
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="card-title">เครื่องมือด่วน</div>
        <div class="grid grid-4">
          <button class="qa" data-go="create"><i class="fas fa-plus"></i>สร้างโปรเจกต์</button>
          <button class="qa" data-go="ai-studio"><i class="fas fa-robot"></i>AI Studio</button>
          <button class="qa" data-go="create"><i class="fas fa-image"></i>สร้างภาพ</button>
          <button class="qa" data-go="videos"><i class="fas fa-video"></i>สร้างวิดีโอ</button>
        </div>
      </div>

      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">โปรเจกต์ล่าสุด</div>
          ${projects.length === 0 ? '<div class="empty"><p>ยังไม่มีโปรเจกต์</p></div>' : `
            <div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>อัปเดต</th></tr></thead><tbody>
              ${projects.slice(0,5).map(p=>`<tr style="cursor:pointer" data-go="projects"><td>${esc(p.name)}</td><td>${fmt(p.updated_at)}</td></tr>`).join('')}
            </tbody></table></div>`}
        </div>
        <div class="card">
          <div class="card-title">สถานะ AI Providers</div>
          ${Object.entries(providers).map(([k,v]) => `
            <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
              <span>${esc(v.name||k)}</span>
              <span class="badge ${v.status==='CONNECTED'?'badge-ok':'badge-bad'}">${esc(v.status)}</span>
            </div>`).join('') || '<p class="sub">ไม่พบข้อมูล</p>'}
          <p style="font-size:.78rem;color:var(--muted);margin-top:10px">
            ถ้าเป็น NOT_CONFIGURED ให้ใส่ API Key ในไฟล์ <code>.env</code> แล้วรีสตาร์ทเซิร์ฟเวอร์
          </p>
        </div>
      </div>
    `;
    el.querySelectorAll('[data-go]').forEach((b) => b.onclick = () => { location.hash = '#' + b.dataset.go; });
  },

  async create(el) {
    el.innerHTML = `
      <div class="steps">
        <span class="step on">1 สินค้า</span>
        <span class="step">2 รายละเอียด</span>
        <span class="step">3 AI</span>
        <span class="step">4 ผลลัพธ์</span>
      </div>
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">ข้อมูลสินค้า</div>
          <label class="f">URL สินค้า</label>
          <div class="row">
            <input class="f" id="c-url" placeholder="https://..." style="margin:0;flex:2" />
            <button class="btn btn-secondary btn-sm" id="c-paste">วาง</button>
            <button class="btn btn-primary btn-sm" id="c-import">วิเคราะห์ลิงก์</button>
          </div>
          <label class="f" style="margin-top:12px">ชื่อสินค้า</label>
          <input class="f" id="c-name" />
          <label class="f">ราคา</label>
          <input class="f" id="c-price" />
          <label class="f">รายละเอียด</label>
          <textarea class="f" id="c-desc"></textarea>
          <div class="actions">
            <button class="btn btn-primary" id="c-magic"><i class="fas fa-wand-magic-sparkles"></i> AI Magic Generation</button>
            <button class="btn btn-secondary" id="c-save"><i class="fas fa-save"></i> บันทึกโปรเจกต์</button>
          </div>
        </div>
        <div class="card">
          <div class="card-title">ผลลัพธ์ AI</div>
          <div class="actions">
            <button class="btn btn-secondary btn-sm" id="c-img"><i class="fas fa-image"></i> สร้างภาพ</button>
            <button class="btn btn-secondary btn-sm" id="c-vid"><i class="fas fa-video"></i> สร้างวิดีโอ</button>
            <button class="btn btn-secondary btn-sm" id="c-copy"><i class="fas fa-copy"></i> คัดลอก</button>
          </div>
          <div id="c-out" class="empty"><p>กด AI Magic เพื่อสร้างคอนเทนต์</p></div>
        </div>
      </div>
    `;

    const product = () => ({
      name: $('#c-name').value.trim(),
      description: $('#c-desc').value.trim(),
      price: $('#c-price').value.trim(),
      url: $('#c-url').value.trim(),
    });

    $('#c-paste').onclick = async () => {
      try {
        $('#c-url').value = await navigator.clipboard.readText();
      } catch {
        toast('อ่านคลิปบอร์ดไม่ได้', 'error');
      }
    };

    $('#c-import').onclick = async () => {
      const url = $('#c-url').value.trim();
      if (!url) return toast('ใส่ URL', 'error');
      setLoading($('#c-import'), true);
      try {
        const r = await Api.post('/api/products/import-url', { url });
        $('#c-name').value = r.data.name || '';
        $('#c-desc').value = r.data.description || '';
        $('#c-price').value = r.data.price || '';
        toast('ดึงข้อมูลสำเร็จ', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading($('#c-import'), false);
      }
    };

    let lastText = null;
    $('#c-magic').onclick = async () => {
      const p = product();
      if (!p.name) return toast('ใส่ชื่อสินค้า', 'error');
      setLoading($('#c-magic'), true);
      try {
        const r = await Api.post('/api/ai/text', { product: p });
        lastText = r.data.text;
        let parsed = null;
        try {
          const m = lastText.match(/\{[\s\S]*\}/);
          if (m) parsed = JSON.parse(m[0]);
        } catch { /* */ }
        $('#c-out').innerHTML = parsed
          ? `<div style="font-size:.9rem;white-space:pre-wrap">
              <strong>แคปชัน</strong>\n${esc(parsed.caption || '')}\n\n
              <strong>สคริปต์</strong>\n${esc(parsed.script || '')}\n\n
              <strong>โพสต์</strong>\n${esc(parsed.post || '')}\n\n
              <strong>Image Prompt</strong>\n${esc(parsed.imagePrompt || '')}
            </div>`
          : `<div style="font-size:.9rem;white-space:pre-wrap">${esc(lastText)}</div>`;
        toast('สร้างคอนเทนต์สำเร็จ', 'success');
        updateChips();
      } catch (e) {
        toast(e.message, 'error');
        if (e.code === 'NOT_CONFIGURED') {
          $('#c-out').innerHTML = `<div class="empty"><i class="fas fa-key"></i>
            <p><strong>NOT CONFIGURED</strong></p>
            <p style="font-size:.85rem">ใส่ GEMINI_API_KEY หรือ OPENAI_API_KEY ในไฟล์ <code>.env</code> แล้วรีสตาร์ทเซิร์ฟเวอร์</p></div>`;
        }
      } finally {
        setLoading($('#c-magic'), false);
      }
    };

    $('#c-save').onclick = async () => {
      const p = product();
      if (!p.name) return toast('ใส่ชื่อสินค้า', 'error');
      setLoading($('#c-save'), true);
      try {
        await Api.post('/api/projects', { name: p.name, data: { product: p, content: lastText } });
        toast('บันทึกโปรเจกต์แล้ว', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading($('#c-save'), false);
      }
    };

    $('#c-img').onclick = async () => {
      const p = product();
      const prompt = p.name ? `Professional product photo of ${p.name}, ${p.description || ''}, studio lighting` : '';
      if (!prompt) return toast('ใส่ชื่อสินค้า', 'error');
      setLoading($('#c-img'), true);
      try {
        const r = await Api.post('/api/ai/image', { prompt });
        $('#c-out').innerHTML = `<img class="preview" src="${esc(r.data.result?.url || '')}" alt="gen" />
          <div class="actions"><a class="btn btn-sm btn-primary" href="${esc(r.data.result?.url || '')}" target="_blank" download>ดาวน์โหลดภาพ</a></div>`;
        toast('สร้างภาพสำเร็จ', 'success');
        updateChips();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading($('#c-img'), false);
      }
    };

    $('#c-vid').onclick = async () => {
      setLoading($('#c-vid'), true);
      try {
        await Api.post('/api/ai/video', { script: product().description || product().name });
        toast('ส่งงานวิดีโอแล้ว', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading($('#c-vid'), false);
      }
    };

    $('#c-copy').onclick = async () => {
      const t = $('#c-out')?.innerText || '';
      try {
        await navigator.clipboard.writeText(t);
        toast('คัดลอกแล้ว', 'success');
      } catch {
        toast('คัดลอกไม่สำเร็จ', 'error');
      }
    };
  },


  async analyze(el) {
    el.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">วิเคราะห์สินค้า</div>
        <p class="sub">รองรับ URL สินค้า / รูปภาพ — แยก SOURCE DATA กับ AI GENERATED</p>
        <label class="f">Product URL หรือ Image URL</label>
        <div class="row">
          <input class="f" id="a-url" placeholder="https://shopee.co.th/... หรือลิงก์รูป" style="margin:0;flex:2" />
          <button class="btn btn-secondary btn-sm" id="a-paste">วาง</button>
        </div>
        <div class="actions">
          <button class="btn btn-primary" id="a-run"><i class="fas fa-magnifying-glass"></i> วิเคราะห์</button>
        </div>
      </div>
      <div id="a-result" class="hidden"></div>
    `;
    let last = null;
    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text || ''); toast('คัดลอกแล้ว', 'success'); }
      catch { toast('คัดลอกไม่สำเร็จ', 'error'); }
    };
    $('#a-paste').onclick = async () => {
      try { $('#a-url').value = await navigator.clipboard.readText(); } catch { toast('อ่านคลิปบอร์ดไม่ได้', 'error'); }
    };
    $('#a-run').onclick = async () => {
      const url = $('#a-url').value.trim();
      if (!url) return toast('ใส่ URL', 'error');
      setLoading($('#a-run'), true);
      try {
        const r = await Api.post('/api/products/import-url', { url });
        last = r.data;
        // Save product record
        let saved = null;
        try {
          const save = await Api.post('/api/products', {
            name: last.name || 'สินค้า',
            description: last.description || '',
            price: last.price || '',
            url: last.url || url,
            product_code: last.product_code,
            source_platform: last.source_platform,
            source_type: last.source_type || 'url',
            source_data: last.source_data,
          });
          saved = save.data;
          last.product_code = saved.product_code || last.product_code;
          last.id = saved.id;
        } catch (e) { console.warn(e); }
        const code = last.product_code || '-';
        $('#a-result').classList.remove('hidden');
        $('#a-result').innerHTML = `
          <div class="card" style="margin-bottom:12px">
            <div class="card-title">Product Code</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <code style="font-size:1.1rem;font-weight:700">${esc(code)}</code>
              <button class="btn btn-sm btn-secondary" id="a-copy-code">คัดลอกรหัส</button>
              <button class="btn btn-sm btn-primary" id="a-to-create">ใช้สร้าง Content</button>
            </div>
            <p class="sub" style="margin-top:8px">แพลตฟอร์ม: <strong>${esc(last.source_platform || '-')}</strong></p>
          </div>
          <div class="card" style="margin-bottom:12px">
            <div class="card-title">SOURCE DATA (จากต้นทาง)</div>
            <p class="sub">ข้อมูลที่ดึงได้จริงเท่านั้น — ช่องว่าง = ดึงไม่ได้</p>
            ${field('ชื่อ', last.name)}
            ${field('รายละเอียด', last.description)}
            ${field('ราคา', last.price || '(ไม่พบ)')}
            ${field('URL', last.url)}
            ${field('แพลตฟอร์ม', last.source_platform)}
          </div>
          <div class="card">
            <div class="card-title">AI GENERATED DATA</div>
            <p class="sub">ยังไม่สร้างอัตโนมัติจนกดวิเคราะห์ด้วย AI (ต้องมี API Key)</p>
            <button class="btn btn-secondary btn-sm" id="a-ai">ให้ AI วิเคราะห์เพิ่ม</button>
            <div id="a-ai-out" style="margin-top:10px"></div>
          </div>`;
        $('#a-copy-code').onclick = () => copy(code);
        $('#a-to-create').onclick = () => {
          sessionStorage.setItem('acs_product', JSON.stringify(last));
          location.hash = '#create';
          toast('โหลดสินค้าเข้าหน้าสร้าง Content', 'success');
        };
        $('#a-ai').onclick = async () => {
          setLoading($('#a-ai'), true);
          try {
            const ar = await Api.post('/api/ai/text', {
              prompt: `วิเคราะห์สินค้าจากข้อมูลนี้แล้วตอบ JSON เท่านั้น:\nชื่อ: ${last.name}\nรายละเอียด: ${last.description}\n\n{"category":"","features":[],"keywords":[],"target_audience":"","selling_points":[]}`,
              system: 'ตอบเป็น JSON ภาษาไทยเท่านั้น อย่าแต่งราคาหรือใบรับรองที่ไม่มีในข้อมูล'
            });
            $('#a-ai-out').innerHTML = `<div style="white-space:pre-wrap;font-size:.88rem">${esc(ar.data.text)}</div>
              <button class="btn btn-sm btn-secondary" style="margin-top:8px" id="a-copy-ai">คัดลอก</button>`;
            $('#a-copy-ai').onclick = () => copy(ar.data.text);
            toast('AI วิเคราะห์แล้ว', 'success');
            updateChips();
          } catch (e) {
            toast(e.message, 'error');
            $('#a-ai-out').innerHTML = `<p class="sub">${esc(e.message)}</p>`;
          } finally {
            setLoading($('#a-ai'), false);
          }
        };
        // copy buttons for fields
        $$('#a-result [data-copy]').forEach((b) => b.onclick = () => copy(b.dataset.copy));
        toast('วิเคราะห์เสร็จ', 'success');
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading($('#a-run'), false);
      }
    };
    function field(label, val) {
      const v = val || '';
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.8rem;color:var(--muted)">${esc(label)}</span>
          <button class="btn btn-sm btn-secondary" data-copy="${esc(v)}">คัดลอก</button>
        </div>
        <div style="font-size:.9rem;margin-top:4px;white-space:pre-wrap">${esc(v || 'ไม่พบข้อมูล')}</div>
      </div>`;
    }
  },

  async projects(el) {
    const r = await Api.get('/api/projects');
    const items = r.data || [];
    el.innerHTML = `
      <div class="actions">
        <button class="btn btn-primary" id="p-new"><i class="fas fa-plus"></i> สร้างโปรเจกต์</button>
        <button class="btn btn-secondary" id="p-ref"><i class="fas fa-rotate"></i> รีเฟรช</button>
      </div>
      ${items.length === 0 ? '<div class="empty"><i class="fas fa-folder-open"></i><p>ยังไม่มีโปรเจกต์</p></div>' : `
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>ชื่อ</th><th>สถานะ</th><th>อัปเดต</th><th></th></tr></thead>
          <tbody>
            ${items.map(p => `<tr>
              <td>${esc(p.name)}</td>
              <td><span class="badge badge-muted">${esc(p.status||'draft')}</span></td>
              <td>${fmt(p.updated_at)}</td>
              <td>
                <button class="btn btn-sm btn-secondary" data-open="${p.id}">เปิด</button>
                <button class="btn btn-sm btn-danger" data-del="${p.id}">ลบ</button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`}
    `;
    $('#p-new').onclick = async () => {
      const name = prompt('ชื่อโปรเจกต์');
      if (!name) return;
      await Api.post('/api/projects', { name });
      toast('สร้างแล้ว', 'success');
      Pages.projects(el);
    };
    $('#p-ref').onclick = () => Pages.projects(el);
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (!confirm('ลบโปรเจกต์นี้?')) return;
        await Api.del('/api/projects/' + b.dataset.del);
        toast('ลบแล้ว', 'success');
        Pages.projects(el);
      };
    });
    el.querySelectorAll('[data-open]').forEach((b) => {
      b.onclick = () => { location.hash = '#create'; };
    });
  },

  async products(el) {
    const r = await Api.get('/api/products');
    const items = r.data || [];
    el.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">เพิ่มสินค้า</div>
        <label class="f">ชื่อ</label><input class="f" id="pr-name" />
        <label class="f">ราคา</label><input class="f" id="pr-price" />
        <label class="f">รายละเอียด</label><textarea class="f" id="pr-desc"></textarea>
        <button class="btn btn-primary" id="pr-save">บันทึกสินค้า</button>
      </div>
      <div id="pr-list"></div>
    `;
    const list = $('#pr-list');
    list.innerHTML = items.length === 0
      ? '<div class="empty"><p>ยังไม่มีสินค้า</p></div>'
      : `<div class="card"><div class="table-wrap"><table><thead><tr><th>ชื่อ</th><th>ราคา</th><th></th></tr></thead><tbody>
          ${items.map(p=>`<tr><td>${esc(p.name)}</td><td>${esc(p.price||'-')}</td>
            <td><button class="btn btn-sm btn-danger" data-del="${p.id}">ลบ</button></td></tr>`).join('')}
        </tbody></table></div></div>`;
    $('#pr-save').onclick = async () => {
      const name = $('#pr-name').value.trim();
      if (!name) return toast('ใส่ชื่อ', 'error');
      await Api.post('/api/products', {
        name,
        price: $('#pr-price').value,
        description: $('#pr-desc').value,
      });
      toast('บันทึกแล้ว', 'success');
      Pages.products(el);
    };
    list.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        await Api.del('/api/products/' + b.dataset.del);
        toast('ลบแล้ว', 'success');
        Pages.products(el);
      };
    });
  },

  async characters(el) {
    const r = await Api.get('/api/characters');
    const items = r.data || [];
    el.innerHTML = `
      <div class="card" style="margin-bottom:14px">
        <div class="card-title">สร้างตัวละคร / นางแบบ</div>
        <label class="f">ชื่อ</label><input class="f" id="ch-name" />
        <label class="f">สไตล์</label><input class="f" id="ch-style" />
        <label class="f">คำอธิบาย</label><textarea class="f" id="ch-desc"></textarea>
        <button class="btn btn-primary" id="ch-save">สร้างตัวละคร</button>
      </div>
      <div class="grid grid-3">
        ${items.map(c => `
          <div class="card">
            <div style="font-weight:600">${esc(c.name)}</div>
            <div style="font-size:.82rem;color:var(--muted)">${esc(c.style||'')}</div>
            <button class="btn btn-sm btn-danger" style="margin-top:8px" data-del="${c.id}">ลบ</button>
          </div>`).join('') || '<div class="empty" style="grid-column:1/-1"><p>ยังไม่มีตัวละคร</p></div>'}
      </div>
    `;
    $('#ch-save').onclick = async () => {
      const name = $('#ch-name').value.trim();
      if (!name) return toast('ใส่ชื่อ', 'error');
      await Api.post('/api/characters', {
        name,
        style: $('#ch-style').value,
        description: $('#ch-desc').value,
      });
      toast('สร้างแล้ว', 'success');
      Pages.characters(el);
    };
    el.querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        await Api.del('/api/characters/' + b.dataset.del);
        toast('ลบแล้ว', 'success');
        Pages.characters(el);
      };
    });
  },

  async 'ai-studio'(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title">AI Studio</div>
        <p class="sub">เขียนแคปชัน สคริปต์ วิเคราะห์สินค้า — เรียก Text AI จริงผ่าน Backend</p>
        <label class="f">ข้อความ / คำสั่ง</label>
        <textarea class="f" id="ai-prompt" placeholder="เช่น: ช่วยเขียนแคปชันโปรโมทเซรั่มบำรุงผิว..."></textarea>
        <div class="actions">
          <button class="btn btn-primary" id="ai-send"><i class="fas fa-paper-plane"></i> ส่ง</button>
          <button class="btn btn-secondary" id="ai-copy"><i class="fas fa-copy"></i> คัดลอก</button>
        </div>
        <div id="ai-out" class="empty"><p>ผลลัพธ์จะแสดงที่นี่</p></div>
      </div>
    `;
    let last = '';
    $('#ai-send').onclick = async () => {
      const prompt = $('#ai-prompt').value.trim();
      if (!prompt) return toast('พิมพ์ข้อความ', 'error');
      setLoading($('#ai-send'), true);
      try {
        const r = await Api.post('/api/ai/text', { prompt });
        last = r.data.text;
        $('#ai-out').innerHTML = `<div style="white-space:pre-wrap;font-size:.9rem">${esc(last)}</div>`;
        toast('สำเร็จ (' + (r.data.provider || 'ai') + ')', 'success');
        updateChips();
      } catch (e) {
        toast(e.message, 'error');
        if (e.code === 'NOT_CONFIGURED') {
          $('#ai-out').innerHTML = `<div class="empty"><i class="fas fa-key"></i>
            <p><strong>NOT CONFIGURED</strong></p>
            <p>ตั้งค่า GEMINI_API_KEY / OPENAI_API_KEY ใน .env</p></div>`;
        }
      } finally {
        setLoading($('#ai-send'), false);
      }
    };
    $('#ai-copy').onclick = async () => {
      try {
        await navigator.clipboard.writeText(last || $('#ai-out').innerText);
        toast('คัดลอกแล้ว', 'success');
      } catch {
        toast('คัดลอกไม่สำเร็จ', 'error');
      }
    };
  },

  async videos(el) {
    el.innerHTML = `
      <div class="card">
        <div class="card-title">สร้างวิดีโอด้วย AI</div>
        <label class="f">สคริปต์</label>
        <textarea class="f" id="v-script" placeholder="สคริปต์วิดีโอ..."></textarea>
        <div class="actions">
          <button class="btn btn-primary" id="v-gen"><i class="fas fa-video"></i> สร้างวิดีโอ</button>
          <a class="btn btn-secondary" href="https://www.capcut.com" target="_blank" rel="noopener">เปิด CapCut</a>
          <a class="btn btn-secondary" href="https://runwayml.com" target="_blank" rel="noopener">เปิด Runway</a>
        </div>
        <div id="v-out" class="empty"><p>ผลลัพธ์ / สถานะงาน</p></div>
      </div>
    `;
    $('#v-gen').onclick = async () => {
      const script = $('#v-script').value.trim();
      if (!script) return toast('ใส่สคริปต์', 'error');
      setLoading($('#v-gen'), true);
      try {
        const r = await Api.post('/api/ai/video', { script });
        $('#v-out').innerHTML = `<pre style="font-size:.85rem">${esc(JSON.stringify(r.data, null, 2))}</pre>`;
        toast('ส่งงานแล้ว', 'success');
      } catch (e) {
        toast(e.message, 'error');
        $('#v-out').innerHTML = `<div class="empty"><p>${esc(e.message)}</p>
          ${e.code === 'NOT_CONFIGURED' ? '<p style="font-size:.85rem">ใส่ VIDEO_API_KEY ใน .env</p>' : ''}</div>`;
      } finally {
        setLoading($('#v-gen'), false);
      }
    };
  },

  async media(el) {
    const r = await Api.get('/api/media');
    const items = r.data || [];
    el.innerHTML = `
      <div class="actions">
        <label class="btn btn-primary btn-sm" style="cursor:pointer">
          <i class="fas fa-upload"></i> อัปโหลด
          <input type="file" id="m-up" hidden accept="image/*,video/*" />
        </label>
      </div>
      <div class="grid grid-3" style="margin-top:12px">
        ${items.map(m => `
          <div class="card">
            ${m.url && m.type==='image' ? `<img class="preview" src="${esc(m.url)}" style="width:100%;height:120px;object-fit:cover" />` : ''}
            <div style="font-size:.88rem;margin-top:6px">${esc(m.name)}</div>
            <span class="badge badge-muted">${esc(m.type)}</span>
            ${m.url ? `<a class="btn btn-sm btn-secondary" style="margin-top:8px" href="${esc(m.url)}" download target="_blank"><i class="fas fa-download"></i></a>` : ''}
          </div>`).join('') || '<div class="empty" style="grid-column:1/-1"><p>ยังไม่มีสื่อ</p></div>'}
      </div>
    `;
    $('#m-up').onchange = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const fd = new FormData();
      fd.append('file', file);
      try {
        await Api.request('POST', '/api/media/upload', fd);
        toast('อัปโหลดสำเร็จ', 'success');
        Pages.media(el);
      } catch (err) {
        toast(err.message, 'error');
      }
    };
  },

  async templates(el) {
    const tpls = [
      { id: 'sell', icon: 'fa-cart-shopping', t: 'ขายสินค้า', d: 'แคปชัน + ภาพโฆษณา' },
      { id: 'review', icon: 'fa-star', t: 'รีวิวสินค้า', d: 'สไตล์รีวิวจริงใจ' },
      { id: 'tiktok', icon: 'fa-tiktok', t: 'TikTok / Reels', d: 'คลิปสั้น 9:16' },
      { id: 'yt', icon: 'fa-youtube', t: 'YouTube Shorts', d: 'สคริปต์ + thumbnail' },
      { id: 'story', icon: 'fa-book', t: 'นิทาน', d: 'ฉาก + ตัวละคร' },
      { id: 'ads', icon: 'fa-bullhorn', t: 'โฆษณา', d: 'CTA ชัดเจน' },
    ];
    el.innerHTML = `
      <div class="grid grid-3">
        ${tpls.map(t => `
          <div class="tpl" data-id="${t.id}">
            <i class="fas ${t.icon}"></i>
            <div class="t">${t.t}</div>
            <div class="d">${t.d}</div>
          </div>`).join('')}
      </div>
    `;
    el.querySelectorAll('.tpl').forEach((c) => {
      c.onclick = () => {
        sessionStorage.setItem('aps_tpl', c.dataset.id);
        location.hash = '#create';
        toast('เลือกเทมเพลตแล้ว', 'success');
      };
    });
  },

  async jobs(el) {
    const r = await Api.get('/api/jobs');
    const items = r.data || [];
    el.innerHTML = `
      <div class="actions"><button class="btn btn-secondary btn-sm" id="j-ref"><i class="fas fa-rotate"></i> รีเฟรช</button></div>
      ${items.length === 0 ? '<div class="empty"><p>ยังไม่มีงาน</p></div>' : `
        <div class="card"><div class="table-wrap"><table>
          <thead><tr><th>ประเภท</th><th>สถานะ</th><th>ความคืบหน้า</th><th>เวลา</th><th></th></tr></thead>
          <tbody>
            ${items.map(j => `<tr>
              <td>${esc(j.type)}</td>
              <td><span class="badge ${j.status==='completed'?'badge-ok':j.status==='failed'?'badge-bad':'badge-warn'}">${esc(j.status)}</span></td>
              <td><div class="bar" style="width:80px"><i style="width:${j.progress||0}%"></i></div></td>
              <td>${fmt(j.created_at)}</td>
              <td>${['queued','processing'].includes(j.status) ? `<button class="btn btn-sm btn-danger" data-cancel="${j.id}">ยกเลิก</button>` : ''}</td>
            </tr>`).join('')}
          </tbody>
        </table></div></div>`}
    `;
    $('#j-ref').onclick = () => Pages.jobs(el);
    el.querySelectorAll('[data-cancel]').forEach((b) => {
      b.onclick = async () => {
        try {
          await Api.post('/api/jobs/' + b.dataset.cancel + '/cancel');
          toast('ยกเลิกแล้ว', 'success');
          Pages.jobs(el);
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });
  },

  async downloads(el) {
    const r = await Api.get('/api/media');
    const items = (r.data || []).filter((m) => m.url);
    el.innerHTML = items.length === 0
      ? '<div class="empty"><i class="fas fa-download"></i><p>ยังไม่มีไฟล์ให้ดาวน์โหลด</p></div>'
      : `<div class="card"><div class="table-wrap"><table>
          <thead><tr><th>ชื่อ</th><th>ประเภท</th><th></th></tr></thead>
          <tbody>
            ${items.map(m => `<tr>
              <td>${esc(m.name)}</td><td>${esc(m.type)}</td>
              <td><a class="btn btn-sm btn-primary" href="${esc(m.url)}" download target="_blank"><i class="fas fa-download"></i></a></td>
            </tr>`).join('')}
          </tbody></table></div></div>`;
  },

  async settings(el) {
    el.innerHTML = `
      <div class="grid grid-2">
        <div class="card">
          <div class="card-title">โปรไฟล์</div>
          <label class="f">ชื่อผู้ใช้</label><input class="f" id="s-user" value="${esc(user.username)}" />
          <label class="f">อีเมล</label><input class="f" id="s-email" value="${esc(user.email)}" />
          <button class="btn btn-primary" id="s-save">บันทึก</button>
          <hr style="border-color:var(--border);margin:16px 0" />
          <label class="f">รหัสผ่านเดิม</label><input class="f" type="password" id="s-old" />
          <label class="f">รหัสผ่านใหม่</label><input class="f" type="password" id="s-new" />
          <button class="btn btn-secondary" id="s-pw">เปลี่ยนรหัสผ่าน</button>
        </div>
        <div class="card">
          <div class="card-title">สมาชิก / VIP Code</div>
          <div id="s-plan-box" class="sub">กำลังโหลดแผน...</div>
          <label class="f" style="margin-top:12px">🎟️ ใส่ VIP Code</label>
          <div class="row">
            <input class="f" id="s-vip" placeholder="VIP-XXXXXXXX" style="margin:0" />
            <button class="btn btn-primary" id="s-vip-redeem">เปิดใช้งาน VIP</button>
          </div>
          <p class="sub" style="margin-top:8px">สมาชิกไม่ต้องกรอก API Key — ใช้ Provider ของระบบ</p>
          <hr style="border-color:var(--border);margin:16px 0" />
          <label class="f">รหัสคูปองโควตา (เก่า)</label>
          <div class="row">
            <input class="f" id="s-coupon" placeholder="WELCOME50" style="margin:0" />
            <button class="btn btn-secondary" id="s-redeem">ใช้คูปอง</button>
          </div>
          <p class="sub" style="margin-top:12px">แพ็กเกจ: <strong>${esc(user.package)}</strong> · โควตา ${user.quota_used}/${user.quota_limit}</p>
          <div class="actions" style="margin-top:16px">
            <button class="btn btn-secondary" id="s-layout">สลับโหมดมือถือ/คอม</button>
            <button class="btn btn-secondary" id="s-install"><i class="fas fa-download"></i> ติดตั้งแอป</button>
          </div>
          ${['owner','admin'].includes(user.role) ? `
            <hr style="border-color:var(--border);margin:16px 0" />
            <a href="#admin" class="btn btn-primary btn-sm">ไปหน้า Admin</a>
          ` : ''}
        </div>
      </div>
    `;
    $('#s-save').onclick = async () => {
      try {
        const r = await Api.patch('/api/users/me', {
          username: $('#s-user').value.trim(),
          email: $('#s-email').value.trim(),
        });
        user = r.data;
        toast('บันทึกแล้ว', 'success');
        showMain();
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    $('#s-pw').onclick = async () => {
      try {
        await Api.patch('/api/users/me/password', {
          oldPassword: $('#s-old').value,
          newPassword: $('#s-new').value,
        });
        toast('เปลี่ยนรหัสผ่านแล้ว', 'success');
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    
    // membership plan load
    try {
      const mr = await Api.get('/api/membership/me');
      const m = mr.data;
      const feats = Object.entries(m.features || {}).map(([k,v]) => `${v?'✓':'✕'} ${k.replace('FEATURE_','')}`).join('<br>');
      $('#s-plan-box').innerHTML = `<strong>Plan: ${(m.plan||'free').toUpperCase()}</strong> · โควตา ${m.quota_used}/${m.quota_limit}` +
        (m.expires_at ? `<br>หมดอายุ: ${fmt(m.expires_at)}` : '') +
        `<div style="margin-top:8px;font-size:.8rem">${feats}</div>`;
    } catch (e) {
      $('#s-plan-box').textContent = 'โหลดแผนไม่สำเร็จ';
    }
    $('#s-vip-redeem').onclick = async () => {
      try {
        const r = await Api.post('/api/membership/redeem', { code: $('#s-vip').value.trim() });
        toast(r.data.message || 'เปิด VIP สำเร็จ', 'success');
        await updateChips();
        Pages.settings(el);
      } catch (e) {
        toast(e.message, 'error');
      }
    };

    $('#s-redeem').onclick = async () => {
      try {
        const r = await Api.post('/api/coupons/redeem', { code: $('#s-coupon').value.trim() });
        toast(`ใช้คูปองสำเร็จ +${r.data.value}`, 'success');
        updateChips();
      } catch (e) {
        toast(e.message, 'error');
      }
    };
    $('#s-layout').onclick = () => $('#btn-layout-toggle').click();
    $('#s-install').onclick = () => tryInstall();
  },

  async admin(el) {
    const r = await Api.get('/api/admin/users');
    const users = r.data || [];
    el.innerHTML = `
      <div class="card">
        <div class="card-title">จัดการผู้ใช้</div>
        <div class="table-wrap"><table>
          <thead><tr><th>ชื่อ</th><th>อีเมล</th><th>Role</th><th>สถานะ</th><th>โควตา</th></tr></thead>
          <tbody>
            ${users.map(u => `<tr>
              <td>${esc(u.username)}</td>
              <td>${esc(u.email)}</td>
              <td>
                <select data-role="${u.id}" ${u.role==='owner'&&user.role!=='owner'?'disabled':''}>
                  ${['member','vip','admin','owner'].map(role =>
                    `<option value="${role}" ${u.role===role?'selected':''} ${role==='owner'&&user.role!=='owner'?'disabled':''}>${role}</option>`
                  ).join('')}
                </select>
              </td>
              <td>
                <select data-status="${u.id}">
                  <option value="active" ${u.status==='active'?'selected':''}>active</option>
                  <option value="inactive" ${u.status==='inactive'?'selected':''}>inactive</option>
                </select>
              </td>
              <td>${u.quota_used}/${u.quota_limit}</td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>
    `;
    el.querySelectorAll('[data-role]').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await Api.post('/api/admin/users/role', { userId: sel.dataset.role, role: sel.value });
          toast('อัปเดต role', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });
    el.querySelectorAll('[data-status]').forEach((sel) => {
      sel.onchange = async () => {
        try {
          await Api.post('/api/admin/users/status', { userId: sel.dataset.status, status: sel.value });
          toast('อัปเดตสถานะ', 'success');
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });

    // Membership codes section
    const codesWrap = document.createElement('div');
    codesWrap.className = 'card';
    codesWrap.style.marginTop = '16px';
    codesWrap.innerHTML = `
      <div class="card-title">🔑 สร้างโค้ดสมาชิก (VIP Code)</div>
      <p class="sub">VIP Code ≠ API Key — ใช้เปิดสิทธิ์/โควตาให้สมาชิกเท่านั้น</p>
      <div class="row">
        <div><label class="f">Package</label>
          <select class="f" id="mc-pkg"><option value="vip">VIP</option><option value="pro">PRO</option><option value="premium">PREMIUM</option></select>
        </div>
        <div><label class="f">ใช้ได้สูงสุด</label><input class="f" id="mc-max" type="number" value="10" /></div>
        <div><label class="f">Quota</label><input class="f" id="mc-quota" type="number" value="500" /></div>
      </div>
      <button class="btn btn-primary" id="mc-create">สร้างรหัส</button>
      <div id="mc-new" class="sub" style="margin-top:10px"></div>
      <div id="mc-list" style="margin-top:14px"></div>
    `;
    el.appendChild(codesWrap);

    const loadCodes = async () => {
      try {
        const r = await Api.get('/api/admin/membership/codes');
        const list = r.data || [];
        $('#mc-list').innerHTML = list.length === 0 ? '<p class="sub">ยังไม่มีรหัส</p>' :
          `<div class="table-wrap"><table><thead><tr><th>Code</th><th>Package</th><th>ใช้แล้ว</th><th>สถานะ</th><th></th></tr></thead><tbody>
          ${list.map(c => `<tr>
            <td><code>${esc(c.code)}</code></td>
            <td>${esc(c.package_name)}</td>
            <td>${c.used_count}/${c.max_uses}</td>
            <td>${esc(c.status)}</td>
            <td>
              <button class="btn btn-sm btn-secondary" data-copy="${esc(c.code)}">คัดลอก</button>
              <button class="btn btn-sm btn-danger" data-disable="${esc(c.code)}">${c.status==='active'?'ปิด':'เปิด'}</button>
            </td>
          </tr>`).join('')}
          </tbody></table></div>`;
        $$('#mc-list [data-copy]').forEach(b => b.onclick = async () => {
          try { await navigator.clipboard.writeText(b.dataset.copy); toast('คัดลอกแล้ว','success'); } catch { toast('คัดลอกไม่สำเร็จ','error'); }
        });
        $$('#mc-list [data-disable]').forEach(b => b.onclick = async () => {
          const code = b.dataset.disable;
          const cur = list.find(x => x.code === code);
          try {
            await Api.request('PATCH', '/api/admin/membership/codes/' + encodeURIComponent(code), {
              status: cur?.status === 'active' ? 'disabled' : 'active'
            });
            toast('อัปเดตแล้ว','success');
            loadCodes();
          } catch (e) { toast(e.message,'error'); }
        });
      } catch (e) {
        $('#mc-list').innerHTML = `<p class="sub">${esc(e.message)}</p>`;
      }
    };
    $('#mc-create').onclick = async () => {
      try {
        const r = await Api.post('/api/admin/membership/codes', {
          package_name: $('#mc-pkg').value,
          max_uses: Number($('#mc-max').value) || 1,
          quota: Number($('#mc-quota').value) || 500,
        });
        $('#mc-new').innerHTML = `✓ สร้างแล้ว: <strong>${esc(r.data.code)}</strong> <button class="btn btn-sm btn-secondary" id="mc-copy-new">คัดลอก</button>`;
        $('#mc-copy-new').onclick = async () => {
          try { await navigator.clipboard.writeText(r.data.code); toast('คัดลอกแล้ว','success'); } catch {}
        };
        toast('สร้างรหัสสำเร็จ','success');
        loadCodes();
      } catch (e) { toast(e.message,'error'); }
    };
    loadCodes();
  },
};

function fmt(iso) {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

// ─── PWA install ─────────────────────────────────
function tryInstall() {
  if (deferredInstall) {
    deferredInstall.prompt();
    deferredInstall.userChoice.then(() => { deferredInstall = null; });
    return;
  }
  // Fallback: instructions
  toast('บนมือถือ: เปิดเมนูเบราว์เซอร์ → เพิ่มไปยังหน้าจอหลัก / Install App', 'info');
}

// ─── Bind ────────────────────────────────────────
function bind() {
  $('#btn-retry-health').onclick = probeHealth;
  const saveBaseBtn = $('#btn-save-api-base');
  if (saveBaseBtn) {
    saveBaseBtn.onclick = () => {
      const v = ($('#api-base-input')?.value || '').trim();
      Api.setBase(v);
      toast(v ? 'บันทึก URL Backend แล้ว' : 'ล้าง URL Backend แล้วใช้ relative path', 'success');
      probeHealth();
    };
  }
  const baseInput = $('#api-base-input');
  if (baseInput) baseInput.value = Api.getBase() || '';

  $('#form-login').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#login-err');
    err.classList.add('hidden');
    setLoading($('#btn-login'), true);
    try {
      const r = await Api.post('/api/auth/login', {
        username: $('#login-user').value.trim(),
        password: $('#login-pass').value,
      });
      Api.setToken(r.token);
      user = r.user;
      toast('เข้าสู่ระบบสำเร็จ', 'success');
      location.hash = '#dashboard';
      await navigate();
    } catch (ex) {
      err.textContent = ex.message || 'เข้าสู่ระบบไม่สำเร็จ';
      err.style.whiteSpace = 'pre-wrap';
      err.classList.remove('hidden');
    } finally {
      setLoading($('#btn-login'), false);
    }
  };

  $('#form-register').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#reg-err');
    err.classList.add('hidden');
    if ($('#reg-pass').value !== $('#reg-pass2').value) {
      err.textContent = 'รหัสผ่านไม่ตรงกัน';
      err.classList.remove('hidden');
      return;
    }
    try {
      const r = await Api.post('/api/auth/register', {
        username: $('#reg-user').value.trim(),
        email: $('#reg-email').value.trim(),
        password: $('#reg-pass').value,
      });
      Api.setToken(r.token);
      user = r.user;
      toast('สมัครสำเร็จ', 'success');
      location.hash = '#dashboard';
      await navigate();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  };

  $('#form-admin-gate').onsubmit = (e) => {
    e.preventDefault();
    const err = $('#gate-err');
    err.classList.add('hidden');
    // security code verified on admin-login endpoint together
    sessionStorage.setItem('aps_gate', $('#admin-sec').value);
    location.hash = '#admin-account-login';
    showAuth('admin-login');
  };

  $('#form-admin-login').onsubmit = async (e) => {
    e.preventDefault();
    const err = $('#admin-err');
    err.classList.add('hidden');
    try {
      const r = await Api.post('/api/auth/admin-login', {
        username: $('#admin-user').value.trim(),
        password: $('#admin-pass').value,
        securityCode: sessionStorage.getItem('aps_gate') || '',
      });
      Api.setToken(r.token);
      user = r.user;
      sessionStorage.removeItem('aps_gate');
      toast('เข้าสู่ระบบ Admin สำเร็จ', 'success');
      location.hash = '#dashboard';
      await navigate();
    } catch (ex) {
      err.textContent = ex.message;
      err.classList.remove('hidden');
    }
  };

  $('#go-register').onclick = (e) => { e.preventDefault(); location.hash = '#register'; showAuth('register'); };
  $('#go-login').onclick = (e) => { e.preventDefault(); location.hash = '#login'; showAuth('login'); };
  $('#go-admin-gate').onclick = () => { location.hash = '#secure-admin-login'; showAuth('admin-gate'); };

  $('#btn-logout').onclick = async () => {
    try { await Api.post('/api/auth/logout'); } catch { /* */ }
    Api.setToken(null);
    user = null;
    location.hash = '#login';
    showAuth('login');
  };

  $('#btn-menu').onclick = () => $('#sidebar').classList.toggle('open');

  $('#btn-layout-toggle').onclick = () => {
    if (layoutMode === 'auto') layoutMode = 'mobile';
    else if (layoutMode === 'mobile') layoutMode = 'desktop';
    else layoutMode = 'auto';
    localStorage.setItem('aps_layout', layoutMode);
    applyLayout();
    toast('โหมดแสดงผล: ' + (layoutMode === 'auto' ? 'อัตโนมัติ' : layoutMode === 'mobile' ? 'มือถือ' : 'คอมพิวเตอร์'), 'info');
  };

  $('#btn-install-pwa').onclick = tryInstall;

  // nav
  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-route]');
    if (a) {
      e.preventDefault();
      location.hash = '#' + a.dataset.route;
    }
  });

  window.addEventListener('hashchange', navigate);
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstall = e;
  });
}

async function init() {
  applyLayout();
  bind();
  const token = Api.getToken();
  if (token) {
    try {
      const r = await Api.get('/api/auth/me');
      user = r.data;
    } catch {
      Api.setToken(null);
    }
  }
  if (!location.hash) location.hash = user ? '#dashboard' : '#login';
  await navigate();
}

init();
