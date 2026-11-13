import test from 'node:test';
import assert from 'node:assert/strict';
import { freshDb, NOW } from './helpers';
import { signup, login, createSession, userFromToken, destroySession, findUser, ownerResetPassword } from '@/lib/services/auth';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/password';
import { bootstrapOwner } from '@/lib/bootstrap';

const good = { name: 'Asha Rao', email: 'Asha@Example.com', phone: '98765 43210', password: 'Secret123', accountType: 'customer' };

test('password hashing: salted, verifiable, rejects wrong password', async () => {
  const h = hashPassword('Secret123'); assert.notEqual(h, hashPassword('Secret123'));
  assert.ok(verifyPassword('Secret123', h)); assert.ok(!verifyPassword('secret123', h)); assert.ok(!h.includes('Secret123'));
  assert.ok(passwordProblem('short1')); assert.ok(passwordProblem('allletters')); assert.equal(passwordProblem('Secret123'), null);
});
test('signup stores hashed password, normalises email/phone, account is usable immediately (no OTP)', async () => {
  const db = (await freshDb()); const { user } = (await signup(db, good, NOW));
  assert.equal(user.role, 'customer'); assert.equal(user.email, 'asha@example.com'); assert.equal(user.phone, '9876543210');
  const row = (await db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)); assert.ok(row.password_hash.startsWith('scrypt$')); assert.equal(row.verified, 1);
  await assert.rejects(async () => (await signup(db, good, NOW)), /already exists/);
  await assert.rejects(async () => (await signup(db, { ...good, email: 'b@example.com' }, NOW)), /phone/);
  await assert.rejects(async () => (await signup(db, { ...good, email: 'c@example.com', phone: '9123456789', password: 'weak' }, NOW)), /8 characters/);
});
test('customers cannot self-register as owner; owner needs the secret invitation code', async () => {
  const db = (await freshDb()); delete process.env.OWNER_INVITE_CODE;
  await assert.rejects(async () => (await signup(db, { ...good, accountType: 'owner' }, NOW)), /disabled/);
  process.env.OWNER_INVITE_CODE = 'ROYAL-INVITE-42';
  await assert.rejects(async () => (await signup(db, { ...good, accountType: 'owner' }, NOW)), /Invalid owner invitation/);
  await assert.rejects(async () => (await signup(db, { ...good, accountType: 'owner', inviteCode: 'guess' }, NOW)), /Invalid owner invitation/);
  assert.equal((await signup(db, { ...good, accountType: 'owner', inviteCode: 'ROYAL-INVITE-42' }, NOW)).user.role, 'owner');
  assert.equal((await signup(db, { ...good, email: 'x@example.com', phone: '9111111111', role: 'owner' }, NOW)).user.role, 'customer');
  delete process.env.OWNER_INVITE_CODE;
});
test('login by email or phone; wrong password fails; sessions expire and can be destroyed', async () => {
  const db = (await freshDb()); const { user } = (await signup(db, good, NOW));
  await assert.rejects(async () => (await login(db, 'asha@example.com', 'wrong')), /Incorrect/); await assert.rejects(async () => (await login(db, 'nobody@example.com', 'Secret123')), /Incorrect/);
  assert.equal((await login(db, 'ASHA@example.com', 'Secret123')).user.id, user.id); assert.equal((await login(db, '+91 9876543210', 'Secret123')).user.id, user.id);
  const s = (await createSession(db, user.id, NOW));
  assert.equal((await userFromToken(db, s.token, NOW + 1000))?.id, user.id);
  assert.equal((await userFromToken(db, s.token, NOW + 8 * 86400_000)), null); assert.equal((await userFromToken(db, 'forged', NOW)), null);
  assert.ok(!JSON.stringify((await db.prepare('SELECT * FROM sessions').all())).includes(s.token));
  (await destroySession(db, s.token)); assert.equal((await userFromToken(db, s.token, NOW)), null);
});
test('owner-assisted password reset signs the customer out everywhere', async () => {
  const db = (await freshDb()); const { user } = (await signup(db, good, NOW)); const s = (await createSession(db, user.id, NOW));
  await assert.rejects(async () => (await ownerResetPassword(db, user.email, 'short')), /8 characters/); await assert.rejects(async () => (await ownerResetPassword(db, 'no@one.com', 'NewPass123')), /No account/);
  (await ownerResetPassword(db, '9876543210', 'NewPass123'));
  assert.ok((await login(db, user.email, 'NewPass123'))); await assert.rejects(async () => (await login(db, user.email, 'Secret123')), /Incorrect/); assert.equal((await userFromToken(db, s.token, NOW + 1)), null);
});
test('owner can be created from OWNER_EMAIL/OWNER_PASSWORD (idempotent)', async () => {
  const db = (await freshDb()); process.env.OWNER_EMAIL = 'Owner@Haveli.com'; process.env.OWNER_PASSWORD = 'OwnerPass99';
  (await bootstrapOwner(db)); (await bootstrapOwner(db));
  assert.equal((await db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'owner'").get()).c, 1);
  assert.equal((await login(db, 'owner@haveli.com', 'OwnerPass99')).user.role, 'owner'); assert.ok((await findUser(db, 'owner@haveli.com')));
  delete process.env.OWNER_EMAIL; delete process.env.OWNER_PASSWORD;
});
