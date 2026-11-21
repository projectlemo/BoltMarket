"""Live price hub: keeps the latest bid/ask per symbol and fans updates out to SSE clients.

Sources (QUOTES_MODE):
* ``bridge``    – a Windows machine running ``backend/bridge/mt5_quote_bridge.py`` pushes ticks
                  from an MT5 terminal to POST /api/v1/quotes/ingest.
* ``terminal``  – the API itself reads ticks with the MetaTrader5 package (Windows host only).
* ``simulated`` – development only, clearly labelled random walk.
* ``disabled``  – no prices; the website hides live prices.
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
import threading
import time
from collections.abc import Iterable
from typing import Any, TypeGuard

log = logging.getLogger("bolt.quotes")

# Reference mid prices, used only by the development simulation.
_SIM_REFERENCE = {
    "EURUSD": 1.0850, "GBPUSD": 1.2700, "USDJPY": 151.20, "USDCHF": 0.8800, "AUDUSD": 0.6600, "USDCAD": 1.3600,
    "NZDUSD": 0.6100, "EURGBP": 0.8550, "EURJPY": 164.00, "GBPJPY": 192.00, "EURCHF": 0.9550, "AUDJPY": 99.80,
    "EURAUD": 1.6400, "GBPCHF": 1.1180, "USDMXN": 18.20, "USDZAR": 18.40, "US30": 39000.0, "US500": 5200.0,
    "NAS100": 18200.0, "GER40": 18000.0, "UK100": 8000.0, "JP225": 39500.0, "EU50": 4950.0, "AUS200": 7800.0,
    "BTCUSD": 65000.0, "ETHUSD": 3200.0, "SOLUSD": 150.0, "XRPUSD": 0.55, "LTCUSD": 85.0, "BNBUSD": 580.0,
    "ADAUSD": 0.45, "DOGEUSD": 0.15, "XAUUSD": 2350.0, "XAGUSD": 28.0, "XPTUSD": 980.0, "USOIL": 78.0,
    "UKOIL": 82.0, "NATGAS": 2.40,
}


def _valid_number(value: Any) -> TypeGuard[float]:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and value > 0


class QuoteHub:
    def __init__(self, symbols: Iterable[str], mode: str, max_clients: int = 500) -> None:
        self.symbols = {s.upper() for s in symbols}
        self.mode = mode
        self.max_clients = max_clients
        self._latest: dict[str, dict[str, Any]] = {}
        self._subs: set[asyncio.Queue[list[dict[str, Any]]]] = set()
        self._loop: asyncio.AbstractEventLoop | None = None
        self._lock = threading.Lock()
        self.last_update: float = 0.0
        self._tasks: list[Any] = []
        self._stop = threading.Event()

    @property
    def enabled(self) -> bool:
        return self.mode in {"bridge", "terminal", "simulated"}

    @property
    def simulated(self) -> bool:
        return self.mode == "simulated"

    def bind_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self._loop = loop

    # -- publishing -------------------------------------------------------------------------
    def publish(self, items: Iterable[dict[str, Any]]) -> int:
        now_ms = int(time.time() * 1000)
        accepted: list[dict[str, Any]] = []
        for item in items:
            if not isinstance(item, dict):
                continue
            symbol = str(item.get("s", "")).upper()
            bid, ask = item.get("b"), item.get("a")
            if not symbol or (self.symbols and symbol not in self.symbols):
                continue
            if not (_valid_number(bid) and _valid_number(ask)) or ask < bid:
                continue
            quote: dict[str, Any] = {"s": symbol, "b": float(bid), "a": float(ask), "t": int(item.get("t") or now_ms)}
            if _valid_number(item.get("o")):
                quote["o"] = float(item["o"])
            elif symbol in self._latest and "o" in self._latest[symbol]:
                quote["o"] = self._latest[symbol]["o"]
            accepted.append(quote)
        if not accepted:
            return 0
        with self._lock:
            for q in accepted:
                self._latest[q["s"]] = q
            self.last_update = time.time()
            subscribers = list(self._subs)
        loop = self._loop
        if loop is not None and subscribers and not loop.is_closed():
            for queue in subscribers:
                loop.call_soon_threadsafe(_offer, queue, accepted)
        return len(accepted)

    def snapshot(self) -> list[dict[str, Any]]:
        with self._lock:
            return list(self._latest.values())

    # -- subscribers -------------------------------------------------------------------------
    def open(self) -> asyncio.Queue[list[dict[str, Any]]] | None:
        with self._lock:
            if len(self._subs) >= self.max_clients:
                return None
            queue: asyncio.Queue[list[dict[str, Any]]] = asyncio.Queue(maxsize=200)
            self._subs.add(queue)
            return queue

    def close(self, queue: asyncio.Queue[list[dict[str, Any]]]) -> None:
        with self._lock:
            self._subs.discard(queue)

    @property
    def clients(self) -> int:
        return len(self._subs)

    # -- sources -------------------------------------------------------------------------------
    async def run_simulation(self) -> None:
        """Development only: random walk around reference prices."""
        rng = random.Random()  # noqa: S311 - development price simulation, not security related
        mids = {s: _SIM_REFERENCE.get(s, 100.0) for s in (self.symbols or _SIM_REFERENCE.keys())}
        opens = dict(mids)

        def quote(symbol: str, mid: float) -> dict[str, Any]:
            spread = mid * 0.00012
            return {"s": symbol, "b": round(mid - spread / 2, 6), "a": round(mid + spread / 2, 6), "o": opens[symbol]}

        self.publish(quote(s, m) for s, m in mids.items())
        while True:
            await asyncio.sleep(1.0)
            batch = []
            for symbol in rng.sample(list(mids), k=max(1, len(mids) // 3)):
                mids[symbol] *= 1 + rng.gauss(0, 0.00025)
                batch.append(quote(symbol, mids[symbol]))
            self.publish(batch)

    def start_terminal_thread(self, settings: Any) -> None:
        """QUOTES_MODE=terminal: poll an MT5 terminal on this (Windows) machine."""

        def run() -> None:
            try:
                import MetaTrader5 as mt5  # type: ignore[import-not-found]
            except ImportError:
                log.error("QUOTES_MODE=terminal needs the MetaTrader5 package (Windows only); live prices stay off")
                return
            kwargs: dict[str, Any] = {}
            if settings.mt5_terminal_path:
                kwargs["path"] = settings.mt5_terminal_path
            if settings.mt5_terminal_login:
                kwargs.update(login=int(settings.mt5_terminal_login), password=settings.mt5_terminal_password, server=settings.mt5_terminal_server)
            if not mt5.initialize(**kwargs):
                log.error("MetaTrader5.initialize failed: %s", mt5.last_error())
                return
            symbols = [s for s in self.symbols if mt5.symbol_select(s, True)]
            opens: dict[str, float] = {}
            while not self._stop.is_set():
                batch = []
                for symbol in symbols:
                    tick = mt5.symbol_info_tick(symbol)
                    if tick is None:
                        continue
                    if symbol not in opens:
                        info = mt5.symbol_info(symbol)
                        opens[symbol] = float(getattr(info, "session_open", 0) or tick.bid)
                    batch.append({"s": symbol, "b": float(tick.bid), "a": float(tick.ask), "t": int(tick.time_msc), "o": opens[symbol]})
                self.publish(batch)
                self._stop.wait(0.25)
            mt5.shutdown()

        thread = threading.Thread(target=run, name="bolt-mt5-terminal", daemon=True)
        thread.start()
        self._tasks.append(thread)

    def stop(self) -> None:
        self._stop.set()


def _offer(queue: asyncio.Queue[list[dict[str, Any]]], batch: list[dict[str, Any]]) -> None:
    if queue.full():
        try:
            queue.get_nowait()
        except asyncio.QueueEmpty:  # pragma: no cover
            pass
    queue.put_nowait(batch)
