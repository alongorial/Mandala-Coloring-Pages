# Mandala Coloring Pages

A printable coloring-page generator: an animal silhouette (horse or giraffe)
filled with dense repeating patterns and framed by ornamental flourishes,
in the style of adult mandala coloring books.

It is a web page with plain JavaScript that draws SVG. No build tools, no
frameworks, no server. Open it in a browser and print.

**Open it here:** https://alongorial.github.io/Mandala-Coloring-Pages/
(published from the `main` branch by GitHub Pages; the first publish
happens when the "Publish to GitHub Pages" workflow runs after a merge).

## On the tablet or phone: put it on the home screen

1. Open the address above in Chrome.
2. Tap the ⋮ menu (top right), then **Add to Home screen** (on some
   versions it says **Install app**). On an iPhone, use Safari's share
   button and **Add to Home Screen**.
3. Accept the name "Coloring Pages". A green spiral icon appears on the
   home screen and opens the generator full screen, without the browser
   bar.

The icon is a shortcut to the web address. When the repo changes, the icon
opens the new version; there is nothing to reinstall. The tablet needs to
be online to open it.

## Sharing the link

Anyone with the address can use it; there is nothing to sign up for. Send
it as a text message, or set the icon up on their device as above.

Favorites and taste weights live in the browser of the device they were
made on. Two people on two devices have two separate sets, unless one
exports and the other imports. A shared version, where each person signs
in and sees the other's favorites, is the planned next phase.

## How to print a page

1. Open the address above on any phone, tablet or computer. (Or download
   `index.html` and `generator.js` together and open `index.html` from
   Files; both files must sit side by side.)
2. Pick an **Animal** (giraffe or horse), a **Pose** (front face,
   profile, or for the horse a full body curled around a mandala), a
   **Frame** (square, round, or let the seed decide) and a **Detail**
   level. Low gives
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

### Favorites

Under the page there is a rating bar: 👍 **Like** or 👎 **Dislike**, then
one-tap reasons such as "too busy" or "love the frame". Ratings are saved
in the browser on that device. The **Favorites** button shows the liked
pages with small previews; **Open** brings one back to print.

Ratings never leave the device on their own. **Export as text** shows them
as text you can copy to another device (or download as a file), and
**Import pasted text** merges them in. To keep a set of favorites for
good, paste an export into `favorites.json` in this repo: the published
page loads that file and merges it with whatever is on the device.

### Taste

The Favorites panel also has a **Taste** section: one number per pattern
family saying how likely it is to be chosen (1 is neutral, 2 twice as
likely, 0.5 half). **Learn from favorites** proposes numbers from your
likes and dislikes; nothing changes until you press **Apply**, and you can
type numbers yourself. A favorite remembers the numbers it was made with,
so it still reproduces exactly after your taste changes.

### Learning

`LEARNING.md` is the guide: the tools, how the generator thinks, the
design theory behind mandala pages, and exercises to try by hand.
`lab.html` is the pattern lab that goes with it.

A seed reproduces a page for the generator **version** that made it. The
version is the small "v3" at the end of the label. When the drawing code
changes, the version number goes up, and old seeds still give a valid page,
just not the identical one.

### Will it run on an old tablet?

Open the address on the device. Within a few seconds you either see a
coloring page, or a short message saying the browser could not run the
generator. The message is the one-minute test: if you see it, update the
browser (Chrome updates separately from Android) and try again.

## How it works

The drawing code lives in `generator.js`; `index.html` is the page around
it (controls, printing). A few ideas make the whole thing hang together:

- **The animal is a jigsaw of closed shapes.** Each animal is a short list
  of named, closed SVG paths drawn by hand: head, neck, ear, eye, muzzle,
  and so on. Thick outlines are drawn last, on top of everything.
- **Patterns are clipped, never computed.** A pattern is drawn over a
  region's bounding box and then clipped to the region's outline using an
  SVG `clipPath`. Any pattern line that reaches the edge is cut there and
  the thick outline closes it. That is how every region ends up closed
  without any geometry math.
- **Front faces are drawn once and mirrored.** A face seen from the
  front is symmetric, so the left half is drawn by hand and the right
  half is its mirror (`mirrorPath` and `symmetric` in `generator.js`).
  Paired pieces such as ears and eyes are one path plus its mirror.
- **The curled horse is a ring with a changing thickness.** The full
  body pose (`horseBody`) draws the body as a ring around the page
  centre, sampled every three degrees, with a thickness that varies from
  the neck to the haunch to the tail. Its head is the profile head,
  shrunk and turned by `transformPath`. The body's bands are wedges
  between wavy radial dividers, which the region brings with it.
- **Big regions are cut into bands.** Each large piece (the head, the
  neck) has an "axis". Wavy dividers cross that axis and each band between
  them gets its own pattern, or is left calm. Bands are clips nested
  inside the region's clip, so they inherit its closed edge for free.
- **A pattern family is one function.** Given a box, a random number
  generator and a spacing, it returns SVG elements. Spots, spirals, scales,
  chevrons, petals, mane strands, and a lace of diamonds. Front faces also
  carry a layered rosette on the forehead, the centre of the mandala. Every family is built from closed shapes
  or lines that run edge to edge, so it can never leave an unclosed pocket.
- **The frame and halo use the same machinery.** The square border is
  four patterned rectangles plus corner medallions; the round frame is one
  big patterned ring; the halo behind the head is a set of donut-shaped
  regions with petals, beads, rays or zigzags. They are ordinary regions,
  just with fixed patterns. The frame also hands back the shape the animal
  is clipped to and how much to shrink it, so a round page just works.
- **Randomness is seeded.** A tiny seeded random generator means the same
  seed always produces the same page.
- **Print sizing is baked in.** The SVG is US Letter at 100 units per inch
  (850 by 1100). Outline strokes are about 1 mm wide and pattern strokes
  about 0.4 mm, both safe for a home inkjet. A print stylesheet hides the
  controls.

## Files

- `index.html`: the page you print from: controls, print stylesheet, and
  the loading / "browser too old" message.
- `lab.html`: the pattern lab. One family at a time with spacing, line
  weight and angle sliders; all families side by side; and an anatomy
  view showing each animal's pieces and band axes.
- `generator.js`: everything that draws. Written in browser JavaScript no
  newer than about 2017 so older tablets can run it.
- `LEARNING.md`: the learning guide (tools, how it works, design theory,
  exercises).
- `favorites.json`: curated ratings, pasted in from an export. Starts
  empty.
- `manifest.webmanifest`, `icon.svg`, `icon-192.png`, `icon-512.png`:
  the name and icon a device uses when the page is added to its home
  screen. The PNGs are rendered from the SVG.
- `.github/workflows/pages.yml`: publishes the repo to GitHub Pages
  whenever `main` changes.
- `README.md`: this file.
- `.gitignore`: keeps editor clutter and preview renders out of git.
