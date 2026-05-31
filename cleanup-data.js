const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Simple function to load environment variables from .env
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const parts = trimmed.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const value = parts.slice(1).join('=').trim();
          process.env[key] = value;
        }
      }
    });
  }
}

loadEnv();

const dbUrls = {
  auth: process.env.AUTH_DATASOURCE_URL,
  order: process.env.ORDER_DATASOURCE_URL,
  payment: process.env.PAYMENT_DATASOURCE_URL,
  inventory: process.env.INVENTORY_DATASOURCE_URL
};

async function executeQuery(dbKey, sql) {
  const jdbcUrl = dbUrls[dbKey];
  if (!jdbcUrl) {
    console.error(`[${dbKey.toUpperCase()} DB] Connection URL is missing in .env`);
    return;
  }

  // Convert JDBC URL to standard Postgres connection string with embedded credentials
  const rawUrl = jdbcUrl.replace(/^jdbc:postgresql:\/\//, '');
  const username = process.env.SPRING_DATASOURCE_USERNAME || '';
  const password = process.env.SPRING_DATASOURCE_PASSWORD || '';
  const connectionString = `postgresql://${username}:${password}@${rawUrl}`;
  
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const res = await client.query(sql);
    console.log(`[${dbKey.toUpperCase()} DB] Success: ${sql.substring(0, 30)}... Rows affected: ${res.rowCount || 0}`);
  } catch (err) {
    console.error(`[${dbKey.toUpperCase()} DB] Error executing query:`, err.message);
  } finally {
    await client.end();
  }
}

async function runCleanup() {
  console.log("Starting database cleanup (keeping only test/mock accounts)...");
  
  // List of accounts to keep in the auth database
  const keepEmails = [
    'a@g.com',
    'b@g.com',
    'mock-google-user@gmail.com',
    'mock-github-user@github.com',
    'aura-test-999@gmail.com'
  ];
  
  const keepEmailsStr = keepEmails.map(e => `'${e}'`).join(',');
  await executeQuery('auth', `DELETE FROM users WHERE email NOT IN (${keepEmailsStr})`);
  
  // Cleanup orders, payments, and stock reservations
  await executeQuery('order', "TRUNCATE TABLE order_items, orders CASCADE");
  await executeQuery('payment', "TRUNCATE TABLE payments CASCADE");
  await executeQuery('inventory', "TRUNCATE TABLE inventory_reservation_items, inventory_reservations CASCADE");

  console.log("Cleanup completed successfully.");
}

runCleanup();
