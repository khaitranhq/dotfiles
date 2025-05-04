# My dotfiles

## TL;DR

- OS: Ubuntu 22.04
- DE: XFCE4

## Installation (after installing Ubuntu)

### Upgrade system

```bash
sudo apt update
sudo apt upgrade -y
```

### Install fonts

```bash
sudo apt install fonts-noto fonts-noto-color-emoji fonts-symbola fontconfig build-essential
```

### Browser

- Install [ Brave ](https://brave.com/vi/download/)

### Install terminal

- Install [ kitty ](https://sw.kovidgoyal.net/kitty/binary/#install-kitty)

### Install tools

```bash
# Oh my posh
curl -s https://ohmyposh.dev/install.sh | bash -s

# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# zoxide
curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | sh

# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# fd-find
cargo install fd-find

# ripgrep
cargo install ripgrep

# bat
cargo install --locked bat

# eza
cargo install eza

# lazydocker
go install github.com/jesseduffield/lazydocker@latest

# lazygit
go install github.com/jesseduffield/lazygit@latest

# fzf
# Check latest version: https://github.com/junegunn/fzf/releases
VERSION=""
wget https://github.com/junegunn/fzf/releases/download/v${VERSION}/fzf-${VERSION}-linux_amd64.tar.gz
tar -xzf fzf-${VERSION}-linux_amd64.tar.gz
sudo mv fzf $HOME/.local/bin/
rm fzf-${VERSION}-linux_amd64.tar.gz

# tmux
sudo apt install -y libevent-dev ncurses-dev build-essential bison pkg-config aclocal automake
cd $HOME/.local/share
git clone https://github.com/tmux/tmux.git
sh autogen.sh
./configure --prefix=$HOME/.local
make && make install

# tpm
git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"

# kubectx
wget https://raw.githubusercontent.com/ahmetb/kubectx/refs/heads/master/kubectx

# k9s
# Download latest version .db file from https://github.com/derailed/k9s/releases
```

### Install fish

```bash
sudo add-apt-repository ppa:fish-shell/release-4
sudo apt update
sudo apt install fish -y

# Make fish the default shell
chsh -s $(which fish)

# Install fisher
curl -sL https://raw.githubusercontent.com/jorgebucaran/fisher/main/functions/fisher.fish | source && fisher install jorgebucaran/fisher
```

Then use `install.sh` to configure `fish`.

> Note
> Create an `ai.fish` file with the following format to run `opencommit`
>
> ```fish
> set -x ANTHROPIC_API_KEY ""
> set -x OPENAI_API_KEY ""
> ```

### Development environment

- Node
  - Install [nvm](https://github.com/nvm-sh/nvm?tab=readme-ov-file#install--update-script)
  - Install [ nvm.fish ](https://github.com/jorgebucaran/nvm.fish)
  - Install LTS version: `nvm install <version>` (check LTS version [here](https://nodejs.org/en/download))
  - Update `path` config in `config.fish` (if needed)
  - Install global packages: `npm i -g yarn pnpm opencommit eslint prettier neovim`
- Python (default 3.10)
  - Install some apt packages: `sudo apt install python3-pip python3-venv`
  - Install some packages: `pip install --upgrade pipx`
- Golang:

```bash
export VERSION="<version>"
wget https://go.dev/dl/go${VERSION}.24.2.linux-amd64.tar.gz
tar -C $HOME/.local/share -xzf go${VERSION}.24.2.linux-amd64.tar.gz
mv $HOME/.local/share/go${VERSION} $HOME/.local/share/go
ln -sf $HOME/.local/share/go/bin/go $HOME/.local/bin/go
ln -sf $HOME/.local/share/go/bin/gofmt $HOME/.local/bin/gofmt
```

- Dotnet

```bash
wget https://dot.net/v1/dotnet-install.sh
chmod +x ./dotnet-install.sh
mkdir -p $HOME/.local/share/dotnet
# Check latest version 9 here: https://dotnet.microsoft.com/en-us/download/dotnet/9.0
./dotnet-install.sh --install-dir $HOME/.local/share/dotnet --version "9..."

# Optional
# Check latest version 8 here: https://dotnet.microsoft.com/en-us/download/dotnet/8.0
./dotnet-install.sh --install-dir $HOME/.local/share/dotnet --version "8..."

ln -sf $HOME/.local/share/dotnet/dotnet $HOME/.local/bin/dotnet
```

### Install Neovim

```bash
export VERSION="<version>"
wget https://github.com/neovim/neovim/releases/download/v${VERSION}/nvim-win64.zip
unzip nvim-win64.zip
mv nvim-win64 $HOME/.local/share/nvim
ln -sf $HOME/.local/share/nvim/bin/nvim $HOME/.local/bin/nvim
nvim
```

- `keyd` for remapping keys
- Using [script](https://github.com/khaitranhq/swap-xfce-workspaces) to swap workspaces on XFCE
- XFCE Plugins
  - Generic monitor with [scripts](https://github.com/xtonousou/xfce4-genmon-scripts)
- Required package: `libpango1.0-0`
- Uninstall incompatible packages: `sudo apt remove ayatana-indicator-application ayatana-indicator-common`
- Font: `Firacode Nerd Font` (additional dependencies: `sudo apt install fonts-noto fonts-noto-color-emoji fonts-symbola fontconfig`)
- `playctl` for controlling music players

### Centralized Notification

- Slack

### Utilities

- Ulauncher
- CopyQ
- Datagrip
- Pgcli
- MyCLI
- Remmina

### Email client

- Thunderbird
- BirdTray

#### Install Birdtray

```bash
sudo apt install -y qt6-tools-dev cmake qt6-base-dev qt6-base-dev-tools libglx-dev libgl1-mesa-dev libqt6svg6-dev qt6-l10n-tools libx11-xcb-dev
git clone https://github.com/gyunaev/birdtray.git
mkdir build

cd build
cmake -DCMAKE_BUILD_TYPE=Release ..
cmake --build .
```
