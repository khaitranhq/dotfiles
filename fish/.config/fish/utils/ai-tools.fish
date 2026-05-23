# AI-powered git commit message generator
function ai_commit -d "Generate AI-powered commit messages from staged changes"
    # Validate required dependencies
    if not command -v pi >/dev/null 2>&1
        echo "❌ Error: pi command not found" >&2
        echo "   Please install pi first" >&2
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

    # Extract Jira ticket ID from branch name (formats: PROJ-123/description or PROJ-123-description)
    set branch_name (git branch --show-current)
    set jira_ticket ""
    if echo "$branch_name" | grep -qP '^[A-Z][A-Z0-9]+-\d+[/-]'
        set jira_ticket (echo "$branch_name" | grep -oP '^[A-Z][A-Z0-9]+-\d+')
    end

    if test -n "$jira_ticket"
        echo "🔍 Detected Jira ticket ID: $jira_ticket"
    else
        echo "🔍 No Jira ticket ID detected in branch name"
    end

    # Build prompt with branch context for Jira ticket awareness
    set ai_prompt "Generate a short but concise conventional commit message from this staged diff. Output only the commit message, no explanation, no markdown."
    if test -n "$jira_ticket"
        set ai_prompt "Generate a short but concise commit message from this staged diff. The commit message must start with \"$jira_ticket: \". IMPORTANT: do NOT include any conventional commit prefix like 'fix:' or 'feat:' — the Jira ticket ID serves as the prefix. Output only the commit message, no explanation, no markdown."
    end

    set generated_message "$(gum spin \
        --title "🤖 Generating commit message from staged changes..." -- \
        sh -c 'printf "%s\n" "$1" | pi -p --no-tools --model opencode-go/deepseek-v4-flash "$2"' \
        _ "$diff_content" "$ai_prompt")"

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

    # Ensure Jira ticket ID is prepended (fallback if AI didn't include it)
    if test -n "$jira_ticket"
        if not echo "$generated_message" | grep -q "^$jira_ticket:"
            set generated_message "$jira_ticket: $generated_message"
        end
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

    gum input --placeholder="Press Enter to continue..." --prompt="" --no-show-help >/dev/null

    return $commit_exit_code
end
