# AndSpace v0.1.0-alpha.4 Launch Assets Checklist

## Screenshots

Final screenshot destination:

```text
docs/screenshots/final/
```

| Asset | Status |
| --- | --- |
| `01-hero-sidebar.png` | Captured from packaged app |
| `02-command-guard.png` | Captured from packaged app |
| `03-ai-handoff.png` | Captured from packaged app |
| `04-command-palette.png` | Captured from packaged app |
| `05-git-diff-preview.png` | Captured from packaged app |
| `06-servers.png` | Captured from packaged app |
| `07-keyboard-shortcuts.png` | Captured from packaged app |

## Demo Video

| Asset | Status |
| --- | --- |
| 30-45 second demo video | Needs recording |
| Demo script | Ready: `docs/DEMO_VIDEO_SCRIPT.md` |
| Final video filename | Suggested: `andspace-v0.1.0-alpha.4-demo.mp4` |

## README And Release

| Item | Status |
| --- | --- |
| README screenshot placeholders | Replaced with real screenshots |
| README final screenshots inserted | Complete: all seven launch screenshots |
| GitHub release screenshots added | Optional after capture |
| GitHub release demo video added | Optional after recording |
| Release link target | `https://github.com/SetFodi/Andspace/releases/tag/v0.1.0-alpha.4` |
| Launch copy reviewed | Ready: `docs/LAUNCH_COPY.md` |

## Website Asset Notes

The website is in:

```text
/Users/lukafartenadze/Desktop/andspace-web
```

Current website image paths and screenshot replacement status:

| Website file | Current image | Suggested replacement |
| --- | --- | --- |
| `components/Hero.tsx` | `/app-hero.png` | Replaced with `01-hero-sidebar.png` |
| `components/SidebarSection.tsx` | `/file-actions.png` | A real File Actions or Git Diff Preview capture |
| `components/CommandPaletteSection.tsx` | `/d3879092-96e8-422f-a1d0-87e3b7499c60.png` | Replaced with `04-command-palette.png` |
| `components/KeyboardSection.tsx` | `/58d6436a-6ea9-474b-84f1-4113ad10737b.png` | Replaced with `07-keyboard-shortcuts.png` |
| `app/layout.tsx` | `/app-hero.png` social preview | Replaced with `01-hero-sidebar.png` |

The website layout was left unchanged. The hero/social preview, command palette,
and keyboard shortcut visuals were swapped to real product screenshots.

## Final Review

- Screenshots are free of secrets, API keys, private customer names, and private
  shell history.
- Demo video does not imply unsupported features such as Git writes, embedded
  browser preview, built-in editing, settings, or provider API integration.
- Release notes, README, website, and launch copy all point to
  `v0.1.0-alpha.4`.
