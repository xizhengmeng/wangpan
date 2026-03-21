import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';

const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

const connection = await mysql.createConnection({
  host: required('DB_HOST'),
  port: Number.parseInt(process.env.DB_PORT || '3306', 10),
  user: required('DB_USER'),
  password: process.env.DB_PASSWORD || '',
  database: required('DB_NAME'),
  multipleStatements: true,
  charset: 'utf8mb4',
  timezone: 'Z',
});

try {
  await connection.query(schema);
  console.log('Database schema initialized.');
} finally {
  await connection.end();
}
