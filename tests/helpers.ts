// Test helper: an in-memory SQLite database (Node's built-in node:sqlite) loaded with the real schema, behind the same async Db interface the app uses.
import { DatabaseSync } from 'node:sqlite';
import { Db, initDb, setDb, wrapNodeSqlite } from '@/lib/db';
import { hashPassword } from '@/lib/password';

export async function freshDb(): Promise<Db> {
  const db = wrapNodeSqlite(new DatabaseSync(':memory:'));
  await initDb(db); setDb(db);
  return db;
}
export async function addUser(db: Db, role: 'customer' | 'owner' = 'customer', n = 1) {
  const r = await db.prepare('INSERT INTO users (name, email, phone, password_hash, role, verified, created_at) VALUES (?,?,?,?,?,1,?)')
    .run(`User ${n}`, `u${n}@example.com`, `98765432${String(n).padStart(2, '0')}`, hashPassword('Passw0rd!'), role, new Date().toISOString());
  return { id: Number(r.lastInsertRowid), name: `User ${n}`, email: `u${n}@example.com`, phone: `98765432${String(n).padStart(2, '0')}`, role };
}
// Thursday 12 Nov 2026, 15:30 in India (10:00 UTC)
export const NOW = Date.UTC(2026, 10, 12, 10, 0, 0);
