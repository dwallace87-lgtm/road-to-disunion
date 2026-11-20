// Backend adapter for the Road to Disunion tracker + Mission Control.
// Two implementations behind ONE api:
//   • firebase — Google sign-in + Firestore. Permissions are enforced by firestore.rules (server-side).
//   • demo     — used while firebase-config.js has no config. Fictional accounts; a simulated database in
//                this browser's localStorage (shared by every open tab); every write goes through
//                demoAuthorize(), a JavaScript copy of the rules, so denied actions behave like production.
//
// Shared api
//   mode                         'firebase' | 'demo'
//   onAuthChange(cb) -> unsub    cb({ status: loading|signedOut|blocked|pending|denied|revoked|student|staff|error, ... })
//   signIn() / signOut()
//   setAvatar(uid, avatarId)     student: own avatar only
//   listenClass(period, cb)      class-visible locations only (no grades)
//   listenMyProgress(uid, cb)    private: the student + staff
//   listenFeedback(uid, cb)      private: the student + staff
//   listenStaff(cb)              staff only: { roster, enroll, users, positions, progress, audit }
//   run(op, args)                staff operations (each writes an audit entry):
//       approveEnrollment {email, period, displayName}   denyEnrollment {email}
//       addStudent {email, displayName, period}           removeStudent {email}
//       setAccess {email, active}                         changePeriod {email, period}
//       setProgress {uid, node, status, action, reason}   requestPractice {uid, text}
//       sendFeedback {uid, text}                          revertAudit {id, reason}
// Demo-only extras: demoAccounts(), demoSignIn(id), demoSimulateSignIn(id), demoAttempt(asId, op, args), demoReset()

import { firebaseConfig, allowedDomains, domainVerified } from './firebase-config.js';

const FB = '10.12.2';
export const STOPS = ['L1', 'L2', 'MC1', 'L3', 'MC2', 'L4', 'L5', 'MC3', 'L6', 'L7', 'FINISH'];
export const STATUS_IDS = ['current', 'practice', 'ready', 'submitted', 'mastered', 'needs', 'complete'];
export const AVATAR_IDS = [...Array(12)].map((_, i) => `avA_${i + 1}`).concat([...Array(12)].map((_, i) => `avB_${i + 1}`));
export const avatarSrc = (id) => `assets/${AVATAR_IDS.includes(id) ? id : 'avA_1'}.png`;
export const nextStop = (n) => STOPS[STOPS.indexOf(n) + 1] || null;
export const DEMO_DOMAIN = 'demo.invalid';
export const domainInfo = { allowedDomains, domainVerified };

export async function createBackend({ cfg }) {
  return firebaseConfig ? firebaseBackend(firebaseConfig) : demoBackend(cfg);
}

const STAFF_OPS = ['approveEnrollment', 'denyEnrollment', 'addStudent', 'removeStudent', 'setAccess', 'changePeriod', 'setProgress', 'requestPractice', 'sendFeedback', 'revertAudit'];
const validEmail = (e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e || '');
function check(op, a) {
  if (['approveEnrollment', 'addStudent', 'changePeriod'].includes(op) && ![1, 2, 5, 7].includes(a.period)) throw new Error('Choose Period 1, 2, 5 or 7.');
  if (['approveEnrollment', 'addStudent'].includes(op) && !(a.displayName || '').trim()) throw new Error('Enter a display name (first name + last initial).');
  if (op === 'addStudent' && !validEmail(a.email)) throw new Error('Enter a full school email address.');
  if (op === 'setProgress' && (!STOPS.includes(a.node) || !STATUS_IDS.includes(a.status))) throw new Error('Invalid lesson or status.');
  if (['requestPractice', 'sendFeedback'].includes(op) && !(a.text || '').trim()) throw new Error('Write a message first.');
}

/* ======================= DEMO ======================= */
const DB_KEY = 'rtd_demo_db_v2';

