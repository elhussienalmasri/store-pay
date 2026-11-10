const fs = require('fs');
const path = require('path');
const { loadEnvConfig } = require('@next/env');
const { neon } = require('@neondatabase/serverless');

async function main() {
  // Migration scripts run outside Next.js, so load the same .env files that
  // Next would load before accessing DATABASE_URL.
  loadEnvConfig(process.cwd());
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required.');

  const sql = neon(process.env.DATABASE_URL);
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((file) => file.endsWith('.sql')).sort();

  for (const file of files) {
    const statements = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
      .split(/;\s*(?:\r?\n|$)/)
      .map((statement) => statement.trim())
      .filter(Boolean);
    for (const statement of statements) await sql.query(statement);
    console.log(`Applied ${file}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
