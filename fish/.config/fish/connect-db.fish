#!/usr/bin/env fish

set -l dbTypes 'mysql' 'postgres'
set -l selectedDbType (gum choose --header "Select DB type" $dbTypes)

if [ "$selectedDbType" = "mysql" ]
  set -l dnsList (mycli --list-dsn | awk -F: '{ print $1 }')
  set -l selectedDsn (gum choose --header "Select DSN" $dnsList | string trim)

  set -l sessionId (bw unlock | grep -Eo 'BW_SESSION="[^"]+"' | cut -d '"' -f 2 | head -n 1)
  set -l bwItems (gum spin --title "Loading Bitwarden items" -- bw list items --session "$sessionId")
  set -l selectedBwItem (echo $bwItems | jq -r '.[].name' | fzf --cycle --ansi --layout=reverse)
  set -l password (gum spin --title "Loading password" -- bw get password $selectedBwItem --session "$sessionId")

  set -l isUsingSshTunnel (gum confirm "Using SSH tunnel?" && echo "yes" || echo "no")
  if [ "$isUsingSshTunnel" = "yes" ]
    set -l selectedSshTunnel (cat ~/.ssh/config | grep "^Host" | awk '{ print $2 }' | gum choose)
    mycli --password $password -d $selectedDsn --ssh-config-host $selectedSshTunnel
  else
    mycli --password $password -d $selectedDsn
  end
else if [ "$selectedDbType" = "postgres" ]
  set -l dnsList (pgcli --list-dsn | awk -F: '{ print $1 }')
  set -l selectedDsn (gum choose --header "Select DSN" $dnsList | string trim)

  pgcli -D $selectedDsn
end
