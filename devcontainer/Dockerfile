FROM mcr.microsoft.com/devcontainers/base:2.1.3-debian13

WORKDIR /tmp

# Install fish && common dependencies
RUN echo 'deb http://download.opensuse.org/repositories/shells:/fish:/release:/4/Debian_Unstable/ /' \
      | sudo tee /etc/apt/sources.list.d/shells:fish:release:4.list && \
    curl -fsSL https://download.opensuse.org/repositories/shells:fish:release:4/Debian_Unstable/Release.key \
      | gpg --dearmor \
      | sudo tee /etc/apt/trusted.gpg.d/shells_fish_release_4.gpg > /dev/null && \
    apt update && \
    apt install python3 file zip unzip yamllint fish -y && \
    sudo chsh -s $(which fish) vscode && \
    rm -rf /var/lib/apt/lists/* && \
    groupadd -g 1001 ktran && \
    useradd -rm -d /home/ktran -s /usr/bin/fish -g root -G sudo -u 1001 ktran && \
    echo "ktran ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers

ENV RIPGREP_VERSION=15.1.0 \
    NEOVIM_VERSION=v0.11.6 \
    LAZYGIT_VERSION=0.58.0 \
    GIT_DELTA_VERSION=0.18.2 \
    FZF_VERSION=0.54.3 \
    EZA_VERSION=v0.23.4 \
    BAT_VERSION=v0.26.1 \
    SHFMT_VERSION=v3.12.0 \
    BUN_VERSION=v1.3.5 \
    YAMLFMT_VERSION=0.21.0 \
    OPENCODE_VERSION=v1.2.10 \
    GUM_VERSION=0.17.0 \
    TREESITTER_VERSION=0.26.5

RUN wget "https://github.com/BurntSushi/ripgrep/releases/download/${RIPGREP_VERSION}/ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl.tar.gz" -O ./ripgrep.tar.gz && \
    tar -xvf ripgrep.tar.gz && \
    mv ripgrep-${RIPGREP_VERSION}-x86_64-unknown-linux-musl/rg /usr/local/bin/rg && \
    wget https://github.com/neovim/neovim/releases/download/${NEOVIM_VERSION}/nvim-linux-x86_64.tar.gz -O ./nvim.tar.gz && \
    tar -xzf ./nvim.tar.gz && \
    mv nvim-linux-x86_64 /usr/local/share/nvim && \
    ln -sf /usr/local/share/nvim/bin/nvim /usr/local/bin/nvim && \
    wget https://github.com/jesseduffield/lazygit/releases/download/v${LAZYGIT_VERSION}/lazygit_${LAZYGIT_VERSION}_Linux_x86_64.tar.gz -O ./lazygit.tar.gz && \
    tar -xzf ./lazygit.tar.gz && \
    mv lazygit /usr/local/bin && \
    wget https://github.com/dandavison/delta/releases/download/${GIT_DELTA_VERSION}/delta-${GIT_DELTA_VERSION}-x86_64-unknown-linux-gnu.tar.gz -O delta.tar.gz && \
    tar -xzf delta.tar.gz && \
    mv delta-${GIT_DELTA_VERSION}-x86_64-unknown-linux-gnu/delta /usr/local/bin/delta && \
    curl -s https://ohmyposh.dev/install.sh | bash -s -- -d /usr/local/bin && \
    wget https://github.com/junegunn/fzf/releases/download/v${FZF_VERSION}/fzf-${FZF_VERSION}-linux_amd64.tar.gz -O ./fzf.tar.gz && \
    tar -xzf ./fzf.tar.gz && \
    mv fzf /usr/local/bin && \
    curl -sSfL https://raw.githubusercontent.com/ajeetdsouza/zoxide/main/install.sh | bash -s -- --bin-dir /usr/local/bin && \
    wget https://github.com/eza-community/eza/releases/download/${EZA_VERSION}/eza_x86_64-unknown-linux-gnu.zip -O ./eza.zip && \
    unzip ./eza.zip && \
    mv eza /usr/local/bin/eza && \
    wget https://github.com/sharkdp/bat/releases/download/${BAT_VERSION}/bat-${BAT_VERSION}-x86_64-unknown-linux-gnu.tar.gz -O ./bat.tar.gz && \
    tar -xzf ./bat.tar.gz && \
    mv bat-${BAT_VERSION}-x86_64-unknown-linux-gnu/bat /usr/local/bin/bat && \
    wget https://github.com/mvdan/sh/releases/download/${SHFMT_VERSION}/shfmt_${SHFMT_VERSION}_linux_amd64 -O /usr/local/bin/shfmt && \
    chmod +x /usr/local/bin/shfmt && \
    wget https://github.com/oven-sh/bun/releases/download/bun-${BUN_VERSION}/bun-linux-x64.zip -O ./bun.zip && \
    unzip ./bun.zip && \
    mv bun-linux-x64/bun /usr/local/bin && \
    bun install -g prettier && \
    wget https://github.com/google/yamlfmt/releases/download/v${YAMLFMT_VERSION}/yamlfmt_${YAMLFMT_VERSION}_Linux_x86_64.tar.gz -O ./yamlfmt.tar.gz && \
    tar -xzf ./yamlfmt.tar.gz && \
    mv yamlfmt /usr/local/bin && \
    wget https://github.com/anomalyco/opencode/releases/download/${OPENCODE_VERSION}/opencode-linux-x64.tar.gz && \
    tar xvf opencode-linux-x64.tar.gz && \
    mv opencode /usr/local/bin && \
    wget https://github.com/charmbracelet/gum/releases/download/v${GUM_VERSION}/gum_${GUM_VERSION}_Linux_x86_64.tar.gz -O ./gum.tar.gz && \
    tar -xzf ./gum.tar.gz && \
    mv gum_${GUM_VERSION}_Linux_x86_64/gum /usr/local/bin/gum && \
    wget https://github.com/tree-sitter/tree-sitter/releases/download/v${TREESITTER_VERSION}/tree-sitter-linux-x64.gz -O ./tree-sitter.gz && \
    gunzip ./tree-sitter.gz && \
    mv tree-sitter /usr/local/bin/tree-sitter && \
    chmod +x /usr/local/bin/tree-sitter && \
    rm -rf /tmp/*
