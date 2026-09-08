# Mandala Coloring Pages

A printable coloring-page generator: an animal silhouette (horse or giraffe)
filled with dense repeating patterns and framed by ornamental flourishes,
in the style of adult mandala coloring books.

It is a single HTML file with plain JavaScript that draws SVG. No build
tools, no frameworks, no server. Open it in a browser and print.

## How to print a page

1. Open `index.html` in a browser. On a phone, open it from Files, from a
   link, or from the GitHub Pages address if this repo is published.
2. Press **Regenerate** until you see a page you like. Every press draws a
   new variation.
3. Press **Print**. On iPhone or iPad, the print button opens the share
   sheet's print dialog; on Android, Chrome opens its print preview.
4. Choose **US Letter**, **portrait**, and turn scaling off or set it to
   100%. The page is designed edge to edge for Letter with printer-safe
   margins built in, so "fit to page" is not needed.

If you like a page, write down its **seed** number. Typing that seed back
in reproduces the exact same page later.

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
- **A pattern family is one function.** Given a box, a random number
  generator and a spacing, it returns SVG elements. Spots, spirals, scales,
  chevrons, petals, mane strands. Every family is built from closed shapes
  or lines that run edge to edge, so it can never leave an unclosed pocket.
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
