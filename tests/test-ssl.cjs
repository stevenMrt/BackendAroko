const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const { Pool } = pg;
const NODE_ENV = process.env.NODE_ENV;
const DB_URL = process.env.DATABASE_URL;

console.log('NODE_ENV:', JSON.stringify(NODE_ENV));
console.log('DATABASE_URL set:', !!DB_URL);

async function testConfig(name, config) {
  console.log('\n--- Testing:', name, '---');
  console.log('ssl:', config.ssl);
  console.log('connectionString has sslmode:', config.connectionString ? config.connectionString.includes('sslmode') : 'N/A');
  const pool = new Pool(config);
  try {
    const result = await pool.query('SELECT 1');
    console.log('SUCCESS:', result.rows[0]);
  } catch (err) {
    console.log('FAILED:', err.message);
    console.log('  code:', err.code);
  } finally {
    await pool.end();
  }
}

// Test 1: connectionString WITH sslmode + ssl option (original working approach)
testConfig('connectionString + sslmode + ssl option', {
  connectionString: DB_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 5000,
}).then(() => {
  // Test 2: connectionString WITHOUT sslmode + ssl option
  let cleanUrl = DB_URL ? DB_URL.replace(/[?&]sslmode=[^&]+/, '') : '';
  if (cleanUrl.endsWith('?')) cleanUrl = cleanUrl.slice(0, -1);

  return testConfig('cleaned connectionString + ssl option', {
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });
}).then(() => {
  // Test 3: individual params + ssl option
  try {
    const url = new URL(DB_URL);
    return testConfig('individual params + ssl option', {
      host: url.hostname,
      port: parseInt(url.port, 10) || 5432,
      database: decodeURIComponent(url.pathname.slice(1)),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 5000,
    });
  } catch (e) {
    console.log('Could not parse URL for individual params test:', e.message);
    return testConfig('cleaned connectionString + ssl:true', {
      connectionString: cleanUrl,
      ssl: true,
      connectionTimeoutMillis: 5000,
    });
  }
}).then(() => {
  // Test 4: connectionString WITHOUT sslmode + ssl:true
  let cleanUrl = DB_URL ? DB_URL.replace(/[?&]sslmode=[^&]+/, '') : '';
  if (cleanUrl.endsWith('?')) cleanUrl = cleanUrl.slice(0, -1);

  return testConfig('cleaned connectionString + ssl:true', {
    connectionString: cleanUrl,
    ssl: true,
    connectionTimeoutMillis: 5000,
  });
}).then(() => {
  console.log('\n=== Test complete ===');
}).catch(err => {
  console.error('Test script error:', err);
});
