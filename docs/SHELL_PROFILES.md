# Shell Profiles

AndSpace is zsh-first today, but users do not all have the same shell setup.
The first-run onboarding and Preferences modal provide a shell profile choice so
new users can start with a reliable default without overwriting their dotfiles.

## Profiles

| Profile | Use case |
| --- | --- |
| Managed zsh profile | Recommended for new users or users with broken/noisy shell configs. |
| Use my shell config | Recommended for advanced users who already maintain their own shell setup. |
| Custom shell path | For users who want AndSpace to launch a specific shell executable. |

## Managed zsh Profile

The managed profile:

- starts `/bin/zsh`;
- uses an AndSpace-owned `ZDOTDIR`;
- loads AndSpace shell integration and Command Guard;
- provides a clean prompt with cwd and Git branch;
- enables `zoxide`, autosuggestions, syntax highlighting, `fzf`, and `eza`
  when those tools are installed;
- does not source the user's `~/.zshrc`, `~/.zprofile`, or `~/.zshenv`;
- does not modify personal shell files.

The managed profile is intentionally portable. It borrows the useful workflow
ideas from a good local zsh setup without copying personal aliases, private
paths, project-specific exports, or secrets.

## Recommended Tools

When the managed profile is selected, Preferences shows recommended shell tools:

- `zoxide`
- `zsh-autosuggestions`
- `zsh-syntax-highlighting`
- `fzf`
- `eza`

If Homebrew is detected, AndSpace can install missing tools only after the user
clicks **Install missing**. There is no silent install and no background package
manager activity.

## Existing Shell Config

`Use my shell config` keeps the earlier alpha behavior. AndSpace starts the
user's `$SHELL`. If that shell is zsh, AndSpace uses its `ZDOTDIR` bootstrap to
source the user's normal zsh files and then load AndSpace shell integration.

For bash/fish/custom shells, the terminal still starts, but full shell
integration and pre-execution Command Guard are zsh-first in this alpha.

## Privacy

Shell profile preferences store only the selected profile and optional custom
shell path in:

```text
~/Library/Application Support/AndSpace/preferences.json
```

AndSpace does not store shell history, command output, terminal scrollback,
AI prompts, secrets, or the contents of personal dotfiles.
