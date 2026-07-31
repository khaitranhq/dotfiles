# -*- coding: utf-8 -*-
# Copyright (c) 2024

import json
import subprocess
from pathlib import Path
from shutil import which

from albert import *

md_iid = "5.0"
md_version = "1.0"
md_name = "Edge Profiles"
md_description = "Open Microsoft Edge with a specific profile"
md_license = "MIT"
md_url = "https://github.com/albertlauncher/albert-plugin-python-chrome-profiles"
md_authors = ["@khaitran"]
md_platforms = ["Linux"]


EDGE_STATE = Path.home() / ".config/microsoft-edge/Local State"


class Plugin(PluginInstance, GeneratorQueryHandler):

    def __init__(self):
        PluginInstance.__init__(self)
        GeneratorQueryHandler.__init__(self)

        self.executable = which("microsoft-edge")
        if not self.executable:
            raise FileNotFoundError("No Microsoft Edge executable found.")

        self.icon_factory = lambda: Icon.theme("microsoft-edge")

    def defaultTrigger(self):
        return "cp "

    def _profiles(self):
        if not EDGE_STATE.exists():
            return {}
        data = json.loads(EDGE_STATE.read_text())
        return data.get("profile", {}).get("info_cache", {})

    def items(self, context):
        exe = self.executable
        assert exe is not None
        raw = context.query.strip()
        trigger = self.defaultTrigger().strip()
        if raw.startswith(trigger):
            raw = raw[len(trigger):].strip()
        query = raw.lower()

        result = []
        for dir_name, info in self._profiles().items():
            name = info.get("name", dir_name)
            if query and query not in name.lower():
                continue
            result.append(StandardItem(
                id=self.id(),
                icon_factory=self.icon_factory,
                text=name,
                subtext=f"Edge profile: {dir_name}",
                actions=[
                    Action(
                        "open", "Open profile",
                        lambda d=dir_name: runDetachedProcess(
                            [exe, f"--profile-directory={d}"]
                        ),
                    ),
                ],
            ))
        if result:
            yield result
