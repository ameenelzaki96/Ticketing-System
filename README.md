# FleetOo · Installation Tickets

A one-page ticket board for GPS installation requests that come in on WhatsApp.

- **You** paste a WhatsApp message → the client, contact number, locations and device count are filled in automatically → **Create ticket**.
- **Mustafa** opens one link on his phone and sees tickets by status: **New → Assigned → In progress → Closed** (or Cancelled).
  He picks a technician (which moves the ticket to *Assigned*), sends the job to the technician on WhatsApp in one tap, and closes it when done.
- Works in **English and Arabic** (button at the top right), refreshes itself every 30 seconds, and warns you when a number already has an open ticket.

```
index.html            the app (hosted on GitHub Pages)
parser.js             reads WhatsApp messages (Arabic + English)
apps-script/Code.gs   the backend (a Google Sheet holds all the tickets)
```

You can try it right now: open `index.html` in a browser. Until step 2 is done it runs in **demo mode** and saves only in that browser.

---

## Setup (about 15 minutes, all free)

### 1. Create the database (Google Sheet + Apps Script)

1. Go to [sheets.new](https://sheets.new) and name the sheet **FleetOo Tickets**.
2. Click **Extensions → Apps Script**.
3. Delete what's in the editor, paste the full contents of `apps-script/Code.gs`.
4. On the first line, change `CHANGE-ME-to-a-long-random-string` to your own secret key, such as `fleetoo-7Hq2xP9mL4vR`. Keep it, because it goes into Mustafa's link.
5. Click **Save**. In the function drop-down choose **setup** → **Run** → approve the permissions (choose your account → *Advanced* → *Go to project*). This creates the *Tickets* and *Technicians* tabs.
6. Click **Deploy → New deployment** → gear icon → **Web app**:
   - Execute as: **Me**
   - Who has access: **Anyone**
   - **Deploy**, then copy the **Web app URL** (it ends in `/exec`).

> If you edit `Code.gs` later: **Deploy → Manage deployments → ✎ → Version: New version → Deploy**. That keeps the same URL.

### 2. Connect the app to it

Open `index.html`, find this line near the bottom and paste your URL:

```js
const API_URL = 'https://script.google.com/macros/s/XXXXXXXX/exec';
```

### 3. Host on GitHub Pages

1. On GitHub: **New repository**, for example `fleetoo-tickets`.
2. **Add file → Upload files** → upload `index.html`, `parser.js` (and `README.md` if you like; you don't need to upload `apps-script/`). **Commit**.
3. **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main` / root → **Save**.
4. After about a minute the site is live at `https://YOUR-USERNAME.github.io/fleetoo-tickets/`

### 4. Send Mustafa his link

Add `#` and your secret key to the end:

```
https://YOUR-USERNAME.github.io/fleetoo-tickets/#fleetoo-7Hq2xP9mL4vR
```

He opens it once and the key is remembered on his phone. He can tap *Share → Add to Home Screen* so it opens like an app. Use the same link yourself for pasting.

**First thing for Mustafa:** open the **Technicians** tab and add his technicians (name, mobile, area).

---

## Daily use

| Who | What |
|---|---|
| You | **+ New from WhatsApp** → paste the message (fields fill in by themselves) → check them → **Create ticket** |
| Mustafa | **Tickets** → pick a technician from the drop-down → **📤 Send to technician** (opens WhatsApp with the job details) |
| Mustafa | **▶ Start** when the technician is on site → **✓ Close ticket** when the installation is done |
| Anyone | **✎ Edit** to fix details, **↺ Reopen** if something comes back, **History** shows who changed what and when |

The Google Sheet is your full record, and you can filter it, export it or build reports from it.

## Security notes

- The GitHub page is public, but the data isn't: without the key, the backend returns nothing. The key is never stored in the code; it lives only in the link.
- If the key leaks, change `ACCESS_KEY` in Apps Script, deploy a new version, and send a new link.
- The page tells search engines not to index it (`noindex`).