function seedDemo(cfg) {
  const av = (p) => (p.match(/(av[AB]_\d+)\.png$/) || [])[1] || null;
  const st = { demo01: 'current', demo02: 'ready', demo03: 'practice', demo04: 'needs', demo05: 'submitted', demo06: 'practice', demo07: 'current' };
  const extra = [
    { id: 'demo10', name: 'Alex N.', period: 2, avatar: 'assets/avB_6.png', current_node: 'FINISH', status: 'complete' },
    { id: 'demo11', name: 'Devon W.', period: 2, avatar: 'assets/avA_9.png', current_node: 'MC1', status: 'submitted' },
    { id: 'demo12', name: 'Harper L.', period: 5, avatar: 'assets/avB_2.png', current_node: 'L3', status: 'practice' },
    { id: 'demo13', name: 'Rowan J.', period: 7, avatar: 'assets/avA_12.png', current_node: 'L2', status: 'ready' }
  ];
  const db = { v: 2, seq: 1, accounts: [], staff: {}, roster: {}, enroll: {}, users: {}, positions: {}, progress: {}, feedback: {}, audit: [] };
  [...cfg.students, ...extra].forEach((s) => {
    const email = `${s.id}@${DEMO_DOMAIN}`, a = av(s.avatar), status = s.status || st[s.id] || 'current';
    db.accounts.push({ id: s.id, email, googleName: s.name });
    db.roster[email] = { period: s.period, displayName: s.name, active: true };
    db.users[s.id] = { email, period: s.period, displayName: s.name, avatar: a, role: 'student' };
    db.positions[s.id] = { period: s.period, displayName: s.name, avatar: a, node: s.current_node };
    db.progress[s.id] = { period: s.period, node: s.current_node, status };
  });
  db.accounts.push({ id: 'demo08', email: `demo08@${DEMO_DOMAIN}`, googleName: 'Sam Kim' });
  db.roster[`demo08@${DEMO_DOMAIN}`] = { period: 2, displayName: 'Sam K.', active: true };
  db.accounts.push({ id: 'demo09', email: `demo09@${DEMO_DOMAIN}`, googleName: 'Jamie Rivera' });
  db.accounts.push({ id: 'staff1', email: `wallace@${DEMO_DOMAIN}`, googleName: 'Mr. Wallace' });
  db.staff[`wallace@${DEMO_DOMAIN}`] = { name: 'Mr. Wallace', role: 'teacher' };
  db.accounts.push({ id: 'staff2', email: `coteacher@${DEMO_DOMAIN}`, googleName: 'Co-teacher' });
  db.staff[`coteacher@${DEMO_DOMAIN}`] = { name: 'Co-teacher (demo)', role: 'coteacher' };
  db.accounts.push({ id: 'outsider', email: 'gamer123@personal.example', googleName: 'Personal Gmail' });
  db.feedback.demo04 = [{ id: 'f0', kind: 'practice', author: 'Mr. Wallace', at: Date.now() - 86400000, text: 'Before you take MC2, let’s do a 5-minute conference on cause and effect. Bring your Document J notes.' }];
  return db;
}

