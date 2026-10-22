import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'sql');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
await client.query('create table if not exists _migrations (name text primary key, applied_at timestamptz not null default now())');
const done = new Set((await client.query('select name from _migrations')).rows.map((r) => r.name));
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
  if (done.has(file)) continue;
  await client.query('begin');
  try {
    await client.query(fs.readFileSync(path.join(dir, file), 'utf8'));
    await client.query('insert into _migrations (name) values ($1)', [file]);
    await client.query('commit');
    console.log('aplicada', file);
  } catch (e) {
    await client.query('rollback');
    console.error('error en', file, e.message);
    process.exit(1);
  }
}
await client.query('alter table _migrations enable row level security');
await client.end();
console.log('migraciones al día');
