#!/usr/bin/env fish

# Script to connect to databases using credentials from Bitwarden or manual input
# Supports PostgreSQL and MySQL connections
# Sets environment variables with connection strings for each database
#
# Requirements:
# - fzf: for interactive selection
# - gum: for spinners and password input
# - jq: for JSON parsing
# - bw (Bitwarden CLI): for credential management
# - psql/mysql: database clients
#
# Environment variables created:
# DB_URI_<DATABASE_NAME>: Connection string for each database found
#
# Example output:
# DB_URI_MYAPP=postgres://user:pass@host:5432/myapp
#
# Usage:
# 1. Run the script: ./connect-db.fish
# 2. Choose whether to use SSH tunnel
# 3. Select database type (postgres/mysql)
# 4. Choose credentials source (bitwarden/manual)
# 5. Follow prompts to enter or select credentials
# 6. Environment variables will be set for all databases found

#=========================Functions=========================
# Prompts user to manually enter database connection credentials
# Returns: connection_name, uri, host, port, username, password as newline-separated string
function get_manual_credentials
    set -l connection_name (gum input --placeholder "Connection name" --header "Enter connection name")
    set -l host (gum input --placeholder "hostname" --header "Enter host")
    set -l port (gum input --placeholder "5432" --header "Enter port")
    set -l username (gum input --placeholder "username" --header "Enter username")
    set -l password (gum input --password --header "Enter password")
    set -l uri "$host:$port"

    echo "$connection_name\n$uri\n$host\n$port\n$username\n$password"
end

# Get database names from server based on database type
# Retrieves list of database names from server
# Handles SSH tunneling if ssh_host is provided
# Args:
#   $1: Database type (postgres/mysql)
#   $2: Host
#   $3: Port
#   $4: Username
#   $5: Password
#   $6: SSH host (optional)
# Returns: Space-separated list of database names
function get_database_names
    set -l dbType $argv[1]
    set -l host $argv[2]
    set -l port $argv[3]
    set -l username $argv[4]
    set -l password $argv[5]
    set -l ssh_host $argv[6]

    echo "Loading database names" >&2
    echo "ssh_host: $ssh_host" >&2
    echo "host: $host" >&2
    echo "port: $port" >&2
    
    # Generate random local port and check if it's available
    set -l local_port (math (random) + 10000)
    set -l max_attempts 10
    set -l attempt 1
    
    while command lsof -i :$local_port >/dev/null 2>&1
        set local_port (math (random) + 10000)
        set attempt (math $attempt + 1)
        if test $attempt -gt $max_attempts
            echo "Error: Could not find an available local port after $max_attempts attempts"
            return 1
        end
    end
    
    if [ -n "$ssh_host" ]
        echo "Turning on SSH Tunnel with port $local_port to $ssh_host" >&2
        # Start SSH tunnel in background
        ssh -f -N -L $local_port:$host:$port $ssh_host
        set -l tunnel_pid (ps aux | grep "ssh.*$local_port:$host:$port" | grep -v grep | awk '{print $2}')
        
        # Update host and port to use local tunnel
        set host "127.0.0.1"
        set port "$local_port"
    end
    
    if [ "$dbType" = "postgres" ]
        set -l result (PGPASSWORD="$password" psql --host $host --port $port --username $username --dbname postgres --command 'SELECT datname FROM pg_catalog.pg_database' --no-align --tuples-only)
        echo $result
    else if [ "$dbType" = "mysql" ]
        set -l result (mysql -h $host -P $port -u $username -p"$password" -e 'SHOW DATABASES' --silent --raw)
        echo $result
    end
    
    # Kill SSH tunnel if it exists
    if [ -n "$ssh_host" -a -n "$tunnel_pid" ]
        kill $tunnel_pid
    end
end

# Get SSH hosts from config file if it exists
# Extracts SSH host names from ~/.ssh/config file
# Returns: List of SSH host names (excluding wildcards)
function get_ssh_hosts
    if test -f $HOME/.ssh/config
        grep -i '^Host ' $HOME/.ssh/config | awk '{print $2}' | grep -v '*'
    end
end

