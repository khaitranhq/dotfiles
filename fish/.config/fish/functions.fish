#!/usr/bin/env fish

function setup_monitor
    set options "home" "work" "single"
    set selected_option (printf "%s\n" $options | fzf --prompt="Select an option: ")

    if test "$selected_option" = "home"
        xrandr \
            --output eDP-1 --off \
            --output HDMI-1 --primary --mode 1920x1080 --pos 1080x340 --rotate normal \
            --output DP-1 --mode 1920x1080 --pos 0x0 --rotate left
    end

    if test "$selected_option" = "single"
        xrandr \
            --output eDP-1 --mode 1920x1080 --rotate normal --pos 0x0
    end

    if test "$selected_option" = "work"
        xrandr \
            --output eDP-1 --mode 1600x900 --pos 0x0 \
            --output HDMI-1 --primary --mode 1920x1080 --pos 1600x0
    end
end

function pick_files
  set pane_dir (tmux display-message -p '#{pane_current_path}')
  set pane_id (tmux display-message -p '#{pane_id}')
  cd $pane_dir; or exit
  set git_root (git rev-parse --show-toplevel)

  # gnu coreutils realpath is needed to make the paths relative to the currently active
  # tmux pane relative to the git repo root, because aider always wants paths relative
  # to the repo root, even if you are in a subdirectory
  if string match -q "darwin*" $OSTYPE
      if not command -v grealpath >/dev/null 2>&1
          echo "grealpath not found. Install with: brew install coreutils" >&2
          exit 1
      end
      set realpath_cmd "grealpath"
  else
      set realpath_cmd "realpath"
  end

  set selected_files (
      fd --type f --hidden | \
      fzf --multi \
          --reverse \
          --preview 'bat --style=numbers --color=always {}' | \
      while read -l file
          $realpath_cmd --relative-to=$git_root "$pane_dir/$file"
      end
  )

  if test -n "$selected_files"
      set files_oneline (string join ' ' $selected_files)
      tmux send-keys -t $pane_id $files_oneline
  end
end

function __check_nvm --on-variable PWD --description 'Do nvm stuff'
 if test -f .nvmrc
   set node_version_target (cat .nvmrc)
   set nvm_node_versions (nvm list)

   if string match -q "*$node_version_target*" $nvm_node_versions
     nvm use $node_version_target --silent
   else 
     nvm install $node_version_target --silent
   end
 end
end

function setup-pnpm-project
    pnpm init
    pnpm install --save-dev \
        eslint \
        @eslint/js \
        typescript \
        typescript-eslint \
        eslint-plugin-prettier \
        eslint-config-prettier \
        prettier \
        @trivago/prettier-plugin-sort-imports

    npx tsc --init

    echo '{
  "trailingComma": "none",
  "tabWidth": 2,
  "semi": true,
  "singleQuote": true,
  "importOrder": ["^@core/(.*)$", "^@server/(.*)$", "^@ui/(.*)$", "^[./]"],
  "importOrderSeparation": true,
  "importOrderSortSpecifiers": true,
  "plugins": ["@trivago/prettier-plugin-sort-imports"]
}' > .prettierrc.json

    echo '// @ts-check

import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettierRecommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": "warn",
    },
  },
);' > eslint.config.mjs
end

# It is invoked by the fish shell automatically using its event system.
function __postexec_notify_on_long_running_commands --on-event fish_postexec
   set --function interactive_commands 'nvim' 'v' 'tmux' 't' 'n' 'nnn'
   for cmd in $interactive_commands
       if string match -q "$cmd*" $argv[1]
           # We quit interactive commands manually,
           # no need for a notification.
           return
       end
   end

   set --local exit_status $status

   if test $CMD_DURATION -gt 5000
     printf \\a
   end
end

function dotenv -d "Load environment variables from .env"
    for line in (cat $argv[1])
        if string match -qr '^\s*#' -- $line
            continue
        end
        if string match -qr '^\s*$' -- $line
            continue
        end
        set key (string match -r '^[^=]+' -- $line)
        set val (string replace "$key=" '' -- $line)
        set val (string trim -c '"' $val)
        set -x $key $val
    end
end

function azure_container_logs -d "Get Azure Container App logs"
    # Check if required parameters are provided
    if test (count $argv) -lt 2
        echo "Usage: azure_container_logs <workspace_id> <container_group_name> [time_range] [container_name]"
        echo "  workspace_id: Azure Log Analytics workspace ID"
        echo "  container_group_name: Name of the Container App"
        echo "  time_range: Time range for logs (default: 5m). Examples: 5m, 1h, 1d"
        echo "  container_name: Specific container name (optional)"
        echo ""
        echo "Example: azure_container_logs myworkspace myapp 10m api"
        return 1
    end

    set workspace_id $argv[1]
    set container_group_name $argv[2]
    
    # Set default time range to 5m if not provided
    set time_range "5m"
    if test (count $argv) -ge 3
        set time_range $argv[3]
    end
    
    # Build the KQL query
    set query "ContainerAppConsoleLogs_CL"
    set query "$query | where ContainerGroupName_s contains \"$container_group_name\""
    
    # Add container name filter if provided
    if test (count $argv) -ge 4
        set container_name $argv[4]
        set query "$query | where ContainerName_s == \"$container_name\""
    end
    
    set query "$query | where time_t >= ago($time_range)"
    set query "$query | project time_t, Log_s"
    set query "$query | order by time_t desc"

    echo "Executing query:"
    echo "=================="
    echo $query
    echo "=================="
    echo ""

    # Execute the query using Azure CLI
    az monitor log-analytics query \
        --workspace $workspace_id \
        --analytics-query $query \
        --output table
end
