import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { URL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA = path.join(__dirname, 'data');
const UPLOADS = path.join(__dirname, 'uploads');
const PORT = Number(process.env.PORT) || 3847;

for (const d of [DATA, UPLOADS]) if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });

const DB_FILE = path.join(DATA, 'db.json');

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const now = new Date().toISOString();
    const db = {
      users: [],
      sessions: {},
      projects: [],
      products: [],
      characters: [],
      jobs: [],
      media: [],
      settings: {
        admin_security_password: 'secure2024',
        app_name: 'AI Creator Studio',
        global_features: {
          FEATURE_ANALYZE_PRODUCT: true,
          FEATURE_CREATE_CONTENT: true,
          FEATURE_IMAGE_GENERATION: true,
          FEATURE_VIDEO_GENERATION: true,
          FEATURE_AVATAR: false,
          FEATURE_VOICE: false,
          FEATURE_AI_CHAT: true,
          FEATURE_PRODUCT_IMPORT: true,
          FEATURE_DOWNLOAD: true,
          FEATURE_TEMPLATE: true,
          FEATURE_PROJECT: true,
        },
        plan_defaults: {
          free: { quota_limit: 50, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: false, FEATURE_AVATAR: false, FEATURE_VOICE: false, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
          vip: { quota_limit: 500, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: true, FEATURE_AVATAR: true, FEATURE_VOICE: true, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
          pro: { quota_limit: 2000, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: true, FEATURE_AVATAR: true, FEATURE_VOICE: true, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
        },
      },
      coupons: {
        WELCOME50: { type: 'quota', value: 50, used: 0, max_uses: 100 },
        PROMO100: { type: 'quota', value: 100, used: 0, max_uses: 50 },
      },
      membership_codes: {},
      membership_redemptions: [],
      membership_history: [],
      quota_usage: [],
    };
    // seed users with sha256 passwords (simple)
    const seed = (username, email, password, role, pkg, limit) => {
      db.users.push({
        id: uid(), username, email,
        password_hash: hash(password),
        role, status: 'active', package: pkg,
        plan: pkg === 'enterprise' ? 'pro' : pkg === 'pro' ? 'vip' : 'free',
        quota_used: 0, quota_limit: limit,
        features_override: {},
        membership_code: null,
        membership_expires: null,
        avatar: null, created_at: now, updated_at: now,
      });
    };
    seed('owner', 'owner@studio.local', 'owner123', 'owner', 'enterprise', 99999);
    seed('admin', 'admin@studio.local', 'admin123', 'admin', 'pro', 500);
    seed('member', 'member@studio.local', 'member123', 'member', 'free', 50);
    saveDb(db);
    return db;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!db.membership_codes) db.membership_codes = {};
  if (!db.membership_redemptions) db.membership_redemptions = [];
  if (!db.membership_history) db.membership_history = [];
  if (!db.quota_usage) db.quota_usage = [];
  if (!db.settings) db.settings = {};
  if (!db.settings.global_features) {
    db.settings.global_features = {
      FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true,
      FEATURE_VIDEO_GENERATION: true, FEATURE_AVATAR: false, FEATURE_VOICE: false, FEATURE_AI_CHAT: true,
      FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true,
    };
  }
  if (!db.settings.plan_defaults) {
    db.settings.plan_defaults = {
      free: { quota_limit: 50, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: false, FEATURE_AVATAR: false, FEATURE_VOICE: false, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
      vip: { quota_limit: 500, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: true, FEATURE_AVATAR: true, FEATURE_VOICE: true, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
      pro: { quota_limit: 2000, features: { FEATURE_ANALYZE_PRODUCT: true, FEATURE_CREATE_CONTENT: true, FEATURE_IMAGE_GENERATION: true, FEATURE_VIDEO_GENERATION: true, FEATURE_AVATAR: true, FEATURE_VOICE: true, FEATURE_AI_CHAT: true, FEATURE_PRODUCT_IMPORT: true, FEATURE_DOWNLOAD: true, FEATURE_TEMPLATE: true, FEATURE_PROJECT: true } },
    };
  }
  for (const u of db.users || []) {
    if (!u.plan) u.plan = u.package === 'enterprise' ? 'pro' : u.package === 'pro' ? 'vip' : 'free';
    if (!u.features_override) u.features_override = {};
  }
  return db;
}

function saveDb(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 0));
}

function uid() { return crypto.randomBytes(12).toString('hex'); }

function productCode() { return 'PROD-' + crypto.randomBytes(3).toString('hex').toUpperCase(); }
function detectPlatform(url) {
  const u = (url || '').toLowerCase();
  if (!u) return 'unknown';
  if (u.includes('shopee.')) return 'shopee';
  if (u.includes('lazada.')) return 'lazada';
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook';
  if (u.includes('instagram.com')) return 'instagram';
  if (u.includes('tiktok.com')) return 'tiktok';
  if (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(u)) return 'image_url';
  return 'website';
}

function hash(pw) { return crypto.createHash('sha256').update('aps:' + pw).digest('hex'); }
function verify(pw, h) { return hash(pw) === h; }


function resolveAccess(db, user, feature) {
  // expire VIP
  if (user.membership_expires && new Date(user.membership_expires) < new Date()) {
    if (user.plan !== 'free') {
      db.membership_history.push({ id: uid(), user_id: user.id, previous_plan: user.plan, new_plan: 'free', action: 'expire', created_at: new Date().toISOString() });
      user.plan = 'free';
      user.package = 'free';
      user.membership_code = null;
      user.membership_expires = null;
      const def = db.settings.plan_defaults?.free;
      if (def) user.quota_limit = def.quota_limit;
      saveDb(db);
    }
  }
  const global = db.settings.global_features || {};
  if (global[feature] === false) {
    return { allowed: false, reason: 'FEATURE_GLOBALLY_DISABLED', plan: user.plan || 'free' };
  }
  if (user.features_override && typeof user.features_override[feature] === 'boolean') {
    return { allowed: user.features_override[feature], source: 'individual', plan: user.plan || 'free', quotaRemaining: Math.max(0, (user.quota_limit||0) - (user.quota_used||0)) };
  }
  const plan = (user.plan || 'free').toLowerCase();
  const planFeat = db.settings.plan_defaults?.[plan]?.features || db.settings.plan_defaults?.free?.features || {};
  const allowed = planFeat[feature] !== false;
  return { allowed, source: 'plan', plan, quotaRemaining: Math.max(0, (user.quota_limit||0) - (user.quota_used||0)) };
}

function requireFeature(db, user, feature) {
  const a = resolveAccess(db, user, feature);
  if (!a.allowed) {
    const e = new Error('บัญชีของคุณไม่มีสิทธิ์ใช้งานฟังก์ชันนี้');
    e.code = 'FEATURE_NOT_ALLOWED';
    e.status = 403;
    throw e;
  }
  if (a.quotaRemaining !== undefined && a.quotaRemaining <= 0) {
    const e = new Error('โควต้าการใช้งานของคุณหมดแล้ว');
    e.code = 'QUOTA_EXCEEDED';
    e.status = 429;
    throw e;
  }
  return a;
}

function sanitize(u) {
  if (!u) return null;
  const { password_hash, ...rest } = u;
  return {
    ...rest,
    plan: rest.plan || 'free',
    features_override: rest.features_override || {},
  };
}

function providers() {
  const g = process.env.GEMINI_API_KEY;
  const o = process.env.OPENAI_API_KEY;
  const c = process.env.CLAUDE_API_KEY;
  const i = process.env.IMAGE_API_KEY || o;
  const v = process.env.VIDEO_API_KEY;
  return {
    text: { name: g ? 'Gemini' : o ? 'OpenAI' : c ? 'Claude' : 'Text AI', status: (g||o||c) ? 'CONNECTED' : 'NOT_CONFIGURED', configured: !!(g||o||c) },
    image: { name: i ? 'Image Provider' : 'Image AI', status: i ? 'CONNECTED' : 'NOT_CONFIGURED', configured: !!i },
    video: { name: v ? 'Video Provider' : 'Video AI', status: v ? 'CONNECTED' : 'NOT_CONFIGURED', configured: !!v },
  };
}

async function genText(prompt, system) {
  const gemini = process.env.GEMINI_API_KEY;
  const openai = process.env.OPENAI_API_KEY;
  if (!gemini && !openai) {
    const e = new Error('Text AI ยังไม่ได้ตั้งค่า — ใส่ GEMINI_API_KEY หรือ OPENAI_API_KEY ใน .env แล้วรีสตาร์ท');
    e.code = 'NOT_CONFIGURED'; throw e;
  }
  if (gemini) {
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${gemini}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: (system ? system + '\n\n' : '') + prompt }] }] }) });
    if (!res.ok) { const e = new Error('Gemini: ' + (await res.text()).slice(0,200)); e.code='PROVIDER_ERROR'; throw e; }
    const data = await res.json();
    return { text: data?.candidates?.[0]?.content?.parts?.[0]?.text || '', provider: 'gemini' };
  }
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + openai },
    body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [...(system?[{role:'system',content:system}]:[]), {role:'user',content:prompt}] }),
  });
  if (!res.ok) { const e = new Error('OpenAI: ' + (await res.text()).slice(0,200)); e.code='PROVIDER_ERROR'; throw e; }
  const data = await res.json();
  return { text: data.choices?.[0]?.message?.content || '', provider: 'openai' };
}

