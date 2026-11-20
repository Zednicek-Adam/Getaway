# Music

The game's two tracks are written in [Strudel](https://strudel.cc) and baked
into loops in `public/audio/`:

| Source | Plays on | Loop | Tempo |
| --- | --- | --- | --- |
| `theme.strudel` | title, instructions and credits screens | 32 bars, 48.0 s | 160 BPM |
| `gameplay.strudel` | a run (ducked under the pause menu and garage) | 42 bars, 57.9 s | 174 BPM |

`src/audio/sound.js` loads the `.ogg` copy, or the `.m4a` one on browsers
without Ogg Vorbis (Safari). The sound effects are not files: they are
synthesised in the browser from `src/audio/sfxRecipes.js`.

## Re-exporting a track after an edit

1. Paste the `.strudel` file into the editor at strudel.cc and add
   `.postgain(0.7)` after the closing `)` of the `stack(...)`. Without it a few
   peaks clip in the export.
2. Open the **export** tab and set:
   - Start cycle `0`, End cycle **twice the loop length**: `64` for the theme,
     `84` for gameplay
   - Sample rate `44100`
   - Multi Channel Orbits **unticked**

   Then press **Export to WAV**.
3. Keep only the second pass. It begins with the reverb and delay tails from
   the end of the first pass, so it loops seamlessly. Then encode both
   formats:

   ```sh
   # theme: one loop = 48 s
   ffmpeg -i theme.wav -af "atrim=start=48:end=96,asetpts=N/SR/TB" loop.wav
   # gameplay: one loop = 42 bars * 240 / 174 = 57.931034 s
   ffmpeg -i gameplay.wav -af "atrim=start=57.931034:end=115.862069,asetpts=N/SR/TB" loop.wav

   ffmpeg -i loop.wav -c:a libvorbis -q:a 5 public/audio/<name>.ogg
   ffmpeg -i loop.wav -c:a aac -b:a 160k public/audio/<name>.m4a
   ```

If the loop length changes, change the end cycle and trim times to match:
one bar lasts `240 / BPM` seconds.

## Samples

The drums come from Strudel's default kit,
[uzu-drumkit](https://github.com/tidalcycles/uzu-drumkit) (Unlicense). The
`gm_*` instruments are General MIDI soundfonts (Aspirin and JCLive) served
by [WebAudioFont](https://github.com/surikov/webaudiofont). Everything else
is Strudel's built-in synths.
