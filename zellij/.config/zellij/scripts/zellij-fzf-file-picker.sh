#!/usr/bin/env bash

# Zellij FZF File Picker
# Opens an interactive file picker using rg and fzf, then writes the selected
# file path to the Zellij pane that invoked this script

set -euo pipefail

# Store the pane ID that invoked this script
INVOKING_PANE="${ZELLIJ_PANE_ID:-}"

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

# Use rg to find files and fzf for selection
# rg options:
#   --files: list files (not directories)
#   --hidden: include hidden files
#   --follow: follow symbolic links
#   --glob '!pattern': exclude matching patterns
#   --no-ignore: don't respect .gitignore
selected_file=$(
	echo "$list_files" |
		fzf --height=100% \
			--border=rounded \
			--prompt="Select file: " \
			--preview='bat --color=always --style=numbers --line-range=:500 {}' \
			--preview-window='right:60%:wrap' \
			--header='Press ENTER to select, ESC to cancel' \
			--color='fg:#c0caf5,bg:#1a1b26,hl:#7aa2f7,fg+:#c0caf5,bg+:#292e42,hl+:#7dcfff,info:#7aa2f7,prompt:#7dcfff,pointer:#7dcfff,marker:#9ece6a,spinner:#9ece6a,header:#9ece6a'
) || exit 0

# If a file was selected and we have the invoking pane ID, write it to that pane
if [[ -n "$selected_file" && -n "$INVOKING_PANE" ]]; then
	zellij action focus-previous-pane
	zellij action write-chars "$selected_file"
	zellij action focus-next-pane
	zellij action close-pane
fi
