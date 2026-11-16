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
node voice.mjs ../../demo/voiceover.mp3 vo   # fit the ElevenLabs voiceover: tighter pauses, 1.15x, line times
node edit-story.mjs vo ../../demo/launch-window-demo.mp4 take take-cold vo
```

The result is one 29.6-second video (Space Apps limit: 30 s) with the voiceover over a generated ambient pad that ducks under the voice.
`voice.mjs` expects the 12 lines in `demo/voiceover-script.md`; the `vo` timeline in `edit-story.mjs` cuts each shot to its line's start time, so a new recording re-times the video on its own.
Without a voiceover, `node edit-story.mjs short <out> take take-cold` renders the 29.8 s cut with the pad only.
Captions live in `overlays.mjs`.
