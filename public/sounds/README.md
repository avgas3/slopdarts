# Sound effects

This folder contains the default board tones and the themed packs the app can
switch between per player. The core fallback files in the root are still the
defaults, and the extra folders (`arcade`, `punch`, `crystal`, `bloom`) are
variants sourced from [Kenney's Impact Sounds pack](https://kenney.nl/assets/impact-sounds)
under [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/), then
renamed to fit the app's event kinds.

| Theme folder | Sound profile |
|---|---|
| `arcade/` | Bright coin-op hits and a celebratory pop |
| `punch/` | Heavier, more physical impact events |
| `crystal/` | Glassy, crisp impact tones |
| `bloom/` | Softer, brighter win/advance moments |
| root files | The original synthesized fallback set |

Each themed folder contains `hit.ogg`, `miss.ogg`, `bust.ogg`,
`advance.ogg`, `turn.ogg` and `win.ogg`. The Classic profile uses the same
event names with a `.wav` extension in the root folder.

Every file is optional — deleting one falls back to a tone generated on the
fly with the Web Audio API, so the app stays audible even with this folder
emptied out. `.mp3`, `.ogg` and `.wav` all decode fine; if you swap to a
different extension, update the relevant `files` map in `src/soundThemes.ts`
to match.

Keep the source and license of any replacement assets documented alongside
them. See [third-party notices](../THIRD_PARTY_NOTICES.txt).
