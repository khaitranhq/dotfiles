# -*- coding: utf-8 -*-
import datetime
import re
import subprocess
import threading
import time

from albert import *

md_iid = "5.0"
md_version = "1.0"
md_name = "Alarm"
md_description = "Set alarms (e.g. 7:30, 14:00) with notification on expiry"
md_license = "MIT"
md_url = ""
md_authors = ["@khaitran"]
md_platforms = ["Linux"]

_time_re = re.compile(r"^(\d{1,2}):(\d{2})\s*(am|pm)?$", re.I)


def _notify(text):
    subprocess.run(["notify-send", "-i", "alarm-symbolic", "--hint=string:sound-name:complete", "Alarm", text])


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
    return " ".join(parts) or "<1m"


class Plugin(PluginInstance, GeneratorQueryHandler):
    def __init__(self):
        PluginInstance.__init__(self)
        GeneratorQueryHandler.__init__(
            self,
        )
        self._timer: threading.Timer | None = None
        self._lock = threading.Lock()
        self._alarm_dt: datetime.datetime | None = None
        self._started_at: float = 0.0
        self._interval: float = 0.0
        self.icon_factory = lambda: Icon.theme("alarm-symbolic")

    def _set(self, hour: int, minute: int):
        with self._lock:
            self._cancel()
            now = datetime.datetime.now()
            target = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if target <= now:
                target += datetime.timedelta(days=1)
            seconds = (target - now).total_seconds()

            self._alarm_dt = target
            self._started_at = time.time()
            self._interval = seconds

            def _on_alarm():
                with self._lock:
                    self._alarm_dt = None
                _notify(f"Alarm {target.strftime('%H:%M')} — time's up!")

            t = threading.Timer(seconds, _on_alarm)
            t.start()
            self._timer = t

    def _cancel(self):
        if self._timer:
            self._timer.cancel()
            self._timer = None
        self._alarm_dt = None

    @staticmethod
    def _parse(raw: str) -> tuple[int, int] | None:
        m = _time_re.match(raw)
        if not m:
            return None
        hour = int(m.group(1))
        minute = int(m.group(2))
        ampm = (m.group(3) or "").lower()
        if ampm == "pm" and hour != 12:
            hour += 12
        elif ampm == "am" and hour == 12:
            hour = 0
        if hour > 23 or minute > 59:
            return None
        return hour, minute

    def defaultTrigger(self):
        return "al "

    def items(self, context: QueryContext):
        raw = context.query.removeprefix(self.defaultTrigger().strip()).strip()
        results = []

        parsed = self._parse(raw)
        if parsed:
            hour, minute = parsed
            label = f"{hour:02d}:{minute:02d}"
            results.append(
                StandardItem(
                    id=f"{self.id()}-set",
                    icon_factory=self.icon_factory,
                    text=f"Set alarm for {label}",
                    subtext="Press Enter to set",
                    actions=[
                        Action(
                            "set",
                            f"Set alarm {label}",
                            lambda h=hour, m=minute: (self._set(h, m), None),
                        )
                    ],
                )
            )

        with self._lock:
            if self._alarm_dt is not None:
                label = self._alarm_dt.strftime("%H:%M")
                remaining = max(0, int(self._interval - (time.time() - self._started_at)))
                results.append(
                    StandardItem(
                        id=f"{self.id()}-active",
                        icon_factory=self.icon_factory,
                        text=f"⏰ Alarm {label} ({_fmt(remaining)} left)",
                        subtext="Press Enter to cancel",
                        actions=[
                            Action("cancel", "Cancel alarm", lambda: self._cancel()),
                        ],
                    )
                )

        if results:
            yield results
