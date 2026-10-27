# My Global Hub — Enterprise Payroll

Bi-weekly payroll, time entry, contractor management and proof-of-payment app.

## Run locally (VS Code)
The app loads sibling files (`support.js`, `app/kit.jsx`, design-system bundle), so it must be served over HTTP — opening the file directly (`file://`) won't work.

1. Open this folder in VS Code.
2. Install the **Live Server** extension (ritwickdey.LiveServer).
3. Right-click `My Global Hub.dc.html` → **Open with Live Server**.

Alternative (any terminal):
```bash
npx serve .
# or
python3 -m http.server 8080
```
Then open `http://localhost:8080/My%20Global%20Hub.dc.html`.

Routes persist in the URL hash: `#periods`, `#mytime`, `#addEmployee`, `#paystub`, `#contractors`, etc.

## Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit: My Global Hub payroll app"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```
To host it, enable **Settings → Pages → Deploy from branch (main / root)**; the app will be at `https://<your-org>.github.io/<repo>/My%20Global%20Hub.dc.html`.

## Structure
- `My Global Hub.dc.html` — main app (single-page Design Component)
- `support.js` — component runtime (do not edit)
- `app/kit.jsx` — enterprise UI-kit screens
- `_ds/` — My Global Hub Design System (tokens, components bundle)
- `assets/` — logos, avatars
- `CLAUDE.md` — project notes and data conventions

## Notes
- Data is mock/in-browser; proof-of-payment uploads are stored in `localStorage`.
- No build step required.
