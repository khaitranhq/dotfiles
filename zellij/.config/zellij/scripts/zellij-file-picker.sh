#!/usr/bin/env bash

# Zellij File Picker
# Opens an interactive file picker using rg and gum, then writes the selected
# file path to the Zellij pane that invoked this script

set -euo pipefail

# Store the pane ID that invoked this script
INVOKING_PANE="${ZELLIJ_PANE_ID:-}"

# rg options:
#   --files: list files (not directories)
#   --hidden: include hidden files
#   --follow: follow symbolic links
#   --glob '!pattern': exclude matching patterns
#   --no-ignore: don't respect .gitignore
list_files=$(
	rg \
		--files \
		--hidden \
		--follow \
		--glob '!.git/**' \
		--glob '!node_modules/**' \
		--glob '!dist/**' \
		--glob '!build/**' \
		--no-ignore
)

selected_file=$(
	echo "$list_files" | gum filter \
		--placeholder "Type to filter files..." \
		--reverse \
		--limit 1 \
		--prompt "Select file: "
) || exit 0

# If a file was selected and we have the invoking pane ID, write it to that pane
if [[ -n "$selected_file" && -n "$INVOKING_PANE" ]]; then
	zellij action focus-previous-pane
	zellij action write-chars "$selected_file"
	zellij action focus-next-pane
	zellij action close-pane
fi
