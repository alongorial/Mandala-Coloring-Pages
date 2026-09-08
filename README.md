# Mandala Coloring Pages

A printable coloring-page generator: an animal silhouette (horse or giraffe)
filled with dense repeating patterns and framed by ornamental flourishes,
in the style of adult mandala coloring books.

It is a single HTML file with plain JavaScript that draws SVG. No build
tools, no frameworks, no server. Open it in a browser and print.

## How to print a page

1. Open `index.html` in a browser. On a phone, open it from Files, from a
   link, or from the GitHub Pages address if this repo is published.
2. Pick an **Animal** (giraffe or horse) and a **Detail** level. Low gives
   big calm areas and fewer, larger motifs; High packs in more bands, more
   halo rings and finer patterns.
3. Press **Regenerate** until you see a page you like. Every press draws a
   new variation.
4. Press **Print**. On iPhone or iPad, the print button opens the share
   sheet's print dialog; on Android, Chrome opens its print preview.
5. Choose **US Letter**, **portrait**, and turn scaling off or set it to
   100%. The page is designed edge to edge for Letter with printer-safe
   margins built in, so "fit to page" is not needed.

Every page prints a small label in its bottom border: the animal, the
**seed** number and the detail level. Typing that seed back in, with the
same animal and detail, reproduces the exact same page. The seed is also
kept in the page address, so bookmarking the page works too.

A seed reproduces a page for the version of `index.html` that made it.
If the generator's code changes later, old seeds will still give a valid
page, just not the identical one.

## How it works

Everything lives in `index.html`. A few ideas make the whole thing hang
together:

- **The animal is a jigsaw of closed shapes.** Each animal is a short list
  of named, closed SVG paths drawn by hand: head, neck, ear, eye, muzzle,
  and so on. Thick outlines are drawn last, on top of everything.
- **Patterns are clipped, never computed.** A pattern is drawn over a
  region's bounding box and then clipped to the region's outline using an
  SVG `clipPath`. Any pattern line that reaches the edge is cut there and
  the thick outline closes it. That is how every region ends up closed
  without any geometry math.
- **Big regions are cut into bands.** Each large piece (the head, the
  neck) has an "axis". Wavy dividers cross that axis and each band between
  them gets its own pattern, or is left calm. Bands are clips nested
  inside the region's clip, so they inherit its closed edge for free.
- **A pattern family is one function.** Given a box, a random number
  generator and a spacing, it returns SVG elements. Spots, spirals, scales,
  chevrons, petals, mane strands. Every family is built from closed shapes
  or lines that run edge to edge, so it can never leave an unclosed pocket.
- **The frame and halo use the same machinery.** The border is four
  patterned rectangles plus corner medallions; the halo behind the head is
  a set of donut-shaped regions with petals, beads, rays or zigzags. They
  are ordinary regions, just with fixed patterns.
- **Randomness is seeded.** A tiny seeded random generator means the same
  seed always produces the same page.
- **Print sizing is baked in.** The SVG is US Letter at 100 units per inch
  (850 by 1100). Outline strokes are about 1 mm wide and pattern strokes
  about 0.4 mm, both safe for a home inkjet. A print stylesheet hides the
  controls.

## Files

- `index.html`: the whole generator.
- `README.md`: this file.
- `.gitignore`: keeps editor clutter and preview renders out of git.
