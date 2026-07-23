# -*- coding: utf-8 -*-
import re
import subprocess
import threading
import time

from albert import *

md_iid = "5.0"
md_version = "1.0"
md_name = "Timer"
md_description = "Set countdown timers (e.g. 5s, 10m, 1h) with notification on expiry"
md_license = "MIT"
md_url = ""
md_authors = ["@khaitran"]
md_platforms = ["Linux"]

_parse_re = re.compile(r"(\d+)\s*(s|sec|secs?|m|min|mins?|h|hr|hrs?|hour|hours?)$", re.I)
_units = {
    "s": 1, "sec": 1, "secs": 1,
    "m": 60, "min": 60, "mins": 60,
    "h": 3600, "hr": 3600, "hrs": 3600, "hour": 3600, "hours": 3600,
}

_counter = 0


def _notify(text):
    subprocess.run(["notify-send", "-i", "alarm-symbolic", "--hint=string:sound-name:complete", "Timer", text])


class Plugin(PluginInstance, GeneratorQueryHandler):
    def __init__(self):
        PluginInstance.__init__(self)
        GeneratorQueryHandler.__init__(
            self,
        )
        self.timers: dict[int, tuple[threading.Timer, float]] = {}  # (timer, started_at)
        self.lock = threading.Lock()
        self.icon_factory = lambda: Icon.theme("alarm-timer")

    def _add(self, seconds: int) -> int:
        global _counter
        _counter += 1
        tid = _counter
        label = self._fmt(seconds)

        def _on_done(tid=tid, label=label):
            with self.lock:
                self.timers.pop(tid, None)
            _notify(f"{label} — time's up!")

        timer = threading.Timer(seconds, _on_done)
        with self.lock:
            self.timers[tid] = (timer, time.time())
        timer.start()
        return tid

    @staticmethod
    def _parse(raw: str) -> int | None:
        m = _parse_re.match(raw)
        if not m:
            return None
        return int(m.group(1)) * _units[m.group(2).lower()]

    @staticmethod
    def _fmt(seconds: int) -> str:
        h, rem = divmod(seconds, 3600)
        m, s = divmod(rem, 60)
        parts = []
        if h:
            parts.append(f"{h}h")
        if m:
            parts.append(f"{m}m")
        if s:
            parts.append(f"{s}s")
        return " ".join(parts)

    def defaultTrigger(self):
        return "tm "

    def items(self, context: QueryContext):
        raw = context.query.removeprefix(self.defaultTrigger().strip()).strip()
        results = []

        # Parse input — prepend input item so user knows we read it
        seconds = self._parse(raw)
        if seconds is not None:
            results.append(
                StandardItem(
                    id=f"{self.id()}-set",
                    icon_factory=self.icon_factory,
                    text=f"Set timer for {self._fmt(seconds)}",
                    subtext="Press Enter to start",
                    actions=[
                        Action(
                            "start",
                            f"Start {self._fmt(seconds)} timer",
                            lambda s=seconds: (self._add(s), None),
                        )
                    ],
                )
            )

        # List active timers
        with self.lock:
            for tid, (timer, started) in list(self.timers.items()):
                remaining = max(0, timer.interval - (time.time() - started))
                results.append(
                    StandardItem(
                        id=f"{self.id()}-{tid}",
                        icon_factory=self.icon_factory,
                        text=f"⏳ Timer {self._fmt(int(timer.interval))} ({self._fmt(int(remaining))} left)",
                        subtext="Press Enter to cancel",
                        actions=[
                            Action(
                                "cancel",
                                "Cancel timer",
                                lambda t=timer, tid=tid: (t.cancel(), self.timers.pop(tid, None)),
                            )
                        ],
                    )
                )

        if results:
            yield results
