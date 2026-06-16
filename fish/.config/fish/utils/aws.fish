function aws_ec2_ssm -d "Select AWS profile and EC2 instance via fzf, then connect via SSM"
    if not command -v fzf >/dev/null 2>&1
        echo "❌ Error: fzf command not found" >&2
        return 1
    end

    set -l config_file "$HOME/.aws/config"
    if not test -f "$config_file"
        echo "❌ Error: AWS config file not found at $config_file" >&2
        return 1
    end

    set -l profiles (grep -oP '^\[profile \K[^\]]+' "$config_file" 2>/dev/null)
    if test -z "$profiles"
        echo "❌ Error: No AWS profiles found in $config_file" >&2
        return 1
    end

    # Step 1: fzf select profile (small frame)
    set -l profile (printf '%s\n' $profiles | fzf --height=~10 --layout=reverse --border --header="Select AWS Profile")
    if test -z "$profile"
        echo "No profile selected."
        return 0
    end
    echo "🔑 Selected profile: $profile"

    # Step 2: Extract region from config for this profile
    set -l region ""
    set -l in_section 0
    while read -l line
        if string match -qr "^\[profile $profile\]" "$line"
            set in_section 1
            continue
        end
        if test $in_section -eq 1
            if string match -qr '^\[' "$line"
                break
            end
            if string match -qr '^region\s*=\s*(.+)$' "$line"
                set region (string match -r '^region\s*=\s*(.+)$' "$line")[2]
                break
            end
        end
    end <"$config_file"

    if test -z "$region"
        echo "❌ Error: No region found for profile '$profile'"
        return 1
    end
    echo "🌍 Region: $region"

    # Step 3: Check authentication
    echo "🔍 Checking authentication..."
    if not aws sts get-caller-identity --profile $profile --region $region >/dev/null 2>&1
        echo "⚠️  Not authenticated. Running aws login..."
        if not aws login --profile $profile
            echo "❌ AWS login failed"
            return 1
        end
        echo "✅ Login successful"
    else
        echo "✅ Authenticated"
    end

    # Step 4: List EC2 instances
    echo "🔍 Fetching EC2 instances..."
    set -l instances (aws ec2 describe-instances \
        --profile $profile \
        --region $region \
        --filters "Name=instance-state-name,Values=running" \
        --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value | [0], InstanceId]' \
        --output text 2>&1)

    if test $status -ne 0
        echo "❌ Error fetching EC2 instances: $instances"
        return 1
    end

    if test -z "$instances"
        echo "⚠️  No EC2 instances found in region $region"
        return 0
    end

    # Step 5: fzf select instance (small frame, show name only)
    set -l selected (printf '%s\n' $instances | fzf --height=~10 --layout=reverse --border --header="Select EC2 Instance" --with-nth=1)
    if test -z "$selected"
        echo "No instance selected."
        return 0
    end

    # Extract instance ID (last column) and name (rest)
    set -l instance_id (echo "$selected" | awk '{print $NF}')
    set -l instance_name (echo "$selected" | awk '{$NF=""; print $0}' | string trim)

    echo "🖥️  Connecting to: $instance_name ($instance_id)"

    # Step 6: SSM start session
    aws ssm start-session \
        --target $instance_id \
        --profile $profile \
        --region $region
end

