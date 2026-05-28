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

__andspace_guard_now_ms() {
  printf '%s000' "$(date +%s)"
}

__andspace_guard_trim() {
  emulate -L zsh
  setopt extended_glob
  local value="$1"
  value="${value##[[:space:]]#}"
  value="${value%%[[:space:]]#}"
  printf '%s' "$value"
}

__andspace_guard_log_value() {
  local value="$1"
  value="${value//$'\n'/\\n}"
  printf '%s' "$value"
}

__andspace_guard_log() {
  local decision="$1"
  local severity="$2"
  local matched_rule="$3"
  local matched_source="$4"
  local matched_pattern_type="$5"
  local command="$6"
  local action="$7"
  local pane="${ANDSPACE_PANE_ID:-unknown}"
  local line="$(__andspace_guard_now_ms) command-guard-preexec pane=$pane cwd=$(__andspace_guard_log_value "$PWD") matcher_impl=zsh decision=$decision severity=$severity"

  if [[ -n "$matched_rule" ]]; then
    line+=" matched_rule=$(__andspace_guard_log_value "$matched_rule")"
  fi
  if [[ -n "$matched_source" ]]; then
    line+=" matched_source=$matched_source"
  fi
  if [[ -n "$matched_pattern_type" ]]; then
    line+=" matched_pattern_type=$matched_pattern_type"
  fi

  line+=" command=$(__andspace_guard_log_value "$command") action=$action"
  print -r -- "$line" >> /tmp/andspace-diag.log 2>/dev/null
}

__andspace_guard_add_rule() {
  local bucket="$1"
  local pattern="$(__andspace_guard_trim "$2")"
  local matcher="$3"
  local source="$4"
  local entry="${pattern}"$'\t'"${matcher}"$'\t'"${source}"

  [[ -n "$pattern" ]] || return 0

  case "$bucket" in
    allowed) __andspace_guard_allowed+=("$entry") ;;
    dangerous) __andspace_guard_dangerous+=("$entry") ;;
    protected) __andspace_guard_protected+=("$entry") ;;
  esac
}

