#!/usr/bin/env fish

function setup_monitor
    set options "home" "work"
    set selected_option (printf "%s\n" $options | fzf --prompt="Select an option: ")

    if test "$selected_option" = "home"
        xrandr \
            --output eDP-1 --off \
            --output HDMI-1 --primary --mode 1920x1080 --pos 1080x340 --rotate normal \
            --output DP-1 --mode 1920x1080 --pos 0x0 --rotate left
    end

    if test "$selected_option" = "work"
        xrandr \
            --output eDP-1 --off \
            --output HDMI-1 --primary --mode 1920x1080 --pos 0x0
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
        if test $exit_status -eq 0
            # Command succeeded
            paplay /usr/share/sounds/freedesktop/stereo/bell.oga & notify-send 'Command finished' "$argv"
        else
            # Command failed
            paplay /usr/share/sounds/freedesktop/stereo/trash-empty.oga & notify-send 'Command failed' "$argv"
        end
    end
end
