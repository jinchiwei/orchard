# ThinkPad Ubersicht Widget

This folder now contains an Ubersicht version of the original Conky theme.

## Files

- `thinkpad.widget.jsx`: the widget itself
- `collect_thinkpad_metrics.py`: macOS metric collector with lightweight caching
- `thinkpad deconstructed.deeppink-warmer-mid.png`: the selected image asset
- `make_transparent_thinkpad.swift`: image recolor/export helper

## Install

Symlink the whole folder into your Ubersicht widgets directory so the widget can keep using its local image asset:

```bash
ln -s /Users/jinchiwei/arcadia/orchard/thinkpad \
  "$HOME/Library/Application Support/Übersicht/widgets/thinkpad"
```

If your system uses the non-combining spelling for the app support folder, use this instead:

```bash
ln -s /Users/jinchiwei/arcadia/orchard/thinkpad \
  "$HOME/Library/Application Support/Übersicht/widgets/thinkpad"
```

After that, reload Ubersicht.

## Tuning

Edit `thinkpad.widget.jsx` and change the `config` object near the top:

- `accent`, `text`, `muted`, `faint`: widget colors
- `graphUp`, `graphDown`: network graph colors
- `imagePath`: which exported PNG to use
- `scale`: overall size

## Notes

- The layout follows the original Conky theme, but the Linux-only pieces were adapted to macOS equivalents.
- Thermal sensors and exact fan telemetry are not generally exposed cleanly on macOS without extra tools, so that section is intentionally conservative.
- The network graphs depend on `netstat`; if macOS blocks that on a given machine, the graphs will stay flat instead of crashing the widget.
