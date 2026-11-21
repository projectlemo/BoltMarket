# MetaTrader 5 bridges (Windows)

MetaQuotes' Manager API and the `MetaTrader5` Python package only run on Windows, while the API is
deployed on Linux (Render/Railway). These two small programs run on a Windows machine (or VPS) next
to your MT5 infrastructure and connect it to the API.

| Program | Needs | API settings |
|---|---|---|
| `mt5_manager_bridge.py` – creates accounts, credits/debits balances, resets passwords | `pip install MT5Manager`, a manager login with the right permissions | `MT5_MODE=bridge`, `MT5_BRIDGE_URL`, `MT5_BRIDGE_KEY` |
| `mt5_quote_bridge.py` – streams bid/ask prices to the website | `pip install MetaTrader5`, an MT5 terminal logged in to your server | `QUOTES_MODE=bridge`, `QUOTES_BRIDGE_KEY` |

If your MT5 server has the **Web API** enabled, you don't need the manager bridge: set
`MT5_MODE=webapi` with `MT5_WEBAPI_URL`, `MT5_MANAGER_LOGIN` and `MT5_MANAGER_PASSWORD` instead.

## Manager bridge

```powershell
pip install MT5Manager
$env:BRIDGE_KEY = "<random 32+ characters>"
$env:MT5_SERVER = "your-mt5-server:443"
$env:MT5_MANAGER_LOGIN = "1000"
$env:MT5_MANAGER_PASSWORD = "<manager password>"
python mt5_manager_bridge.py --host 0.0.0.0 --port 8787 --cert cert.pem --key key.pem
```

* Serve it over HTTPS (built-in `--cert/--key`, or behind IIS/nginx/Caddy) and allow only the API's
  outbound IP addresses in the Windows firewall.
* Try the contract without MT5: `python mt5_manager_bridge.py --mock` (accounts live in memory).
* This is a **reference implementation** written from the MT5Manager documentation. Method names can
  vary between Manager API builds, so test account creation, balance operations and password
  changes on a demo group first.

## Quote bridge

```powershell
pip install MetaTrader5
$env:API_URL = "https://<your-api-host>"
$env:BRIDGE_KEY = "<same value as QUOTES_BRIDGE_KEY>"
# optional when your symbols carry suffixes:
$env:SYMBOL_MAP = "US500=SPX500,XAUUSD=GOLD"
python mt5_quote_bridge.py
```

Run both as Windows services (e.g. with NSSM) so they restart automatically.
