import { newId, sha256Hex } from "./crypto";
import { query } from "./database";

const rowData = (row) =>
  row ? (typeof row.data === "string" ? JSON.parse(row.data) : row.data) : null;
const rowsData = (rows) => rows.map(rowData);
const now = () => new Date().toISOString();

export async function findMerchantById(id) {
  return rowData(
    (await query("SELECT data FROM merchants WHERE id = $1", [id]))[0],
  );
}
export async function findMerchantByPublishableKey(key) {
  return key
    ? rowData(
        (
          await query("SELECT data FROM merchants WHERE publishable_key = $1", [
            key,
          ])
        )[0],
      )
    : null;
}
export async function findMerchantByEmail(email) {
  return email
    ? rowData(
        (
          await query(
            "SELECT data FROM merchants WHERE LOWER(email) = LOWER($1)",
            [String(email).trim()],
          )
        )[0],
      )
    : null;
}
export async function findMerchantBySecret(key) {
  if (!key) return null;
  return rowData(
    (
      await query("SELECT data FROM merchants WHERE secret_hash = $1", [
        await sha256Hex(key),
      ])
    )[0],
  );
}
export async function insertMerchant(value) {
  await query(
    "INSERT INTO merchants (id,email,publishable_key,secret_hash,data,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)",
    [
      value.id,
      value.email,
      value.publishableKey,
      value.secretHash,
      JSON.stringify(value),
      value.createdAt,
      value.updatedAt,
    ],
  );
  return value;
}
export async function patchMerchant(id, patch) {
  const current = await findMerchantById(id);
  if (!current) return null;
  const timestamp = now();
  const { config, ...rest } = patch;
  const value = {
    ...current,
    ...rest,
    updatedAt: timestamp,
    ...(config
      ? { config: { ...current.config, ...config, updatedAt: timestamp } }
      : {}),
  };
  await query(
    "UPDATE merchants SET email=$2,publishable_key=$3,secret_hash=$4,data=$5::jsonb,updated_at=$6 WHERE id=$1",
    [
      id,
      value.email,
      value.publishableKey,
      value.secretHash,
      JSON.stringify(value),
      timestamp,
    ],
  );
  return value;
}

export async function listProducts(merchantId) {
  return rowsData(
    await query(
      "SELECT data FROM products WHERE merchant_id=$1 ORDER BY created_at DESC",
      [merchantId],
    ),
  );
}
export async function insertProduct(product) {
  const timestamp = now();
  const value = {
    id: newId("prd"),
    createdAt: timestamp,
    updatedAt: timestamp,
    active: true,
    kind: "product",
    linkUrl: "",
    listed: true,
    ...product,
  };
  await query(
    "INSERT INTO products (id,merchant_id,active,listed,data,created_at,updated_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7)",
    [
      value.id,
      value.merchantId,
      value.active !== false,
      value.listed !== false,
      JSON.stringify(value),
      value.createdAt,
      value.updatedAt,
    ],
  );
  return value;
}
export async function listMarketplaceProducts() {
  const rows = await query(
    "SELECT p.data AS product,m.data AS merchant FROM products p JOIN merchants m ON m.id=p.merchant_id WHERE p.active=TRUE AND p.listed=TRUE ORDER BY p.created_at DESC",
  );
  return rows.map((row) => ({
    ...(typeof row.product === "string"
      ? JSON.parse(row.product)
      : row.product),
    merchantName: (typeof row.merchant === "string"
      ? JSON.parse(row.merchant)
      : row.merchant
    ).name,
  }));
}
export async function findMarketplaceProduct(productId) {
  const [row] = await query(
    "SELECT p.data AS product,m.data AS merchant FROM products p JOIN merchants m ON m.id=p.merchant_id WHERE p.id=$1 AND p.active=TRUE AND p.listed=TRUE",
    [productId],
  );
  return row
    ? {
        product:
          typeof row.product === "string"
            ? JSON.parse(row.product)
            : row.product,
        merchant:
          typeof row.merchant === "string"
            ? JSON.parse(row.merchant)
            : row.merchant,
      }
    : null;
}
export async function patchProduct(merchantId, productId, patch) {
  const current = rowData(
    (
      await query("SELECT data FROM products WHERE id=$1 AND merchant_id=$2", [
        productId,
        merchantId,
      ])
    )[0],
  );
  if (!current) return null;
  const value = { ...current, ...patch, updatedAt: now() };
  await query(
    "UPDATE products SET active=$3,listed=$4,data=$5::jsonb,updated_at=$6 WHERE id=$1 AND merchant_id=$2",
    [
      productId,
      merchantId,
      value.active !== false,
      value.listed !== false,
      JSON.stringify(value),
      value.updatedAt,
    ],
  );
  return value;
}
export async function removeProduct(merchantId, productId) {
  return (
    (
      await query(
        "DELETE FROM products WHERE id=$1 AND merchant_id=$2 RETURNING id",
        [productId, merchantId],
      )
    ).length > 0
  );
}

