const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'shop.db');
const SEED_PATH = path.join(__dirname, '..', 'seed', 'products.json');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  manufacturer TEXT NOT NULL,
  price_cents INTEGER NOT NULL,
  rating INTEGER NOT NULL DEFAULT 0,
  in_stock INTEGER NOT NULL DEFAULT 1,
  image TEXT NOT NULL,
  description TEXT NOT NULL,
  specs_json TEXT NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reference TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  shipping_address TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'placed',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_slug TEXT NOT NULL,
  title TEXT NOT NULL,
  unit_price_cents INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  line_total_cents INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_slug);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
`;

function main() {
  const reset = process.argv.includes('--reset');
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (reset && fs.existsSync(DB_PATH)) {
    fs.rmSync(DB_PATH);
    console.log('Removed existing shop.db');
  }

  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const db = new DatabaseSync(DB_PATH);
  db.exec(SCHEMA);

  const existingProducts = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  if (existingProducts > 0 && !reset) {
    console.log(`Database already has ${existingProducts} products. Use "npm run reset:db" to reseed.`);
    db.close();
    return;
  }

  const upsertCategory = db.prepare(
    'INSERT INTO categories (slug, name) VALUES (?, ?) ON CONFLICT(slug) DO UPDATE SET name = excluded.name'
  );
  seed.categories.forEach((category) => upsertCategory.run(category.slug, category.name));

  const upsertProduct = db.prepare(`
    INSERT INTO products (
      slug, title, category_slug, manufacturer, price_cents, rating, in_stock, image, description, specs_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(slug) DO UPDATE SET
      title = excluded.title,
      category_slug = excluded.category_slug,
      manufacturer = excluded.manufacturer,
      price_cents = excluded.price_cents,
      rating = excluded.rating,
      in_stock = excluded.in_stock,
      image = excluded.image,
      description = excluded.description,
      specs_json = excluded.specs_json
  `);
  seed.products.forEach((product) => {
    upsertProduct.run(
      product.slug,
      product.title,
      product.category,
      product.manufacturer,
      product.priceCents,
      product.rating,
      product.inStock,
      product.image,
      product.description,
      JSON.stringify(product.specs || [])
    );
  });

  const productCount = db.prepare('SELECT COUNT(*) AS n FROM products').get().n;
  const categoryCount = db.prepare('SELECT COUNT(*) AS n FROM categories').get().n;
  db.close();
  console.log(`Seeded ${productCount} products across ${categoryCount} categories at ${DB_PATH}`);
}

main();
