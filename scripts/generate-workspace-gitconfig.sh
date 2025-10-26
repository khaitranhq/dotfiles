#!/usr/bin/env bash
# Generate ~/.config/git/workspaces.config with conditional includes for each workspace.
# Fancy output with icons for status reporting.

WORKSPACES_DIR="$HOME/Workspaces"
CONFIG_DIR="$HOME/.config/git"
CONFIG_FILE="$CONFIG_DIR/workspaces.config"

# Ensure config directory exists
mkdir -p "$CONFIG_DIR"

config_out=""
missing=()
present=()

echo "📝 Scanning workspace folders in $WORKSPACES_DIR..."

for folder in "$WORKSPACES_DIR"/*/; do
    folder="${folder%/}"
    folder_name=$(basename "$folder")
    gitconfig_path="$folder/.gitconfig"
    if [[ -f "$gitconfig_path" ]]; then
        config_out+=$'\n'
        config_out+="[includeIf \"gitdir:${folder}/\"]"$'\n'
        config_out+="    path = ${gitconfig_path}"$'\n'
        present+=("$folder_name")
        echo "  ✅ Found .gitconfig in $folder_name"
    else
        missing+=("$folder_name")
        echo "  ❌ Missing .gitconfig in $folder_name"
    fi
done

# Write config file (overwrites)
echo "$config_out" > "$CONFIG_FILE"

echo -e "\n📝 Generated $CONFIG_FILE."

if (( ${#missing[@]} )); then
    echo "❌ Folders missing .gitconfig:"
    for name in "${missing[@]}"; do
        echo "    - $name"
    done
else
    echo "✅ All workspace folders contain .gitconfig."
fi
