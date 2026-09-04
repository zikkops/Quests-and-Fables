# The tavern

The room, six figures and two pieces of furniture. Nine files, 456KB. Seven of
them are generated (Higgsfield, `nano_banana_pro`, 2 credits each) and one, the
bar counter, is cut straight out of the room render. Overwrite any one of them
and the page picks it up; delete one and that figure falls back to a dashed box
carrying its name, its role and the filename it wants.

| File | What | Notes |
|---|---|---|
| `room.webp` | The common room, empty | Bar and shelves down the left, hearth on the right, floorboards across the bottom third |
| `barkeep.webp` | Maret | Standing, drying a cup |
| `server.webp` | Nessa | Mid stride, tray of tankards on one hand |
| `veteran.webp` | Orla | Seated on a bench, leaning back |
| `newcomer.webp` | Dain | Seated on a stool, satchel, empty hands |
| `sellsword.webp` | Kest | Astride a bench, sword propped beside him |
| `hooded-one.webp` | The hooded one | **Standing** by the fire in a hooded cloak, an iron lantern held low, face in shadow |
| `table.webp` | The table and benches | **Drawn over the cast, not behind them** |
| `bar.webp` | The counter | Cut from `room.webp`, drawn back over the barkeep so she is behind her bar |

## The layers

The stage is the room, then the cast, then furniture painted back over the top.

The table stands near the viewer and the three sit at the **far** side of it, so
each of them is whole, boots included, and only the tankards standing on the
table overlap them. The first attempt put them lower down the frame with the
tabletop crossing their waists, which is how a table actually works and reads as
three people cut off at the middle. The table's `base` is past the bottom of the
stage on purpose: what shows is the near half of a big table, and that is what
puts the party a table's width away. Move it in `src/data/tavern.ts` and the
three seated placements move with it.

The counter works the same way and is why the barkeep is behind her bar rather
than standing in front of it. It is not drawn: it is the same pixels cut out of
`room.webp`, put back in the identical place, so its only visible edge is the
one along the countertop and there is no seam to match. It is layered at z 35,
which is above her and below everyone else, so the serving maid still walks in
front of it.

That is what `z` on a prop is for. Figures land on even numbers (40 minus twice
their depth) and a prop takes an odd one to slot between two of them.

⚠️ The counter is measured against `room.webp`, and **the stage carries that
image's aspect ratio (1376:768) rather than a round 16:9** so the mapping stays
one to one. Replace the room and the counter has to be re-cut from the new one.

The table is desktop only. In the 3:4 room a phone gets, a table across the
front would bury the people it is meant to seat, and each of them is sitting on
their own bench or stool in their own artwork anyway.

## How they were made

One prompt per figure, all sharing the same style contract, so six separate
generations still agree about where the light is coming from:

> Painterly oil illustration, dark fantasy tavern, warm candlelight from the
> upper left, deep shadows, muted palette of near black brown, old gold and
> ember orange. Isolated on a completely flat uniform chroma key green
> background, pure #00B140, no shadow cast on the background, no floor, no
> table, no wall. No text.

Generating on chroma green rather than asking for a transparent background is
what makes these usable: the cut-out is then a mechanical step rather than a
hope.

**Do not cut them with a plain colour key.** The first pass used ffmpeg's
`colorkey`, which removes every green pixel in the frame, and the newcomer lost
his shins: his trousers are olive and the filter could not tell them from the
backdrop. The fix is a flood fill instead. Two thresholds, and the gap between
them is the whole point:

- **core green** (`g > 100 && g > r * 1.8 && g > b * 1.8`) is the backdrop
  itself. #00B140 is violently green and nothing painted on these people comes
  near it. Every core pixel is a seed.
- **edge green** (`g > 60 && g > r * 1.15 && g > b * 1.15`) is loose enough to
  catch the anti-aliased pixels where the backdrop meets a shoulder. The fill
  may spread through it, but never starts there.

An olive trouser leg is never a seed and is never reached from one, so it
survives. Seeding from *every* core pixel rather than only the frame border also
clears the pockets of backdrop enclosed by a bench back or a propped sword,
which otherwise come out as teal holes in the middle of the room.

What survives is then **eroded by one pixel**. The outermost ring of kept pixels
is where the renderer blended the backdrop into the figure with its own
anti-aliasing, and no despill rescues it: on the page it shows as a green thread
around the silhouette. Losing a pixel of robe is the cheaper trade. After that
the green is capped (`g = min(g, (r + b) / 2 + 8)`) to kill whatever spill is
left, a 0.7px blur on the alpha channel alone puts the anti-aliasing back after
a hard-edged fill, and the file is cropped to the alpha bounding box.

That last step matters more than it sounds: `base` in the data is the floor
under the figure's feet, so any transparent margin left under the boots would
push the figure up into the air.

