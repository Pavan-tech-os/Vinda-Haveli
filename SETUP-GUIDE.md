# VINDU HAVELI: Windows Setup Guide (beginner friendly)

Everything below is typed into **Windows PowerShell**. (Start menu → type `PowerShell` → open it.)

## 1. Install Node.js (one time)
```powershell
winget install OpenJS.NodeJS.LTS
```
Close PowerShell, open it again, then check (you need **Node 22.13 or newer**; Node 24 works):
```powershell
node -v
npm -v
```
You should see version numbers, and `node -v` must be v22.13 or higher.

## 2. Unzip the project and open it
Right-click the ZIP → *Extract All*, or:
```powershell
cd $HOME\Downloads
Expand-Archive .\VINDU-HAVELI-ADVANCED-RESTAURANT.zip -DestinationPath $HOME\Documents\
cd $HOME\Documents\vindu-haveli
```
(If your folder name differs, `cd` into the folder that contains `package.json`.)

## 3. Install the packages
```powershell
npm install
```
Needs internet. The database is SQLite built into Node, so nothing needs compiling. If an earlier attempt failed halfway, first run `Remove-Item -Recurse -Force node_modules` (close VS Code or any program using the folder).

## 4. Create your settings file
```powershell
Copy-Item .env.example .env.local
notepad .env.local
```
Change at least:
- `OWNER_EMAIL` and `OWNER_PASSWORD`: your restaurant-owner login (created automatically on first start).
- `NEXT_PUBLIC_RESTAURANT_ADDRESS`: printed on receipts.

Save and close Notepad. **Never share `.env.local`.**

## 5. Add food photos, videos and your logo (optional but recommended)
```powershell
npm run images -- YOUR_PEXELS_API_KEY
```
(as before; free key at pexels.com/api)
- **Videos:** copy your `.mp4` files into `public\videos\` with the names in `public\videos\README.md`.
- **Logo:** copy your logo to `public\images\branding\restaurant-logo.png`.

Missing videos/logo are fine: the site falls back to its normal look.

## 6. Run the website
```powershell
npm run dev
```
Open http://localhost:3000. The database file is created automatically at `storage\vindu-haveli.db` (schema: `db\schema.sql`). Stop the site with **Ctrl + C**.

### Try it out
1. Click **Login/Sign up** → create a **Customer** account (no codes or OTP needed).
2. Dashboard → **BOOK DINE** → pick date, time, guests → pick a table → pay the advance.
   Without Razorpay keys you will see a clear **DEMO MODE** label and no money is charged.
3. After booking, answer **YES: ORDER FOOD** (menu → cart → checkout is linked to your table) or **NO**.
4. Log out, then log in with the owner email/password → **Owner Dashboard**: accept the booking, see the food order, open **Kitchen** and move the order New → Accepted → Preparing → Ready → Completed. The customer's **My Orders** page updates by itself.

## 7. Turn on real payments (Razorpay)
1. Create an account at https://dashboard.razorpay.com and copy your **Test** keys (*Settings → API Keys*).
2. In `.env.local` fill `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`, then restart (`Ctrl + C`, `npm run dev`).
3. Do a test booking with Razorpay's test card/UPI. The booking is marked **Paid** only after the server verifies the payment with Razorpay.
4. Recommended: in Razorpay *Settings → Webhooks* add `https://YOUR-SITE/api/payments/webhook`, events `payment.captured` and `order.paid`, and put its secret in `RAZORPAY_WEBHOOK_SECRET`. This confirms bookings even if the customer closes the browser mid-payment.
5. Going live: switch to Live keys and set `ALLOW_DEMO_PAYMENTS=false`.

## 8. Owner settings
Owner Dashboard → **Settings**: advance amount (default ₹200), booking duration (default 90 min), opening hours, slot interval, auto-confirm, and a form to give a customer a temporary password if they forgot theirs.

## 9. Check and build for production
```powershell
npm test
npm run build
npm start
```

## 10. Deploy

### Vercel (free) with a Turso online database
Vercel cannot keep files, so the website stores its data in Turso (a free online SQLite database).
1. Create a free account at https://turso.tech, create a database (pick the location nearest your customers) and copy its **URL** (starts with `libsql://`) and a **token**.
2. In Vercel > Project > Settings > Environment Variables add: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `OWNER_NAME`, `OWNER_PHONE`, `COOKIE_SECURE=true` (do not set `DATABASE_PATH`).
3. Redeploy. The tables and the owner account are created automatically on the first visit.

### Your own PC / a server with a disk
Leave `TURSO_DATABASE_URL` empty. The site then uses the local SQLite file (`DATABASE_PATH`). Run `npm run build` then `npm start`, behind HTTPS with `COOKIE_SECURE=true`. Back up the `.db` file regularly.

## Troubleshooting
- **"needs Node.js 22.13 or newer" error:** install the latest LTS: `winget install OpenJS.NodeJS.LTS`, reopen PowerShell.
- **EPERM / cannot remove folder during `npm install`:** close anything using the folder, then `Remove-Item -Recurse -Force node_modules` and run `npm install` again.
- You may see "SQLite is an experimental feature" in the console on some Node versions. It is harmless.
- **Port 3000 busy:** `npm run dev -- -p 3001`.
- **Start fresh (deletes all bookings/orders/users):** stop the site, then `Remove-Item .\storage\vindu-haveli.db*`.
- **Customer forgot password:** Owner Dashboard → Settings → temporary password.
- **Videos do not show:** names must match `public\videos\README.md` exactly; use MP4 (H.264); press Ctrl+F5.
