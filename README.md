# The Road to Disunion — Game Board & Mission Control

**Status:** DEMO MODE. Accounts are fictional and progress is saved only in each visitor's browser. Do not enter real student information.

## Put it on GitHub Pages (no coding)
1. In the GitHub repository, click **Settings → Pages**.
2. Under **Build and deployment**, open **Source** and select **GitHub Actions**.
3. A push to `main` publishes the demo. To start the first deployment by hand, open **Actions → Publish demo to GitHub Pages → Run workflow**, select **main**, and click **Run workflow**.
4. Once deployment finishes, go back to **Settings → Pages** and click **Visit site**. The default address is `https://OWNER.github.io/REPOSITORY/`.

## Put it on Google Sites
- **Student board:** Insert → Embed → **By URL** → paste your site address → stretch the box to full width.
- **Mission Control (teachers):** link to `…/Mission%20Control.dc.html`. Don't embed it on a student page.

## Files
- `index.html`: opens the student board.
- `Road to Disunion Tracker.dc.html`: the student game board.
- `Mission Control.dc.html`: the teacher dashboard.
- `support.js`: the runtime that makes both pages work.
- `backend.js`: sign-in and data (demo now; Firebase later).
- `firebase-config.js`: where the school's Firebase settings and email domain go. **The domain is unverified.**
- `board_config.json`: lesson content, route, map positions and art paths.
- `assets/`: all the pixel art.
- `_ds/`: fonts and colors.
- `firestore.rules` and `firebase.json`: real security rules and hosting settings, used once Firebase is set up.
- `tests/` and `package.json`: automated security tests that run on pull requests and on pushes to `main`.
- `docs/`: the plan and a plain-English guide to Mission Control.

## Before real students use it
1. Confirm the school email domain.
2. Create the school's Firebase project and paste its settings into `firebase-config.js`.
3. Run the security tests.
4. Get school approval for student data.

Until then, it stays in demo mode.
