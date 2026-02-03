function add-keys-ssh-agent
    # Unlock Bitwarden and export the session for bw CLI
    set -lx BW_SESSION (bw unlock --raw)

    # Get the folder id for the "SSH keys" folder
    set -l FOLDER_ID (bw list folders --search "SSH keys" | jq -r '.[0].id')

    # Stream each private key (encoded by jq as base64), decode and add to ssh-agent
    bw list items --folderid $FOLDER_ID | jq -r '.[].sshKey.privateKey | @base64' | while read b64
        printf '%s' "$b64" | base64 -d | ssh-add -
    end

    set -e BW_SESSION
end
