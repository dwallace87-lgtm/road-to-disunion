# The Road to Disunion — Game Board & Mission Control

**Status:** DEMO MODE. Accounts are fictional and progress is saved only in each visitor's browser. Do not enter real student information.

## Put it on GitHub Pages (no coding)
1. Create a new repository on github.com (for example, `road-to-disunion`).
2. Click **Add file → Upload files**. Drag in **everything inside this folder**, including the `assets`, `_ds`, `tests` and `docs` folders and the `.nojekyll` file. Then click **Commit changes**.
   - Hidden files like `.nojekyll` may not show on your computer. On a Mac, press Cmd+Shift+. in Finder. On Windows, turn on View → Hidden items.
3. Go to **Settings → Pages**. Under "Branch", choose **main** and **/ (root)**, then click **Save**.
4. After about a minute, your site address appears at the top of that page, for example `https://yourname.github.io/road-to-disunion/`.

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
- `tests/` and `package.json`: automated security tests. They have not been run yet.
- `docs/`: the plan and a plain-English guide to Mission Control.

## Before real students use it
1. Confirm the school email domain.
2. Create the school's Firebase project and paste its settings into `firebase-config.js`.
3. Run the security tests.
4. Get school approval for student data.

Until then, it stays in demo mode.
