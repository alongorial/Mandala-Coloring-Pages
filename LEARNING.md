# Learning guide

This is the companion to the code. It is written to be read on a phone,
one section at a sitting. Each idea points at the place in the code where
you can see it. Nothing here needs to be memorised; it is a map.

Four parts:

1. [The tools](#1-the-tools): what the browser, git and GitHub are doing.
2. [How this generator thinks](#2-how-this-generator-thinks): the handful of ideas the code is built on.
3. [Mandala design theory](#3-mandala-design-theory): why some pages feel good to color, and which knob controls each quality.
4. [Exercises](#4-exercises): small things to change by hand, with the expected result.

---

## 1. The tools

### A web page is three languages in one file

Open `index.html` and you will see three kinds of text:

- **HTML** is the skeleton: the buttons, the drop-downs, the empty
  `<svg>` box the picture goes into. It says *what is on the page*.
- **CSS**, inside `<style>`, is the clothing: colors, sizes, what to hide
  when printing. It says *what things look like*.
- **JavaScript**, inside `<script>` and in `generator.js`, is the
  behaviour: what happens when you press Regenerate. It says *what things
  do*.

The browser reads the file top to bottom, builds the skeleton, applies
the clothing, then runs the scripts. That is the whole "stack" of this
project. There is no server; the browser is the computer.

### SVG is drawing with words

The picture is SVG, a way of describing shapes as text: "a circle at
(400, 300) with radius 12", "a path that starts here and curves there".
Because it is text, JavaScript can write it, and because it is shapes
rather than pixels, it prints crisp at any size.

The one SVG idea worth knowing is the **path**. A path string like
`M165 470 C195 425, 240 380, 300 340 ... Z` means: **M**ove the pen to
(165, 470), draw a **C**urve to (300, 340) bending toward the two control
points on the way, and so on, then **Z** close the shape back to the
start. Every animal piece in `generator.js` section 6 is one of these.

The coordinate system: x runs left to right, y runs **top to bottom**
(unlike a maths graph), and the page is 850 wide by 1100 tall, so 100
units is one inch. Line widths are in the same units: the outline is 4.5
units, about 1.1 mm.

### JavaScript, the parts you will meet

- A **function** is a named recipe: `spots(box, rng, spacing)` takes a
  rectangle, a random generator and a spacing and hands back shapes.
- A **const** is a name for a value that does not change, like
  `PAGE_W = 850`. Tables like `DETAIL` and `DENSITY` are consts you can
  edit.
- A **loop** (`for (...)`) repeats something, for example once per grid
  cell.
- Arrow functions, `(x) => x * 2`, are just short functions.
- `rng.range(0.34, 0.43)` asks the seeded random generator for a number
  in that range. Change the numbers, change the look.

### Git and GitHub

**Git** is a history for files. A **commit** is a saved snapshot with a
message; the project so far is a short list of them (`git log`). A
**branch** is a named line of commits; this project was built on a branch
and merged into `main`. A **diff** is the list of lines that changed
between two snapshots, shown with `-` for removed and `+` for added.
Reading diffs is the fastest way to understand what a change did.

**GitHub** stores the history online and, through **GitHub Pages**,
serves the files as a website. The workflow in
`.github/workflows/pages.yml` runs after every change to `main` and
publishes the repo root, so `index.html` becomes the front page.

**Claude Code** on your phone is a way to say "change this" and have the
change made as a commit on a branch, which you can read as a diff before
merging.

### Where things live in the browser

Favorites are stored with **local storage**, a small key-value store each
website gets in each browser. It survives closing the tab, but it belongs
to that browser on that device, which is why Export exists.

---

## 2. How this generator thinks

Five ideas carry the whole thing. They are worth reading twice.

### The animal is a jigsaw, not a silhouette

Look at `giraffe()` in `generator.js`. It is a list of **regions**, each a
closed path: mane, neck, ear, ossicones, head, eye, nostril. They are
listed back to front. Each region paints itself white before its pattern,
so where the ear tucks behind the head, the head simply covers the join.
Open `lab.html` and look at the Anatomy section to see the pieces shaded.

### Front faces: draw half, mirror the rest

`giraffeFront()` and `horseFront()` draw only the left half of the face.
`symmetric(halfPath, CX)` builds the closed whole: the half runs from the
centre line at the top down to the centre line at the bottom, and the
function appends the same curves backwards with every x reflected across
`CX`. Paired pieces (ears, eyes, ossicones, nostrils) are one path plus
`mirrorPath(path, CX)`. Fewer numbers to type, and perfect symmetry for
free, which is exactly the mandala feel.

### Closure comes from clipping, not from geometry

The requirement "every region closed" sounds like it needs clever maths.
It does not. A pattern is drawn over a region's whole bounding rectangle,
then **clipped** to the region's outline (`drawRegion`, section 5). Any
pattern line that reaches the edge is cut off there, and the thick
outline drawn on top closes it. Regions are closed by construction.

### Bands are clips inside clips

Large regions are split by wavy dividers (`planBands`). Each region has an
**axis**, the direction it is long; dividers cross the axis at right
angles. A band is the area between two dividers, and it is itself a clip
nested inside the region's clip, so it inherits the closed edge for free.
Each band gets its own family, or is left calm.

### A pattern family is one function

Six functions, section 4: `spots`, `spirals`, `petals`, `scales`,
`chevrons`, `strands`. They all have the same shape: given a box, a random
generator and a spacing, return shapes. Because they are interchangeable,
the generator can pick them by name, weight them, and the lab can show
them one at a time. To add a family, write one more function of that
shape and add it to `FAMILIES` and `DENSITY`.

### The seed makes randomness repeatable

`makeRng(seed)` (section 2) is a random number generator that always
produces the same sequence for the same seed. So "animal + detail + seed
+ version" names a page exactly, which is what favorites save and what
the label on the paper shows. Change any generation code and the same
seed gives a different page; that is why `GENERATOR_VERSION` goes up.

Taste weights (`WEIGHTS`) are part of the recipe too. A favorite stores
the weights it was made with and uses them again when you press Open.

---

## 3. Mandala design theory

These are the qualities that make a page satisfying to color, and where
each one lives in the code. Use the lab to see them in isolation.

### A center, and rhythm around it

A mandala has a center and everything answers to it. Here the head is the
center and the **halo** rings behind it (`drawHalo`) supply the radial
rhythm: motifs repeated around a circle at even angles. The full-body
horse turns this inside out: the mandala is the centre and the animal
wraps around it, which is the oldest mandala composition there is. The frame answers
the halo with the same motifs in straight lines. Knob: `halo.r` in each
animal sets how far out the rings start; `DETAIL[...].rings` how many.

### Repetition with small variation

Pure repetition is dull; pure randomness is noise. Every family repeats a
motif on a grid and then jitters it a little: spots vary their radius and
side count, spirals their turn count and direction. Knobs: the
`rng.range(...)` calls inside each family. Make the ranges wider for a
looser, hand-drawn feel; narrower for a formal one.

### Contrast of scale: three sizes

Good pages have three scales at once: large calm areas, medium motifs,
fine texture. The eye rests in the calm areas and that makes the dense
ones read as rich instead of busy. Knobs: `DETAIL[...].calm` (the chance
a band stays white), `calm: true` on the neck (always keep one resting
band), and `DENSITY` for how fine each family draws.

### Line-weight hierarchy

Three line weights, never more: outline (thick), divider (medium),
pattern (thin). The hierarchy tells the eye what is an object, what is a
zone inside it, and what is texture. Knob: `STROKE`. Keep the ratio near
4.5 : 3 : 1.7; when everything is the same weight the drawing goes flat.

### Closure and negative space

A marker needs a boundary, so every region closes (see part 2). But
closure is also visual: the gaps *between* motifs are shapes too, and a
family whose gaps are pleasant (scales, spots) colors better than one
whose gaps are slivers. Knob: spot radius (`0.34 to 0.43` of spacing)
sets how fat the gaps between spots are.

### Framing the subject

The frame is a promise that the page is finished. The border band, the
corner medallions and the quarter fans (`drawFrame`, `cornerFan`) give
the eye an edge to come back from. Knobs: `FRAME.inset` (distance from
the paper edge) and `FRAME.band` (width of the patterned band).

A round frame changes the feeling more than any pattern does: the page
becomes a medallion, and the corners turn into quiet space with a small
fan in each. The medallion radius is the `R = 370` in `drawFrame`; the
animal is scaled down by `scale` to fit inside it, and the strokes are
thickened by the same amount so the printed lines stay the same width.

### Why calm areas make dense areas read

This one is worth saying on its own. If you ever feel a page is "too
busy", the fix is usually not smaller patterns but a bigger calm area
next to them. Raise `calm`, or lower the detail level, before touching
`DENSITY`.

---

## 4. Exercises

Each exercise changes one thing, looks at the result, and undoes it. Do
them in order; each takes a few minutes. Open `index.html` in a browser,
edit the file, reload.

1. **Spot size.** In `spots()`, change `rng.range(0.34, 0.43)` to
   `rng.range(0.25, 0.30)`. Reload. Expected: smaller spots, fatter gaps,
   the neck looks calmer. Undo with `git checkout generator.js`.
2. **A reason of your own.** In `index.html`, add a phrase to `REASONS`,
   such as `'perfect for markers'`. Reload, press 👍, and see your chip
   appear. Keep this one if you like it.
3. **Find a spacing in the lab.** Open `lab.html`, pick `chevrons`, slide
   spacing until the strips look right for a medium marker. Read the units
   in the caption. In `generator.js`, change `chevrons: 0.5` in `DENSITY`
   so that 50 units times your number matches. Reload the generator and
   look at a page with chevrons.
4. **Nudge the taste.** In the Favorites panel, set `spirals` to 2.0 and
   press Apply. Regenerate ten pages and count how many have spirals
   somewhere. Then set it to 0.3 and count again. Reset to neutral.
5. **Three sizes.** Set `DETAIL.medium.calm` to `0` and regenerate a few
   pages. Then set it to `0.5`. Which set is more restful? Put it back to
   `0.22`, or leave it where you preferred and bump `GENERATOR_VERSION`.
6. **Line weights.** Set every `STROKE` value to `2.5`. Reload. Notice the
   drawing going flat. Put the three weights back.
7. **Move one eye.** In `giraffeFront()`, change the `306` at the start
   of the `eye` path to `296` (and the iris circle's `cx: 332` to `322`).
   Reload with Pose set to Front face. Both eyes move outward, because the
   right eye is the mirror of the left.
8. **A smaller medallion.** In `drawFrame`, change `R = 370` to `R = 320`
   and set Frame to Round. The corners grow and the fans look bigger by
   comparison. Try `R = 400` and watch the medallion nearly touch the
   page border.
9. **A fatter tail.** In `horseBody()`, find the `thick` table and change
   the `[150, 26]` stop to `[150, 40]`. Set Pose to Full body. The tail
   thickens along the left of the ring, because thickness is a function of
   angle and you moved one point on that function.
10. **A seventh family.** Copy `chevrons`, rename the copy `waves`, and
   replace the zigzag points with a sine wave (`Math.sin`). Add `waves` to
   `FAMILIES`, `DENSITY`, `DIRECTIONAL` and `DEFAULT_WEIGHTS.families`,
   then to one region's `families` list. Bump `GENERATOR_VERSION`. Open
   the lab and pick `waves` to see it on its own.
