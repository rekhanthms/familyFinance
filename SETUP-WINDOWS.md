# Build and run the app on your Windows PC

> Update: `setup.bat` now needs no administrator rights and no winget. If your Node.js is missing or too old it downloads its own copy into a hidden `.tools` folder inside the project, and installs npm 11 there too. It also checks disk space and internet, picks another port if 4200 is busy, and skips Angular's analytics question. `start.bat` is the quick start for later.


## The easy way (recommended)
1. Right-click the zip, choose Extract All, and extract to `C:\family-finance`.
2. Open that folder and **double-click `setup.bat`**.
3. If Windows shows a blue "protected your PC" box, click More info, then Run anyway. If it asks permission to install Node.js, choose Yes.
4. Wait. It installs what is missing, installs the packages, runs the tests, and opens the app at http://localhost:4200.
5. Next time, just double-click `start.bat`.

The manual steps below do the same thing, for when you want to see each one.

Do these once. Each step says what you should see.

1. **Install Node.js.** Go to https://nodejs.org, download the LTS installer (version 22.22.2 or newer, or 24), run it with the default options. Close and reopen any terminal afterwards.
2. **Update npm.** Open Command Prompt or PowerShell and run `npm install -g npm@11.6.2`. (Older npm 10.9 can fail on Angular projects.)
3. **Unzip the project** to a short folder such as `C:\family-finance`. Avoid OneDrive and Desktop folders; they slow installs down.
4. **Open a terminal in that folder.** In File Explorer, click the address bar, type `cmd` and press Enter.
5. **Check the computer:** `npm run doctor`. It prints PASS or FIX for each requirement and tells you what to do for any FIX.
6. **Install the dependencies:** `npm install`. The first time takes a few minutes on a laptop like yours. Warnings are normal; errors are not.
7. **Run the app:** `npm start`. When it says "Local: http://localhost:4200", open that address in Chrome or Edge.
8. **Check the work (optional but worth it):** `npm run test:ci` should end with "Tests ... passed". `npm run build` makes the deployable site in `dist\family-finance\browser`.

## Your laptop
8 GB of memory is enough, but close the browser tabs you don't need while building. The first `npm install` and the first build are the slow ones; after that they are much quicker.

## If something fails
- `npm install` says it can't reach the network: check you are online and not on a company VPN or proxy.
- "Port 4200 is already in use": close the other terminal running the app, or run `npx ng serve --port 4300`.
- Anything else: copy the last 15 lines of the red error text and send them to me.

## Putting it on your phone
Phase 7 (sync) and phase 8 (email) need the free Supabase setup in `docs/SYNC_SETUP.md` and `docs/REMINDERS_SETUP.md`. The app also needs to be hosted somewhere so your phone can open it; free options are GitHub Pages or Cloudflare Pages. Ask me and I'll prepare the one you prefer.
