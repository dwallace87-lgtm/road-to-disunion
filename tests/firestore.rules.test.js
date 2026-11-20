// Automated security-rule tests for firestore.rules.
// STATUS: written, NOT yet run. Requires Node 18+, Java, and the Firebase emulator:
//   npm install
//   npm run test:rules
// The real domain is unverified, so the placeholder in firestore.rules is swapped for a test domain here.

const { test, before, after, beforeEach } = require('node:test');
const fs = require('node:fs');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, collection, serverTimestamp } = require('firebase/firestore');

const DOMAIN = 'school.test';
let env;

before(async () => {
  const rules = fs.readFileSync('firestore.rules', 'utf8').replace("'UNVERIFIED-DOMAIN.invalid'", `'${DOMAIN}'`);
  env = await initializeTestEnvironment({ projectId: 'rtd-rules-test', firestore: { rules } });
});
after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'staff', `wallace@${DOMAIN}`), { name: 'Mr. Wallace', role: 'teacher' });
    const kids = [['quinn', 'Quinn D.', 2, 'L1', 'current'], ['riley', 'Riley F.', 2, 'L2', 'ready'], ['avery', 'Avery M.', 1, 'L4', 'current']];
    for (const [uid, name, period, node, status] of kids) {
      const email = `${uid}@${DOMAIN}`;
      await setDoc(doc(db, 'roster', email), { period, displayName: name, active: true });
      await setDoc(doc(db, 'users', uid), { email, period, displayName: name, avatar: 'avA_1', role: 'student' });
      await setDoc(doc(db, 'positions', uid), { period, displayName: name, avatar: 'avA_1', node });
      await setDoc(doc(db, 'progress', uid), { period, node, status });
    }
    await setDoc(doc(db, 'audit', 'old'), { actor: `wallace@${DOMAIN}`, action: 'seed', target: 'riley', at: new Date() });
  });
});

const as = (uid, email, verified = true) => env.authenticatedContext(uid, { email, email_verified: verified }).firestore();
const quinn = () => as('quinn', `quinn@${DOMAIN}`);
const wallace = () => as('wallaceUid', `wallace@${DOMAIN}`);
const jamie = () => as('jamie', `jamie@${DOMAIN}`); // school account, not on any roster

// --- Students cannot bypass mastery approval ---
test('student cannot mark their own progress as mastered', async () => {
  await assertFails(updateDoc(doc(quinn(), 'progress', 'quinn'), { status: 'mastered' }));
});
test('student cannot move their own position to a later checkpoint', async () => {
  await assertFails(updateDoc(doc(quinn(), 'positions', 'quinn'), { node: 'MC1' }));
});
test('student cannot forge an audit entry to unlock a progress change', async () => {
  const db = quinn(), b = writeBatch(db), a = doc(collection(db, 'audit'));
  b.set(a, { actor: `quinn@${DOMAIN}`, target: 'quinn', action: 'fake', at: serverTimestamp() });
  b.update(doc(db, 'progress', 'quinn'), { node: 'L2', status: 'current', lastAuditId: a.id });
  await assertFails(b.commit());
});

// --- Students cannot act as other students ---
test('student cannot change another student’s avatar', async () => {
  await assertFails(updateDoc(doc(quinn(), 'users', 'riley'), { avatar: 'avB_1' }));
  await assertFails(updateDoc(doc(quinn(), 'positions', 'riley'), { avatar: 'avB_1' }));
});
test('student cannot read another student’s private progress or feedback', async () => {
  await assertFails(getDoc(doc(quinn(), 'progress', 'riley')));
  await assertFails(getDoc(doc(quinn(), 'progress', 'riley', 'feedback', 'x')));
});
test('student can read same-period positions but not other periods', async () => {
  await assertSucceeds(getDoc(doc(quinn(), 'positions', 'riley')));
  await assertFails(getDoc(doc(quinn(), 'positions', 'avery')));
});

// --- Students cannot elevate roles or self-approve ---
test('student cannot grant themselves a staff role', async () => {
  await assertFails(setDoc(doc(quinn(), 'staff', `quinn@${DOMAIN}`), { name: 'Quinn', role: 'teacher' }));
});
test('even staff cannot grant staff roles from the app', async () => {
  await assertFails(setDoc(doc(wallace(), 'staff', `quinn@${DOMAIN}`), { role: 'teacher' }));
});
test('student cannot change their own period', async () => {
  await assertFails(updateDoc(doc(quinn(), 'users', 'quinn'), { period: 5 }));
  await assertFails(updateDoc(doc(quinn(), 'roster', `quinn@${DOMAIN}`), { period: 5 }));
});
test('pending account cannot approve itself onto a roster', async () => {
  await assertFails(setDoc(doc(jamie(), 'roster', `jamie@${DOMAIN}`), { period: 2, displayName: 'Jamie R.', active: true }));
});
test('pending account can request enrollment for itself only, and only as pending', async () => {
  await assertSucceeds(setDoc(doc(jamie(), 'enrollRequests', `jamie@${DOMAIN}`), { email: `jamie@${DOMAIN}`, googleName: 'Jamie', status: 'pending', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(jamie(), 'enrollRequests', `other@${DOMAIN}`), { email: `other@${DOMAIN}`, googleName: 'X', status: 'pending', createdAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(jamie(), 'enrollRequests', `jamie@${DOMAIN}`), { status: 'approved', reviewedBy: `jamie@${DOMAIN}` }));
});
test('student cannot create a profile with a teacher role or another period', async () => {
  const db = as('newkid', `riley@${DOMAIN}`);
  await assertFails(setDoc(doc(db, 'users', 'newkid'), { email: `riley@${DOMAIN}`, period: 2, displayName: 'Riley F.', avatar: null, role: 'teacher', createdAt: serverTimestamp() }));
  await assertFails(setDoc(doc(db, 'users', 'newkid'), { email: `riley@${DOMAIN}`, period: 7, displayName: 'Riley F.', avatar: null, role: 'student', createdAt: serverTimestamp() }));
});

// --- Domain / verification ---
test('non-school and unverified accounts are denied', async () => {
  await assertFails(setDoc(doc(as('x', 'gamer@gmail.com'), 'enrollRequests', 'gamer@gmail.com'), { email: 'gamer@gmail.com', googleName: 'x', status: 'pending', createdAt: serverTimestamp() }));
  await assertFails(getDoc(doc(as('quinn', `quinn@${DOMAIN}`, false), 'progress', 'quinn')));
});

// --- Staff actions must be audited; history is append-only ---
test('staff progress change fails without an audit entry and succeeds with one', async () => {
  const db = wallace();
  await assertFails(updateDoc(doc(db, 'progress', 'riley'), { node: 'MC1', status: 'current' }));
  const b = writeBatch(db), a = doc(collection(db, 'audit'));
  b.set(a, { actor: `wallace@${DOMAIN}`, target: 'riley', action: 'Mastery verified', at: serverTimestamp(), before: { node: 'L2', status: 'ready' }, after: { node: 'MC1', status: 'current' } });
  b.update(doc(db, 'progress', 'riley'), { node: 'MC1', status: 'current', lastAuditId: a.id });
  b.update(doc(db, 'positions', 'riley'), { node: 'MC1' });
  await assertSucceeds(b.commit());
});
test('audit history cannot be edited or deleted, even by staff', async () => {
  await assertFails(updateDoc(doc(wallace(), 'audit', 'old'), { action: 'changed' }));
  await assertFails(deleteDoc(doc(wallace(), 'audit', 'old')));
});
test('students cannot read the audit history', async () => {
  await assertFails(getDoc(doc(quinn(), 'audit', 'old')));
});
