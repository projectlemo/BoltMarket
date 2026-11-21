# End-to-end test

Drives a real browser through the website, client portal and back office against a local API
(SQLite, mock MT5, simulated prices): register → confirm email → log in → open demo and live MT5
accounts → upload KYC → support ticket → contact form → live prices → staff sign-in with forced 2FA →
KYC approval → ticket reply → message handling → account adjustment → deposit outage handling →
withdrawal request, approval and payout → blog publish → client notes, suspend and reactivate →
system and audit pages → client sees the results. 22 steps.

```bash
# 1. build the website with the back office inside it
cd frontend
VITE_BASE_PATH=bolt-markets VITE_SITE_URL=http://127.0.0.1:8090/bolt-markets VITE_API_URL=http://127.0.0.1:8000 npm run build
cd ../admin
VITE_BASE_PATH=bolt-markets/admin VITE_API_URL=http://127.0.0.1:8000 npm run build
mkdir -p ../frontend/dist/admin && cp -R dist/. ../frontend/dist/admin/

# 2. start the test API (fresh SQLite database) and the GitHub Pages-like server, in two terminals
./e2e/run-api.sh
cd e2e && npm install && npx playwright install chromium && npm run serve

# 3. run
cd e2e && npm test
```

`api.env` holds test-only settings: placeholder payment keys switch the crypto rail on so the
withdrawal flow can run, and the deposit step checks that a provider outage is reported to the client.
Never use these values outside this test.

Environment overrides: `E2E_SITE`, `E2E_API`, `E2E_DB` (the SQLite file the API writes, default
`/tmp/bolt-e2e/bolt.db`), `E2E_SHOTS` (screenshot folder).
