#!/bin/bash

stow zsh
# mkdir -p ~/.config/fish && stow fish
mkdir -p ~/.config/nvim && stow nvim
mkdir -p ~/.config/ohmyposh && stow ohmyposh
stow tmux
mkdir -p ~/.config/eza && stow eza
mkdir -p ~/.config/lazygit && stow lazygit
mkdir -p ~/.config/Agent && stow AgentCrew
mkdir -p ~/.config/yamlfmt && stow yamlfmt