__andspace_guard_parse_file() {
  emulate -L zsh
  setopt extended_glob

  local file="$1"
  local source="$2"
  local section=""
  local line trimmed title item matcher pattern

  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    trimmed="$(__andspace_guard_trim "$line")"

    if [[ "$trimmed" == '## '* && "$trimmed" != '###'* ]]; then
      title="${trimmed#'## '}"
      while [[ "$title" == *'#' ]]; do
        title="${title%#}"
      done
      title="$(__andspace_guard_trim "$title")"
      case "${(L)title}" in
        "protected commands") section="protected" ;;
        "dangerous commands") section="dangerous" ;;
        "allowed") section="allowed" ;;
        *) section="" ;;
      esac
      continue
    fi

    [[ -n "$section" ]] || continue

    case "$trimmed" in
      "- "*) item="${trimmed#- }" ;;
      "\* "*) item="${trimmed#\* }" ;;
      "+ "*) item="${trimmed#\+ }" ;;
      *) continue ;;
    esac

    item="${item%%\#*}"
    item="$(__andspace_guard_trim "$item")"
    [[ -n "$item" ]] || continue

    matcher="substring"
    pattern="$item"
    if [[ "${item[1]}" == "/" && "${item[-1]}" == "/" && ${#item} -gt 2 ]]; then
      matcher="regex"
      pattern="${item[2,-2]}"
    fi

    __andspace_guard_add_rule "$section" "$pattern" "$matcher" "$source"
  done < "$file"
}

__andspace_guard_load_rules() {
  typeset -ga __andspace_guard_allowed=()
  typeset -ga __andspace_guard_dangerous=()
  typeset -ga __andspace_guard_protected=()

  __andspace_guard_parse_file "$PWD/ANDSPACE.md" "project"
  __andspace_guard_parse_file "$HOME/.andspace/rules.md" "user"

  local pattern
  for pattern in \
    "git push --force" \
    "git push -f" \
    "sudo" \
    "npm publish" \
    "pnpm publish" \
    "yarn publish" \
    "vercel --prod" \
    "supabase db push" \
    "pm2 restart"; do
    __andspace_guard_add_rule "protected" "$pattern" "substring" "builtin"
  done

  for pattern in "rm -rf /" "DROP TABLE" "dropdb"; do
    __andspace_guard_add_rule "dangerous" "$pattern" "substring" "builtin"
  done
}

__andspace_guard_match_bucket() {
  local command="$1"
  shift
  local entry pattern zsh_pattern matcher source
  local -a parts

  for entry in "$@"; do
    parts=("${(@ps:\t:)entry}")
    pattern="${parts[1]}"
    matcher="${parts[2]}"
    source="${parts[3]}"

    if [[ "$matcher" == "regex" ]]; then
      zsh_pattern="${pattern//\\s/[[:space:]]}"
      if [[ "$command" =~ $zsh_pattern ]] 2>/dev/null; then
        print -r -- "$entry"
        return 0
      fi
    elif [[ "$command" == *"$pattern"* ]]; then
      print -r -- "$entry"
      return 0
    fi
  done

  return 1
}

__andspace_guard_evaluate() {
  local command="$1"
  local match pattern matcher source
  local -a parts

  __andspace_guard_load_rules

  if match="$(__andspace_guard_match_bucket "$command" "${__andspace_guard_allowed[@]}")"; then
    parts=("${(@ps:\t:)match}")
    print -r -- "allowed"$'\t'"none"$'\t'"${parts[1]}"$'\t'"${parts[3]}"$'\t'"${parts[2]}"
    return 0
  fi

  if match="$(__andspace_guard_match_bucket "$command" "${__andspace_guard_dangerous[@]}")"; then
    parts=("${(@ps:\t:)match}")
    print -r -- "dangerous"$'\t'"type-to-confirm"$'\t'"${parts[1]}"$'\t'"${parts[3]}"$'\t'"${parts[2]}"
    return 0
  fi

  if match="$(__andspace_guard_match_bucket "$command" "${__andspace_guard_protected[@]}")"; then
    parts=("${(@ps:\t:)match}")
    print -r -- "protected"$'\t'"confirm"$'\t'"${parts[1]}"$'\t'"${parts[3]}"$'\t'"${parts[2]}"
    return 0
  fi

  print -r -- "safe"$'\t'"none"$'\t'$'\t'$'\t'
}

__andspace_guard_prompt() {
  local decision="$1"
  local matched_rule="$2"
  local reply

  zle -I
  if [[ "$decision" == "protected" ]]; then
    printf '\nAndSpace protected command: %s. Run once? [y/N] ' "$matched_rule" > /dev/tty
    IFS= read -r reply < /dev/tty
    [[ "${(L)reply}" == "y" ]]
    return $?
  fi

  if [[ "$decision" == "dangerous" ]]; then
    printf '\nAndSpace dangerous command: %s. Type run to continue: ' "$matched_rule" > /dev/tty
    IFS= read -r reply < /dev/tty
    [[ "$reply" == "run" ]]
    return $?
  fi

  return 0
}

__andspace_accept_line() {
  local command="$BUFFER"
  local result decision severity matched_rule matched_source matched_pattern_type action
  local -a parts

  result="$(__andspace_guard_evaluate "$command")"
  parts=("${(@ps:\t:)result}")
  decision="${parts[1]}"
  severity="${parts[2]}"
  matched_rule="${parts[3]}"
  matched_source="${parts[4]}"
  matched_pattern_type="${parts[5]}"

  if [[ "$decision" == "protected" || "$decision" == "dangerous" ]]; then
    if __andspace_guard_prompt "$decision" "$matched_rule"; then
      action="run"
      __andspace_guard_log "$decision" "$severity" "$matched_rule" "$matched_source" "$matched_pattern_type" "$command" "$action"
      zle __andspace_orig_accept_line
      return $?
    fi

    action="cancel"
    __andspace_guard_log "$decision" "$severity" "$matched_rule" "$matched_source" "$matched_pattern_type" "$command" "$action"
    BUFFER=""
    print -r -- "AndSpace canceled command." > /dev/tty
    zle reset-prompt
    return 0
  fi

  action="run"
  __andspace_guard_log "$decision" "$severity" "$matched_rule" "$matched_source" "$matched_pattern_type" "$command" "$action"
  zle __andspace_orig_accept_line
}

if [[ -o interactive ]]; then
  autoload -Uz add-zsh-hook 2>/dev/null
  add-zsh-hook precmd __andspace_precmd
  add-zsh-hook preexec __andspace_preexec

  if [[ -z "$__andspace_accept_line_installed" ]]; then
    zle -A accept-line __andspace_orig_accept_line
    zle -N accept-line __andspace_accept_line
    __andspace_accept_line_installed=1
  fi
fi
