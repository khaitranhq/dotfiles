#!/usr/bin/env fish

# Function to assume an AWS role using a selected profile from the AWS config.
function assume_role
  # Retrieve all AWS profiles from the config file, excluding those with "source".
  set profiles (grep -oP '\[profile \K[^\]]+' ~/.aws/config | grep -v "source")
  # Use fzf to select a profile interactively.
  set selectedProfile (echo $profiles | string split " " | fzf --header "Select profile" --cycle --ansi --layout=reverse --height=15)

  # Extract the role ARN for the selected profile from the AWS config.
  set role_arn (awk -v profile="$selectedProfile" '
      $0 ~ "\\\\[profile " profile "\\\\]" {found=1}
      found && /role_arn/ {print $3; exit}
      /^$/ {found=0}
      ' ~/.aws/config)

  # Extract the MFA serial for the selected profile from the AWS config.
  set mfa_serial (awk -v profile="$selectedProfile" '
      $0 ~ "\\\\[profile " profile "\\\\]" {found=1}
      found && /mfa_serial/ {print $3; exit}
      /^$/ {found=0}
      ' ~/.aws/config)

  # Initialize the token code variable.
  set token_code ""
  if test -n "$mfa_serial"
    # Unlock Bitwarden and retrieve the session ID.
    set -l sessionId (bw unlock | grep -Eo 'BW_SESSION="[^"]+"' | cut -d '"' -f 2 | head -n 1)
    
    if [ "$sessionId" = "" ]
      exit 1
    end

    # Load Bitwarden items using the session ID.
    set -l bwItems (gum spin --title "Loading Bitwarden items" -- bw list items --session "$sessionId")
    set -l selectedBwItem (echo $bwItems | jq -r '.[].name' | fzf --header "Select bitwarden item" --cycle --ansi --layout=reverse --height=15)
    # Retrieve the TOTP token code for the selected Bitwarden item.
    set token_code (gum spin --title "Loading token code" -- bw get totp $selectedBwItem --session "$sessionId")
  end
  if test -n "$role_arn"
    # Assume the AWS role using the provided credentials and token code.
    set -l creds (
      gum spin --title "Assuming profile $selectedProfile" -- aws sts assume-role \
        --role-arn "$role_arn" \
        --role-session-name "session" \
        --serial-number "$mfa_serial" \
        --token-code "$token_code" \
        --output json \
        --profile "$selectedProfile-source"
    )
    echo "$selectedProfile,,,$creds"
  else
    echo "Empty AWS CLI configs" >&2
    exit 1
  end
end

# Function to authenticate an AWS profile and set environment variables.
function authenticate_aws_profile
  set assume_role_result (assume_role)
  set splitted_result (string split ',,,' $assume_role_result)

  set credentials $splitted_result[2]
  set aws_access_key (echo $credentials | jq -r '.Credentials.AccessKeyId')
  set aws_secret_access_key (echo $credentials | jq -r '.Credentials.SecretAccessKey')
  set aws_session_token (echo $credentials | jq -r '.Credentials.SessionToken')

  set selectedProfile $splitted_result[1]
  set default_region (awk -v profile="$selectedProfile-source" '
      $0 ~ "\\\\[profile " profile "\\\\]" {found=1}
      found && /region/ {print $3; exit}
      /^$/ {found=0}
      ' ~/.aws/config)

  set -gx AWS_ACCESS_KEY_ID $aws_access_key
  set -gx AWS_SECRET_ACCESS_KEY $aws_secret_access_key
  set -gx AWS_SESSION_TOKEN $aws_session_token
  set -gx AWS_REGION $default_region

  echo "Authenticated AWS Profile: $selectedProfile. Now you can use AWS CLI commands."
end

# Function to start an SSM session with a selected EC2 instance.
function ssm_ec2_instances
  set assume_role_result (assume_role)
  set splitted_result (string split ',,,' $assume_role_result)

  set credentials $splitted_result[2]
  
  set selectedProfile $splitted_result[1]
  set default_region (awk -v profile="$selectedProfile-source" '
      $0 ~ "\\\\[profile " profile "\\\\]" {found=1}
      found && /region/ {print $3; exit}
      /^$/ {found=0}
      ' ~/.aws/config)

  set aws_access_key (echo $credentials | jq -r '.Credentials.AccessKeyId')
  set aws_secret_access_key (echo $credentials | jq -r '.Credentials.SecretAccessKey')
  set aws_session_token (echo $credentials | jq -r '.Credentials.SessionToken')
  set -gx AWS_ACCESS_KEY_ID $aws_access_key
  set -gx AWS_SECRET_ACCESS_KEY $aws_secret_access_key
  set -gx AWS_SESSION_TOKEN $aws_session_token

  set regions (gum spin --title "Loading regions..." -- aws ec2 describe-regions --region $default_region | jq -r '.Regions[].RegionName' | string match -v $default_region)
  set regions $default_region $regions
  set selectedRegion (echo $regions | string split " " | fzf --header "Select region" --cycle --ansi --layout=reverse --height=15)

  set selected_instance (
    gum spin --title "Loading instances..." -- aws ec2 describe-instances --region $selectedRegion --query 'Reservations[].Instances[?State.Name==`running`].[InstanceId, Tags[?Key==`Name`].Value | [0] || `NoName`]' --output json | 
      jq -r '.[][] | select(length > 0) | "\(.[0])(\(.[1]))"' | 
      string split "\n" | 
      fzf --header "Select instance" --cycle --ansi --layout=reverse --height=15
  )
  set selected_instance (string split '(' $selected_instance)[1]

  aws ssm start-session --target $selected_instance --region $selectedRegion
end

# Define available tasks for the user to select.
set tasks 'Authenticate AWS Profile\nSSM to EC2 instances'

# Use fzf to select a task interactively.
set selectedTask (echo $tasks | string split "\n" | fzf --header "Select task" --cycle --ansi --layout=reverse --height=15)

if test "$selectedTask" = "Authenticate AWS Profile"
    authenticate_aws_profile
else if test "$selectedTask" = "SSM to EC2 instances"
    ssm_ec2_instances
end