export async function insertSession(value) {
  await query(
    "INSERT INTO payment_sessions (id,merchant_id,token_hash,status,data,created_at,updated_at,expires_at) VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)",
    [
      value.id,
      value.merchantId,
      value.tokenHash,
      value.status,
      JSON.stringify(value),
      value.createdAt,
      value.updatedAt,
      value.expiresAt,
    ],
  );
  return value;
}
export async function findSessionById(id) {
  return rowData(
    (await query("SELECT data FROM payment_sessions WHERE id=$1", [id]))[0],
  );
}
export async function findSessionByToken(id, token) {
  return !id || !token
    ? null
    : rowData(
        (
          await query(
            "SELECT data FROM payment_sessions WHERE id=$1 AND token_hash=$2",
            [id, await sha256Hex(token)],
          )
        )[0],
      );
}
export async function listSessions(merchantId) {
  return rowsData(
    await query(
      "SELECT data FROM payment_sessions WHERE merchant_id=$1 ORDER BY created_at DESC",
      [merchantId],
    ),
  );
}
export async function patchSession(id, patch) {
  const current = await findSessionById(id);
  if (!current) return null;
  const value = { ...current, ...patch, updatedAt: now() };
  await query(
    "UPDATE payment_sessions SET token_hash=$2,status=$3,data=$4::jsonb,updated_at=$5,expires_at=$6 WHERE id=$1",
    [
      id,
      value.tokenHash,
      value.status,
      JSON.stringify(value),
      value.updatedAt,
      value.expiresAt,
    ],
  );
  return value;
}

export async function insertDelivery(delivery) {
  const value = { id: newId("whd"), createdAt: now(), ...delivery };
  await query(
    "INSERT INTO webhook_deliveries (id,merchant_id,data,created_at) VALUES ($1,$2,$3::jsonb,$4)",
    [value.id, value.merchantId, JSON.stringify(value), value.createdAt],
  );
  return value;
}
export async function listDeliveries(merchantId, limit = 20) {
  return rowsData(
    await query(
      "SELECT data FROM webhook_deliveries WHERE merchant_id=$1 ORDER BY created_at DESC LIMIT $2",
      [merchantId, limit],
    ),
  );
}

