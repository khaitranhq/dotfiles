#!/usr/bin/env bash
# Search wiki pages with context and highlighting.
# Wraps ripgrep with useful defaults for knowledge base work.
# Usage: search.sh <pattern> [--type entity|concept|source|query]
set -euo pipefail

pattern="$1"
kb_root="$(dirname "$0")/discover.sh"
kb_path="$("$kb_root")"

type_filter="${2:-}"
if [ -n "$type_filter" ]; then
    rg --heading --line-number --context 2 \
       --iglob "wiki/${type_filter}s/*.md" \
       "$pattern" "$kb_path/wiki/"
else
    rg --heading --line-number --context 2 \
       "$pattern" "$kb_path/wiki/"
fi
