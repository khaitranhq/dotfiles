#!/usr/bin/env bash
# Walk up the directory tree to find the knowledge base root.
# Looks for AGENTS.md + wiki/ directory.
# Exits 0 and prints path if found, exits 1 if not.
set -euo pipefail

dir="${1:-$PWD}"

while [ "$dir" != "/" ]; do
    if [ -f "$dir/AGENTS.md" ] && [ -d "$dir/wiki" ]; then
        echo "$dir"
        exit 0
    fi
    dir="$(dirname "$dir")"
done

echo "ERROR: No knowledge base found (looked for AGENTS.md + wiki/)" >&2
exit 1
