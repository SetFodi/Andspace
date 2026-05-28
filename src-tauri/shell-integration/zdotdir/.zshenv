# AndSpace zsh env bootstrap (ZDOTDIR). User ~/.zshenv is not read when ZDOTDIR is set.
[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

if [[ -f "$HOME/.zshenv" ]]; then
  source "$HOME/.zshenv"
fi