# Retrieves database credentials from Bitwarden vault
# Unlocks vault and lets user select credential entry
# Returns: connection_name, uri, host, port, username, password as newline-separated string
function get_bitwarden_credentials
    # First unlock Bitwarden vault and retrieve the session ID
    set -l sessionId (bw unlock | grep -Eo 'BW_SESSION="[^"]+"' | cut -d '"' -f 2 | head -n 1)

    set -l bwItems (gum spin --title "Loading Bitwarden items" -- bw list items --session "$sessionId")
    # Get list of database credentials from Bitwarden and let user select one
    set -l selectedBwItem (
        echo $bwItems | 
        jq -r '.[].name' | 
        fzf --header "Select bitwarden item" --cycle --ansi --layout=reverse --height=15
    )

    set -l dbCredentials (gum spin --title "Loading credentials" -- bw get item $selectedBwItem --session "$sessionId")

    set -l connection_name (echo $dbCredentials | jq -r '.name')
    set -l uri (echo $dbCredentials | jq -r '.login.uris[0].uri')
    set -l host (echo $uri | cut -d ':' -f 1)
    set -l port (echo $uri | cut -d ':' -f 2)
    set -l username (echo $dbCredentials | jq -r '.login.username')
    set -l password (echo $dbCredentials | jq -r '.login.password')

    if [ "$password" = "null" ]
        set password (gum input --password --header "Enter password")
    end

    echo "$connection_name\n$uri\n$host\n$port\n$username\n$password"
end

#=========================Main Process=========================
# Let user select SSH host if they want to use SSH tunnel
set -l use_ssh (gum confirm "Use SSH tunnel?" && echo "yes" || echo "no")
set -l ssh_host ""

if [ "$use_ssh" = "yes" ]
    set -l ssh_hosts (get_ssh_hosts)
    if [ -z "$ssh_hosts" ]
        echo "No SSH hosts found in $HOME/.ssh/config"
        exit 1
    end
    
    set ssh_host (
        echo $ssh_hosts |
        string split " " |
        fzf --header "Select SSH host" --cycle --ansi --layout=reverse --height=15
    )
    
    if [ -z "$ssh_host" ]
        echo "No SSH host selected"
        exit 1
    end
end

# Define supported database types
set -l dbTypes 'postgres' 'mysql'
set -l selectedDbType (echo $dbTypes | string split " " | fzf --header "Select DB type" --cycle --ansi --layout=reverse --height=15)

# Define available credential sources
set -l dbCredentialsSources 'bitwarden' 'manual'
set -l selectedDbCredentialsSource (
  echo $dbCredentialsSources | 
  string split " " | 
  fzf --header "Select DB credentials source" --cycle --ansi --layout=reverse --height=15
)

# Get credentials based on selected source
set -l creds
if [ "$selectedDbCredentialsSource" = "bitwarden" ]
    set creds (get_bitwarden_credentials)
else
    set creds (get_manual_credentials)
end

set -l cred_array (string split '\n' $creds)
set -l connection_name $cred_array[1]
set -l uri $cred_array[2]
set -l host $cred_array[3]
set -l port $cred_array[4]
set -l username $cred_array[5]
set -l password $cred_array[6]

# Get list of databases from server and split into array
set -l database_names (get_database_names "$selectedDbType" "$host" "$port" "$username" "$password" "$ssh_host" | string split " ")

# Create connection string prefix with credentials
set -l prefix_db_uri "$selectedDbType://$username:$password@$uri"

# Generate environment variables for each database
for database_name in $database_names
  # Skip template databases, system databases and empty lines
  if [ "$database_name" = "template0" -o \
       "$database_name" = "template1" -o \
       "$database_name" = "information_schema" -o \
       "$database_name" = "performance_schema" -o \
       "$database_name" = "mysql" -o \
       "$database_name" = "sys" -o \
       "$database_name" = "" ]
    continue
  end
  
  # Sanitize database name for variable name (remove special chars, convert to uppercase)
  set -l sanitized_name (echo $database_name | string upper | string replace -a -r '[^A-Z0-9_]' '_')
  
  # Set global variable with format DB_URI_DBNAME
  if [ "$use_ssh" = "yes" ]
    set -gx DB_UI_$sanitized_name "ssh://$ssh_host:$prefix_db_uri/$database_name"
  else
    set -gx DB_UI_$sanitized_name "$prefix_db_uri/$database_name"
  end
end
