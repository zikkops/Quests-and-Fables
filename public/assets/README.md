# Assets

## `dragon-eye.jpg`, missing, and the hero needs it

Save the dragon photo here as exactly `dragon-eye.jpg`. Until then the hero
renders a hatched placeholder that says so out loud.

What the photo needs to be:

- **A tight crop on a single eye**, landscape (the frame is 3:2). Brow,
  scales and horn edges in shot, those are what stay locked while the iris
  moves, and they're what make it read as a photograph rather than an effect.
- **Iris clearly visible and not blown out.** The iris is the only part that
  moves; if it's a bright blur there is nothing to animate.
- Ideally ~1600px on the long edge. Larger is wasted, smaller shows.

Then calibrate:

1. `npm run dev`, open the homepage
2. Press `C`, a green ellipse, centre lines and a dashed travel box appear
3. `1` to `4` pick what you're nudging (iris centre / iris radius / gaze range /
   photo offset), arrow keys nudge, `shift` for coarse steps
4. Get the ellipse sitting on the iris, and keep the dashed travel box inside
   the eyeball, if it runs onto the scales, the gaze range is too wide
5. Hit **copy for globals.css** and paste over the `EYE CALIBRATION` block in
   `src/app/globals.css`

The calibrator is dev-only and never ships to production.
