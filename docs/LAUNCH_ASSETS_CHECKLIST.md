# AndSpace v0.1.0-alpha.2 Launch Assets Checklist

## Screenshots

Final screenshot destination:

```text
docs/screenshots/final/
```

| Asset | Status |
| --- | --- |
| `01-hero-sidebar.png` | Seeded from website public asset |
| `02-command-guard.png` | Needs capture |
| `03-ai-handoff.png` | Needs capture |
| `04-command-palette.png` | Seeded from website public asset |
| `05-git-diff-preview.png` | Needs capture |
| `06-servers.png` | Seeded from website public asset |
| `07-keyboard-shortcuts.png` | Seeded from website public asset |

## Demo Video

| Asset | Status |
| --- | --- |
| 30-45 second demo video | Needs recording |
| Demo script | Ready: `docs/DEMO_VIDEO_SCRIPT.md` |
| Final video filename | Suggested: `andspace-v0.1.0-alpha.2-demo.mp4` |

## README And Release

| Item | Status |
| --- | --- |
| README screenshot placeholders | Replaced with seeded screenshots |
| README final screenshots inserted | Partial: hero, command palette, keyboard shortcuts |
| GitHub release screenshots added | Optional after capture |
| GitHub release demo video added | Optional after recording |
| Release link verified | Ready: `https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.2` |
| Launch copy reviewed | Ready: `docs/LAUNCH_COPY.md` |

## Website Asset Notes

The website is in:

```text
/Users/lukafartenadze/Desktop/andspace-web
```

Current website image paths that should eventually be replaced with real
captured app screenshots:

| Website file | Current image | Suggested replacement |
| --- | --- | --- |
| `components/Hero.tsx` | `/app-hero.png` | `01-hero-sidebar.png` |
| `components/SidebarSection.tsx` | `/file-actions.png` | A real File Actions or Git Diff Preview capture |
| `components/CommandPaletteSection.tsx` | `/d3879092-96e8-422f-a1d0-87e3b7499c60.png` | `04-command-palette.png` |
| `components/KeyboardSection.tsx` | `/58d6436a-6ea9-474b-84f1-4113ad10737b.png` | `07-keyboard-shortcuts.png` |
| `app/layout.tsx` | `/app-hero.png` social preview | Final hero/social screenshot after capture |

The website already uses these seeded assets. Replace them later only when the
missing Command Guard, AI Handoff, and Git Diff Preview screenshots are captured
and cropped consistently.

## Final Review

- Screenshots are free of secrets, API keys, private customer names, and private
  shell history.
- Demo video does not imply unsupported features such as Git writes, embedded
  browser preview, built-in editing, settings, or provider API integration.
- Release notes, README, website, and launch copy all point to
  `v0.1.0-alpha.2`.