async function genImage(prompt) {
  const key = process.env.IMAGE_API_KEY || process.env.OPENAI_API_KEY;
  if (!key) { const e = new Error('Image AI ยังไม่ได้ตั้งค่า — ใส่ IMAGE_API_KEY หรือ OPENAI_API_KEY ใน .env'); e.code='NOT_CONFIGURED'; throw e; }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
    body: JSON.stringify({ model: process.env.IMAGE_MODEL || 'dall-e-3', prompt, n: 1, size: '1024x1024' }),
  });
  if (!res.ok) { const e = new Error('Image: ' + (await res.text()).slice(0,200)); e.code='PROVIDER_ERROR'; throw e; }
  const data = await res.json();
  return { url: data.data?.[0]?.url, provider: 'openai-image' };
}

function json(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); } catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

function getUser(req, db) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token || !db.sessions[token]) return null;
  const s = db.sessions[token];
  if (new Date(s.expires_at) < new Date()) { delete db.sessions[token]; saveDb(db); return null; }
  return db.users.find((u) => u.id === s.user_id) || null;
}

function mime(p) {
  if (p.endsWith('.html')) return 'text/html; charset=utf-8';
  if (p.endsWith('.css')) return 'text/css; charset=utf-8';
  if (p.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (p.endsWith('.json')) return 'application/json';
  if (p.endsWith('.png')) return 'image/png';
  if (p.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS' });
    return res.end();
  }

  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  const db = loadDb();

  try {
    // API
    if (p === '/api/health') return json(res, 200, { success: true, status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() });
    if (p === '/api/providers/status') return json(res, 200, { success: true, providers: providers() });

    if (p === '/api/auth/register' && req.method === 'POST') {
      const b = await readBody(req);
      if (!b.username || !b.email || !b.password) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'กรอกข้อมูลให้ครบ' });
      if (db.users.find((u) => u.username === b.username)) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' });
      if (db.users.find((u) => u.email === b.email)) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'อีเมลนี้มีอยู่แล้ว' });
      const now = new Date().toISOString();
      const u = { id: uid(), username: b.username, email: b.email, password_hash: hash(b.password), role: 'member', status: 'active', package: 'free', plan: 'free', quota_used: 0, quota_limit: 50, features_override: {}, membership_code: null, membership_expires: null, avatar: b.avatar || null, created_at: now, updated_at: now };
      db.users.push(u);
      const token = uid() + uid();
      db.sessions[token] = { user_id: u.id, expires_at: new Date(Date.now() + 7*864e5).toISOString() };
      saveDb(db);
      return json(res, 200, { success: true, token, user: sanitize(u) });
    }

    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = await readBody(req);
      const u = db.users.find((x) => x.username === b.username || x.email === b.username);
      if (!u || !verify(b.password || '', u.password_hash)) return json(res, 401, { success: false, code: 'AUTH_ERROR', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      if (u.status !== 'active') return json(res, 403, { success: false, code: 'AUTH_ERROR', message: 'บัญชีถูกระงับ' });
      const token = uid() + uid();
      db.sessions[token] = { user_id: u.id, expires_at: new Date(Date.now() + 7*864e5).toISOString() };
      saveDb(db);
      return json(res, 200, { success: true, token, user: sanitize(u) });
    }

    if (p === '/api/auth/admin-login' && req.method === 'POST') {
      const b = await readBody(req);
      if (b.securityCode !== db.settings.admin_security_password) return json(res, 401, { success: false, code: 'AUTH_ERROR', message: 'รหัสประตู Admin ไม่ถูกต้อง' });
      const u = db.users.find((x) => x.username === b.username || x.email === b.username);
      if (!u || !verify(b.password || '', u.password_hash)) return json(res, 401, { success: false, code: 'AUTH_ERROR', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
      if (u.role !== 'owner' && u.role !== 'admin') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'บัญชีนี้ไม่ใช่ Owner/Admin' });
      const token = uid() + uid();
      db.sessions[token] = { user_id: u.id, expires_at: new Date(Date.now() + 7*864e5).toISOString() };
      saveDb(db);
      return json(res, 200, { success: true, token, user: sanitize(u) });
    }

    if (p === '/api/auth/me' && req.method === 'GET') {
      const u = getUser(req, db);
      if (!u) return json(res, 401, { success: false, code: 'AUTH_ERROR', message: 'ไม่ได้เข้าสู่ระบบ' });
      return json(res, 200, { success: true, data: sanitize(u) });
    }

    if (p === '/api/auth/logout' && req.method === 'POST') {
      const h = req.headers.authorization || '';
      const token = h.startsWith('Bearer ') ? h.slice(7) : null;
      if (token) delete db.sessions[token];
      saveDb(db);
      return json(res, 200, { success: true });
    }

    // auth required helpers
    const needUser = () => {
      const u = getUser(req, db);
      if (!u) { const e = new Error('ไม่ได้เข้าสู่ระบบ'); e.code = 'AUTH_ERROR'; e.status = 401; throw e; }
      return u;
    };

    if (p === '/api/users/me' && req.method === 'PATCH') {
      const u = needUser();
      const b = await readBody(req);
      if (b.username) u.username = b.username;
      if (b.email) u.email = b.email;
      if (b.avatar !== undefined) u.avatar = b.avatar;
      u.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: sanitize(u) });
    }

    if (p === '/api/users/me/password' && req.method === 'PATCH') {
      const u = needUser();
      const b = await readBody(req);
      if (!verify(b.oldPassword || '', u.password_hash)) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'รหัสผ่านเดิมไม่ถูกต้อง' });
      if (!b.newPassword || b.newPassword.length < 6) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'รหัสผ่านใหม่อย่างน้อย 6 ตัว' });
      u.password_hash = hash(b.newPassword);
      u.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true });
    }

    // Projects
    if (p === '/api/projects' && req.method === 'GET') {
      const u = needUser();
      return json(res, 200, { success: true, data: db.projects.filter((x) => x.user_id === u.id) });
    }
    if (p === '/api/projects' && req.method === 'POST') {
      const u = needUser();
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ต้องมีชื่อโปรเจกต์' });
      const now = new Date().toISOString();
      const item = { id: uid(), user_id: u.id, name: b.name, data: b.data || {}, status: b.status || 'draft', created_at: now, updated_at: now };
      db.projects.unshift(item);
      saveDb(db);
      return json(res, 200, { success: true, data: item });
    }
    if (p.startsWith('/api/projects/') && req.method === 'DELETE') {
      const u = needUser();
      const id = p.split('/').pop();
      const i = db.projects.findIndex((x) => x.id === id && x.user_id === u.id);
      if (i < 0) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบโปรเจกต์' });
      db.projects.splice(i, 1);
      saveDb(db);
      return json(res, 200, { success: true });
    }
    if (p.startsWith('/api/projects/') && req.method === 'PUT') {
      const u = needUser();
      const id = p.split('/').pop();
      const item = db.projects.find((x) => x.id === id && x.user_id === u.id);
      if (!item) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบโปรเจกต์' });
      const b = await readBody(req);
      if (b.name) item.name = b.name;
      if (b.data) item.data = b.data;
      if (b.status) item.status = b.status;
      item.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: item });
    }

    // Products
    if (p === '/api/products' && req.method === 'GET') {
      const u = needUser();
      return json(res, 200, { success: true, data: db.products.filter((x) => x.user_id === u.id) });
    }
    if (p === '/api/products' && req.method === 'POST') {
      const u = needUser();
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ต้องมีชื่อสินค้า' });
      const now = new Date().toISOString();
      const item = { id: uid(), user_id: u.id, product_code: b.product_code || productCode(), name: b.name, description: b.description || '', price: b.price || '', original_price: b.original_price || '', currency: b.currency || 'THB', url: b.url || '', source_platform: b.source_platform || detectPlatform(b.url || ''), source_type: b.source_type || 'manual', images: b.images || [], category: b.category || '', features: b.features || [], keywords: b.keywords || [], target_audience: b.target_audience || '', source_data: b.source_data || null, ai_analysis: b.ai_analysis || null, created_at: now, updated_at: now };
      db.products.unshift(item);
      saveDb(db);
      return json(res, 200, { success: true, data: item });
    }
    if (p === '/api/products/import-url' && req.method === 'POST') {
      const uImp = needUser();
      try { requireFeature(db, uImp, 'FEATURE_PRODUCT_IMPORT'); } catch (e) { return json(res, e.status || 403, { success: false, code: e.code, message: e.message }); }
      const b = await readBody(req);
      if (!b.url || !/^https?:\/\//i.test(b.url)) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'URL ไม่ถูกต้อง' });
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const resp = await fetch(b.url, { signal: ctrl.signal, headers: { 'User-Agent': 'APSBot/1.0' } });
        clearTimeout(t);
        if (!resp.ok) return json(res, 400, { success: false, code: 'SCRAPE_BLOCKED', message: 'ดึงข้อมูลไม่ได้ (HTTP ' + resp.status + ')' });
        const html = await resp.text();
        const title = (html.match(/<title[^>]*>([^<]+)/i)?.[1] || b.url.split('/').pop() || 'สินค้า').trim().slice(0, 120);
        const desc = (html.match(/name=["']description["'][^>]*content=["']([^"']+)/i)?.[1] || '').trim().slice(0, 500);
        const code = productCode();
        const platform = detectPlatform(b.url);
        const source_data = { title, description: desc, price: null, url: b.url, platform, fetched_at: new Date().toISOString() };
        return json(res, 200, { success: true, data: {
          product_code: code,
          name: title,
          description: desc,
          price: '',
          original_price: '',
          currency: 'THB',
          url: b.url,
          source_platform: platform,
          source_type: 'url',
          images: [],
          source_data,
          ai_analysis: null,
          note: 'SOURCE DATA จากหน้าเว็บเท่านั้น — ฟิลด์ที่ว่างหมายถึงดึงไม่ได้ ห้ามถือว่าเป็นข้อมูลที่ยืนยันแล้ว'
        } });
      } catch {
        return json(res, 400, { success: false, code: 'SCRAPE_BLOCKED', message: 'ไม่สามารถดึงข้อมูลจาก URL ได้ — ใส่ข้อมูลด้วยมือ' });
      }
    }
    if (p.startsWith('/api/products/') && req.method === 'DELETE') {
      const u = needUser();
      const id = p.split('/').pop();
      const i = db.products.findIndex((x) => x.id === id && x.user_id === u.id);
      if (i < 0) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบสินค้า' });
      db.products.splice(i, 1);
      saveDb(db);
      return json(res, 200, { success: true });
    }

    // Product by code
    if (p.startsWith('/api/products/code/') && req.method === 'GET') {
      const u = needUser();
      const code = decodeURIComponent(p.split('/').pop());
      const item = db.products.find((x) => x.product_code === code && x.user_id === u.id);
      if (!item) return json(res, 404, { success: false, code: 'NOT_FOUND', message: 'ไม่พบ Product Code' });
      return json(res, 200, { success: true, data: item });
    }

    
    // ── Membership / VIP Codes ──
    if (p === '/api/membership/redeem' && req.method === 'POST') {
      const u = needUser();
      const b = await readBody(req);
      const raw = (b.code || '').trim().toUpperCase();
      if (!raw) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ใส่ VIP Code' });
      // rate-ish: simple
      const codeEntry = db.membership_codes[raw];
      if (!codeEntry) return json(res, 400, { success: false, code: 'INVALID_CODE', message: 'รหัสไม่ถูกต้อง' });
      if (codeEntry.status !== 'active') return json(res, 400, { success: false, code: 'INVALID_CODE', message: 'รหัสถูกปิดใช้งาน' });
      if (codeEntry.expires_at && new Date(codeEntry.expires_at) < new Date()) return json(res, 400, { success: false, code: 'EXPIRED', message: 'รหัสหมดอายุ' });
      if (codeEntry.used_count >= codeEntry.max_uses) return json(res, 400, { success: false, code: 'MAX_USES', message: 'รหัสถูกใช้ครบจำนวนแล้ว' });
      if (db.membership_redemptions.some((r) => r.user_id === u.id && r.code === raw)) {
        return json(res, 400, { success: false, code: 'ALREADY_USED', message: 'คุณใช้รหัสนี้ไปแล้ว' });
      }
      const prev = u.plan || 'free';
      const pkg = (codeEntry.package_name || 'vip').toLowerCase();
      u.plan = pkg;
      u.package = pkg;
      u.membership_code = raw.slice(0, 4) + '****';
      u.membership_expires = codeEntry.expires_at || null;
      if (codeEntry.quota) u.quota_limit = Math.max(u.quota_limit || 0, codeEntry.quota);
      const planDef = db.settings.plan_defaults?.[pkg];
      if (planDef && planDef.quota_limit) u.quota_limit = Math.max(u.quota_limit, planDef.quota_limit);
      u.updated_at = new Date().toISOString();
      codeEntry.used_count = (codeEntry.used_count || 0) + 1;
      db.membership_redemptions.push({ id: uid(), user_id: u.id, code: raw, package_name: pkg, created_at: new Date().toISOString() });
      db.membership_history.push({ id: uid(), user_id: u.id, previous_plan: prev, new_plan: pkg, code_id: raw, action: 'redeem', created_at: new Date().toISOString() });
      saveDb(db);
      return json(res, 200, { success: true, data: { plan: u.plan, package: u.package, quota_limit: u.quota_limit, expires_at: u.membership_expires, message: 'เปิดใช้งานสำเร็จ' } });
    }

    if (p === '/api/membership/me' && req.method === 'GET') {
      const u = needUser();
      resolveAccess(db, u, 'FEATURE_PROJECT'); // trigger expire check
      const plan = (u.plan || 'free').toLowerCase();
      const features = { ...(db.settings.plan_defaults?.[plan]?.features || {}), ...(u.features_override || {}) };
      // apply global off
      for (const [k, v] of Object.entries(db.settings.global_features || {})) {
        if (v === false) features[k] = false;
      }
      return json(res, 200, { success: true, data: {
        plan: u.plan || 'free',
        package: u.package,
        status: u.status,
        membership_code: u.membership_code,
        expires_at: u.membership_expires,
        quota_used: u.quota_used,
        quota_limit: u.quota_limit,
        features,
      }});
    }

    if (p === '/api/admin/membership/codes' && req.method === 'GET') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const list = Object.values(db.membership_codes || {});
      return json(res, 200, { success: true, data: list });
    }

    if (p === '/api/admin/membership/codes' && req.method === 'POST') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const b = await readBody(req);
      // secure random code
      const code = (b.code || ('VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase())).toUpperCase();
      if (db.membership_codes[code]) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'รหัสซ้ำ' });
      const entry = {
        code,
        package_name: b.package_name || 'vip',
        status: 'active',
        max_uses: Number(b.max_uses) || 1,
        used_count: 0,
        valid_from: b.valid_from || new Date().toISOString(),
        expires_at: b.expires_at || null,
        quota: Number(b.quota) || 500,
        feature_access: b.feature_access || null,
        created_by: u.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      db.membership_codes[code] = entry;
      saveDb(db);
      return json(res, 200, { success: true, data: entry, note: 'คัดลอกรหัสนี้ไว้ — แสดงเต็มเฉพาะตอนสร้าง' });
    }

    if (p.startsWith('/api/admin/membership/codes/') && req.method === 'PATCH') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const code = decodeURIComponent(p.split('/').pop()).toUpperCase();
      const entry = db.membership_codes[code];
      if (!entry) return json(res, 404, { success: false, code: 'NOT_FOUND', message: 'ไม่พบรหัส' });
      const b = await readBody(req);
      if (b.status) entry.status = b.status;
      if (b.max_uses != null) entry.max_uses = Number(b.max_uses);
      if (b.expires_at !== undefined) entry.expires_at = b.expires_at;
      if (b.quota != null) entry.quota = Number(b.quota);
      if (b.package_name) entry.package_name = b.package_name;
      entry.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: entry });
    }

    if (p === '/api/admin/features' && req.method === 'GET') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      return json(res, 200, { success: true, data: { global: db.settings.global_features, plans: db.settings.plan_defaults } });
    }

    if (p === '/api/admin/features' && req.method === 'PATCH') {
      const u = needUser();
      if (u.role !== 'owner') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'เฉพาะ Owner' });
      const b = await readBody(req);
      if (b.global) db.settings.global_features = { ...db.settings.global_features, ...b.global };
      if (b.plans) db.settings.plan_defaults = { ...db.settings.plan_defaults, ...b.plans };
      saveDb(db);
      return json(res, 200, { success: true });
    }

    if (p === '/api/admin/users/permission' && req.method === 'POST') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const b = await readBody(req);
      const target = db.users.find((x) => x.id === b.userId);
      if (!target) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ไม่พบผู้ใช้' });
      if (target.role === 'owner' && u.role !== 'owner') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ห้ามแก้ไข Owner' });
      target.features_override = target.features_override || {};
      if (b.feature && typeof b.allowed === 'boolean') {
        target.features_override[b.feature] = b.allowed;
      }
      if (b.plan) { target.plan = b.plan; target.package = b.plan; }
      if (b.quota_limit != null) target.quota_limit = Number(b.quota_limit);
      if (b.reset_quota) target.quota_used = 0;
      target.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: sanitize(target) });
    }


    // Characters
    if (p === '/api/characters' && req.method === 'GET') {
      const u = needUser();
      return json(res, 200, { success: true, data: db.characters.filter((x) => x.user_id === u.id) });
    }
    if (p === '/api/characters' && req.method === 'POST') {
      const u = needUser();
      const b = await readBody(req);
      if (!b.name) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ต้องมีชื่อตัวละคร' });
      const now = new Date().toISOString();
      const item = { id: uid(), user_id: u.id, name: b.name, description: b.description || '', style: b.style || '', image: b.image || null, created_at: now, updated_at: now };
      db.characters.unshift(item);
      saveDb(db);
      return json(res, 200, { success: true, data: item });
    }
    if (p.startsWith('/api/characters/') && req.method === 'DELETE') {
      const u = needUser();
      const id = p.split('/').pop();
      const i = db.characters.findIndex((x) => x.id === id && x.user_id === u.id);
      if (i < 0) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบตัวละคร' });
      db.characters.splice(i, 1);
      saveDb(db);
      return json(res, 200, { success: true });
    }

    // AI
    if (p === '/api/ai/text' && req.method === 'POST') {
      const u = needUser();
      try { requireFeature(db, u, 'FEATURE_AI_CHAT'); } catch (e) { return json(res, e.status || 403, { success: false, code: e.code, message: e.message }); }
      if (u.quota_used >= u.quota_limit) return json(res, 429, { success: false, code: 'QUOTA_EXCEEDED', message: 'โควต้าการใช้งานของคุณหมดแล้ว' });
      const b = await readBody(req);
      let prompt = b.prompt || '';
      if (b.product) prompt = `สร้างแคปชัน, สคริปต์วิดีโอ, และโพสต์สำหรับสินค้า:\nชื่อ: ${b.product.name||''}\nรายละเอียด: ${b.product.description||''}\nราคา: ${b.product.price||''}\n\nตอบ JSON: {"caption":"...","script":"...","post":"...","imagePrompt":"...","videoPrompt":"..."}`;
      if (!prompt) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ต้องมี prompt' });
      try {
        const result = await genText(prompt, b.system || 'คุณเป็นนักเขียนคอนเทนต์สินค้า ตอบเป็นภาษาไทย');
        u.quota_used += 1; u.updated_at = new Date().toISOString();
        saveDb(db);
        return json(res, 200, { success: true, data: result });
      } catch (e) {
        return json(res, e.code === 'NOT_CONFIGURED' ? 503 : 400, { success: false, code: e.code || 'ERROR', message: e.message });
      }
    }

    if (p === '/api/ai/image' && req.method === 'POST') {
      const u = needUser();
      try { requireFeature(db, u, 'FEATURE_IMAGE_GENERATION'); } catch (e) { return json(res, e.status || 403, { success: false, code: e.code, message: e.message }); }
      if (u.quota_used + 2 > u.quota_limit) return json(res, 429, { success: false, code: 'QUOTA_EXCEEDED', message: 'โควต้าการใช้งานของคุณหมดแล้ว' });
      const b = await readBody(req);
      if (!b.prompt) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ต้องมี prompt' });
      const jobId = uid();
      const now = new Date().toISOString();
      const job = { id: jobId, user_id: u.id, project_id: b.projectId || null, type: 'image', status: 'processing', progress: 10, input: { prompt: b.prompt }, result: null, error: null, created_at: now, updated_at: now };
      db.jobs.unshift(job);
      saveDb(db);
      try {
        const result = await genImage(b.prompt);
        job.status = 'completed'; job.progress = 100; job.result = result; job.updated_at = new Date().toISOString();
        const media = { id: uid(), user_id: u.id, job_id: jobId, name: 'image-' + jobId, type: 'image', url: result.url, created_at: new Date().toISOString() };
        db.media.unshift(media);
        u.quota_used += 2; u.updated_at = new Date().toISOString();
        saveDb(db);
        return json(res, 200, { success: true, data: { jobId, status: 'completed', result, mediaId: media.id } });
      } catch (e) {
        job.status = 'failed'; job.error = e.message; job.updated_at = new Date().toISOString();
        saveDb(db);
        return json(res, e.code === 'NOT_CONFIGURED' ? 503 : 400, { success: false, code: e.code || 'ERROR', message: e.message });
      }
    }

    if (p === '/api/ai/video' && req.method === 'POST') {
      const u = needUser();
      if (!process.env.VIDEO_API_KEY) return json(res, 503, { success: false, code: 'NOT_CONFIGURED', message: 'Video AI ยังไม่ได้ตั้งค่า — ใส่ VIDEO_API_KEY ใน .env' });
      return json(res, 503, { success: false, code: 'NOT_CONFIGURED', message: 'VIDEO_API_KEY มีแล้ว แต่ยังไม่ได้เชื่อม adapter provider จริง' });
    }

    // Jobs
    if (p === '/api/jobs' && req.method === 'GET') {
      const u = needUser();
      return json(res, 200, { success: true, data: db.jobs.filter((x) => x.user_id === u.id) });
    }
    if (p.match(/^\/api\/jobs\/[\w-]+\/cancel$/) && req.method === 'POST') {
      const u = needUser();
      const id = p.split('/')[3];
      const job = db.jobs.find((x) => x.id === id && x.user_id === u.id);
      if (!job) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบงาน' });
      if (['completed', 'failed'].includes(job.status)) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'งานจบแล้ว' });
      job.status = 'cancelled'; job.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true });
    }
    if (p.match(/^\/api\/jobs\/[\w-]+$/) && req.method === 'GET') {
      const u = needUser();
      const id = p.split('/').pop();
      const job = db.jobs.find((x) => x.id === id && x.user_id === u.id);
      if (!job) return json(res, 404, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่พบงาน' });
      return json(res, 200, { success: true, data: job });
    }

    // Media
    if (p === '/api/media' && req.method === 'GET') {
      const u = needUser();
      let list = db.media.filter((x) => x.user_id === u.id);
      if (url.searchParams.get('type')) list = list.filter((m) => m.type === url.searchParams.get('type'));
      return json(res, 200, { success: true, data: list });
    }
    if (p === '/api/media/upload' && req.method === 'POST') {
      // JSON base64 fallback for simplicity without multer
      const u = needUser();
      const b = await readBody(req);
      if (!b.dataUrl && !b.name) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ไม่มีไฟล์' });
      const item = { id: uid(), user_id: u.id, name: b.name || 'upload', type: b.type || 'image', url: b.dataUrl || b.url || '', created_at: new Date().toISOString() };
      db.media.unshift(item);
      saveDb(db);
      return json(res, 200, { success: true, data: item });
    }

    // Coupons
    if (p === '/api/coupons/redeem' && req.method === 'POST') {
      const u = needUser();
      const b = await readBody(req);
      const code = (b.code || '').toUpperCase();
      const c = db.coupons[code];
      if (!c) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ไม่พบคูปอง' });
      if (c.used >= c.max_uses) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'คูปองถูกใช้ครบแล้ว' });
      c.used += 1;
      if (c.type === 'quota') u.quota_limit += c.value;
      u.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: { code, value: c.value, type: c.type } });
    }

    // Admin
    if (p === '/api/admin/users' && req.method === 'GET') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      return json(res, 200, { success: true, data: db.users.map(sanitize) });
    }
    if (p === '/api/admin/users/role' && req.method === 'POST') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const b = await readBody(req);
      const target = db.users.find((x) => x.id === b.userId);
      if (!target) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ไม่พบผู้ใช้' });
      if (target.role === 'owner' && u.role !== 'owner') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ห้ามแก้ไข Owner' });
      if (b.role === 'owner' && u.role !== 'owner') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'เฉพาะ Owner' });
      target.role = b.role;
      target.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: sanitize(target) });
    }
    if (p === '/api/admin/users/status' && req.method === 'POST') {
      const u = needUser();
      if (!['owner', 'admin'].includes(u.role)) return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ไม่มีสิทธิ์' });
      const b = await readBody(req);
      const target = db.users.find((x) => x.id === b.userId);
      if (!target) return json(res, 400, { success: false, code: 'VALIDATION_ERROR', message: 'ไม่พบผู้ใช้' });
      if (target.role === 'owner' && u.role !== 'owner') return json(res, 403, { success: false, code: 'PERMISSION_ERROR', message: 'ห้ามแก้ไข Owner' });
      target.status = b.status;
      target.updated_at = new Date().toISOString();
      saveDb(db);
      return json(res, 200, { success: true, data: sanitize(target) });
    }

    if (p === '/api/settings' && req.method === 'GET') {
      needUser();
      return json(res, 200, { success: true, data: db.settings });
    }

    // Static files
    let filePath = path.join(ROOT, p === '/' ? 'index.html' : p);
    if (!filePath.startsWith(ROOT)) return json(res, 403, { success: false, message: 'Forbidden' });
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': mime(filePath) });
      return res.end(data);
    }
    // SPA fallback
    const index = path.join(ROOT, 'index.html');
    if (fs.existsSync(index)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(index));
    }
    json(res, 404, { success: false, message: 'Not found' });
  } catch (e) {
    json(res, e.status || 500, { success: false, code: e.code || 'ERROR', message: e.message || 'Error' });
  }
});

server.listen(PORT, () => {
  console.log('\\n  AI Product Studio');
  console.log('  → http://localhost:' + PORT);
  console.log('  → Health: http://localhost:' + PORT + '/api/health\\n');
});
