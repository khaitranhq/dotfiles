# AI-powered git commit message generator
function ai_commit() {
    # Validate required dependencies
    if ! command -v pi >/dev/null 2>&1; then
        echo "❌ Error: pi command not found" >&2
        echo "   Please install pi first" >&2
        return 1
    fi

    if ! command -v git >/dev/null 2>&1; then
        echo "❌ Error: git command not found" >&2
        return 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
        echo "❌ Error: Not in a git repository" >&2
        return 1
    fi

    # Get staged diff
    local diff_content
    diff_content=$(git diff --staged)

    # Validate that there are staged changes
    if [[ -z "$diff_content" ]]; then
        echo "❌ Error: No staged changes found" >&2
        echo "   Use 'git add' to stage files first" >&2
        return 1
    fi

    # Extract Jira ticket ID from branch name
    local branch_name jira_ticket
    branch_name=$(git branch --show-current)
    jira_ticket=""
    if echo "$branch_name" | grep -qP '^[A-Z][A-Z0-9]+-\d+[/-]'; then
        jira_ticket=$(echo "$branch_name" | grep -oP '^[A-Z][A-Z0-9]+-\d+')
    fi

    if [[ -n "$jira_ticket" ]]; then
        echo "🔍 Detected Jira ticket ID: $jira_ticket"
    else
        echo "🔍 No Jira ticket ID detected in branch name"
    fi

    # Build prompt with branch context for Jira ticket awareness
    local ai_prompt
    ai_prompt="Generate a short but concise conventional commit message from this staged diff. If the diff contains more than one kind of change, include a commit body that describes each change on a separate line, with an empty line between the title and body. Output only the commit message, no explanation, no markdown."
    if [[ -n "$jira_ticket" ]]; then
        ai_prompt="Generate a short but concise commit message from this staged diff. The commit message must start with \"$jira_ticket: \". IMPORTANT: do NOT include any conventional commit prefix like 'fix:' or 'feat:' — the Jira ticket ID serves as the prefix. If the diff contains more than one kind of change, include a commit body that describes each change on a separate line, with an empty line between the title and body. Output only the commit message, no explanation, no markdown."
    fi

    local generated_message generate_exit_code
    generated_message=$(gum spin \
        --title "🤖 Generating commit message from staged changes..." -- \
        sh -c 'printf "%s\n" "$1" | pi -p --no-tools --extension ~/.pi/agent/extensions/llm-providers --no-extensions --provider github-copilot --model gpt-5.4-mini "$2"' \
        _ "$diff_content" "$ai_prompt")
    generate_exit_code=$?

    if [[ $generate_exit_code -ne 0 ]]; then
        echo "❌ Error: Failed to generate commit message" >&2
        echo "   Exit code: $generate_exit_code" >&2
        echo "   Output: $generated_message" >&2
        return 1
    fi

    # Validate generated message is not empty
    if [[ -z "$generated_message" ]]; then
        echo "❌ Error: Generated commit message is empty" >&2
        return 1
    fi

    # Ensure Jira ticket ID is prepended (fallback if AI didn't include it)
    if [[ -n "$jira_ticket" ]]; then
        if ! echo "$generated_message" | grep -q "^$jira_ticket:"; then
            generated_message="$jira_ticket: $generated_message"
        fi
    fi

    # Display the generated commit message
    echo "📝 Generated commit message:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$generated_message"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🚀 Committing changes..."

    # Commit using the generated message
    if git commit -m "$generated_message"; then
        echo "✅ Successfully committed changes"
    else
        echo "❌ Error: git commit failed" >&2
        return 1
    fi

    echo ""
    gum input --placeholder="Press Enter to continue..." --prompt="" --no-show-help >/dev/null
}
