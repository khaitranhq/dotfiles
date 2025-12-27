function aws_auth
    set -l profile $argv[1]

    if test -z "$profile"
        echo "❌ Error: Profile name is required"
        echo "Usage: aws_auth <profile-name>"
        return 1
    end

    echo "🔐 Authenticating AWS with profile: $profile"

    # Step 1: Get AWS Account ID from config file
    echo "🔍 Reading AWS Account ID from config..."
    set -l config_file "$HOME/.aws/config"
    set -l account_id ""

    if test -f "$config_file"
        # Extract account ID from login_session ARN in config
        # Format: login_session = arn:aws:iam::757085376176:user/leoaslan
        set -l login_session (awk -v profile="$profile" '
            /^\[profile / {
                in_section = 0
                if ($0 ~ "\\[profile " profile "\\]") in_section = 1
            }
            in_section && /^login_session/ {
                # Extract account ID using gsub and regex
                line = $0
                if (match(line, /arn:aws:iam::[0-9]+:/)) {
                    sub(/.*arn:aws:iam::/, "", line)
                    sub(/:.*/, "", line)
                    print line
                    exit
                }
            }
        ' "$config_file")

        if test -n "$login_session"
            set account_id "$login_session"
            echo "📋 Account ID from config: $account_id"
        end
    end

    # Step 2: Check if cache file with this account ID already exists
    set -l cache_dir "$HOME/.aws/login/cache"
    set -l matching_file ""

    if test -n "$account_id" -a -d "$cache_dir"
        echo "🔎 Checking for existing cache file with Account ID: $account_id..."

        for cache_file in $cache_dir/*.json
            if test -f "$cache_file"
                # Extract accountId from JSON file
                set -l file_account_id (jq -r '.accessToken.accountId // empty' "$cache_file" 2>/dev/null)

                if test "$file_account_id" = "$account_id"
                    set matching_file "$cache_file"
                    echo "✅ Found existing cache file: "(basename $matching_file)
                    break
                end
            end
        end
    end

    # Step 3: AWS Login (only if no valid cache found or we need to refresh)
    if test -z "$matching_file"
        echo "🔑 No valid cache found. Performing AWS login..."

        if not aws login --profile $profile
            echo "❌ AWS login failed"
            return 1
        end

        echo "✅ AWS login successful"

        # If we didn't get account_id from config, get it from STS
        if test -z "$account_id"
            echo "🔍 Retrieving AWS Account ID from STS..."
            set account_id (aws sts get-caller-identity --query Account --output text --profile $profile 2>/dev/null)

            if test -z "$account_id"
                echo "❌ Failed to retrieve AWS Account ID"
                return 1
            end

            echo "📋 Account ID: $account_id"
        end
    else
        echo "♻️  Using existing authentication cache"
    end

    # Step 4: Find/verify matching cache file
    if test -z "$matching_file"
        echo "🔎 Searching for cache file..."

        if not test -d "$cache_dir"
            echo "⚠️  Cache directory not found: $cache_dir"
            return 1
        end

        for cache_file in $cache_dir/*.json
            if test -f "$cache_file"
                # Extract accountId from JSON file
                set -l file_account_id (jq -r '.accessToken.accountId // empty' "$cache_file" 2>/dev/null)

                if test "$file_account_id" = "$account_id"
                    set matching_file "$cache_file"
                    break
                end
            end
        end

        if test -z "$matching_file"
            echo "⚠️  No matching cache file found for Account ID: $account_id"
            echo "ℹ️  Authentication is still valid, but cache file verification failed"
            return 0
        end

        echo "✅ Found matching cache file: "(basename $matching_file)
    end

    # Step 5: Extract and export AWS credentials
    echo "🔑 Extracting credentials from cache..."

    # Parse credentials from JSON
    set -l access_key_id (jq -r '.accessToken.accessKeyId // empty' "$matching_file" 2>/dev/null)
    set -l secret_access_key (jq -r '.accessToken.secretAccessKey // empty' "$matching_file" 2>/dev/null)
    set -l session_token (jq -r '.accessToken.sessionToken // empty' "$matching_file" 2>/dev/null)
    set -l expires_at (jq -r '.accessToken.expiresAt // empty' "$matching_file" 2>/dev/null)

    # Validate credentials exist
    if test -z "$access_key_id" -o -z "$secret_access_key" -o -z "$session_token"
        echo "❌ Failed to extract credentials from cache file"
        echo "ℹ️  Authentication is valid, but cache parsing failed"
        return 1
    end

    # Check if token is expired
    if test -n "$expires_at"
        # Convert ISO 8601 timestamps to Unix epoch for comparison
        set -l expires_epoch (date -d "$expires_at" +%s 2>/dev/null)
        set -l current_epoch (date +%s)

        if test -n "$expires_epoch" -a "$expires_epoch" -lt "$current_epoch"
            echo "⚠️  Token has expired at: $expires_at"
            echo "ℹ️  Please re-authenticate"
            return 1
        end
        echo "⏰ Token expires at: $expires_at"
    end

    # Export credentials as environment variables
    set -gx AWS_ACCESS_KEY_ID "$access_key_id"
    set -gx AWS_SECRET_ACCESS_KEY "$secret_access_key"
    set -gx AWS_SESSION_TOKEN "$session_token"
    set -gx AWS_ACCOUNT_ID "$account_id"

    echo "✅ Credentials exported to environment:"
    echo "   • AWS_ACCESS_KEY_ID: "(string sub -l 20 "$access_key_id")"..."
    echo "   • AWS_SECRET_ACCESS_KEY: [HIDDEN]"
    echo "   • AWS_SESSION_TOKEN: [HIDDEN]"
    echo "   • AWS_ACCOUNT_ID: $account_id"

    echo "🎉 AWS authentication complete!"
    return 0
end

function aws_clear
    echo "🧹 Clearing AWS credentials from environment..."

    # Clear AWS environment variables
    set -e AWS_ACCESS_KEY_ID
    set -e AWS_SECRET_ACCESS_KEY
    set -e AWS_SESSION_TOKEN
    set -e AWS_ACCOUNT_ID

    echo "✅ AWS credentials cleared"
end