The whole thing is about 90 lines of node against raw RGBA piped out of the
`ffmpeg` that already ships in `node_modules` (`ffmpeg-static`, a dev
dependency). No image library was added for it.

Sizes are deliberate. The biggest figure is about 200px wide on screen at
desktop width, so they ship at 520px, roughly two device pixels per drawn pixel,
and the room ships at 1400px. They were 900px each to start with and the section
weighed 552KB.

The room got a mild grade on the way in, because a generated interior comes out
warmer and brighter than a page whose background is `#12100f`. Nothing else is
done to it:

```bash
ffmpeg -i room.png -vf "eq=brightness=-0.06:saturation=0.94:contrast=1.02,\
vignette=PI/5,scale=1400:788" -frames:v 1 -update 1 -c:v libwebp -quality 80 room.webp
```

The counter was not generated at all. It is a crop of that finished room, masked
along the countertop, which is the only edge of it that ever shows:

```bash
# 102,405 is the counter's top left corner in the 1400x788 file, and its top
# edge falls 0.163px for every px across.
ffmpeg -i room.webp -vf "crop=443:377:102:405,format=rgba,\
geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='clip((Y-(73.2-0.163*X))*255,0,255)'" \
  -frames:v 1 -update 1 -c:v libwebp -lossless 1 bar.webp
```

**Alpha only, and lossless.** Every visible pixel has to stay exactly what it is
in the room, so the crop touches nothing but the alpha channel, and the encode
is lossless because a second lossy pass over an already lossy image is a way to
shift colour by a hair for no reason. It costs 43KB and it means the counter's
decoded pixels are bit for bit the room's own.

Two ways of getting this wrong, both of which shipped once:

- **Cutting from the raw render** rather than the graded `room.webp`. The room
  is darkened on the way in; a counter cut from the original lands as a bright
  patch.
- **Grading the cut itself.** Asked to sink the bar's left end into the dark, the
  obvious move is a darkening ramp across the crop. It is wrong twice over: the
  room underneath still has its own counter, so the overlay reads as a darker
  patch with a step along its edge, and a clamped linear ramp is itself an edge.
  If the corner needs to be darker, darken the room and re-cut.

**The light has to be above the overlay, not under it.** The hearth glow, the
candle pool and the floor wash are CSS layers in `Tavern.module.css`, and they
used to sit inside the room, beneath the cast and the furniture. That put the
counter in different light from the room it was cut out of: the floor wash
darkened the boards around it and left the counter itself bright. No amount of
colour matching in the file fixes that. They are now at `z-index: 45`, over
everything except the speech bubbles, so one light falls on the whole scene.

## Replacing any of them

**Rename the file when the character changes.** The lantern bearer replaced a
seated hooded figure that had itself replaced another, and by then it was not
obvious from the outside whether a reload was showing the new art or a cached
copy of the old. Overwriting `gm.webp` again would have kept that doubt; landing
the new figure at `hooded-one.webp` and pointing the data at it cannot be
served from anyone's cache. It costs one line in `tavern.ts`.

- **Keep the shape.** `aspect` in `src/data/tavern.ts` is the file's own width
  over height and has to match, or the figure stretches. Change the file, change
  the number.
- **Feet or seat at the very bottom edge of the canvas.** Every figure is placed
  by the floor it stands on.
- **Ask for a generous margin, then count it rather than squint at it.** Two
  game masters in a row came back with a knee or a chair arm running off the
  edge of the render, and a figure cut by its own frame looks cut on the page
  too. What worked in the end was asking for the figure to be *small in the
  frame and completely surrounded by empty background on every side*, with no
  furniture behind it, and generating three at once to choose from. Then read
  the alpha bounding box and compare it against the render's own frame: a
  figure clear of it on all four sides was never cut. Measuring the *cropped*
  file proves nothing, since a tight crop touches its own borders by definition.
- **Light from the upper left**, warm, and dark muted colour. Anything with a
  bright rim or saturated colour floats off the page.
- **Facing into the room.** Everyone on the left half faces right, everyone on
  the right faces left. `flip: true` in the data mirrors a cut-out that came out
  the wrong way round, so nothing needs regenerating for that alone.

## Placing them

Positions live in `src/data/tavern.ts`, in percentages of the stage, never
pixels. Each figure carries two sets: `wide` for the 16:9 room on desktop, and
`narrow` for the 3:4 room on a phone. Nudge `x` (centre, across), `base` (the
floor under the feet, down) and `w` (width) until the scene reads. Nothing else
in the codebase knows these numbers.

Composing them in a browser is slow. Compositing the actual files with ffmpeg is
not, and it is how this arrangement was set:

```bash
ffmpeg -i room.webp -i veteran.webp -filter_complex \
  "[0]scale=1200:675[bg];[1]scale=204:200[v];[bg][v]overlay=558:340" \
  -frames:v 1 -update 1 mock.png
```

where every number is the percentage from the data times 1200 or 675.
