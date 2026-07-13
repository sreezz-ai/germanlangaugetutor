Deutsch100 — German Learning Portal
A single-page German learning app (vocab, typing translation challenges, a
speaking exam) with server-side, per-user progress that syncs across devices.
How persistence works
Frontend: `index.html` — the whole app (Tailwind UI + game logic).
Backend: `netlify/functions/progress.js` — a Netlify Function that
reads/writes progress using Netlify Blobs (Netlify's built-in
key/value store — no external database or account needed), keyed by
username.
On first visit, the app shows a username screen. Entering a username that
has never been used creates a brand-new profile starting at Level 1.
Entering a username that already has saved progress resumes exactly where
that learner left off — the app calls
`GET /.netlify/functions/progress?username=<name>`, which returns
`{ exists, username, state }`.
The chosen username is remembered in this browser (`localStorage`) so
returning here skips straight to the dashboard; a "switch user" icon next
to the learner name clears that and re-shows the username screen so a
different profile can be entered.
Every time a level is completed, the app calls
`POST /.netlify/functions/progress` with `{ username, ... }` to save the
new level, streak, and badge state to the server — so opening the site
from a different browser, device, or incognito window and entering the
same username shows the same progress.
If the server can't be reached (e.g. offline, or testing by double-clicking
the file locally), the app falls back to a per-username cache in this
browser's localStorage, then re-syncs to the server on the next successful
request.
Files in this project
```
.
├── index.html                     # the app itself (UI + username flow + game logic)
├── netlify/
│   └── functions/
│       └── progress.js            # GET/POST progress by username, via Netlify Blobs
├── netlify.toml                   # tells Netlify where the functions live
├── package.json                   # declares the @netlify/blobs dependency
└── .gitignore
```
Username rules
Usernames are 3-20 characters: lowercase letters, numbers, `_` or `-`
(entered case is lowercased automatically). Whatever username is entered is
the key for that person's progress — so the same username always resumes
the same profile, from any browser or device, and a username nobody has
used yet always starts fresh at Level 1.
Deployment steps
1. Push this folder to GitHub
```bash
cd deutsch100-site
git init
git add .
git commit -m "Deutsch100 with multi-user, server-synced progress"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```
(Or use GitHub's website "Upload files" if you'd rather not use the
command line — drag in all the files/folders exactly as they are here,
keeping the `netlify/functions/` folder structure intact.)
2. Connect the repo to Netlify
Go to app.netlify.com and log in.
Click Add new site → Import an existing project.
Choose GitHub, authorize if asked, and select your repository.
Build settings — Netlify should auto-detect from `netlify.toml`, but if
it asks:
Build command: leave blank (nothing to build)
Publish directory: `.`
Functions directory: `netlify/functions` (already set in
`netlify.toml`)
Click Deploy site.
3. That's it — no extra setup for the database
Netlify Blobs is zero-configuration: as soon as the site is deployed on
Netlify, the function in `netlify/functions/progress.js` can read and write
its blob store automatically. There's no separate database to create or
connect, and no per-user setup — each new username is created on first save.
4. Verify it works
Open your new `https://<something>.netlify.app` URL.
Enter a new username (e.g. `alex`) — it should start at Level 1.
Complete a level.
Open the same URL in a different browser (or a private/incognito
window, or your phone). Enter the same username — the level you just
completed should already be unlocked, and the streak/badges should match.
Try a second, different username — it should start fresh at Level 1,
completely independent of the first profile.
Local testing (optional)
If you want to test the function locally before deploying:
```bash
npm install -g netlify-cli
cd deutsch100-site
npm install
netlify dev
```
This runs the site and the function together at `http://localhost:8888`
with a local Blobs store.
Notes / limitations
Anyone who knows a given username can view/continue that profile — there
is no password or real authentication. This is fine for personal/family/
classroom use where usernames aren't guessed easily, but not meant for
anything sensitive.
There's no "username taken" concept beyond this: whoever enters a given
username is that profile. If you want stricter identity (e.g. accounts
with passwords or email login), that would need a real auth layer added
on top of this.
