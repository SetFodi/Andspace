# AndSpace zsh bootstrap — loaded via ZDOTDIR on PTY spawn only.
# Does not modify the user's ~/.zshrc on disk.

[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0

if [[ "${ANDSPACE_SHELL_PROFILE:-user-shell}" == "managed-zsh" ]]; then
  setopt prompt_subst
  setopt auto_cd
  setopt auto_pushd
  setopt pushd_ignore_dups
  setopt hist_ignore_dups
  setopt hist_ignore_space
  setopt share_history

  autoload -Uz compinit 2>/dev/null
  compinit -d "$ZSH_COMPDUMP" 2>/dev/null

  __andspace_brew_prefix="${ANDSPACE_HOMEBREW_PREFIX:-}"
  if [[ -z "$__andspace_brew_prefix" ]]; then
    if command -v brew >/dev/null 2>&1; then
      __andspace_brew_prefix="$(brew --prefix 2>/dev/null)"
    elif [[ -d /opt/homebrew ]]; then
      __andspace_brew_prefix="/opt/homebrew"
    elif [[ -d /usr/local ]]; then
      __andspace_brew_prefix="/usr/local"
    fi
  fi

  if command -v zoxide >/dev/null 2>&1; then
    eval "$(zoxide init zsh)"
  fi

  if [[ -n "$__andspace_brew_prefix" ]]; then
    [[ -f "$__andspace_brew_prefix/share/zsh-autosuggestions/zsh-autosuggestions.zsh" ]] && \
      source "$__andspace_brew_prefix/share/zsh-autosuggestions/zsh-autosuggestions.zsh"
    [[ -f "$__andspace_brew_prefix/opt/fzf/shell/completion.zsh" ]] && \
      source "$__andspace_brew_prefix/opt/fzf/shell/completion.zsh"
    [[ -f "$__andspace_brew_prefix/opt/fzf/shell/key-bindings.zsh" ]] && \
      source "$__andspace_brew_prefix/opt/fzf/shell/key-bindings.zsh"
  fi

  if command -v eza >/dev/null 2>&1; then
    alias ls='eza --icons --color=always --group-directories-first -lh'
    alias ll='eza --icons --color=always --group-directories-first -lah'
    alias la='eza --icons --color=always --group-directories-first -a'
  else
    alias ll='ls -lah'
    alias la='ls -a'
  fi
  if command -v nvim >/dev/null 2>&1; then
    alias vim='nvim'
  fi

  autoload -Uz vcs_info add-zsh-hook 2>/dev/null
  zstyle ':vcs_info:git:*' formats ' git:(%F{red}%b%f)'
  __andspace_managed_prompt_precmd() {
    vcs_info 2>/dev/null
  }
  add-zsh-hook precmd __andspace_managed_prompt_precmd 2>/dev/null
  PROMPT='%F{green}➜%f  %F{cyan}%1~%f${vcs_info_msg_0_} %F{yellow}%#%f '
  RPROMPT=''

  if [[ -n "$__andspace_brew_prefix" && -f "$__andspace_brew_prefix/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh" ]]; then
    source "$__andspace_brew_prefix/share/zsh-syntax-highlighting/zsh-syntax-highlighting.zsh"
  fi

  unset __andspace_brew_prefix
elif [[ -f "$HOME/.zshrc" ]]; then
  source "$HOME/.zshrc"
fi

if [[ -n "$ANDSPACE_ZSH_INTEGRATION" && -f "$ANDSPACE_ZSH_INTEGRATION" ]]; then
  source "$ANDSPACE_ZSH_INTEGRATION"
fi
