# AndSpace zsh env bootstrap (ZDOTDIR). User ~/.zshenv is not read when ZDOTDIR is set.
[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

export ZSH_COMPDUMP="${TMPDIR:-/tmp}/andspace-zcompdump-${PPID:-$$}"
export HISTFILE="${TMPDIR:-/tmp}/andspace-zsh-history-${PPID:-$$}"

if [[ -f "$HOME/.zshenv" ]]; then
  source "$HOME/.zshenv"
fi
