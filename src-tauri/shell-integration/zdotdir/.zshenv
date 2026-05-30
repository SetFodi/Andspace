# AndSpace zsh env bootstrap (ZDOTDIR). User ~/.zshenv is not read when ZDOTDIR is set.
[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

export ZSH_COMPDUMP="${TMPDIR:-/tmp}/andspace-zcompdump-${PPID:-$$}"
export HISTFILE="${TMPDIR:-/tmp}/andspace-zsh-history-${PPID:-$$}"

if [[ "${ANDSPACE_SHELL_PROFILE:-user-shell}" == "managed-zsh" ]]; then
  __andspace_brew_prefix="${ANDSPACE_HOMEBREW_PREFIX:-}"
  if [[ -z "$__andspace_brew_prefix" ]]; then
    if [[ -d /opt/homebrew/bin ]]; then
      __andspace_brew_prefix="/opt/homebrew"
    elif [[ -d /usr/local/bin ]]; then
      __andspace_brew_prefix="/usr/local"
    fi
  fi

  if [[ -n "$__andspace_brew_prefix" ]]; then
    export PATH="$__andspace_brew_prefix/bin:$__andspace_brew_prefix/sbin:$PATH"
  fi
  export PATH="$HOME/.local/bin:$HOME/bin:$HOME/.bun/bin:$HOME/.cargo/bin:$HOME/.volta/bin:$PATH"
  unset __andspace_brew_prefix
elif [[ -f "$HOME/.zshenv" ]]; then
  source "$HOME/.zshenv"
fi
