import { neon } from '@neondatabase/serverless';

let client;

function getClient() {
  if (client) return client;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to use the StorePay database.');
  }

  client = neon(connectionString);
  return client;
}

/**
 * Executes a parameterized query through Neon's HTTP driver. Keeping this
 * boundary small prevents database-driver details from leaking into routes.
 */
export async function query(statement, params = []) {
  return getClient().query(statement, params);
}
