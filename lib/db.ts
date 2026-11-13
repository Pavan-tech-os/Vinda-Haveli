// Database layer. Two drivers behind ONE async interface:
//   - TURSO_DATABASE_URL set  -> Turso (online SQLite, works on Vercel). Used in production.
//   - otherwise               -> a local SQLite file via Node's built-in node:sqlite (local development / tests).
// Every query is async (await it). Use tx(db, async (t) => { ... }) for all-or-nothing changes.
import { SCHEMA } from './schema';
import { bootstrapOwner } from './bootstrap';

export interface RunResult { changes: number; lastInsertRowid: number | bigint }
export interface Stmt { run(...p: any[]): Promise<RunResult>; get(...p: any[]): Promise<any>; all(...p: any[]): Promise<any[]> }
export interface Db {
  exec(sql: string): Promise<void>;
  prepare(sql: string): Stmt;
  /** Runs fn inside one exclusive transaction; rolls back if fn throws. fn must use the `t` it is given. */
  transaction<T>(fn: (t: Db) => Promise<T>): Promise<T>;
}

type Exec = (sql: string, args: any[]) => Promise<{ rows: any[]; changes: number; lastId: number | bigint }>;
const buildDb = (exec: Exec, execMulti: (sql: string) => Promise<void>, transaction: Db['transaction']): Db => ({
  exec: execMulti,
  prepare: (sql) => ({
    run: async (...p) => { const r = await exec(sql, p); return { changes: r.changes, lastInsertRowid: r.lastId }; },
    get: async (...p) => (await exec(sql, p)).rows[0],
    all: async (...p) => (await exec(sql, p)).rows,
  }),
  transaction,
});

// ---------- Local driver: Node's built-in SQLite (Node 22.13+), wrapped to look async ----------
export function wrapNodeSqlite(raw: any): Db {
  let chain: Promise<unknown> = Promise.resolve();
  const exec: Exec = async (sql, args) => {
    const st = raw.prepare(sql);
    if (/^\s*(select|pragma|with)\b/i.test(sql)) return { rows: st.all(...args), changes: 0, lastId: 0 };
    const r = st.run(...args);
    return { rows: [], changes: Number(r.changes), lastId: r.lastInsertRowid };
  };
  const db: Db = buildDb(exec, async (sql) => { raw.exec(sql); }, (fn) => {
    // One transaction at a time on the single local connection.
    const run = chain.then(async () => {
      raw.exec('BEGIN IMMEDIATE');
      try { const r = await fn(db); raw.exec('COMMIT'); return r; }
      catch (e) { try { raw.exec('ROLLBACK'); } catch {} throw e; }
    });
    chain = run.catch(() => {});
    return run as Promise<any>;
  });
  return db;
}

// ---------- Turso driver (libSQL over HTTPS) ----------
const plainRow = (columns: string[], row: any) => { const o: Record<string, any> = {}; columns.forEach((c, i) => { const v = row[i]; o[c] = typeof v === 'bigint' ? Number(v) : v; }); return o; };
const toResult = (r: any) => ({ rows: r.rows.map((row: any) => plainRow(r.columns, row)), changes: r.rowsAffected ?? 0, lastId: r.lastInsertRowid ?? 0 });

async function openTurso(): Promise<Db> {
  const { createClient } = await import('@libsql/client/web');
  // https:// is the most reliable transport from serverless functions.
  const url = process.env.TURSO_DATABASE_URL!.trim().replace(/^libsql:\/\//, 'https://');
  const client: any = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN?.trim() });
  const txDb = (t: any): Db => {
    const d: Db = buildDb(async (sql, args) => toResult(await t.execute({ sql, args })), async () => { throw new Error('exec() is not available inside a transaction.'); }, (fn) => fn(d));
    return d;
  };
  return buildDb(
    async (sql, args) => toResult(await client.execute({ sql, args })),
    async (sql) => { await client.executeMultiple(sql); },
    async (fn) => {
      const t = await client.transaction('write');
      try { const r = await fn(txDb(t)); await t.commit(); return r; }
      catch (e) { try { await t.rollback(); } catch {} throw e; }
      finally { t.close(); }
    },
  );
}

async function openLocal(): Promise<Db> {
  if (process.env.VERCEL) throw new Error('TURSO_DATABASE_URL is not set. On Vercel this website needs a Turso database: add TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Project Settings > Environment Variables, then redeploy.');
  const sqlite = (process as any).getBuiltinModule?.('node:sqlite');
  if (!sqlite) throw new Error(`This website needs Node.js 22.13 or newer for local use (you have ${process.version}), or set TURSO_DATABASE_URL.`);
  const fs = (process as any).getBuiltinModule('node:fs'); const path = (process as any).getBuiltinModule('node:path');
  const file = process.env.DATABASE_PATH || path.join(process.cwd(), 'storage', 'vindu-haveli.db');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const raw = new sqlite.DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  return wrapNodeSqlite(raw);
}

const g = globalThis as unknown as { __vhDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__vhDb) {
    g.__vhDb = (async () => {
      const db = process.env.TURSO_DATABASE_URL ? await openTurso() : await openLocal();
      await initDb(db);
      await bootstrapOwner(db);
      return db;
    })();
    g.__vhDb.catch(() => { g.__vhDb = undefined; }); // a failed start (bad token, network) is retried on the next request
  }
  return g.__vhDb;
}

/** Used by tests: install an already-opened database. */
export function setDb(db: Db) { g.__vhDb = Promise.resolve(db); }

export const DEFAULT_TABLES: [number, string, number][] = [
  [1, 'TABLE 01', 2], [2, 'TABLE 02', 2], [3, 'TABLE 03', 4], [4, 'TABLE 04', 4],
  [5, 'TABLE 05', 4], [6, 'TABLE 06', 6], [7, 'TABLE 07', 6], [8, 'TABLE 08', 8],
];

export async function initDb(db: Db) {
  await db.exec(SCHEMA);
  const values = DEFAULT_TABLES.map(([id, label, seats]) => `(${Number(id)}, '${label.replace(/'/g, "''")}', ${Number(seats)})`).join(', ');
  await db.exec(`INSERT OR IGNORE INTO dining_tables (id, label, seats) VALUES ${values};`);
}

/** Run fn inside one exclusive transaction. Rolls back if fn throws. Inside fn use ONLY the `t` it receives. */
export function tx<T>(db: Db, fn: (t: Db) => Promise<T>): Promise<T> { return db.transaction(fn); }
