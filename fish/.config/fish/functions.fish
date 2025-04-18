#!/usr/bin/env fish

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
      fd --type f | \
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
