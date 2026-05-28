# AndSpace zsh shell integration — OSC lifecycle for v0.1
# Auto-loaded via ZDOTDIR bootstrap when spawned from AndSpace (see zdotdir/.zshrc).

[[ "$TERM_PROGRAM" == "AndSpace" ]] || return 0
[[ -n "$ANDSPACE_SHELL_INTEGRATION" || -n "$ANDSPACE_ZSH_INTEGRATION" ]] || return 0

__andspace_osc() {
  printf '\033]9001;%s\033\\' "$1"
}

__andspace_b64() {
  printf '%s' "$1" | /usr/bin/base64 | /usr/bin/tr -d '\n'
}

__andspace_emit_cwd() {
  local host="${HOST:-localhost}"
  local path="$PWD"
  printf '\033]7;file://%s%s\033\\' "$host" "$path"
  __andspace_osc "cwd|$(__andspace_b64 "$path")"
}

__andspace_precmd() {
  local ec=$?
  if [[ -n "$__andspace_cmd_running" ]]; then
    __andspace_osc "end|${ec}|$(date +%s)"
    unset __andspace_cmd_running
  fi
  __andspace_emit_cwd
}

__andspace_preexec() {
  local cmd="$1"
  __andspace_cmd_running=1
  __andspace_osc "start|$(date +%s)"
  __andspace_osc "cmd|$(__andspace_b64 "$cmd")"
}

if [[ -o interactive ]]; then
  autoload -Uz add-zsh-hook 2>/dev/null
  add-zsh-hook precmd __andspace_precmd
  add-zsh-hook preexec __andspace_preexec
fi
