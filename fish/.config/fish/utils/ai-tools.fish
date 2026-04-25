# AI-powered git commit message generator
function ai_commit -d "Generate AI-powered commit messages from staged changes"
    # Validate required dependencies
    if not command -v opencode >/dev/null 2>&1
        echo "❌ Error: opencode command not found" >&2
        echo "   Please install opencode first" >&2
        return 1
    end

    if not command -v git >/dev/null 2>&1
        echo "❌ Error: git command not found" >&2
        return 1
    end

    # Check if we're in a git repository
    if not git rev-parse --git-dir >/dev/null 2>&1
        echo "❌ Error: Not in a git repository" >&2
        return 1
    end

    # Get staged diff
    set diff_content (git diff --staged)

    # Validate that there are staged changes
    if test -z "$diff_content"
        echo "❌ Error: No staged changes found" >&2
        echo "   Use 'git add' to stage files first" >&2
        return 1
    end

    set generated_message "$(gum spin \
        --title "🤖 Generating commit message from staged changes..." -- \
        opencode run \
        --agent="git-generator" \
        "$diff_content")"

    set generate_message_exit_code $status

    if test $generate_message_exit_code -ne 0
        echo "❌ Error: Failed to generate commit message" >&2
        echo "   Exit code: $generate_message_exit_code" >&2
        echo "   Output: $generated_message" >&2
        return 1
    end

    # Validate generated message is not empty
    if test -z "$generated_message"
        echo "❌ Error: Generated commit message is empty" >&2
        return 1
    end

    # Display the generated commit message
    echo "📝 Generated commit message:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$generated_message"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚀 Committing changes..."

    # Commit using the generated message
    set commit_exit_code 0
    if git commit -m "$generated_message"
        echo "✅ Successfully committed changes"
    else
        echo "❌ Error: git commit failed" >&2
        set commit_exit_code 1
    end

    echo ""

    gum input --placeholder="Press Enter to continue..." --prompt="" --no-show-help > /dev/null

    return $commit_exit_code
end
