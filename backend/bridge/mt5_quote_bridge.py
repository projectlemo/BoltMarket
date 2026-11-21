"""Live price bridge: MetaTrader 5 terminal -> Bolt Markets API.

Run on a Windows machine with the MetaTrader 5 terminal installed and logged in to your server
(any account works, a demo login is enough). Requires the official package:
    pip install MetaTrader5

Then on the API set QUOTES_MODE=bridge and QUOTES_BRIDGE_KEY to the same value as BRIDGE_KEY here.

Environment:
    API_URL       e.g. https://bolt-markets-api.onrender.com
    BRIDGE_KEY    shared secret (QUOTES_BRIDGE_KEY on the API)
    SYMBOLS       optional, comma separated (defaults to the website's 38 instruments)
    SYMBOL_MAP    optional, website=terminal pairs for suffixed symbols, e.g. "US500=SPX500,XAUUSD=GOLD"
    MT5_PATH / MT5_LOGIN / MT5_PASSWORD / MT5_SERVER   optional terminal login details
    INTERVAL      seconds between pushes (default 0.5)
"""
from __future__ import annotations

import json
import logging
import os
import time
import urllib.error
import urllib.request

log = logging.getLogger("quote-bridge")

DEFAULT_SYMBOLS = (
    "EURUSD,GBPUSD,USDJPY,USDCHF,AUDUSD,USDCAD,NZDUSD,EURGBP,EURJPY,GBPJPY,EURCHF,AUDJPY,EURAUD,GBPCHF,USDMXN,USDZAR,"
    "US30,US500,NAS100,GER40,UK100,JP225,EU50,AUS200,BTCUSD,ETHUSD,SOLUSD,XRPUSD,LTCUSD,BNBUSD,ADAUSD,DOGEUSD,"
    "XAUUSD,XAGUSD,XPTUSD,USOIL,UKOIL,NATGAS"
)


def push(api_url: str, key: str, quotes: list[dict]) -> None:
    body = json.dumps({"quotes": quotes}).encode()
    if not api_url.startswith(("https://", "http://")):
        raise SystemExit("API_URL must start with https://")
    req = urllib.request.Request(f"{api_url.rstrip('/')}/api/v1/quotes/ingest", data=body, method="POST",  # noqa: S310
                                 headers={"Content-Type": "application/json", "X-Bridge-Key": key})
    with urllib.request.urlopen(req, timeout=10) as res:  # noqa: S310 - configured https endpoint
        res.read()


def main() -> None:
    import MetaTrader5 as mt5  # type: ignore[import-not-found]

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    api_url, key = os.environ["API_URL"], os.environ["BRIDGE_KEY"]
    interval = float(os.environ.get("INTERVAL", "0.5"))
    symbols = [s.strip().upper() for s in os.environ.get("SYMBOLS", DEFAULT_SYMBOLS).split(",") if s.strip()]
    mapping = dict(pair.split("=", 1) for pair in os.environ.get("SYMBOL_MAP", "").split(",") if "=" in pair)

    kwargs: dict = {}
    if os.environ.get("MT5_PATH"):
        kwargs["path"] = os.environ["MT5_PATH"]
    if os.environ.get("MT5_LOGIN"):
        kwargs.update(login=int(os.environ["MT5_LOGIN"]), password=os.environ.get("MT5_PASSWORD", ""), server=os.environ.get("MT5_SERVER", ""))
    if not mt5.initialize(**kwargs):
        raise SystemExit(f"MetaTrader5.initialize failed: {mt5.last_error()}")

    terminal = {s: mapping.get(s, s) for s in symbols}
    active = {s: t for s, t in terminal.items() if mt5.symbol_select(t, True)}
    for missing in sorted(set(terminal) - set(active)):
        log.warning("symbol %s (%s) is not available in this terminal", missing, terminal[missing])
    opens: dict[str, float] = {}
    last_sent: dict[str, tuple[float, float]] = {}
    backoff = 1.0
    log.info("streaming %d symbols to %s", len(active), api_url)
    while True:
        batch = []
        for symbol, term in active.items():
            tick = mt5.symbol_info_tick(term)
            if tick is None or tick.bid <= 0 or tick.ask <= 0:
                continue
            if symbol not in opens:
                info = mt5.symbol_info(term)
                opens[symbol] = float(getattr(info, "session_open", 0) or tick.bid)
            if last_sent.get(symbol) == (tick.bid, tick.ask):
                continue
            batch.append({"s": symbol, "b": float(tick.bid), "a": float(tick.ask), "t": int(tick.time_msc), "o": opens[symbol]})
        if batch:
            try:
                push(api_url, key, batch)
                for q in batch:
                    last_sent[q["s"]] = (q["b"], q["a"])
                backoff = 1.0
            except (urllib.error.URLError, OSError) as exc:
                log.warning("push failed (%s); retrying in %.0fs", exc, backoff)
                time.sleep(backoff)
                backoff = min(backoff * 2, 30)
                continue
        time.sleep(interval)


if __name__ == "__main__":
    main()
