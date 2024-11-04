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

# TODO: ssh tunnel
# TODO: mysql

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

if [ "$selectedDbCredentialsSource" = "bitwarden" ]
  # Use Bitwarden as credentials source
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

  # Query the database server to get list of available databases
  echo "Loading database names"
  
  set -l database_names ""
  if [ "$selectedDbType" = "postgres" ]
    set database_names (PGPASSWORD="$password" psql --host $host --port $port --username $username --dbname postgres  --command 'SELECT datname FROM pg_catalog.pg_database' --no-align --tuples-only)
  else if [ "$selectedDbType" = "mysql" ]
    set database_names (mysql -h $host -P $port -u $username -p"$password" -e 'SHOW DATABASES' --silent --raw)
  end

  # Create connection string prefix with credentials
  set -l prefix_db_uri "$selectedDbType://$username:$password@$uri"

  # Generate environment variables for each database
  for database_name in $database_names
    # Skip template databases and empty lines
    if [ "$database_name" = "template0" -o "$database_name" = "template1" -o "$database_name" = "" ]
      continue
    end
    
    # Sanitize database name for variable name (remove special chars, convert to uppercase)
    set -l sanitized_name (echo $database_name | string upper | string replace -a -r '[^A-Z0-9_]' '_')
    
    # Set global variable with format DB_URI_DBNAME
    set -gx DB_UI_$sanitized_name "$prefix_db_uri/$database_name"
  end
end