function aws_auth
    set -l profile $argv[1]
    set -l region $argv[2]

    if test -z "$profile"
        echo "❌ Error: Profile name is required"
        echo "Usage: aws_auth <profile-name> [region]"
        return 1
    end

    echo "🔐 Authenticating AWS with profile: $profile"

    # Step 1: Check current authentication status
    echo "🔍 Checking authentication status..."
    set -l caller_identity_output (aws sts get-caller-identity --profile $profile 2>&1)
    set -l sts_exit_code $status

    # Step 2: Handle authentication based on status
    if test $sts_exit_code -ne 0
        # Check if session expired
        if string match -q "*expired*" "$caller_identity_output"
            echo "⚠️  Session has expired. Reauthenticating..."
        else if string match -q "*reauthenticate*" "$caller_identity_output"
            echo "⚠️  Reauthentication required..."
        else
            echo "⚠️  Authentication check failed. Attempting login..."
        end

        # Perform AWS login
        echo "🔑 Performing AWS login..."
        if not aws login --profile $profile
            echo "❌ AWS login failed"
            return 1
        end

        echo "✅ AWS login successful"

        # Re-fetch caller identity after successful login
        echo "🔍 Retrieving account information..."
        set caller_identity_output (aws sts get-caller-identity --profile $profile 2>&1)
        set sts_exit_code $status

        if test $sts_exit_code -ne 0
            echo "❌ Failed to retrieve account information after login"
            return 1
        end
    else
        echo "✅ Authentication is valid"
    end

    # Step 3: Extract account ID from caller identity
    echo "📋 Extracting account ID..."
    set -l account_id (echo "$caller_identity_output" | yq -r '.Account // "empty"' 2>/dev/null)

    if test -z "$account_id"
        echo "❌ Failed to extract account ID from caller identity"
        return 1
    end

    echo "📋 Account ID: $account_id"

    # Step 4: Find matching cache file
    set -l cache_dir "$HOME/.aws/login/cache"
    set -l matching_file ""

    if not test -d "$cache_dir"
        echo "⚠️  Cache directory not found: $cache_dir"
        echo "ℹ️  Authentication is valid, but cache directory does not exist"
        return 0
    end

    echo "🔎 Searching for cache file with Account ID: $account_id..."

    for cache_file in $cache_dir/*.json
        if test -f "$cache_file"
            # Extract accountId from JSON file
            set -l file_account_id (yq -r '.accessToken.accountId // "empty"' "$cache_file" 2>/dev/null)

            if test "$file_account_id" = "$account_id"
                set matching_file "$cache_file"
                echo "✅ Found matching cache file: "(basename $matching_file)
                break
            end
        end
    end

    if test -z "$matching_file"
        echo "⚠️  No matching cache file found for Account ID: $account_id"
        echo "ℹ️  Authentication is valid, but credentials cannot be exported to environment"
        return 0
    end

    # Step 5: Extract and export AWS credentials
    echo "🔑 Extracting credentials from cache..."

    # Parse credentials from JSON
    set -l access_key_id (yq -r '.accessToken.accessKeyId // "empty"' "$matching_file" 2>/dev/null)
    set -l secret_access_key (yq -r '.accessToken.secretAccessKey // "empty"' "$matching_file" 2>/dev/null)
    set -l session_token (yq -r '.accessToken.sessionToken // "empty"' "$matching_file" 2>/dev/null)
    set -l expires_at (yq -r '.accessToken.expiresAt // "empty"' "$matching_file" 2>/dev/null)

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

    # Step 6: Determine AWS region
    if test -z "$region"
        echo "🌍 No region specified, reading from ~/.aws/config..."
        set -l config_file "$HOME/.aws/config"

        if test -f "$config_file"
            # Parse region from config file for the specified profile
            set -l in_profile_section 0

            while read -l line
                # Check if we're entering the target profile section
                if string match -qr "^\[profile $profile\]\s*\$" "$line"
                    set in_profile_section 1
                    continue
                end

                # Check if we've entered a different profile section
                if test $in_profile_section -eq 1; and string match -qr '^\[profile ' "$line"
                    # We've moved to another profile, stop searching
                    break
                end

                # Extract region if we're in the target profile section
                if test $in_profile_section -eq 1
                    if string match -qr '^region\s*=\s*(.+)$' "$line"
                        set region (string match -r '^region\s*=\s*(.+)$' "$line" | string trim)[2]
                        break
                    end
                end
            end <"$config_file"

            if test -z "$region"
                echo "⚠️  No region found for profile '$profile' in config file"
                echo "ℹ️  Proceeding without setting AWS_REGION"
            else
                echo "✅ Region found: $region"
            end
        else
            echo "⚠️  Config file not found: $config_file"
            echo "ℹ️  Proceeding without setting AWS_REGION"
        end
    else
        echo "🌍 Using specified region: $region"
    end

    # Export credentials as environment variables
    set -gx AWS_ACCESS_KEY_ID "$access_key_id"
    set -gx AWS_SECRET_ACCESS_KEY "$secret_access_key"
    set -gx AWS_SESSION_TOKEN "$session_token"
    set -gx AWS_ACCOUNT_ID "$account_id"

    # Export region if available
    if test -n "$region"
        set -gx AWS_REGION "$region"
    end

    echo "✅ Credentials exported to environment:"
    echo "   • AWS_ACCESS_KEY_ID: "(string sub -l 20 "$access_key_id")"..."
    echo "   • AWS_SECRET_ACCESS_KEY: [HIDDEN]"
    echo "   • AWS_SESSION_TOKEN: [HIDDEN]"
    echo "   • AWS_ACCOUNT_ID: $account_id"
    if test -n "$region"
        echo "   • AWS_REGION: $region"
    end

    echo "🎉 AWS authentication complete!"
    return 0
end
