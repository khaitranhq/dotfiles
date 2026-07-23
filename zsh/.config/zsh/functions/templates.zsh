TEMPLATE_DIR="${ZDOTDIR:-$HOME/.config/zsh}/templates"

function specmd() {
    if [[ $# -ne 1 ]]; then
        echo "Usage: specmd <target.md>" >&2
        return 1
    fi

    local target="$1"
    local template="${TEMPLATE_DIR}/spec.md"

    if [[ ! -f "$template" ]]; then
        echo "Template not found: $template" >&2
        return 1
    fi

    if [[ -f "$target" ]]; then
        echo "File already exists: $target" >&2
        return 1
    fi

    cp "$template" "$target"
    echo "Created: $target"
}

function reviewmd() {
    local target=""
    local diff_src=""

    # Parse args: optional diff source then target
    case $# in
        0)
            echo "Usage: reviewmd [-s|--staged|-u|--unstaged|<commit>] <target.md>" >&2
            return 1
            ;;
        1)
            target="$1"
            ;;
        2)
            case "$1" in
                -s|--staged) diff_src="--cached" ;;
                -u|--unstaged) diff_src="" ;;
                *) diff_src="$1" ;;
            esac
            target="$2"
            ;;
        *)
            echo "Usage: reviewmd [-s|--staged|-u|--unstaged|<commit>] <target.md>" >&2
            return 1
            ;;
    esac

    local template="${TEMPLATE_DIR}/review.md"

    if [[ ! -f "$template" ]]; then
        echo "Template not found: $template" >&2
        return 1
    fi

    if [[ -f "$target" ]]; then
        echo "File already exists: $target" >&2
        return 1
    fi

    # Generate review with optional diff prepended
    {
        if [[ -n "$diff_src" ]]; then
            echo '```diff'
            git diff $diff_src
            local git_exit=$?
            echo '```'
            echo
            if [[ $git_exit -ne 0 ]]; then
                echo "Warning: git diff failed" >&2
            fi
        fi
        cat "$template"
    } > "$target"

    echo "Created: $target"
}
