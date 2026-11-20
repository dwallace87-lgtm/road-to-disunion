# Mission Control — Plain-English Guide

**Status:** works in demo mode with fictional accounts. It is not connected to Google sign-in or a real database yet, and nothing here has been checked against the real security rules.

## Opening it
- Open **Mission Control.dc.html**. Staff on the board can also use the **Mission Control ↗** button in the top bar.
- In demo mode, pick **Mr. Wallace** or **Co-teacher** from the demo account list.
  - Picking a student account shows a "This page is for teachers" screen.
  - In production, the database rules block staff data for students even if they find the page.

## The screen, top to bottom
1. **Period switch (All · 1 · 2 · 5 · 7):** everything below filters to that class.
2. **Summary cards:** On roster, Signed in, Requesting approval, Awaiting feedback, Needs support, Completed unit, and Enrollment requests. Click a card to filter the roster to those students.
3. **Views:**
   - **Roster:** one compact row per student showing:
     - avatar and name
     - current stop
     - private status
     - lessons and checks completed
     - quick actions: ✓ Verify, Practice, Details
   - **Map view:** one column per checkpoint, in the exact route order. Each column shows its count and the students there, with a status dot.
   - **Change history:** every staff change, with who made it, what changed, and when. Entries can't be edited or deleted. **Undo** adds a new correction entry.
   - **Demo walkthrough:** the 7 test scenarios, next to the real student board running live in a frame.
   - **Security tests:** tries forbidden actions as students and shows that each is denied.
4. **Right column:**
   - Enrollment requests, with Approve or Deny plus a period and display name.
   - Requesting approval, Awaiting feedback, Needs support and Completed lists, each with one-click Verify where it applies.

## Student details panel (click any name)
- Period (change it here), access (revoke or restore), current stop, and private status.
- Route chips (done, current, upcoming), the three mastery checks, and the next step.
- **Actions:**
  - **✓ Verify & advance:** moves the student one stop along the route.
  - **Request more practice:** keeps them at the same stop, marks them "Needs support", and sends your private message.
  - **Send feedback only:** sends the message without changing their status.
  - **Correct position:** fixes a mistaken entry; a reason is required.
  - **Remove from class:** their history is kept.
- Their private feedback and change history.

Every change to a student's progress, period or access asks you to confirm first, and is written to the change history.

## The 7 demo scenarios
Each scenario is listed with what works in demo mode and what production still needs.

1. **Mr. Wallace signs in and views Period 2.**
   - Demo: works.
   - Production: needs Firebase, Google sign-in, and a staff record.
2. **A new student requests enrollment.**
   - Demo: works (simulated sign-in by Jamie Rivera).
   - Production: the rule is written but untested.
3. **Approve Jamie and assign Period 2.**
   - Demo: works.
   - Production: the rule is written but untested.
4. **Jamie appears on the Period 2 board.**
   - Demo: works; the live frame updates.
   - Production: needs Firebase for live updates.
5. **Update Riley's verified progress.**
   - Demo: works and writes a history entry.
   - Production: the database refuses progress changes that don't have a matching history entry. That rule is covered by tests, which haven't been run yet.
6. **Riley's avatar moves.**
   - Demo: works (in Riley's own view of the board).
   - Production: needs Firebase for live updates.
7. **A student tries an unauthorized action.**
   - Demo: denied by the simulated copy of the rules in this browser.
   - Production: real denial needs the emulator test suite to be run and the rules deployed.

## What "demo mode" means
- **Accounts are fictional.** Sign-in is a list of buttons, not Google.
- **The database is this browser.** Every tab on this computer shares it (that's why the board frame updates live), and **Reset demo data** restores the starting state.
- **Permissions are a JavaScript copy of the server rules.** It shows the intended behavior, but it isn't real security — anyone with developer tools could bypass it. Real security comes only from `firestore.rules` running on Google's servers.

## Before going live (nothing below has been done)
1. **Confirm the school email domain(s).** They are marked UNVERIFIED in `firebase-config.js` and `firestore.rules`.
2. **Create the school Firebase project** and paste its config into `firebase-config.js`.
3. **Run the security tests.** Run `npm install`, then `npm run test:rules` (needs Node 18+ and Java). The 17 tests are in `tests/firestore.rules.test.js`.
4. **Deploy:** `firebase deploy --only firestore:rules,hosting`.
5. **Add staff records** for you and your co-teachers in the Firebase console. This can't be done from the app, by design.
6. **Get school approval** before adding any real student records.