function demoBackend(cfg) {
  let db;
  const load = () => { try { const d = JSON.parse(localStorage.getItem(DB_KEY)); if (d && d.v === 2) return d; } catch (e) {} const d = seedDemo(cfg); persist(d); return d; };
  const persist = (d) => { try { localStorage.setItem(DB_KEY, JSON.stringify(d)); } catch (e) {} };
  db = load();

  let session = null; // signed-in demo account for THIS page only (in memory)
  const L = { auth: new Set(), cls: new Set(), prog: new Set(), fb: new Set(), staff: new Set() };
  const accountById = (id) => db.accounts.find((a) => a.id === id) || null;
  const uidByEmail = (e) => (db.accounts.find((a) => a.email === e) || {}).id || null;
  const nameOf = (uid) => (db.users[uid] && db.users[uid].displayName) || uid;

  function actorOf(acc) {
    if (!acc) return { anon: true };
    const email = acc.email.toLowerCase(), school = email.endsWith('@' + DEMO_DOMAIN);
    const staff = school ? db.staff[email] : null, ro = school ? db.roster[email] : null;
    return { uid: acc.id, email, school, staff: !!staff, student: !!(ro && ro.active), period: ro ? ro.period : null, name: staff ? staff.name : ro ? ro.displayName : acc.googleName, googleName: acc.googleName };
  }

  // ---- Simulated security rules (mirror of firestore.rules) ----
  const RULES = {
    requestEnrollment: (x, a) => !x.school ? 'Only school-managed Google accounts can request access' : (x.staff || db.roster[x.email]) ? 'This account already has access' : a.email !== x.email ? 'You can only request access for your own account' : null,
    firstSignIn: (x, a) => !x.student ? 'Not an approved student' : a.uid !== x.uid ? 'You can only create your own profile' : (a.node !== 'L1' || a.status !== 'current') ? 'New profiles must start at L1' : null,
    setAvatar: (x, a) => !x.student ? 'Not an approved student' : a.uid !== x.uid ? 'Students can only change their OWN avatar' : !AVATAR_IDS.includes(a.avatar) ? 'Unknown avatar' : null,
    readProgress: (x, a) => (x.staff || (x.student && a.uid === x.uid)) ? null : 'Progress is private to the student and staff',
    readStaff: (x) => x.staff ? null : 'Mission Control is staff-only',
    writeStaff: () => 'Staff roles can only be granted by an administrator in the Firebase console — never from the app',
    editAudit: () => 'Change history is append-only — entries can never be edited or deleted'
  };
  STAFF_OPS.forEach((op) => { RULES[op] = (x) => x.staff ? null : 'Only staff can do this'; });
  function demoAuthorize(x, op, a) {
    const why = RULES[op] ? RULES[op](x, a || {}) : 'Unknown operation';
    if (why) { const e = new Error('Permission denied: ' + why); e.code = 'permission-denied'; throw e; }
  }

  function audit(x, f) {
    const n = db.seq++, id = 'a' + n;
    db.audit.unshift({ id, n, at: Date.now(), actor: x.email, actorName: x.name, target: null, ...f });
    return id;
  }
  const OPS = {
    requestEnrollment(x, a) { db.enroll[x.email] = { email: x.email, googleName: a.googleName || x.googleName, status: 'pending', at: Date.now() }; },
    firstSignIn(x) {
      const ro = db.roster[x.email];
      db.users[x.uid] = { email: x.email, period: ro.period, displayName: ro.displayName, avatar: null, role: 'student' };
      db.positions[x.uid] = { period: ro.period, displayName: ro.displayName, avatar: null, node: 'L1' };
      db.progress[x.uid] = { period: ro.period, node: 'L1', status: 'current' };
    },
    setAvatar(x, a) { db.users[a.uid].avatar = a.avatar; if (db.positions[a.uid]) db.positions[a.uid].avatar = a.avatar; },
    readProgress() {}, readStaff() {}, writeStaff() {}, editAudit() {},
    approveEnrollment(x, a) {
      if (db.roster[a.email]) throw new Error('That account is already on a roster.');
      db.roster[a.email] = { period: a.period, displayName: a.displayName.trim(), active: true };
      const e = db.enroll[a.email]; if (e) { e.status = 'approved'; e.reviewedBy = x.email; }
      audit(x, { action: 'Enrollment approved', email: a.email, targetName: a.displayName.trim(), change: `Approved for Period ${a.period}` });
    },
    denyEnrollment(x, a) {
      const e = db.enroll[a.email]; if (e) { e.status = 'denied'; e.reviewedBy = x.email; }
      audit(x, { action: 'Enrollment denied', email: a.email, targetName: e ? e.googleName : a.email, change: 'Request denied' });
    },
    addStudent(x, a) {
      const email = a.email.trim().toLowerCase();
      if (db.roster[email]) throw new Error('That email is already on a roster.');
      if (db.staff[email]) throw new Error('That email belongs to a staff member.');
      db.roster[email] = { period: a.period, displayName: a.displayName.trim(), active: true };
      const e = db.enroll[email]; if (e) { e.status = 'approved'; e.reviewedBy = x.email; }
      if (!db.accounts.find((c) => c.email === email)) db.accounts.push({ id: 'u' + db.seq, email, googleName: a.displayName.trim() });
      audit(x, { action: 'Student added', email, targetName: a.displayName.trim(), change: `Added to Period ${a.period}` });
    },
    removeStudent(x, a) {
      const r = db.roster[a.email]; if (!r) throw new Error('Not on a roster.');
      delete db.roster[a.email]; const uid = uidByEmail(a.email); if (uid) delete db.positions[uid];
      audit(x, { action: 'Removed from class', email: a.email, target: uid, targetName: r.displayName, change: `Removed from Period ${r.period} (progress history kept)` });
    },
    setAccess(x, a) {
      const r = db.roster[a.email]; if (!r) throw new Error('Not on a roster.');
      r.active = !!a.active; const uid = uidByEmail(a.email);
      if (uid && db.users[uid]) {
        if (!a.active) delete db.positions[uid];
        else { const u = db.users[uid], p = db.progress[uid] || { node: 'L1' }; db.positions[uid] = { period: r.period, displayName: r.displayName, avatar: u.avatar, node: p.node }; }
      }
      audit(x, { action: a.active ? 'Access granted' : 'Access revoked', email: a.email, target: uid, targetName: r.displayName, change: a.active ? 'Can sign in again' : 'Sign-in blocked; hidden from the board' });
    },
    changePeriod(x, a) {
      const r = db.roster[a.email]; if (!r) throw new Error('Not on a roster.');
      const from = r.period; if (from === a.period) return; r.period = a.period;
      const uid = uidByEmail(a.email);
      if (uid) ['users', 'positions', 'progress'].forEach((c) => { if (db[c][uid]) db[c][uid].period = a.period; });
      audit(x, { action: 'Period changed', email: a.email, target: uid, targetName: r.displayName, change: `Period ${from} → ${a.period}`, periodBefore: from, periodAfter: a.period });
    },
    setProgress(x, a) {
      const p = db.progress[a.uid]; if (!p) throw new Error('This student has not signed in yet.');
      const before = { node: p.node, status: p.status };
      const id = audit(x, { action: a.action || 'Progress updated', target: a.uid, email: db.users[a.uid].email, targetName: nameOf(a.uid), before, after: { node: a.node, status: a.status }, reason: a.reason || '', revertOf: a.revertOf || null });
      db.progress[a.uid] = { ...p, node: a.node, status: a.status, lastAuditId: id };
      if (db.positions[a.uid]) db.positions[a.uid].node = a.node;
    },
    requestPractice(x, a) {
      const p = db.progress[a.uid]; if (!p) throw new Error('This student has not signed in yet.');
      OPS.setProgress(x, { uid: a.uid, node: p.node, status: 'needs', action: 'Practice requested', reason: 'Next-step instructions sent privately' });
      (db.feedback[a.uid] = db.feedback[a.uid] || []).unshift({ id: 'f' + db.seq++, kind: 'practice', text: a.text.trim(), author: x.name, at: Date.now() });
    },
    sendFeedback(x, a) {
      if (!db.users[a.uid]) throw new Error('This student has not signed in yet.');
      (db.feedback[a.uid] = db.feedback[a.uid] || []).unshift({ id: 'f' + db.seq++, kind: 'note', text: a.text.trim(), author: x.name, at: Date.now() });
      audit(x, { action: 'Private feedback sent', target: a.uid, email: db.users[a.uid].email, targetName: nameOf(a.uid), change: 'Message visible only to the student' });
    },
    revertAudit(x, a) {
      const e = db.audit.find((r) => r.id === a.id); if (!e) throw new Error('Entry not found.');
      if (db.audit.some((r) => r.revertOf === e.id)) throw new Error('This change was already undone.');
      if (e.before) return OPS.setProgress(x, { uid: e.target, node: e.before.node, status: e.before.status, action: `Correction — undo of #${e.n}`, reason: a.reason || '', revertOf: e.id });
      if (e.periodBefore) { OPS.changePeriod(x, { email: e.email, period: e.periodBefore }); db.audit[0].revertOf = e.id; db.audit[0].action = `Correction — undo of #${e.n}`; db.audit[0].reason = a.reason || ''; return; }
      throw new Error('This entry has nothing to undo.');
    }
  };

  function exec(x, op, a = {}, silent = false) {
    demoAuthorize(x, op, a);
    if (STAFF_OPS.includes(op)) check(op, a);
    const r = OPS[op](x, a);
    persist(db); if (!silent) emitAll();
    return r;
  }

  function resolve(acc) {
    if (!acc) return { status: 'signedOut' };
    const x = actorOf(acc);
    if (!x.school) return { status: 'blocked', email: x.email };
    if (x.staff) return { status: 'staff', uid: x.uid, email: x.email, name: x.name, role: db.staff[x.email].role };
    const ro = db.roster[x.email];
    if (ro && !ro.active) return { status: 'revoked', email: x.email, name: ro.displayName };
    if (ro) {
      if (!db.users[x.uid]) exec(x, 'firstSignIn', { uid: x.uid, node: 'L1', status: 'current' }, true);
      return { status: 'student', uid: x.uid, email: x.email, name: ro.displayName, period: ro.period, avatar: db.users[x.uid].avatar };
    }
    if (!db.enroll[x.email] || db.enroll[x.email].status === 'approved') exec(x, 'requestEnrollment', { email: x.email, googleName: acc.googleName }, true);
    return { status: db.enroll[x.email].status === 'denied' ? 'denied' : 'pending', email: x.email, name: acc.googleName };
  }

  const actorNow = () => actorOf(session);
  const staffSnap = () => ({ roster: Object.entries(db.roster).map(([email, r]) => ({ email, ...r, uid: uidByEmail(email) })), enroll: Object.values(db.enroll), users: db.users, positions: db.positions, progress: db.progress, feedback: db.feedback, audit: db.audit });
  let lastAuth = '';
  function emitAll() {
    const st = resolve(session), js = JSON.stringify(st);
    if (js !== lastAuth) { lastAuth = js; L.auth.forEach((cb) => cb(st)); }
    L.cls.forEach(({ period, cb }) => cb(Object.entries(db.positions).filter(([, p]) => p.period === period).map(([id, p]) => ({ id, ...p }))));
    L.prog.forEach(({ uid, cb }) => { try { demoAuthorize(actorNow(), 'readProgress', { uid }); cb(db.progress[uid] || null); } catch (e) { cb(null); } });
    L.fb.forEach(({ uid, cb }) => { try { demoAuthorize(actorNow(), 'readProgress', { uid }); cb(db.feedback[uid] || []); } catch (e) { cb([]); } });
    L.staff.forEach((cb) => { try { demoAuthorize(actorNow(), 'readStaff'); cb(staffSnap()); } catch (e) { cb(null); } });
  }
  window.addEventListener('storage', (e) => { if (e.key === DB_KEY) { db = load(); emitAll(); } });
  const sub = (set, v) => { set.add(v); emitAll(); return () => set.delete(v); };

  return {
    mode: 'demo',
    onAuthChange(cb) { L.auth.add(cb); const st = resolve(session); lastAuth = JSON.stringify(st); cb(st); return () => L.auth.delete(cb); },
    async signIn() { throw new Error('Google sign-in is not configured yet (demo mode).'); },
    async signOut() { session = null; emitAll(); },
    async setAvatar(uid, avatar) { exec(actorNow(), 'setAvatar', { uid, avatar }); },
    listenClass: (period, cb) => sub(L.cls, { period, cb }),
    listenMyProgress: (uid, cb) => sub(L.prog, { uid, cb }),
    listenFeedback: (uid, cb) => sub(L.fb, { uid, cb }),
    listenStaff: (cb) => sub(L.staff, cb),
    async run(op, args) { if (!STAFF_OPS.includes(op)) throw new Error('Unknown operation'); return exec(actorNow(), op, args); },
    demoMove(uid, node, status) { exec(actorNow(), 'setProgress', { uid, node, status, action: 'Demo controls move', reason: 'Simulation' }); },
    demoAccounts() {
      return db.accounts.map((a) => {
        const x = actorOf(a), ro = db.roster[x.email], en = db.enroll[x.email];
        const kind = !x.school ? 'outside' : x.staff ? 'staff' : ro ? (ro.active ? 'student' : 'revoked') : 'pending';
        const meta = kind === 'staff' ? 'Staff · all periods' : kind === 'student' ? `Student · Period ${ro.period}${db.users[a.id] ? '' : ' · first sign-in'}` : kind === 'revoked' ? 'Access revoked' : kind === 'outside' ? 'Personal account (not school-managed)' : en ? (en.status === 'denied' ? 'Enrollment denied' : 'Waiting for approval') : 'Not on any roster yet';
        return { id: a.id, name: ro ? ro.displayName : x.staff ? x.name : a.googleName, kind, meta, period: ro ? ro.period : null };
      });
    },
    demoSignIn(id) { session = accountById(id); emitAll(); },
    demoSimulateSignIn(id) { const acc = accountById(id); const st = resolve(acc); persist(db); emitAll(); return st; },
    demoAttempt(asId, op, args) {
      const x = actorOf(accountById(asId));
      try { exec(x, op, args); return { ok: true }; } catch (e) { return { ok: false, denied: e.code === 'permission-denied', message: e.message }; }
    },
    demoReset() { db = seedDemo(cfg); persist(db); emitAll(); }
  };
}