function scopeKey(scope) {
  return scope?.merchantId
    ? ["merchant", "merchant_id", scope.merchantId]
    : scope?.wallet
      ? ["buyer", "wallet", scope.wallet]
      : null;
}
export async function insertNotifications(values) {
  if (!values.length) return [];
  await Promise.all(
    values.map((value) =>
      query(
        "INSERT INTO notifications (id,audience,merchant_id,wallet,is_read,data,created_at) VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7)",
        [
          value.id,
          value.audience,
          value.merchantId || null,
          value.wallet || null,
          Boolean(value.read),
          JSON.stringify(value),
          value.createdAt,
        ],
      ),
    ),
  );
  return values;
}
export async function listNotifications(scope, limit = 50) {
  const key = scopeKey(scope);
  return !key
    ? []
    : rowsData(
        await query(
          `SELECT data FROM notifications WHERE audience=$1 AND ${key[1]}=$2 ORDER BY created_at DESC LIMIT $3`,
          [key[0], key[2], limit],
        ),
      );
}
export async function markNotificationsRead(scope) {
  const key = scopeKey(scope);
  return !key
    ? 0
    : (
        await query(
          `UPDATE notifications SET is_read=TRUE,data=jsonb_set(data,'{read}','true'::jsonb) WHERE audience=$1 AND ${key[1]}=$2 AND is_read=FALSE RETURNING id`,
          [key[0], key[2]],
        )
      ).length;
}
export async function deleteNotification(id, scope) {
  const key = scopeKey(scope);
  return !id || !key
    ? false
    : (
        await query(
          `DELETE FROM notifications WHERE id=$1 AND audience=$2 AND ${key[1]}=$3 RETURNING id`,
          [id, key[0], key[2]],
        )
      ).length > 0;
}
export async function deleteNotifications(scope) {
  const key = scopeKey(scope);
  return !key
    ? 0
    : (
        await query(
          `DELETE FROM notifications WHERE audience=$1 AND ${key[1]}=$2 RETURNING id`,
          [key[0], key[2]],
        )
      ).length;
}

export async function getPayoutProfile(wallet) {
  return wallet
    ? rowData(
        (
          await query("SELECT data FROM payout_profiles WHERE wallet=$1", [
            wallet,
          ])
        )[0],
      )
    : null;
}
export async function upsertPayoutProfile(value) {
  await query(
    "INSERT INTO payout_profiles (wallet,data,updated_at) VALUES ($1,$2::jsonb,$3) ON CONFLICT (wallet) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at",
    [value.wallet, JSON.stringify(value), value.updatedAt],
  );
  return value;
}
export async function deletePayoutProfile(wallet) {
  return wallet
    ? (
        await query(
          "DELETE FROM payout_profiles WHERE wallet=$1 RETURNING wallet",
          [wallet],
        )
      ).length > 0
    : false;
}
export async function listP2PListings(wallet) {
  return rowsData(
    await query(
      `SELECT data FROM p2p_listings ${wallet ? "WHERE wallet=$1" : ""} ORDER BY created_at DESC`,
      wallet ? [wallet] : [],
    ),
  );
}
export async function upsertP2PListing(value) {
  await query(
    "INSERT INTO p2p_listings (wallet,id,data,created_at,updated_at) VALUES ($1,$2,$3::jsonb,$4,$5) ON CONFLICT (wallet,id) DO UPDATE SET data=EXCLUDED.data,updated_at=EXCLUDED.updated_at",
    [
      value.wallet,
      value.id,
      JSON.stringify(value),
      value.createdAt,
      value.updatedAt,
    ],
  );
  return value;
}
export async function deleteP2PListing(wallet, id) {
  return !wallet || !id
    ? false
    : (
        await query(
          "DELETE FROM p2p_listings WHERE wallet=$1 AND id=$2 RETURNING id",
          [wallet, id],
        )
      ).length > 0;
}

export async function createCheckoutSession(value) {
  await query(
    "INSERT INTO checkout_sessions (id,data,status,created_at,expires_at) VALUES ($1,$2::jsonb,$3,$4,$5)",
    [
      value.sessionId,
      JSON.stringify(value),
      value.status,
      value.createdAt,
      value.expiresAt,
    ],
  );
  return value;
}
export async function findCheckoutSession(id) {
  return rowData(
    (
      await query(
        "SELECT data FROM checkout_sessions WHERE id=$1 AND expires_at > NOW()",
        [id],
      )
    )[0],
  );
}
