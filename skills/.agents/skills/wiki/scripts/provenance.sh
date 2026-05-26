#!/usr/bin/env bash
# Compute sha256 of file body, skipping YAML frontmatter between --- delimiters.
# Usage: provenance.sh <file>
# Returns sha256 hash of body content only.
set -euo pipefail

file="$1"

if [ ! -f "$file" ]; then
    echo "ERROR: File not found: $file" >&2
    exit 1
fi

# Extract body (everything after the second --- line, if frontmatter exists)
# This handles: files WITH frontmatter (skip between first two ---)
#               files WITHOUT frontmatter (hash entire file)
first_line="$(head -1 "$file")"
if [ "$first_line" = "---" ]; then
    # Has frontmatter — skip from first --- to second ---
    sed -n '/^---$/,/^---$/!p' "$file" | sha256sum | cut -d' ' -f1
else
    # No frontmatter — hash the whole file
    sha256sum "$file" | cut -d' ' -f1
fi
