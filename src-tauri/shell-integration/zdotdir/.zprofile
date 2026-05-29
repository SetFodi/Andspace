# AndSpace zsh login bootstrap — loaded via ZDOTDIR on PTY spawn only.
# This mirrors a normal macOS terminal login shell while keeping AndSpace's
# shell integration isolated from the user's dotfiles on disk.

[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

if [[ -f "$HOME/.zprofile" ]]; then
  source "$HOME/.zprofile"
fi
