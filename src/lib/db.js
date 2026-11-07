import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';

const DB_PATH = path.join(process.cwd(), 'data', 'shop.db');

let handle = null;

function db() {
  if (!handle) {
    if (!fs.existsSync(DB_PATH)) {
      throw new Error('shop.db is missing. Run "npm run setup:db" first.');
    }
    handle = new DatabaseSync(DB_PATH);
    handle.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  }
  return handle;
}

function toProduct(row) {
  return {
    slug: row.slug,
    title: row.title,
    category: row.category_slug,
    categoryName: row.category_name || row.category_slug,
    manufacturer: row.manufacturer,
    priceCents: row.price_cents,
    rating: row.rating,
    inStock: row.in_stock === 1,
    image: row.image,
    description: row.description,
    specs: JSON.parse(row.specs_json || '[]'),
  };
}

export function listProducts({ category } = {}) {
  const sql = `
    SELECT p.*, c.name AS category_name
    FROM products p
    LEFT JOIN categories c ON c.slug = p.category_slug
    ${category ? 'WHERE p.category_slug = ?' : ''}
    ORDER BY p.price_cents DESC, p.title ASC
  `;
  const rows = category ? db().prepare(sql).all(category) : db().prepare(sql).all();
  return rows.map(toProduct);
}

export function findProduct(slug) {
  const row = db()
    .prepare(
      `SELECT p.*, c.name AS category_name
       FROM products p
       LEFT JOIN categories c ON c.slug = p.category_slug
       WHERE p.slug = ?`
    )
    .get(slug);
  return row ? toProduct(row) : null;
}

export function listCategories() {
  return db().prepare('SELECT slug, name FROM categories ORDER BY name').all();
}

export function countProducts() {
  return db().prepare('SELECT COUNT(*) AS n FROM products').get().n;
}

export function createOrder({ reference, customer, totalCents, items }) {
  const connection = db();
  connection.exec('BEGIN');
  try {
    const orderResult = connection
      .prepare(
        `INSERT INTO orders (
           reference, customer_name, customer_email, customer_phone, shipping_address, total_cents, status, created_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'placed', ?)`
      )
      .run(
        reference,
        customer.name,
        customer.email,
        customer.phone,
        customer.address,
        totalCents,
        new Date().toISOString()
      );

    const insertItem = connection.prepare(
      `INSERT INTO order_items (order_id, product_slug, title, unit_price_cents, quantity, line_total_cents)
       VALUES (?, ?, ?, ?, ?, ?)`
    );
    items.forEach((item) => {
      insertItem.run(
        Number(orderResult.lastInsertRowid),
        item.slug,
        item.title,
        item.unitPriceCents,
        item.quantity,
        item.lineTotalCents
      );
    });

    connection.exec('COMMIT');
    return getOrder(reference);
  } catch (error) {
    connection.exec('ROLLBACK');
    throw error;
  }
}

export function getOrder(reference) {
  const order = db()
    .prepare(
      'SELECT reference, customer_name, customer_email, customer_phone, shipping_address, total_cents, status, created_at FROM orders WHERE reference = ?'
    )
    .get(reference);
  if (!order) return null;

  const items = db()
    .prepare(
      'SELECT product_slug, title, unit_price_cents, quantity, line_total_cents FROM order_items WHERE order_id = (SELECT id FROM orders WHERE reference = ?)'
    )
    .all(reference);

  return {
    reference: order.reference,
    status: order.status,
    createdAt: order.created_at,
    totalCents: order.total_cents,
    customer: {
      name: order.customer_name,
      email: order.customer_email,
      phone: order.customer_phone,
      address: order.shipping_address,
    },
    items: items.map((item) => ({
      slug: item.product_slug,
      title: item.title,
      unitPriceCents: item.unit_price_cents,
      quantity: item.quantity,
      lineTotalCents: item.line_total_cents,
    })),
  };
}

export function listOrders({ limit = 20 } = {}) {
  return db()
    .prepare(
      'SELECT reference, customer_name, customer_email, total_cents, status, created_at FROM orders ORDER BY id DESC LIMIT ?'
    )
    .all(limit);
}

function toUser(row) {
  return { id: row.id, name: row.name, email: row.email, createdAt: row.created_at };
}

export function findUserByEmail(email) {
  const row = db().prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
  return row ? { ...toUser(row), passwordHash: row.password_hash } : null;
}

export function createUser({ name, email, passwordHash, createdAt }) {
  const result = db()
    .prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(name, String(email).toLowerCase(), passwordHash, createdAt);
  return toUser(db().prepare('SELECT * FROM users WHERE id = ?').get(Number(result.lastInsertRowid)));
}

export function createSession({ userId, token, expiresAt }) {
  db().prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expiresAt);
  return token;
}

export function findUserBySession(token) {
  if (!token) return null;
  const row = db()
    .prepare(
      `SELECT u.id, u.name, u.email, u.created_at, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`
    )
    .get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return toUser(row);
}

export function destroySession(token) {
  if (!token) return;
  db().prepare('DELETE FROM sessions WHERE token = ?').run(token);
}
