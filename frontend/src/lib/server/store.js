import fs from 'fs/promises';
import path from 'path';
import { newId, sha256Hex } from './crypto';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'escrowpay.json');

const EMPTY_DB = {
  merchants: [],
  products: [],
  sessions: [],
  deliveries: [],
  notifications: [],
};

let writeQueue = Promise.resolve();

function freshDb() {
  return JSON.parse(JSON.stringify(EMPTY_DB));
}

async function loadDb() {
  try {
    const raw = await fs.readFile(DB_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...freshDb(),
      ...parsed,
      merchants: parsed.merchants || [],
      products: parsed.products || [],
      sessions: parsed.sessions || [],
      deliveries: parsed.deliveries || [],
      notifications: parsed.notifications || [],
    };
  } catch (err) {
    if (err.code === 'ENOENT') return freshDb();
    throw err;
  }
}

async function saveDb(db) {
  await fs.mkdir(DB_DIR, { recursive: true });
  const tmp = `${DB_FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), 'utf8');
  await fs.rename(tmp, DB_FILE);
}

export async function readDb() {
  return loadDb();
}

export async function withDb(mutator) {
  const run = writeQueue.then(async () => {
    const db = await loadDb();
    const result = await mutator(db);
    await saveDb(db);
    return result;
  });
  writeQueue = run.catch(() => {});
  return run;
}

export async function findMerchantById(id) {
  const db = await readDb();
  return db.merchants.find((merchant) => merchant.id === id) || null;
}

export async function findMerchantByPublishableKey(publishableKey) {
  if (!publishableKey) return null;
  const db = await readDb();
  return db.merchants.find((merchant) => merchant.publishableKey === publishableKey) || null;
}

export async function findMerchantBySecret(secretKey) {
  if (!secretKey) return null;
  const secretHash = await sha256Hex(secretKey);
  const db = await readDb();
  return db.merchants.find((merchant) => merchant.secretHash === secretHash) || null;
}

export async function findMerchantByEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  const db = await readDb();
  return (
    db.merchants.find(
      (merchant) => String(merchant.email || '').trim().toLowerCase() === normalized
    ) || null
  );
}

export async function insertMerchant(merchant) {
  return withDb((db) => {
    db.merchants.push(merchant);
    return merchant;
  });
}

export async function patchMerchant(id, patch) {
  return withDb((db) => {
    const merchant = db.merchants.find((item) => item.id === id);
    if (!merchant) return null;
    const { config, ...rest } = patch;
    Object.assign(merchant, rest, { updatedAt: new Date().toISOString() });
    if (config) {
      merchant.config = { ...merchant.config, ...config };
      merchant.config.updatedAt = new Date().toISOString();
    }
    return merchant;
  });
}

export async function listProducts(merchantId) {
  const db = await readDb();
  return db.products
    .filter((product) => product.merchantId === merchantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function insertProduct(product) {
  const record = {
    id: newId('prd'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    active: true,
    kind: 'product',
    linkUrl: '',
    listed: true,
    ...product,
  };
  return withDb((db) => {
    db.products.push(record);
    return record;
  });
}

export async function listMarketplaceProducts() {
  const db = await readDb();
  const merchantsById = new Map(db.merchants.map((merchant) => [merchant.id, merchant]));
  return db.products
    .filter((product) => product.active !== false && product.listed !== false)
    .filter((product) => merchantsById.has(product.merchantId))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((product) => ({
      ...product,
      merchantName: merchantsById.get(product.merchantId).name,
    }));
}

export async function patchProduct(merchantId, productId, patch) {
  return withDb((db) => {
    const product = db.products.find(
      (item) => item.id === productId && item.merchantId === merchantId
    );
    if (!product) return null;
    Object.assign(product, patch, { updatedAt: new Date().toISOString() });
    return product;
  });
}

export async function removeProduct(merchantId, productId) {
  return withDb((db) => {
    const index = db.products.findIndex(
      (item) => item.id === productId && item.merchantId === merchantId
    );
    if (index === -1) return false;
    db.products.splice(index, 1);
    return true;
  });
}

export async function insertSession(session) {
  return withDb((db) => {
    db.sessions.push(session);
    return session;
  });
}

export async function findSessionById(sessionId) {
  const db = await readDb();
  return db.sessions.find((session) => session.id === sessionId) || null;
}

export async function findSessionByToken(sessionId, token) {
  if (!sessionId || !token) return null;
  const tokenHash = await sha256Hex(token);
  const db = await readDb();
  const session = db.sessions.find((item) => item.id === sessionId);
  if (!session || session.tokenHash !== tokenHash) return null;
  return session;
}

export async function listSessions(merchantId) {
  const db = await readDb();
  return db.sessions
    .filter((session) => session.merchantId === merchantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function patchSession(sessionId, patch) {
  return withDb((db) => {
    const session = db.sessions.find((item) => item.id === sessionId);
    if (!session) return null;
    Object.assign(session, patch, { updatedAt: new Date().toISOString() });
    return session;
  });
}

export async function insertDelivery(delivery) {
  return withDb((db) => {
    db.deliveries.push({
      id: newId('whd'),
      createdAt: new Date().toISOString(),
      ...delivery,
    });
    if (db.deliveries.length > 200) {
      db.deliveries.splice(0, db.deliveries.length - 200);
    }
    return delivery;
  });
}

export async function listDeliveries(merchantId, limit = 20) {
  const db = await readDb();
  return db.deliveries
    .filter((delivery) => delivery.merchantId === merchantId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

const NOTIFICATION_CAP = 1000;

function inNotificationScope(notification, scope) {
  if (!scope) return false;
  if (notification.audience === 'merchant') {
    return Boolean(scope.merchantId) && notification.merchantId === scope.merchantId;
  }
  if (notification.audience === 'buyer') {
    return Boolean(scope.wallet) && notification.wallet === scope.wallet;
  }
  return false;
}

export async function insertNotifications(records) {
  if (!records.length) return [];
  return withDb((db) => {
    db.notifications.push(...records);
    if (db.notifications.length > NOTIFICATION_CAP) {
      db.notifications.splice(0, db.notifications.length - NOTIFICATION_CAP);
    }
    return records;
  });
}

export async function listNotifications(scope, limit = 50) {
  if (!scope) return [];
  const db = await readDb();
  return db.notifications
    .filter((notification) => inNotificationScope(notification, scope))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, limit);
}

export async function markNotificationsRead(scope) {
  if (!scope) return 0;
  return withDb((db) => {
    let changed = 0;
    for (const notification of db.notifications) {
      if (!notification.read && inNotificationScope(notification, scope)) {
        notification.read = true;
        changed += 1;
      }
    }
    return changed;
  });
}

export async function deleteNotification(id, scope) {
  if (!id || !scope) return false;
  return withDb((db) => {
    const index = db.notifications.findIndex(
      (notification) => notification.id === id && inNotificationScope(notification, scope)
    );
    if (index === -1) return false;
    db.notifications.splice(index, 1);
    return true;
  });
}

export async function deleteNotifications(scope) {
  if (!scope) return 0;
  return withDb((db) => {
    const before = db.notifications.length;
    db.notifications = db.notifications.filter(
      (notification) => !inNotificationScope(notification, scope)
    );
    return before - db.notifications.length;
  });
}
