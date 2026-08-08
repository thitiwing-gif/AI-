const TOKEN_KEY = 'aps_token';
const API_BASE_KEY = 'aps_api_base';

function normalizeBase(url) {
  if (!url) return '';
  let u = String(url).trim().replace(/\/+$/, '');
  // allow origin only
  if (u && !u.startsWith('http://') && !u.startsWith('https://')) {
    u = 'https://' + u;
  }
  return u;
}

export const Api = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  },

  getBase() {
    return normalizeBase(localStorage.getItem(API_BASE_KEY) || window.APS_API_BASE || '');
  },
  setBase(url) {
    const n = normalizeBase(url);
    if (n) localStorage.setItem(API_BASE_KEY, n);
    else localStorage.removeItem(API_BASE_KEY);
  },

  url(path) {
    const base = this.getBase();
    if (!path.startsWith('/')) path = '/' + path;
    // If base set, always use it for /api
    if (base) return base + path;
    return path;
  },

  async request(method, path, body, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (body && !(body instanceof FormData)) headers['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const full = path.startsWith('http') ? path : this.url(path);

    let res;
    try {
      res = await fetch(full, {
        method,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      const err = new Error(
        'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้\n' +
        'ถ้าเปิดผ่าน Netlify ต้องตั้ง URL Backend (เช่น https://xxx.railway.app)\n' +
        'หรือรัน node backend/server-lite.js แล้วเปิด localhost'
      );
      err.code = 'SERVER_UNAVAILABLE';
      throw err;
    }

    const ct = (res.headers.get('content-type') || '').toLowerCase();
    const text = await res.text();

    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      // Netlify often returns index.html for /api/* → not JSON
      const looksHtml = text.trimStart().startsWith('<!') || text.includes('<html');
      const err = new Error(
        looksHtml
          ? 'Backend ไม่ได้รันที่โฮสต์นี้ (ได้หน้าเว็บแทน API)\nตั้งค่า URL Backend ด้านล่าง หรือรัน server-lite.js'
          : 'เซิร์ฟเวอร์ตอบกลับไม่ใช่ JSON (Invalid response)'
      );
      err.code = 'INVALID_RESPONSE';
      err.status = res.status;
      throw err;
    }

    if (!res.ok || data.success === false) {
      const err = new Error(data.message || res.statusText || 'Error');
      err.code = data.code || 'ERROR';
      err.status = res.status;
      throw err;
    }
    return data;
  },

  get: (p) => Api.request('GET', p),
  post: (p, b) => Api.request('POST', p, b),
  put: (p, b) => Api.request('PUT', p, b),
  patch: (p, b) => Api.request('PATCH', p, b),
  del: (p) => Api.request('DELETE', p),
};
