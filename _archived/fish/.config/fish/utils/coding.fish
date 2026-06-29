function setup-pnpm-project
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

    pnpm init
    pnpm install --save-dev \
        eslint@9.39.4 \
        @eslint/js@9.39.4 \
        typescript \
        typescript-eslint \
        eslint-plugin-prettier \
        eslint-config-prettier \
        prettier \
        @trivago/prettier-plugin-sort-imports

    npx tsc --init
end


function gotest -d "Run Go tests with colorized output"
    # Check if go is available
    if not command -v go >/dev/null 2>&1
        echo "Error: go command not found" >&2
        return 1
    end

    # Run go test with provided arguments and colorize the output
    go test $argv | sed \
        -e 's/--- PASS:/'(printf "\033[32m✅--- PASS:\033[0m")'/g' \
        -e 's/--- FAIL:/'(printf "\033[31m❌--- FAIL:\033[0m")'/g' \
        -e 's/^PASS$/'(printf "\033[32mPASS\033[0m")'/g' \
        -e 's/^FAIL$/'(printf "\033[31mFAIL\033[0m")'/g' \
        -e 's/^FAIL[[:space:]]/'(printf "\033[31mFAIL\033[0m")'\t/g' \
        -e 's/^[[:space:]]*ok[[:space:]]/'(printf "\033[32mok\033[0m")'\t/g'
end
