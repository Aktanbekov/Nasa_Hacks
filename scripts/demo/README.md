# Demo video pipeline

Records a scripted playthrough of the running game and edits it into the demo video in `demo/`.

Requirements: Google Chrome, ffmpeg, and `playwright-core` (uses your installed Chrome, downloads no browser):

```bash
cd scripts/demo && npm init -y && PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install playwright-core
```

With the game running (`npm run dev`):

```bash
node record.mjs take            # scripted playthrough, 1920x1080 frames + time marks (exit code 3 = mission not a win, re-run)
node master.mjs take            # constant 30 fps master.mp4 + marks relative to it
node coldopen.mjs take-cold     # clean full-screen story scenes + 3D Earth for the cold open
node master.mjs take-cold
node overlays.mjs               # caption, cold-open and title PNGs in the game's HUD style
node edit-story.mjs short ../../demo/launch-window-demo.mp4 take take-cold
```

The result is one 29.8-second video (Space Apps limit: 30 s).
Shot start times in `edit-story.mjs` (the `short` timeline) match the line start times in `demo/voiceover-script.md`.
If your recorded narration runs longer or shorter, move those start times and re-render.
Captions live in `overlays.mjs`. The soundtrack is a generated ambient pad (no licensing); swap it for your voiceover.
