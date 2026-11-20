# Road to Disunion — Audit & Phased Implementation Plan

_Updated after Phase 2 (Mission Control)._

## 1. Status at a glance

### Works in demo mode (fictional data, this browser only)
- **Student board** (`Road to Disunion Tracker.dc.html`):
  - All maps, art, animation and the exact locked route.
  - Sign-in gate with these account states: pending, denied, access paused, blocked, student, staff.
  - Avatar picker; private self-status; latest private teacher message.
  - Live position updates.
- **Mission Control** (`Mission Control.dc.html`):
  - Period switch and summary cards.
  - Roster with search and filters, map view, and pending queues.
  - Enrollment approve/deny; add, remove and change-period; revoke/grant access.
  - Verify & advance, request practice, private feedback, and corrections with a required reason.
  - Change history with logged undo.
  - Demo walkthrough of the 7 scenarios; security test bench.
- **Shared demo database:** localStorage key `rtd_demo_db_v2`, so tabs and the embedded board stay in sync.
- **Simulated rules:** `demoAuthorize()` in `backend.js` mirrors `firestore.rules`, so students are denied in the demo the same way the real rules are designed to deny them.

### Written but NOT configured, deployed or tested
- **Firebase adapter** in `backend.js`: Google sign-in, enrollment requests, roster, progress with audit batches, feedback, and live listeners.
- **`firestore.rules`:** staff allowlist is admin-only; students are limited to their own L1 start plus their avatar; every progress change must reference a matching audit entry in the same batch; history is append-only.
- **`tests/firestore.rules.test.js`:** 17 emulator tests (self-mastery, impersonation, role elevation, self-approval, period change, private reads, forged audit, domain/verification, append-only history). **Not run.**
- **Hosting:** `firebase.json` (Google Sites frame allowance).

### Unverified configuration
- The school email domain. It is a placeholder (`UNVERIFIED-DOMAIN.invalid`) in `firebase-config.js` and `schoolDomains()` in `firestore.rules`.

### Not built yet
- The student "I'm Ready for My Mastery Check" request with a work link or Google Classroom link.
- A request queue tied to submitted work.
- A full feedback thread and revision/reassessment cycle.
- Resource links stored in the database. They are currently per-browser, and editing is staff-only.

## 2. Architecture (unchanged)
- **Firebase Auth (Google) and Firestore:**
  - Roles come from `staff/{email}`, which is admin-managed, and `roster/{email}`, which is teacher-managed.
  - Unrecognized school accounts create `enrollRequests/{email}` (pending) and wait for approval.
- **Every staff write is a single batch:** the change plus an `audit` entry. The rules reject progress writes without that matching entry.
- **Hosting:** Firebase Hosting or another school-approved static host, embedded in Google Sites. The web config is public; security comes from the rules only.

## 3. Phases
1. ✅ Authentication & roles (demo-functional; Firebase path written).
2. ✅ Mission Control v1 (demo-functional; Firebase path written).
3. **Next — mastery requests & revision:**
   - Student "I'm Ready" button on their current stop, with an optional work link (Google Classroom URL) and a note. This writes `requests/{id}`; the rules already restrict it to the student's own current stop.
   - Teacher queue in Mission Control showing the request, link and note:
     - **Approve:** batched request update + progress + position + audit.
     - **Needs practice:** private next-step instructions.
   - Student view of their request state ("Submitted — awaiting feedback") and a private feedback thread.
   - Revision & reassessment loop for L7 and failed checks: practice → re-request → re-verify. Each attempt is kept in the mastery-check history.
4. **Teacher tools:** resource links in the database (`resources/`), CSV roster import, an aliases option, and printable class snapshots.
5. **Hardening & launch:**
   - Run the emulator suite and fix any failures.
   - Chromebook QA and an accessibility pass.
   - School privacy approval.
   - Deploy, embed in Sites, and import the real roster.

## 4. Setup checklist (nothing done yet)
1. Confirm the school domain(s), then update `firebase-config.js` (`allowedDomains`, `domainVerified: true`) and `schoolDomains()` in `firestore.rules`.
2. Create the Firebase project under the school Workspace and enable Google sign-in.
3. Paste the web config into `firebase-config.js`.
4. Run `npm install`, then `npm run test:rules`. All 17 must pass.
5. Deploy: `firebase deploy --only firestore:rules,hosting`.
6. Add the `staff/{email}` docs in the console: `{ role: "teacher", name: "Mr. Wallace" }`.
7. Test with fictional roster entries until real student records are approved.
