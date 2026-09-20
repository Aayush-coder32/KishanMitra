# e-Kharid — Smart Digital Procurement

A connected SIH26032 demonstration built with React, Tailwind, Express, MongoDB/Mongoose, Socket.IO and role-based authentication. Includes farmer, district, state and government workspaces.

## Run locally

Requires Node.js 22+.

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://localhost:5173**. API: port 4000. Use `npm` instead of `npm.cmd` on other shells.

Without environment configuration, a **labelled local demo** persists synthetic records in `.data/db.json`. It does not claim to use MongoDB. Four demo logins are prefilled. Their random password is generated locally in ignored `.data/demo-password` and exposed by `/api/config` **only in development demo mode**. Use synthetic information only. OTP codes are displayed in demo mode when email is not configured.

Copy `.env.example` to `.env` for services. Never commit `.env`, `.data` or `uploads`. Backend secrets must not have a `VITE_` prefix.

## Connected features

- Six-step registration, email OTP, password reset, encrypted Aadhaar/PAN and masked profile responses.
- Four role logins, bcrypt hashes, HTTP-only JWT cookies, rotating refresh tokens, session revocation and login lockouts.
- Live slot availability, capacity checks, unique tokens, one active booking per farmer and cancellation.
- Socket.IO queue updates with 30-second polling fallback. Waiting time is an estimate of eight minutes per farmer in the window.
- District procurement stages: call, processing, verification, weighing, quality check, completion. Measured quantity and configured crop price create the payment record.
- Payment processing, hold/failure/retry and completion with a required bank reference. **The app tracks payments; it does not transfer money.**
- In-app notifications, reminders and announcements; SMTP email and optional Twilio SMS adapters.
- Encrypted PDF/JPEG/PNG uploads, 5 MB limit, file-signature validation and owner/jurisdiction-protected downloads.
- Real-data charts, centre maps, scoped PDF/CSV/Excel reports and government audit logs.
- Responsive layouts, farmer mobile navigation, support guidance and loading/error/empty states.

District officials operate within their assigned district/state. State administrators monitor their state. Government administrators monitor nationally. Public registration always creates a farmer.

## Demo walkthrough

1. Sign in as Farmer and inspect your next slot, queue and payment history.
2. Cancel the waiting booking in My bookings, then book a new slot.
3. Sign out, choose District at login, and advance the token in Procurement.
4. Enter measured quantity and grade at completion. In Payments, move to Processing then Completed with a synthetic reference.
5. Return to Farmer to see procurement/payment updates and notifications.
6. Explore State/Government analytics, reports and the government audit trail.

Demo crop prices and centre coordinates are illustrative, not authoritative procurement policy or current MSP data.

## MongoDB

Set `MONGODB_URI` to Atlas or a local **replica set**, then restart. Transactions are required. The dashboard banner identifies MongoDB when connected.

Mongoose collections cover users, farmers, geography, centres, crops, slots, tokens, procurements, payments, notifications, documents, reports, audits, sessions and challenges. A revision lock and MongoDB transactions keep booking mutations consistent; only changed records are written. Local demo uses atomic file replacement.

The current repository reads collection snapshots and serializes writes for straightforward SIH consistency. **It is not a nationwide-scale data-access architecture.** Before large deployment, replace snapshots with indexed paginated queries and targeted reservation transactions; add distributed rate limiting and delivery workers.

## Tests

```powershell
npm.cmd test
npm.cmd run build
# Start the demo server before these (they mutate synthetic demo records):
npm.cmd run test:api
npm.cmd run test:security
node scripts/report-smoke.mjs
npm.cmd run test:browser
# Isolated MongoDB replica set; downloads mongod on first use:
node scripts/mongo-smoke.mjs
```

Browser tests use Microsoft Edge on Windows. Set `BROWSER_EXECUTABLE` for another Chromium executable. Screenshots are written to `artifacts/`. The MongoDB test checks persistence, capacity conflicts and rollback in an isolated temporary replica set.

## Deployment

Configuration is supplied; **hosted services have not been provisioned**.

**Render:** use `render.yaml`; supply Atlas URI, exact frontend `APP_ORIGIN`, SMTP settings, JWT secrets and a 64-hex-character `IDENTITY_KEY`. A persistent disk holds encrypted documents. Back up this disk and the identity key together. Key rotation requires ciphertext migration. Production startup rejects missing required configuration. Hosting must provide HTTPS.

**Vercel:** use `vercel.json`. Set `VITE_API_URL=https://YOUR-RENDER-HOST/api` before building, and set Render `APP_ORIGIN` to the exact frontend origin. WebSockets connect to the API host. Production cookies are Secure, HTTP-only and SameSite=None. Prefer same-site custom domains (app.example.org / api.example.org) to avoid third-party-cookie blocking. Render can also serve the built frontend from one origin.

**Provisioning:** production does not seed demo accounts. Edit `catalog.example.json` with approved centres, crops and prices, then run `node scripts/import-catalog.mjs catalog.json` with `MONGODB_URI` configured. Set `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (14+ characters), `ADMIN_ROLE`, `ADMIN_DISTRICT`, `ADMIN_STATE`, and `ADMIN_MOBILE` in a secure operator environment, then run `npm run admin:create`. Clear those variables afterwards. There is no public official-registration endpoint.

**Notifications:** configure SMTP for OTP/reset codes and notification email. Optional Twilio settings are in `.env.example`; sender/template approvals and credentials are external setup. Delivery retries up to three times. Multi-instance deployment needs a dedicated durable delivery worker.

## Security and release boundaries

Implemented: Helmet, origin checks, mandatory custom mutation headers, credentialed CORS, validation, rate limits, access checks, AES-256-GCM identity/document encryption with random nonces, bcrypt passwords and generated document filenames. Sensitive values are not placed in URLs or application logs. Documents download as attachments.

Before processing real farmer data, complete independent security/load/accessibility reviews, official identity-verification integration, malware scanning, retention/deletion procedures, monitoring, backup/restore drills and provider verification. OTP verifies email, not Aadhaar/PAN authenticity or mobile ownership. File-signature validation is not antivirus scanning. This is a functioning demonstration/reference implementation, **not a certified production government service**.

## Layout

`src/components` contains shared UI and maps; `src/pages` contains landing/auth/dashboards; `src/services` contains the API client. `server/index.js` contains routes/authorization, `domain.js` booking/encryption, `store.js` schemas/persistence, `reports.js` exports and `notification-worker.js` reminders/notifications. `scripts` contains tests and operator provisioning.

Assets: locally saved [Unsplash landscape](https://images.unsplash.com/photo-1500382017468-9049fed747ef); DM Sans and Manrope via Fontsource; OpenStreetMap tiles with attribution. The map background requires online tile access. The prototype uses its own logo and disclaims official government-service status.