/* ======================= FIREBASE (production path — not yet configured or tested) ======================= */
async function firebaseBackend(config) {
  const { initializeApp } = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-app.js`);
  const A = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-auth.js`);
  const F = await import(`https://www.gstatic.com/firebasejs/${FB}/firebase-firestore.js`);
  const app = initializeApp(config), auth = A.getAuth(app), db = F.getFirestore(app);
  const d = (...p) => F.doc(db, ...p);
  const startingProgress = { node: 'L1', status: 'current' };
  let me = null; // { email, name }

  async function resolve(user) {
    if (!user) return { status: 'signedOut' };
    const email = (user.email || '').toLowerCase();
    if (!user.emailVerified || !allowedDomains.some((x) => email.endsWith('@' + x))) return { status: 'blocked', email };
    const staff = await F.getDoc(d('staff', email));
    if (staff.exists()) { me = { email, name: staff.data().name || user.displayName }; return { status: 'staff', uid: user.uid, email, name: me.name, role: staff.data().role || 'teacher' }; }
    const ro = await F.getDoc(d('roster', email));
    if (ro.exists()) {
      const r = ro.data();
      if (r.active !== true) return { status: 'revoked', email, name: r.displayName };
      let u = await F.getDoc(d('users', user.uid));
      if (!u.exists()) {
        const b = F.writeBatch(db);
        b.set(d('users', user.uid), { email, period: r.period, displayName: r.displayName, avatar: null, role: 'student', createdAt: F.serverTimestamp() });
        b.set(d('positions', user.uid), { period: r.period, displayName: r.displayName, avatar: null, node: startingProgress.node });
        await b.commit(); u = await F.getDoc(d('users', user.uid));
      }
      return { status: 'student', uid: user.uid, email, name: r.displayName, period: r.period, avatar: u.data().avatar };
    }
    const er = await F.getDoc(d('enrollRequests', email));
    if (!er.exists()) await F.setDoc(d('enrollRequests', email), { email, googleName: user.displayName || email, status: 'pending', createdAt: F.serverTimestamp() });
    return { status: er.exists() && er.data().status === 'denied' ? 'denied' : 'pending', email, name: user.displayName || email };
  }

  const uidByEmail = async (email) => { const s = await F.getDocs(F.query(F.collection(db, 'users'), F.where('email', '==', email))); return s.empty ? null : s.docs[0].id; };
  const newAudit = (b, f) => { const ref = F.doc(F.collection(db, 'audit')); b.set(ref, { actor: me.email, actorName: me.name, target: null, at: F.serverTimestamp(), ...f }); return ref.id; };
  async function setProgressB(b, a) {
    const ref = d('progress', a.uid);
    const p = await b.get(ref);
    const u = (await b.get(d('users', a.uid))).data();
    if (!u) throw new Error('This student has not signed in yet.');
    const previous = p.data() ?? startingProgress;
    const next = { node: a.node ?? previous.node, status: a.status };
    const id = newAudit(b, { action: a.action || 'Progress updated', target: a.uid, email: u.email, targetName: u.displayName, before: { node: previous.node, status: previous.status }, after: next, reason: a.reason || '', revertOf: a.revertOf || null });
    b.set(ref, { ...next, period: p.exists() ? previous.period : u.period, lastAuditId: id }, { merge: true });
    b.update(d('positions', a.uid), { node: next.node });
  }
  const OPS = {
    async approveEnrollment(b, a) {
      b.set(d('roster', a.email), { period: a.period, displayName: a.displayName.trim(), active: true });
      b.update(d('enrollRequests', a.email), { status: 'approved', reviewedBy: me.email });
      newAudit(b, { action: 'Enrollment approved', email: a.email, targetName: a.displayName.trim(), change: `Approved for Period ${a.period}` });
    },
    async denyEnrollment(b, a) { b.update(d('enrollRequests', a.email), { status: 'denied', reviewedBy: me.email }); newAudit(b, { action: 'Enrollment denied', email: a.email, change: 'Request denied' }); },
    async addStudent(b, a) {
      const email = a.email.trim().toLowerCase();
      b.set(d('roster', email), { period: a.period, displayName: a.displayName.trim(), active: true });
      newAudit(b, { action: 'Student added', email, targetName: a.displayName.trim(), change: `Added to Period ${a.period}` });
    },
    async removeStudent(b, a) {
      const r = (await F.getDoc(d('roster', a.email))).data(), uid = await uidByEmail(a.email);
      b.delete(d('roster', a.email)); if (uid) b.delete(d('positions', uid));
      newAudit(b, { action: 'Removed from class', email: a.email, target: uid, targetName: r.displayName, change: `Removed from Period ${r.period} (progress history kept)` });
    },
    async setAccess(b, a) {
      const r = (await F.getDoc(d('roster', a.email))).data(), uid = await uidByEmail(a.email);
      b.update(d('roster', a.email), { active: !!a.active });
      if (uid) {
        if (!a.active) b.delete(d('positions', uid));
        else { const u = (await F.getDoc(d('users', uid))).data(), p = (await F.getDoc(d('progress', uid))).data() ?? startingProgress; b.set(d('positions', uid), { period: r.period, displayName: r.displayName, avatar: u.avatar, node: p.node }); }
      }
      newAudit(b, { action: a.active ? 'Access granted' : 'Access revoked', email: a.email, target: uid, targetName: r.displayName, change: a.active ? 'Can sign in again' : 'Sign-in blocked; hidden from the board' });
    },
    async changePeriod(b, a) {
      const r = (await b.get(d('roster', a.email))).data(), uid = await uidByEmail(a.email);
      const p = uid ? await b.get(d('progress', uid)) : null;
      b.update(d('roster', a.email), { period: a.period });
      const id = newAudit(b, { action: 'Period changed', email: a.email, target: uid, targetName: r.displayName, change: `Period ${r.period} → ${a.period}`, periodBefore: r.period, periodAfter: a.period, revertOf: a.revertOf || null });
      if (uid) {
        b.update(d('users', uid), { period: a.period });
        b.update(d('positions', uid), { period: a.period });
        if (p.exists()) b.update(p.ref, { period: a.period, lastAuditId: id });
      }
    },
    async setProgress(b, a) { await setProgressB(b, a); },
    async requestPractice(b, a) {
      await setProgressB(b, { uid: a.uid, status: 'needs', action: 'Practice requested', reason: 'Next-step instructions sent privately' });
      b.set(F.doc(F.collection(db, 'progress', a.uid, 'feedback')), { kind: 'practice', text: a.text.trim(), author: me.email, authorName: me.name, at: F.serverTimestamp() });
    },
    async sendFeedback(b, a) {
      b.set(F.doc(F.collection(db, 'progress', a.uid, 'feedback')), { kind: 'note', text: a.text.trim(), author: me.email, authorName: me.name, at: F.serverTimestamp() });
      newAudit(b, { action: 'Private feedback sent', target: a.uid, change: 'Message visible only to the student' });
    },
    async revertAudit(b, a) {
      const e = (await b.get(d('audit', a.id))).data(); if (!e) throw new Error('Entry not found.');
      const dup = await F.getDocs(F.query(F.collection(db, 'audit'), F.where('revertOf', '==', a.id))); if (!dup.empty) throw new Error('This change was already undone.');
      if (e.before) return setProgressB(b, { uid: e.target, node: e.before.node, status: e.before.status, action: 'Correction — undo', reason: a.reason || '', revertOf: a.id });
      if (e.periodBefore) return OPS.changePeriod(b, { email: e.email, period: e.periodBefore, revertOf: a.id });
      throw new Error('This entry has nothing to undo.');
    }
  };
  const ts = (v) => (v && v.toMillis ? v.toMillis() : v || Date.now());

  return {
    mode: 'firebase',
    onAuthChange(cb) { cb({ status: 'loading' }); return A.onAuthStateChanged(auth, async (u) => { try { cb(await resolve(u)); } catch (e) { cb({ status: 'error', error: e.code || String(e) }); } }); },
    async signIn() { const p = new A.GoogleAuthProvider(); if (domainVerified) p.setCustomParameters({ hd: allowedDomains[0], prompt: 'select_account' }); await A.signInWithPopup(auth, p); },
    signOut: () => A.signOut(auth),
    async setAvatar(uid, avatar) { const b = F.writeBatch(db); b.update(d('users', uid), { avatar }); b.update(d('positions', uid), { avatar }); await b.commit(); },
    listenClass: (period, cb) => F.onSnapshot(F.query(F.collection(db, 'positions'), F.where('period', '==', period)), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data() }))), () => cb([])),
    listenMyProgress: (uid, cb) => F.onSnapshot(d('progress', uid), (x) => cb(x.data() ?? startingProgress), () => cb(null)),
    listenFeedback: (uid, cb) => F.onSnapshot(F.query(F.collection(db, 'progress', uid, 'feedback'), F.orderBy('at', 'desc')), (s) => cb(s.docs.map((x) => ({ id: x.id, ...x.data(), author: x.data().authorName || x.data().author, at: ts(x.data().at) }))), () => cb([])),
    listenStaff(cb) {
      const snap = { roster: [], enroll: [], users: {}, positions: {}, progress: null, feedback: {}, audit: [] }, unsubs = [];
      const emit = () => {
        const progress = { ...snap.progress };
        if (snap.progress) {
          for (const [uid, user] of Object.entries(snap.users)) {
            progress[uid] ??= { ...startingProgress, period: user.period };
          }
        }
        cb({ ...snap, progress, roster: snap.roster.map((r) => ({ ...r, uid: (Object.entries(snap.users).find(([, u]) => u.email === r.email) || [])[0] || null })) });
      };
      const byId = (s) => Object.fromEntries(s.docs.map((x) => [x.id, x.data()]));
      unsubs.push(F.onSnapshot(F.collection(db, 'roster'), (s) => { snap.roster = s.docs.map((x) => ({ email: x.id, ...x.data() })); emit(); }, () => cb(null)));
      unsubs.push(F.onSnapshot(F.collection(db, 'enrollRequests'), (s) => { snap.enroll = s.docs.map((x) => ({ ...x.data(), at: ts(x.data().createdAt) })); emit(); }));
      unsubs.push(F.onSnapshot(F.collection(db, 'users'), (s) => { snap.users = byId(s); emit(); }));
      unsubs.push(F.onSnapshot(F.collection(db, 'positions'), (s) => { snap.positions = byId(s); emit(); }));
      unsubs.push(F.onSnapshot(F.collection(db, 'progress'), (s) => { snap.progress = byId(s); emit(); }));
      unsubs.push(F.onSnapshot(F.query(F.collection(db, 'audit'), F.orderBy('at', 'desc'), F.limit(300)), (s) => { snap.audit = s.docs.map((x, i) => ({ id: x.id, n: s.size - i, ...x.data(), at: ts(x.data().at) })); emit(); }));
      return () => unsubs.forEach((u) => u());
    },
    async run(op, a) {
      if (!STAFF_OPS.includes(op)) throw new Error('Unknown operation');
      check(op, a);
      if (['setProgress', 'requestPractice', 'changePeriod', 'revertAudit'].includes(op)) {
        return F.runTransaction(db, (transaction) => OPS[op](transaction, a));
      }
      const b = F.writeBatch(db); await OPS[op](b, a); await b.commit();
    }
  };
}
