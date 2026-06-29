function aws-ec2-ssm() {
    if ! command -v fzf >/dev/null 2>&1; then
        echo "❌ Error: fzf command not found" >&2
        return 1
    fi

    local config_file="$HOME/.aws/config"
    if [[ ! -f "$config_file" ]]; then
        echo "❌ Error: AWS config file not found at $config_file" >&2
        return 1
    fi

    local profiles
    profiles=$(grep -oP '^\[profile \K[^\]]+' "$config_file" 2>/dev/null)
    if [[ -z "$profiles" ]]; then
        echo "❌ Error: No AWS profiles found in $config_file" >&2
        return 1
    fi

    # Step 1: fzf select profile
    local profile
    profile=$(print -l $profiles | fzf --cycle --height=~10 --layout=reverse --border --header="Select AWS Profile")
    if [[ -z "$profile" ]]; then
        echo "No profile selected."
        return 0
    fi
    echo "🔑 Selected profile: $profile"

    # Step 2: Extract region from config for this profile
    local region in_section
    region=""
    in_section=0
    while IFS= read -r line; do
        if [[ "$line" =~ ^\[profile\ $profile\] ]]; then
            in_section=1
            continue
        fi
        if [[ $in_section -eq 1 ]]; then
            if [[ "$line" =~ ^\[ ]]; then
                break
            fi
            if [[ "$line" =~ ^region\s*=\s*(.+)$ ]]; then
                region="${match[1]}"
                break
            fi
        fi
    done <"$config_file"

    if [[ -z "$region" ]]; then
        echo "❌ Error: No region found for profile '$profile'"
        return 1
    fi
    echo "🌍 Region: $region"

    # Step 3: Check authentication
    echo "🔍 Checking authentication..."
    if ! aws sts get-caller-identity --profile "$profile" --region "$region" >/dev/null 2>&1; then
        echo "⚠️  Not authenticated. Running aws login..."
        if ! aws login --profile "$profile"; then
            echo "❌ AWS login failed"
            return 1
        fi
        echo "✅ Login successful"
    else
        echo "✅ Authenticated"
    fi

    # Step 4: List EC2 instances
    echo "🔍 Fetching EC2 instances..."
    local instances
    instances=$(aws ec2 describe-instances \
        --profile "$profile" \
        --region "$region" \
        --filters "Name=instance-state-name,Values=running" \
        --query 'Reservations[*].Instances[*].[Tags[?Key==`Name`].Value | [0], InstanceId]' \
        --output text 2>&1)
    local ec2_status=$?

    if [[ $ec2_status -ne 0 ]]; then
        echo "❌ Error fetching EC2 instances: $instances"
        return 1
    fi

    if [[ -z "$instances" ]]; then
        echo "⚠️  No EC2 instances found in region $region"
        return 0
    fi

    # Step 5: fzf select instance
    local selected
    selected=$(print -l $instances | fzf --cycle --height=~10 --layout=reverse --border --header="Select EC2 Instance" --with-nth=1)
    if [[ -z "$selected" ]]; then
        echo "No instance selected."
        return 0
    fi

    local instance_id instance_name
    instance_id=$(echo "$selected" | awk '{print $NF}')
    instance_name=$(echo "$selected" | awk '{$NF=""; print $0}' | sed 's/ *$//')

    echo "🖥️  Connecting to: $instance_name ($instance_id)"

    # Step 6: SSM start session
    aws ssm start-session \
        --target "$instance_id" \
        --profile "$profile" \
        --region "$region"
}

function aws_auth() {
    local profile="$1"
    local region="$2"

    if [[ -z "$profile" ]]; then
        echo "❌ Error: Profile name is required"
        echo "Usage: aws_auth <profile-name> [region]"
        return 1
    fi

    echo "🔐 Authenticating AWS with profile: $profile"

    # Step 1: Check current authentication status
    echo "🔍 Checking authentication status..."
    local caller_identity_output sts_exit_code
    caller_identity_output=$(aws sts get-caller-identity --profile "$profile" 2>&1)
    sts_exit_code=$?

    # Step 2: Handle authentication based on status
    if [[ $sts_exit_code -ne 0 ]]; then
        if echo "$caller_identity_output" | grep -q "expired"; then
            echo "⚠️  Session has expired. Reauthenticating..."
        elif echo "$caller_identity_output" | grep -q "reauthenticate"; then
            echo "⚠️  Reauthentication required..."
        else
            echo "⚠️  Authentication check failed. Attempting login..."
        fi

        echo "🔑 Performing AWS login..."
        if ! aws login --profile "$profile"; then
            echo "❌ AWS login failed"
            return 1
        fi

        echo "✅ AWS login successful"

        caller_identity_output=$(aws sts get-caller-identity --profile "$profile" 2>&1)
        sts_exit_code=$?

        if [[ $sts_exit_code -ne 0 ]]; then
            echo "❌ Failed to retrieve account information after login"
            return 1
        fi
    else
        echo "✅ Authentication is valid"
    fi

    # Step 3: Extract account ID from caller identity
    echo "📋 Extracting account ID..."
    local account_id
    account_id=$(echo "$caller_identity_output" | yq -r '.Account // "empty"' 2>/dev/null)

    if [[ -z "$account_id" ]]; then
        echo "❌ Failed to extract account ID from caller identity"
        return 1
    fi

    echo "📋 Account ID: $account_id"

    # Step 4: Find matching cache file
    local cache_dir="$HOME/.aws/login/cache"
    local matching_file=""

    if [[ ! -d "$cache_dir" ]]; then
        echo "⚠️  Cache directory not found: $cache_dir"
        echo "ℹ️  Authentication is valid, but cache directory does not exist"
        return 0
    fi

    echo "🔎 Searching for cache file with Account ID: $account_id..."

    for cache_file in "$cache_dir"/*.json; do
        if [[ -f "$cache_file" ]]; then
            local file_account_id
            file_account_id=$(yq -r '.accessToken.accountId // "empty"' "$cache_file" 2>/dev/null)

            if [[ "$file_account_id" = "$account_id" ]]; then
                matching_file="$cache_file"
                echo "✅ Found matching cache file: $(basename "$matching_file")"
                break
            fi
        fi
    done

    if [[ -z "$matching_file" ]]; then
        echo "⚠️  No matching cache file found for Account ID: $account_id"
        echo "ℹ️  Authentication is valid, but credentials cannot be exported to environment"
        return 0
    fi

    # Step 5: Extract and export AWS credentials
    echo "🔑 Extracting credentials from cache..."

    local access_key_id secret_access_key session_token expires_at
    access_key_id=$(yq -r '.accessToken.accessKeyId // "empty"' "$matching_file" 2>/dev/null)
    secret_access_key=$(yq -r '.accessToken.secretAccessKey // "empty"' "$matching_file" 2>/dev/null)
    session_token=$(yq -r '.accessToken.sessionToken // "empty"' "$matching_file" 2>/dev/null)
    expires_at=$(yq -r '.accessToken.expiresAt // "empty"' "$matching_file" 2>/dev/null)

    if [[ -z "$access_key_id" || -z "$secret_access_key" || -z "$session_token" ]]; then
        echo "❌ Failed to extract credentials from cache file"
        echo "ℹ️  Authentication is valid, but cache parsing failed"
        return 1
    fi

    # Check if token is expired
    if [[ -n "$expires_at" ]]; then
        local expires_epoch current_epoch
        expires_epoch=$(date -d "$expires_at" +%s 2>/dev/null)
        current_epoch=$(date +%s)

        if [[ -n "$expires_epoch" && "$expires_epoch" -lt "$current_epoch" ]]; then
            echo "⚠️  Token has expired at: $expires_at"
            echo "ℹ️  Please re-authenticate"
            return 1
        fi
        echo "⏰ Token expires at: $expires_at"
    fi

    # Step 6: Determine AWS region
    if [[ -z "$region" ]]; then
        echo "🌍 No region specified, reading from ~/.aws/config..."
        local config_file="$HOME/.aws/config"

        if [[ -f "$config_file" ]]; then
            local in_profile_section=0

            while IFS= read -r line; do
                if [[ "$line" =~ ^\[profile\ $profile\]\s*$ ]]; then
                    in_profile_section=1
                    continue
                fi

                if [[ $in_profile_section -eq 1 && "$line" =~ ^\[profile\  ]]; then
                    break
                fi

                if [[ $in_profile_section -eq 1 && "$line" =~ ^region\s*=\s*(.+)$ ]]; then
                    region="${match[1]}"
                    break
                fi
            done <"$config_file"

            if [[ -z "$region" ]]; then
                echo "⚠️  No region found for profile '$profile' in config file"
                echo "ℹ️  Proceeding without setting AWS_REGION"
            else
                echo "✅ Region found: $region"
            fi
        else
            echo "⚠️  Config file not found: $config_file"
            echo "ℹ️  Proceeding without setting AWS_REGION"
        fi
    else
        echo "🌍 Using specified region: $region"
    fi

    # Export credentials as environment variables
    export AWS_ACCESS_KEY_ID="$access_key_id"
    export AWS_SECRET_ACCESS_KEY="$secret_access_key"
    export AWS_SESSION_TOKEN="$session_token"
    export AWS_ACCOUNT_ID="$account_id"

    if [[ -n "$region" ]]; then
        export AWS_REGION="$region"
    fi

    echo "✅ Credentials exported to environment:"
    echo "   • AWS_ACCESS_KEY_ID: ${access_key_id:0:20}..."
    echo "   • AWS_SECRET_ACCESS_KEY: [HIDDEN]"
    echo "   • AWS_SESSION_TOKEN: [HIDDEN]"
    echo "   • AWS_ACCOUNT_ID: $account_id"
    if [[ -n "$region" ]]; then
        echo "   • AWS_REGION: $region"
    fi

    echo "🎉 AWS authentication complete!"
    return 0
}
