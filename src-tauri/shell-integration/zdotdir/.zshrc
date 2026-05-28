# AndSpace zsh bootstrap — loaded via ZDOTDIR on PTY spawn only.
# Does not modify the user's ~/.zshrc on disk.

[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

if [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc"
fi

if [[ -n "$ANDSPACE_ZSH_INTEGRATION" && -f "$ANDSPACE_ZSH_INTEGRATION" ]]; then
  source "$ANDSPACE_ZSH_INTEGRATION"
fi
