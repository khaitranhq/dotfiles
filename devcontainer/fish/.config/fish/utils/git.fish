function git_squash_with_history
    set -l target_hash $argv[1]
    set -l new_message $argv[2]

    # Validate arguments
    if test -z "$target_hash"
        echo "❌ Error: Target commit hash is required"
        echo "Usage: git_squash_with_history <target-hash> <new-commit-message>"
        return 1
    end

    if test -z "$new_message"
        echo "❌ Error: New commit message is required"
        echo "Usage: git_squash_with_history <target-hash> <new-commit-message>"
        return 1
    end

    # Validate that we're in a git repository
    if not git rev-parse --git-dir >/dev/null 2>&1
        echo "❌ Error: Not in a git repository"
        return 1
    end

    # Validate that target hash exists
    if not git rev-parse --verify "$target_hash" >/dev/null 2>&1
        echo "❌ Error: Invalid commit hash: $target_hash"
        return 1
    end

    # Check if there are uncommitted changes
    if not git diff-index --quiet HEAD 2>/dev/null
        echo "⚠️  Warning: You have uncommitted changes"
        echo "Please commit or stash your changes before proceeding"
        return 1
    end

    echo "📝 Backing up commit messages from HEAD to $target_hash..."

    # Backup commit messages (from target_hash..HEAD, excluding the target commit itself)
    set -l backup_messages (git log --format="%h - %s%n%b" "$target_hash..HEAD")

    if test -z "$backup_messages"
        echo "⚠️  No commits found between HEAD and $target_hash"
        echo "Aborting operation"
        return 1
    end

    echo "📋 Found commit messages to backup:"
    echo "---"
    echo "$backup_messages"
    echo "---"

    # Perform soft reset
    echo "🔄 Performing soft reset to $target_hash..."
    if not git reset --soft "$target_hash"
        echo "❌ Error: Failed to reset to $target_hash"
        return 1
    end

    echo "✅ Soft reset completed"

    # Check if there are staged changes after reset
    if git diff-index --quiet --cached HEAD 2>/dev/null
        echo "⚠️  No staged changes after reset"
        echo "Nothing to commit"
        return 1
    end

    # Create commit with new message and backup as description
    echo "💾 Creating new commit..."

    # Build commit message with backup as description
    set -l commit_body "Previous commits squashed:\n---\n$backup_messages"

    if not git commit -m "$new_message" -m "$commit_body"
        echo "❌ Error: Failed to create commit"
        return 1
    end

    echo "✅ Successfully created new commit with message: '$new_message'"
    echo "📜 Previous commit history preserved in commit description"

    # Show the new commit
    echo ""
    echo "New commit details:"
    git log -1 --stat

    return 0
end
