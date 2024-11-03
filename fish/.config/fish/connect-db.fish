#!/usr/bin/env fish

# Script to connect to databases using credentials from Bitwarden or manual input
# Supports PostgreSQL and MySQL connections
# Sets environment variables with connection strings for each database

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

  if [ "$selectedDbType" = "postgres" ]
    # For PostgreSQL, fetch all database names and create connection strings
    # Sets environment variables in format DB_URI_DBNAME for each database
    echo "Loading database names"
    set -l database_names (PGPASSWORD="$password" psql --host $host --port $port --username $username --dbname postgres  --command 'SELECT datname FROM pg_catalog.pg_database' --no-align --tuples-only)

    set -l prefix_db_uri "$selectedDbType://$username:$password@$uri"
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

  if [ "$selectedDbType" = "mysql" ]
    # For MySQL, set a single connection string and database name
    # Sets DATABASE_NAME and DATABASE_URL environment variables
    set -gx DATABASE_NAME "$connection_name"
    set -gx DATABASE_URL "$selectedDbType://$username:$password@$uri"
  end
end
