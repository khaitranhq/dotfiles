# AI-powered git commit message generator
function ai_commit -d "Generate AI-powered commit messages from staged changes"
    # Validate required dependencies
    if not command -v agentcrew >/dev/null 2>&1
        echo "❌ Error: agentcrew command not found" >&2
        echo "   Please install agentcrew first" >&2
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

    echo "🤖 Generating commit message from staged changes..."
    echo ""

    # Generate commit message using agentcrew
    set generated_message "$(agentcrew job \
        --agent="CommitMessageGenerator" \
        --agent-config='https://raw.githubusercontent.com/saigontechnology/AgentCrew/refs/heads/main/examples/agents/jobs/commit-message-generator.toml' \
        --provider='openai' \
        --model-id="gpt-4.1-mini" \
        "$diff_content" 2>&1)"

    set agentcrew_exit_code $status

    # Handle agentcrew execution errors
    if test $agentcrew_exit_code -ne 0
        echo "❌ Error: Failed to generate commit message" >&2
        echo "   Exit code: $agentcrew_exit_code" >&2
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
    echo "Press q to exit"

    # Wait for user to press 'q'
    while true
        read -n 1 -s key
        if test "$key" = "q"
            break
        end
    end

    return $commit_exit_code
end

# Generate and execute bash commands using AI
function ai_bash -d "Generate and execute bash commands using AI"
    # Validate required dependencies
    if not command -v agentcrew >/dev/null 2>&1
        echo "❌ Error: agentcrew command not found" >&2
        echo "   Please install agentcrew first" >&2
        return 1
    end

    if not command -v gum >/dev/null 2>&1
        echo "❌ Error: gum command not found" >&2
        echo "   Install with: brew install gum" >&2
        return 1
    end

    # Validate prompt argument
    if test (count $argv) -eq 0
        echo "Usage: ai_bash <prompt request command>" >&2
        echo "Example: ai_bash 'find all python files modified in last 7 days'" >&2
        return 1
    end

    set prompt $argv

    echo "🤖 Generating command for: $prompt"
    echo ""

    # Call agentcrew to generate command
    set generated_command (agentcrew job \
        --agent="BashAgent" \
        --agent-config "https://raw.githubusercontent.com/khaitranhq/dotfiles/refs/heads/windows-wsl/AgentCrew/.AgentCrew/job-agents/BashAgent.toml" \
        --provider=github_copilot \
        --model-id="gpt-4.1" \
        "$prompt" 2>&1)

    set agentcrew_exit_code $status

    # Handle agentcrew execution errors
    if test $agentcrew_exit_code -ne 0
        echo "❌ Error: Failed to generate command" >&2
        echo "   Exit code: $agentcrew_exit_code" >&2
        echo "   Output: $generated_command" >&2
        return 1
    end

    # Validate generated command is not empty
    if test -z "$generated_command"
        echo "❌ Error: Generated command is empty" >&2
        return 1
    end

    # Strip surrounding quotes from JSON output
    set generated_command (echo $generated_command | sed 's/^["'\''[:space:]]*//;s/["'\''[:space:]]*$//')

    # Display the generated command with syntax highlighting
    echo "📝 Generated command:"
    echo "   $generated_command"
    echo ""

    # Ask user for confirmation using gum
    if gum confirm "Execute this command?" --affirmative="✅ Yes, run it" --negative="❌ No, cancel"
        echo ""
        echo "🚀 Executing command..."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Execute the command and capture its exit code
        # Use fish -c to properly parse the command with redirects and pipes
        fish -c "$generated_command"
        set cmd_exit_code $status

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Report execution status
        if test $cmd_exit_code -eq 0
            echo "✅ Command executed successfully"
        else
            echo "⚠️  Command exited with code: $cmd_exit_code" >&2
        end

        return $cmd_exit_code
    else
        echo ""
        echo "🚫 Command execution cancelled"
        return 0
    end
end

# Generate code snippets using AI
function code_snip -d "Generate code snippets using AI"
    # Validate required dependencies
    if not command -v agentcrew >/dev/null 2>&1
        echo "❌ Error: agentcrew command not found" >&2
        echo "   Please install agentcrew first" >&2
        return 1
    end

    # Validate prompt argument
    if test (count $argv) -eq 0
        echo "Usage: code_snip <code snippet request>" >&2
        echo "Example: code_snip 'python function to parse JSON file'" >&2
        return 1
    end

    set prompt $argv

    echo "🤖 Generating code snippet for: $prompt"
    echo ""

    # Call agentcrew to generate code snippet
    set generated_snippet (agentcrew job \
        --agent="CodeSnipper" \
        --agent-config "https://raw.githubusercontent.com/khaitranhq/dotfiles/refs/heads/windows-wsl/AgentCrew/.AgentCrew/job-agents/CodeSnipper.toml" \
        --provider=github_copilot \
        --model-id="claude-sonnet-4.5" \
        "$prompt" 2>&1)

    set agentcrew_exit_code $status

    # Handle agentcrew execution errors
    if test $agentcrew_exit_code -ne 0
        echo "❌ Error: Failed to generate code snippet" >&2
        echo "   Exit code: $agentcrew_exit_code" >&2
        echo "   Output: $generated_snippet" >&2
        return 1
    end

    # Validate generated snippet is not empty
    if test -z "$generated_snippet"
        echo "❌ Error: Generated code snippet is empty" >&2
        return 1
    end

    # Display the generated snippet
    echo "📝 Generated code snippet:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$generated_snippet"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    return 0
end
