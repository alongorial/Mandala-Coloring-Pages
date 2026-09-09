/* Mandala Coloring Pages: the generator.
   Everything that draws lives in this file. index.html (the page you
   print from) and lab.html (the pattern lab) both load it with a plain
   <script src="generator.js"> tag, so it must stay ordinary browser
   JavaScript: no modules, no build step, nothing newer than about 2017
   so the old tablet can run it.

   Sections:
     1. Sizes            2. Seeded randomness    3. Small SVG helpers
     4. Pattern families 5. Regions and bands    6. The animals
     7. Frame and halo   8. Putting a page together
*/
'use strict';

/* =====================================================================
   1. Sizes
   Everything below is in page units: 100 units = 1 inch.
   Stroke widths are chosen for a home inkjet: the outline is about
   1 mm and the pattern lines about 0.4 mm. Nothing thinner than that.
   ===================================================================== */
// Bump this whenever anything that affects the drawing changes. A seed
// only reproduces a page for the version that made it, so the version is
// printed on the page label and saved with every favorite.
const GENERATOR_VERSION = 6;

const PAGE_W = 850, PAGE_H = 1100;
const STROKE = { outline: 4.5, divider: 3, pattern: 1.7 };
const FRAME = { inset: 50, band: 36 };   // outer border inset, width of the patterned border band
const MIN_SPACING = 22;                  // patterns never get finer than this (0.22 inch)

// The three detail levels. "mult" scales every pattern spacing, "bands"
// shifts how many bands a region is cut into, "rings" is the number of
// halo rings behind the animal, "calm" is the chance a band stays white.
const DETAIL = {
  low:    { mult: 1.4,  bands: -1, rings: 1, calm: 0.35 },
  medium: { mult: 1.0,  bands:  0, rings: 2, calm: 0.22 },
  high:   { mult: 0.74, bands: +1, rings: 3, calm: 0.12 },
};

/* =====================================================================
   2. Seeded randomness
   Math.random() cannot be replayed. This tiny generator (mulberry32)
   always produces the same sequence for the same seed, which is what
   lets a seed number reproduce a page exactly.
   ===================================================================== */
function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;   // 0 <= x < 1
  };
  return {
    next,
    range: (lo, hi) => lo + next() * (hi - lo),               // float in [lo, hi)
    int:   (lo, hi) => Math.floor(lo + next() * (hi - lo + 1)), // integer in [lo, hi]
    pick:  (arr)    => arr[Math.floor(next() * arr.length)],
    chance:(p)      => next() < p,
  };
}

/* =====================================================================
   3. Small SVG helpers
   el() builds an SVG element with attributes and children so the rest
   of the file reads like a description of the drawing.
   ===================================================================== */
const SVG_NS = 'http://www.w3.org/2000/svg';
function el(name, attrs = {}, children = []) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const c of children) node.appendChild(c);
  return node;
}
// Format a number for a path string: 1 decimal keeps the file small.
const f = (n) => Math.round(n * 10) / 10;
// Turn a list of [x, y] points into a path string ("M x y L x y ...").
function polyPath(points, close = false) {
  return points.map(([x, y], i) => `${i ? 'L' : 'M'}${f(x)} ${f(y)}`).join(' ') + (close ? ' Z' : '');
}
// A full circle as a path (so it can be combined with other subpaths).
const circlePath = (cx, cy, r) =>
  `M${f(cx - r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx + r)} ${f(cy)} A${f(r)} ${f(r)} 0 1 0 ${f(cx - r)} ${f(cy)} Z`;
// A ring (donut): outer circle plus inner circle, filled with the even-odd rule.
const ringPath = (cx, cy, rIn, rOut) => circlePath(cx, cy, rOut) + ' ' + circlePath(cx, cy, rIn);
// The angle of the line from p0 to p1, in degrees.
const angleOf = (p0, p1) => Math.atan2(p1[1] - p0[1], p1[0] - p0[0]) * 180 / Math.PI;

// Visit every centre of a staggered (hexagonal) grid covering the box,
// with one extra row and column of slack on each side so the clipped
// edge never shows a gap.
function hexGrid(box, spacing, visit) {
  const rowH = spacing * 0.87;
  let row = 0;
  for (let y = box.y - spacing; y < box.y + box.h + spacing; y += rowH, row++) {
    const shift = (row % 2) * spacing / 2;
    for (let x = box.x - spacing + shift; x < box.x + box.w + spacing; x += spacing) visit(x, y);
  }
}

// Directional patterns (scales, chevrons, strands) are drawn upright
// inside a bigger square and then the whole square is rotated. The
// square's side is the box diagonal, so it still covers the box after
// any rotation.
function rotated(box, angle, draw) {
  const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
  const d = Math.hypot(box.w, box.h) + 20;
  const big = { x: cx - d / 2, y: cy - d / 2, w: d, h: d };
  return [el('g', { transform: `rotate(${f(angle)} ${f(cx)} ${f(cy)})` }, draw(big))];
}

/* =====================================================================
   4. Pattern families
   Each family is a function (box, rng, spacing, opts) -> SVG elements.
   "box" is the rectangle to cover; the caller clips the result to the
   real region, so a family only has to fill a rectangle generously.
   Every family is made of closed shapes, or of lines that run right
   through the box edge to edge, so it never leaves an unclosed pocket
   for a marker to leak out of.
   ===================================================================== */

// Giraffe spots: a staggered grid of irregular polygons. Each spot is
// smaller than half the grid spacing so neighbours never touch, which
// keeps the gaps between spots as one connected, closed "background".
function spots(box, rng, spacing) {
  const out = [];
  hexGrid(box, spacing, (x, y) => {
    const cx = x + rng.range(-0.04, 0.04) * spacing;
    const cy = y + rng.range(-0.04, 0.04) * spacing;
    const sides = rng.int(5, 8);
    const r = spacing * rng.range(0.34, 0.43);   // biggest spot + jitter still < half the spacing
    const start = rng.range(0, Math.PI * 2);
    const pts = [];
    for (let i = 0; i < sides; i++) {
      const a = start + (i / sides) * Math.PI * 2 + rng.range(-0.15, 0.15);
      const rr = r * rng.range(0.72, 1);
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    out.push(el('path', { d: polyPath(pts, true), 'stroke-linejoin': 'round' }));
  });
  return out;
}

// Spirals: a staggered grid of circles, each holding a spiral that
// starts at the centre and ends on the circle. The disk stays one
// closed region (a winding ribbon), and the gaps between circles are
// closed by the circles themselves plus the region outline.
function spirals(box, rng, spacing) {
  const out = [];
  hexGrid(box, spacing, (x, y) => {
    const r = spacing * 0.46;
    // Fewer turns in a small circle, so the ribbon between the spiral's
    // coils stays about 2.5 mm wide at any size.
    const turns = Math.min(3, Math.max(1.2, r / 9)) * rng.range(0.9, 1.1);
    const dir = rng.chance(0.5) ? 1 : -1;
    const a0 = rng.range(0, Math.PI * 2);
    const steps = Math.ceil(turns * 28);
    const pts = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;                              // 0 at centre, 1 at rim
      const a = a0 + dir * t * turns * Math.PI * 2;
      pts.push([x + Math.cos(a) * r * t, y + Math.sin(a) * r * t]);
    }
    out.push(el('circle', { cx: f(x), cy: f(y), r: f(r) }));
    out.push(el('path', { d: polyPath(pts) }));
  });
  return out;
}

// Petals: a staggered grid of little rosettes. Each has an outer circle,
// a tiny centre circle, and almond-shaped petals between the two.
function petals(box, rng, spacing) {
  const out = [];
  hexGrid(box, spacing, (x, y) => {
    const R = spacing * 0.47, r0 = R * 0.2;
    const n = Math.max(4, Math.min(8, Math.round(R / 4) + rng.int(-1, 1)));  // fewer petals when small
    const a0 = rng.range(0, Math.PI * 2);
    const halfWidth = (Math.PI * R / n) * 0.55;        // how fat each petal is
    out.push(el('circle', { cx: f(x), cy: f(y), r: f(R) }));
    out.push(el('circle', { cx: f(x), cy: f(y), r: f(r0) }));
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      const nx = -sa, ny = ca;                          // sideways direction
      const p0 = [x + ca * r0, y + sa * r0];
      const p1 = [x + ca * R * 0.92, y + sa * R * 0.92];
      const mx = x + ca * R * 0.55, my = y + sa * R * 0.55;
      out.push(el('path', { d:
        `M${f(p0[0])} ${f(p0[1])} Q${f(mx + nx * halfWidth)} ${f(my + ny * halfWidth)} ${f(p1[0])} ${f(p1[1])}` +
        ` Q${f(mx - nx * halfWidth)} ${f(my - ny * halfWidth)} ${f(p0[0])} ${f(p0[1])} Z` }));
    }
  });
  return out;
}

// Scales: rows of U-shaped arcs, each row shifted by half a scale, so
// every arc's ends land exactly on the bottoms of the arcs above it.
function scales(box, rng, spacing, opts = {}) {
  return rotated(box, opts.angle || 0, (big) => {
    const out = [];
    const r = spacing / 2;
    let row = 0;
    for (let y = big.y; y < big.y + big.h + r; y += r, row++) {
      const shift = (row % 2) * r;
      for (let x = big.x - r + shift; x < big.x + big.w + r; x += 2 * r) {
        out.push(el('path', { d: `M${f(x - r)} ${f(y)} A${f(r)} ${f(r)} 0 0 0 ${f(x + r)} ${f(y)}` }));
      }
    }
    return out;
  });
}

// Chevrons: identical zigzag lines stacked on top of each other. The
// strips between them are closed by the region outline.
function chevrons(box, rng, spacing, opts = {}) {
  return rotated(box, opts.angle || 0, (big) => {
    const out = [];
    const amp = spacing * 0.42, half = spacing * rng.range(0.9, 1.4);
    for (let y = big.y; y < big.y + big.h + spacing; y += spacing) {
      const pts = [];
      let up = false;
      for (let x = big.x - half; x < big.x + big.w + half; x += half, up = !up) {
        pts.push([x, y + (up ? -amp : amp)]);
      }
      out.push(el('path', { d: polyPath(pts), 'stroke-linejoin': 'miter' }));
    }
    return out;
  });
}

// Mane strands: long flowing lines that all bend the same way, with a
// little individual wobble, so they read as hair and never cross.
function strands(box, rng, spacing, opts = {}) {
  return rotated(box, opts.angle || 0, (big) => {
    const out = [];
    const step = spacing * 0.55;
    const amp = spacing * 1.2, wavelength = spacing * rng.range(6, 9), phase = rng.range(0, 6.28);
    for (let x = big.x - amp; x < big.x + big.w + amp; x += step) {
      const wobble = spacing * 0.12, wPhase = rng.range(0, 6.28);
      const pts = [];
      for (let y = big.y; y <= big.y + big.h + 8; y += 8) {
        const bend = Math.sin(y / wavelength * Math.PI * 2 + phase) * amp;
        const w = Math.sin(y / (wavelength * 0.37) + wPhase) * wobble;
        pts.push([x + bend + w, y]);
      }
      out.push(el('path', { d: polyPath(pts) }));
    }
    return out;
  });
}

// Ring patterns: for the halo behind the animal and the frame corners.
// They know the ring's centre and radii, and draw the two circles plus
// a motif repeated around the ring.
function ringMotif(box, rng, spacing, opts) {
  const { cx, cy, rIn, rOut, kind } = opts;
  const out = [];
  out.push(el('circle', { cx: f(cx), cy: f(cy), r: f(rIn) }));
  out.push(el('circle', { cx: f(cx), cy: f(cy), r: f(rOut) }));
  const rMid = (rIn + rOut) / 2, w = rOut - rIn;
  const n = Math.max(8, Math.round(2 * Math.PI * rMid / spacing));
  const a0 = rng.range(0, Math.PI * 2);
  const pt = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

  if (kind === 'petals') {
    const halfWidth = (Math.PI * rMid / n) * 0.6;
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      const [x0, y0] = pt(a, rIn + w * 0.08), [x1, y1] = pt(a, rOut - w * 0.08);
      const [mx, my] = pt(a, rMid);
      const nx = -Math.sin(a), ny = Math.cos(a);
      out.push(el('path', { d:
        `M${f(x0)} ${f(y0)} Q${f(mx + nx * halfWidth)} ${f(my + ny * halfWidth)} ${f(x1)} ${f(y1)}` +
        ` Q${f(mx - nx * halfWidth)} ${f(my - ny * halfWidth)} ${f(x0)} ${f(y0)} Z` }));
    }
  } else if (kind === 'beads') {
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(a0 + (i / n) * Math.PI * 2, rMid);
      out.push(el('circle', { cx: f(x), cy: f(y), r: f(w * 0.36) }));
    }
  } else if (kind === 'rays') {
    for (let i = 0; i < n; i++) {
      const a = a0 + (i / n) * Math.PI * 2;
      out.push(el('path', { d: polyPath([pt(a, rIn), pt(a, rOut)]) }));
    }
  } else { // 'zigzag': one closed star-shaped polygon bouncing between the circles
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      pts.push(pt(a0 + (i / (n * 2)) * Math.PI * 2, i % 2 ? rOut - w * 0.12 : rIn + w * 0.12));
    }
    out.push(el('path', { d: polyPath(pts, true), 'stroke-linejoin': 'miter' }));
  }
  return out;
}

// The families a band inside the animal may choose from, and which of
// them care about direction.
const FAMILIES = { spots, spirals, petals, scales, chevrons, strands };
const DIRECTIONAL = new Set([scales, chevrons, strands]);
// Line-based families need to be denser than blob-based ones to read
// as a texture, so each family scales the region's spacing a little.
const DENSITY = { spots: 1, spirals: 0.85, petals: 0.9, scales: 0.62, chevrons: 0.5, strands: 0.42 };

// Taste weights. Every choice the generator makes between families is a
// weighted draw from one of these tables: a weight of 2 makes a family
// twice as likely as one at 1, and 0.5 half as likely. All 1 means no
// preference. The favorites panel can propose new weights from your
// ratings, and you can edit them by hand; a page remembers the weights
// it was made with so a favorite still reproduces exactly.
const DEFAULT_WEIGHTS = {
  families: { spots: 1, spirals: 1, petals: 1, scales: 1, chevrons: 1, strands: 1 },
  halo:     { petals: 1, beads: 1, rays: 1, zigzag: 1 },
  frame:    { scales: 1, chevrons: 1, spirals: 1 },
};
let WEIGHTS = JSON.parse(JSON.stringify(DEFAULT_WEIGHTS));

// Pick one name from a list, with the odds given by a weight table.
// A weight that is missing counts as 1; nothing ever drops below 0.05,
// so a family can be made rare but never impossible.
function weightedPick(rng, names, table) {
  const w = names.map(n => Math.max(0.05, table && table[n] != null ? table[n] : 1));
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < names.length; i++) {
    r -= w[i];
    if (r < 0) return names[i];
  }
  return names[names.length - 1];
}

/* =====================================================================
   5. Regions, clipping, bands
   A region is drawn as: clipPath of its outline -> a white fill -> the
   pattern, all clipped to the outline. The outline stroke is drawn
   straight after, so any pattern line that reaches the edge is cut off
   and closed by the outline. That is what guarantees closed regions.

   A region can be split into bands: wavy dividers cross it at right
   angles to its "axis", and each band gets its own pattern (or is
   left calm). A band is a clip nested inside the region's clip.
   ===================================================================== */
// Clip ids must be unique across the whole document, and the favorites
// view draws several pages at once, so each render gets its own prefix.
let idCounter = 0, renderCounter = 0;
const nextId = () => 'r' + renderCounter + 'c' + (++idCounter);

// A wavy polyline through point q, at right angles to direction (dx, dy),
// long enough to cross any region on the page.
function wavyDivider(q, dx, dy, rng, amplitude) {
  const len = Math.hypot(dx, dy);
  const ux = -dy / len, uy = dx / len;          // direction of the divider
  const nx = dx / len, ny = dy / len;           // its sideways direction (along the axis)
  const wavelength = rng.range(120, 220), phase = rng.range(0, Math.PI * 2);
  const pts = [];
  for (let s = -1500; s <= 1500; s += 12) {
    const wob = Math.sin(s / wavelength * Math.PI * 2 + phase) * amplitude;
    pts.push([q[0] + ux * s + nx * wob, q[1] + uy * s + ny * wob]);
  }
  return pts;
}

// Decide how a region gets filled: one pattern, or several bands.
function planBands(ctx, region) {
  const rng = ctx.rng, detail = ctx.detail;
  const [p0, p1] = region.axis;
  const axisLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  let count = 1;
  if (region.bands) {
    count = rng.int(region.bands[0], region.bands[1]) + detail.bands;
    count = Math.max(1, Math.min(count, Math.floor(axisLen / 90)));
  }
  // Dividers sit at evenly spread positions along the axis, jittered.
  const dividers = [];
  for (let i = 1; i < count; i++) {
    const t = i / count + rng.range(-0.06, 0.06);
    const q = [p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t];
    dividers.push(wavyDivider(q, p1[0] - p0[0], p1[1] - p0[1], rng, rng.range(8, 16)));
  }
  // One pattern per band, never the same family twice in a row.
  // A region marked "calm" always keeps one band white as a resting place.
  const calmIndex = region.calm && count > 1 ? rng.int(0, count - 1) : -1;
  const bands = [];
  let last = null, calmUsed = false;
  const axisAngle = angleOf(p0, p1);
  for (let i = 0; i < count; i++) {
    let family = null;
    // At most one calm band per region, and never a region with no pattern at all.
    const calmHere = i === calmIndex || (!calmUsed && count > 1 && rng.chance(detail.calm));
    if (!calmHere) {
      family = weightedPick(rng, region.families.filter(name => name !== last), ctx.weights.families);
    } else {
      calmUsed = true;
    }
    last = family;
    const fn = family ? FAMILIES[family] : null;
    let angle = 0;
    if (fn && DIRECTIONAL.has(fn)) {
      // Strands follow the axis; scales and chevrons run across or along it.
      angle = fn === strands ? axisAngle + 90 : axisAngle + rng.pick([0, 90]) + rng.range(-6, 6);
    }
    const density = family ? DENSITY[family] : 1;
    const spacing = Math.max(MIN_SPACING, region.spacing * density * detail.mult * rng.range(0.85, 1.15));
    bands.push({ fn, angle, spacing });
    ctx.recipe.push({ part: region.name || 'region', band: i, family: family || 'calm' });
  }
  return { dividers, bands };
}

// Build a closed polygon that covers everything between two dividers.
function bandPolygon(a, b) {
  return polyPath(a.concat(b.slice().reverse()), true);
}

function drawRegion(ctx, region) {
  const { svg, defs, layer, rng, detail } = ctx;
  const clipId = nextId();
  const clipAttrs = region.evenodd ? { d: region.d, 'clip-rule': 'evenodd' } : { d: region.d };
  defs.appendChild(el('clipPath', { id: clipId }, [el('path', clipAttrs)]));

  // Measure the region so patterns know which rectangle to cover.
  const probe = el('path', { d: region.d });
  svg.appendChild(probe);
  const bb = probe.getBBox();
  svg.removeChild(probe);
  const box = { x: bb.x, y: bb.y, w: bb.width, h: bb.height };

  const fillAttrs = { d: region.d, fill: 'white' };
  if (region.evenodd) fillAttrs['fill-rule'] = 'evenodd';
  const group = el('g', { 'clip-path': `url(#${clipId})` });
  group.appendChild(el('path', fillAttrs));

  const patternGroup = (nodes) =>
    el('g', { fill: 'none', stroke: 'black', 'stroke-width': STROKE.pattern }, nodes);

  if (region.pattern) {
    // A fixed pattern (used by the halo rings and the frame).
    group.appendChild(patternGroup(region.pattern(box, rng, region.spacing, region.opts || {})));
  } else if (region.families) {
    const { dividers, bands } = planBands(ctx, region);
    // Straight, far-away edges close the first and last band.
    const [p0, p1] = region.axis;
    const far = (t) => wavyDivider([p0[0] + (p1[0] - p0[0]) * t, p0[1] + (p1[1] - p0[1]) * t],
                                   p1[0] - p0[0], p1[1] - p0[1], rng, 0);
    const edges = [far(-20)].concat(dividers, [far(20)]);
    bands.forEach((band, i) => {
      if (!band.fn) return;                       // a calm band: just white
      const bandClip = nextId();
      defs.appendChild(el('clipPath', { id: bandClip }, [el('path', { d: bandPolygon(edges[i], edges[i + 1]) })]));
      group.appendChild(el('g', { 'clip-path': `url(#${bandClip})` },
        [patternGroup(band.fn(box, rng, band.spacing, { angle: band.angle }))]));
    });
    // The divider lines themselves, clipped to the region so they end on the outline.
    for (const d of dividers) {
      group.appendChild(el('path', { d: polyPath(d), fill: 'none', stroke: 'black',
        'stroke-width': STROKE.divider, 'stroke-linecap': 'round' }));
    }
  }

  layer.appendChild(group);
  // The outline goes straight after the fill. A region drawn later paints
  // white over this one, which hides the join where two pieces overlap
  // (for example the ear base tucked behind the head).
  layer.appendChild(el('path', { d: region.d, fill: 'none', stroke: 'black',
    'stroke-width': region.thin ? STROKE.divider : STROKE.outline, 'stroke-linejoin': 'round' }));
}

/* =====================================================================
   Mirror helpers
   A face seen from the front is symmetric, so we draw only the left
   half and mirror it. Paths here use only absolute M, L, C, Q and Z,
   which keeps the parser tiny.
   ===================================================================== */
function parsePath(d) {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+/g) || [];
  const segs = [];
  let i = 0;
  while (i < tokens.length) {
    const cmd = tokens[i++];
    const count = { M: 2, L: 2, C: 6, Q: 4, Z: 0 }[cmd];
    const nums = [];
    for (let k = 0; k < count; k++) nums.push(Number(tokens[i++]));
    segs.push({ cmd, nums });
  }
  return segs;
}

// The same path reflected left-to-right across the vertical line x = cx.
function mirrorPath(d, cx) {
  return parsePath(d).map(s =>
    s.cmd + s.nums.map((n, i) => f(i % 2 === 0 ? 2 * cx - n : n)).join(' ')).join(' ');
}

// A closed symmetric shape from its left half. The half starts on the
// centre line, runs down the left side and ends on the centre line; the
// mirrored half is appended backwards (a curve run backwards swaps its
// two control points) and the shape is closed.
function symmetric(halfD, cx) {
  const segs = parsePath(halfD);
  const ends = segs.map(s => s.nums.slice(-2));
  const mx = (x) => f(2 * cx - x);
  const back = [];
  for (let i = segs.length - 1; i >= 1; i--) {
    const s = segs[i], prev = ends[i - 1];
    if (s.cmd === 'C') back.push(`C${mx(s.nums[2])} ${f(s.nums[3])} ${mx(s.nums[0])} ${f(s.nums[1])} ${mx(prev[0])} ${f(prev[1])}`);
    else if (s.cmd === 'Q') back.push(`Q${mx(s.nums[0])} ${f(s.nums[1])} ${mx(prev[0])} ${f(prev[1])}`);
    else back.push(`L${mx(prev[0])} ${f(prev[1])}`);
  }
  return halfD.trim() + ' ' + back.join(' ') + ' Z';
}

// Small helpers for the thin details: a stroke, and a stroke plus its mirror.
const detail = (d) => el('path', { d });
const mirrored = (d, cx) => [el('path', { d }), el('path', { d: mirrorPath(d, cx) })];

/* =====================================================================
   6. The animals
   Each animal is a jigsaw of closed paths in page coordinates, facing
   left. Regions are listed back-to-front: things drawn later cover
   things drawn earlier, and each region paints itself white first so
   the overlaps are hidden.

   Region fields:
     d         the closed path
     families  pattern names this region may use (omit for plain white)
     spacing   base pattern spacing before the detail multiplier
     axis      [from, to]: the long direction, dividers cross it
     bands     [min, max] number of bands
     calm      true = always leave one band white (a resting place)
     thin      true = draw the outline at divider weight (for small inner shapes)
   ===================================================================== */
function giraffe() {
  const bottom = PAGE_H + 20;   // the neck runs off the page; the frame closes it

  const neck = `
    M548 415
    C600 560, 665 790, 695 ${bottom}
    L425 ${bottom}
    C445 880, 465 700, 470 560
    C490 510, 520 460, 548 415 Z`;

  const mane = `
    M540 380
    C600 500, 670 740, 700 ${bottom}
    L745 ${bottom}
    C720 760, 650 500, 585 372 Z`;

  const ear = `
    M525 300
    C570 262, 625 232, 660 232
    C668 242, 645 292, 585 330
    C570 340, 555 350, 540 356 Z`;

  const innerEar = `
    M548 308
    C580 285, 615 262, 640 258
    C640 270, 620 295, 585 318
    C572 325, 560 332, 552 336 Z`;

  // The two ossicones (the horn-like knobs). Their bases sit a little
  // inside the skull so the head, drawn afterwards, covers the joint.
  const ossicone = (bx, tipX) => `
    M${bx} 285
    C${bx + 2} 250, ${tipX - 16} 232, ${tipX - 15} 212
    C${tipX - 32} 200, ${tipX - 24} 168, ${tipX} 168
    C${tipX + 24} 168, ${tipX + 32} 200, ${tipX + 15} 212
    C${tipX + 16} 232, ${bx + 44} 250, ${bx + 46} 285 Z`;

  const head = `
    M165 470
    C195 425, 240 380, 300 340
    C330 318, 352 300, 382 282
    C412 265, 452 258, 492 265
    C522 272, 542 295, 550 330
    C558 360, 554 390, 548 415
    C520 460, 490 510, 470 560
    C420 582, 330 588, 265 575
    C230 568, 210 562, 205 552
    C185 540, 160 512, 165 470 Z`;

  const eye = `
    M362 362
    C378 336, 422 336, 442 358
    C422 382, 378 384, 362 362 Z`;

  const nostril = `
    M214 448
    C204 440, 206 428, 218 428
    C226 428, 230 440, 222 452
    C218 456, 216 452, 214 448 Z`;

  return {
    halo: { cx: 400, cy: 440, r: 250 },
    regions: [
      { name: 'mane', d: mane, families: ['strands'], spacing: 30, axis: [[560, 380], [720, 1100]] },
      { name: 'neck', d: neck, families: ['spots', 'scales', 'petals', 'chevrons', 'spirals'], spacing: 66,
        axis: [[510, 470], [560, 1100]], bands: [2, 3], calm: true },
      { d: ear },
      { name: 'ear', d: innerEar, families: ['spirals', 'scales', 'chevrons'], spacing: 32, axis: [[550, 335], [650, 250]] },
      { name: 'ossicone', d: ossicone(404, 428), families: ['spirals', 'scales', 'petals'], spacing: 28, axis: [[426, 285], [428, 170]] },
      { name: 'ossicone', d: ossicone(458, 482), families: ['spirals', 'scales', 'petals'], spacing: 28, axis: [[480, 285], [482, 170]] },
      { name: 'head', d: head, families: ['spots', 'spirals', 'petals', 'scales', 'chevrons'], spacing: 50,
        axis: [[170, 480], [545, 380]], bands: [2, 3] },
      { d: eye },
      { d: nostril, thin: true },
    ],
    // Thin details drawn on top: they are strokes, not regions.
    details: [
      el('circle', { cx: 404, cy: 358, r: 12 }),                   // iris
      el('circle', { cx: 404, cy: 358, r: 5, fill: 'black' }),     // pupil
      el('path',   { d: 'M168 498 C190 512, 215 518, 240 520' }),  // mouth
      el('path',   { d: 'M356 352 C350 344, 346 336, 344 328' }),  // lashes
      el('path',   { d: 'M372 342 C368 334, 366 326, 366 318' }),
    ],
  };
}

function horse() {
  const bottom = PAGE_H + 20;

  const neck = `
    M500 250
    C590 420, 680 720, 720 ${bottom}
    L390 ${bottom}
    C420 900, 470 700, 480 545
    C500 470, 520 360, 500 250 Z`;

  // The mane hangs over the far edge of the neck. Its outer edge is a
  // series of soft locks; the strands pattern inside gives the flow.
  const mane = `
    M455 218
    C520 240, 585 290, 612 350
    C622 372, 612 392, 626 410
    C670 480, 700 570, 703 650
    C706 672, 694 700, 716 730
    C748 830, 766 950, 772 ${bottom}
    L640 ${bottom}
    C636 900, 605 650, 555 470
    C525 380, 495 300, 455 218 Z`;

  const earBack = `
    M468 240
    C474 190, 490 148, 510 124
    C526 150, 534 200, 526 252 Z`;

  const earFront = `
    M420 240
    C426 184, 440 138, 456 112
    C476 138, 486 194, 482 244 Z`;

  const innerEarFront = `
    M436 236
    C440 196, 448 160, 456 138
    C466 160, 472 200, 470 238 Z`;

  const head = `
    M168 468
    C200 416, 262 330, 350 252
    C382 226, 420 214, 452 216
    C492 220, 522 250, 534 292
    C548 342, 552 400, 542 440
    C534 480, 506 522, 472 546
    C430 574, 300 574, 220 546
    C196 538, 176 522, 170 500
    C166 488, 165 478, 168 468 Z`;

  const forelock = `
    M478 226
    C440 232, 404 256, 386 300
    C382 312, 386 322, 396 318
    C414 300, 436 282, 452 262
    C464 250, 474 238, 478 226 Z`;

  const eye = `
    M352 324
    C370 298, 412 298, 432 318
    C412 342, 370 344, 352 324 Z`;

  const nostril = `
    M226 446
    C210 438, 212 418, 228 418
    C240 418, 246 434, 238 452
    C234 460, 230 452, 226 446 Z`;

  return {
    halo: { cx: 380, cy: 400, r: 250 },
    regions: [
      { name: 'mane', d: mane, families: ['strands'], spacing: 30, axis: [[540, 250], [700, 1100]] },
      { name: 'neck', d: neck, families: ['scales', 'petals', 'chevrons', 'spirals', 'spots'], spacing: 62,
        axis: [[480, 480], [560, 1100]], bands: [2, 3], calm: true },
      { d: earBack },
      { d: earFront },
      { name: 'ear', d: innerEarFront, families: ['scales', 'chevrons'], spacing: 26, axis: [[454, 240], [456, 140]] },
      { name: 'head', d: head, families: ['petals', 'spirals', 'scales', 'chevrons', 'spots'], spacing: 48,
        axis: [[172, 480], [540, 340]], bands: [2, 3] },
      { name: 'forelock', d: forelock, families: ['strands'], spacing: 30, axis: [[470, 232], [392, 310]] },
      { d: eye },
      { d: nostril, thin: true },
    ],
    details: [
      el('circle', { cx: 394, cy: 320, r: 12 }),
      el('circle', { cx: 394, cy: 320, r: 5, fill: 'black' }),
      el('path',   { d: 'M172 496 C196 508, 222 512, 250 512' }),  // mouth
      el('path',   { d: 'M346 314 C340 306, 336 298, 334 290' }),  // lashes
      el('path',   { d: 'M362 304 C358 296, 356 288, 356 280' }),
    ],
  };
}

/* ---------- Front views: the left half is drawn, the right is mirrored ---------- */
const CX = PAGE_W / 2;   // the centre line every front view is mirrored across

function giraffeFront() {
  const bottom = PAGE_H + 20;

  // Neck: from behind the muzzle, widening as it leaves the page.
  const neck = symmetric(`M${CX} 640 C372 640, 345 720, 325 ${bottom} L${CX} ${bottom}`, CX);

  // A tuft of hair between the ossicones; the head covers its base.
  const tuft = symmetric(`M${CX} 250 C408 252, 396 274, 404 312 C412 316, 418 318, ${CX} 318`, CX);

  const ossicone = `
    M384 318
    C382 284, 384 254, 386 228
    C368 214, 374 176, 394 176
    C414 176, 420 214, 402 228
    C404 254, 408 284, 410 318 Z`;

  const ear = `
    M330 345
    C290 315, 225 300, 190 328
    C182 346, 218 386, 280 402
    C306 409, 322 406, 330 402 Z`;

  const innerEar = `
    M322 356
    C290 334, 238 322, 210 338
    C208 350, 236 376, 284 390
    C302 394, 314 392, 322 390 Z`;

  // The muzzle shares the head's last curve, so it sits exactly on the face.
  const chin = `C372 748, 398 762, ${CX} 764`;
  const head = symmetric(`
    M${CX} 300
    C395 297, 352 305, 330 330
    C306 360, 296 405, 298 450
    C302 510, 322 555, 340 600
    C352 640, 356 680, 362 715
    ${chin}`, CX);

  const muzzle = symmetric(`M${CX} 655 C400 650, 372 668, 362 715 ${chin}`, CX);

  const eye = `
    M306 452
    C320 432, 346 434, 358 454
    C346 470, 320 472, 306 452 Z`;

  const nostril = `
    M392 690
    C380 690, 376 706, 386 712
    C396 716, 402 704, 396 694 Z`;

  return {
    halo: { cx: CX, cy: 500, r: 245 },
    regions: [
      { name: 'neck', d: neck, families: ['spots', 'scales', 'petals', 'chevrons', 'spirals'], spacing: 62,
        axis: [[CX, 700], [CX, 1100]], bands: [1, 2], calm: true },
      { name: 'tuft', d: tuft, families: ['strands'], spacing: 26, axis: [[CX, 250], [CX, 318]] },
      { name: 'ossicone', d: ossicone, families: ['spirals', 'scales', 'petals'], spacing: 28, axis: [[397, 318], [394, 176]] },
      { name: 'ossicone', d: mirrorPath(ossicone, CX), families: ['spirals', 'scales', 'petals'], spacing: 28, axis: [[453, 318], [456, 176]] },
      { name: 'ear', d: ear }, { name: 'ear', d: mirrorPath(ear, CX) },
      { name: 'ear', d: innerEar, families: ['spirals', 'scales', 'chevrons'], spacing: 30, axis: [[322, 390], [210, 338]] },
      { name: 'ear', d: mirrorPath(innerEar, CX), families: ['spirals', 'scales', 'chevrons'], spacing: 30, axis: [[528, 390], [640, 338]] },
      { name: 'head', d: head, families: ['spots', 'spirals', 'petals', 'scales', 'chevrons'], spacing: 48,
        axis: [[CX, 300], [CX, 764]], bands: [2, 3] },
      { name: 'muzzle', d: muzzle, families: ['spirals', 'petals', 'scales'], spacing: 34, axis: [[CX, 655], [CX, 764]], calm: true, bands: [1, 1] },
      { name: 'eye', d: eye }, { name: 'eye', d: mirrorPath(eye, CX) },
      { name: 'nostril', d: nostril, thin: true }, { name: 'nostril', d: mirrorPath(nostril, CX), thin: true },
    ],
    details: [
      el('circle', { cx: 332, cy: 452, r: 10 }), el('circle', { cx: 2 * CX - 332, cy: 452, r: 10 }),
      el('circle', { cx: 332, cy: 452, r: 4, fill: 'black' }), el('circle', { cx: 2 * CX - 332, cy: 452, r: 4, fill: 'black' }),
      detail(`M${CX - 40} 742 C${CX - 20} 750, ${CX + 20} 750, ${CX + 40} 742`),   // mouth
    ].concat(
      mirrored('M310 442 C306 434, 304 426, 304 418', CX),        // lashes
      mirrored('M324 436 C322 428, 322 420, 323 412', CX),
      mirrored('M312 418 C328 404, 352 402, 368 410', CX),        // brow
      mirrored('M330 570 C336 600, 346 622, 358 640', CX),        // cheek line
    ),
  };
}

function horseFront() {
  const bottom = PAGE_H + 20;

  // The mane shows behind the neck on both sides; the neck sits over it.
  const mane = symmetric(`M${CX} 560 C350 560, 318 760, 314 ${bottom} L${CX} ${bottom}`, CX);
  const neck = symmetric(`M${CX} 640 C384 640, 362 760, 350 ${bottom} L${CX} ${bottom}`, CX);

  const ear = `
    M384 300
    C368 260, 354 216, 348 180
    C330 218, 326 264, 336 320 Z`;

  const innerEar = `
    M374 302
    C364 270, 356 238, 350 206
    C340 234, 338 270, 344 312 Z`;

  const chin = `C402 768, 416 772, ${CX} 772`;
  const head = symmetric(`
    M${CX} 290
    C392 288, 352 300, 336 335
    C318 375, 316 435, 322 480
    C332 545, 350 600, 358 650
    C366 700, 374 732, 388 754
    ${chin}`, CX);

  // A lock of forelock falling between the ears to a point on the forehead.
  const forelock = symmetric(`M${CX} 286 C396 284, 372 306, 366 346 C378 354, 402 360, ${CX} 392`, CX);

  // Muzzle: its side runs along the head's edge, its bottom is the chin.
  const muzzle = symmetric(`M${CX} 662 C404 658, 382 676, 371 712 C376 735, 380 748, 388 754 ${chin}`, CX);

  const eye = `
    M318 478
    C332 458, 356 460, 368 480
    C356 496, 332 498, 318 478 Z`;

  const nostril = `
    M388 694
    C374 694, 370 714, 382 722
    C396 728, 404 712, 398 698 Z`;

  return {
    halo: { cx: CX, cy: 500, r: 245 },
    regions: [
      { name: 'mane', d: mane, families: ['strands'], spacing: 30, axis: [[CX, 560], [CX, 1100]] },
      { name: 'neck', d: neck, families: ['scales', 'petals', 'chevrons', 'spirals', 'spots'], spacing: 60,
        axis: [[CX, 700], [CX, 1100]], bands: [1, 2], calm: true },
      { name: 'ear', d: ear }, { name: 'ear', d: mirrorPath(ear, CX) },
      { name: 'ear', d: innerEar, families: ['scales', 'chevrons'], spacing: 26, axis: [[358, 312], [350, 206]] },
      { name: 'ear', d: mirrorPath(innerEar, CX), families: ['scales', 'chevrons'], spacing: 26, axis: [[492, 312], [500, 206]] },
      { name: 'head', d: head, families: ['petals', 'spirals', 'scales', 'chevrons', 'spots'], spacing: 46,
        axis: [[CX, 290], [CX, 772]], bands: [2, 3] },
      { name: 'forelock', d: forelock, families: ['strands'], spacing: 26, axis: [[CX, 286], [CX, 392]] },
      { name: 'muzzle', d: muzzle, families: ['spirals', 'petals', 'scales'], spacing: 34, axis: [[CX, 662], [CX, 772]], calm: true, bands: [1, 1] },
      { name: 'eye', d: eye }, { name: 'eye', d: mirrorPath(eye, CX) },
      { name: 'nostril', d: nostril, thin: true }, { name: 'nostril', d: mirrorPath(nostril, CX), thin: true },
    ],
    details: [
      el('circle', { cx: 342, cy: 478, r: 10 }), el('circle', { cx: 2 * CX - 342, cy: 478, r: 10 }),
      el('circle', { cx: 342, cy: 478, r: 4, fill: 'black' }), el('circle', { cx: 2 * CX - 342, cy: 478, r: 4, fill: 'black' }),
      detail(`M${CX - 30} 752 C${CX - 14} 758, ${CX + 14} 758, ${CX + 30} 752`),   // mouth
    ].concat(
      mirrored('M322 468 C318 460, 316 452, 316 444', CX),        // lashes
      mirrored('M336 462 C334 454, 334 446, 335 438', CX),
      mirrored('M322 444 C340 432, 364 430, 380 438', CX),        // brow
      mirrored('M340 590 C344 618, 352 642, 364 660', CX),        // cheek line
    ),
  };
}

// Each animal has poses; a pose is a function that returns the regions.
const ANIMALS = {
  giraffe: { front: giraffeFront, profile: giraffe },
  horse:   { front: horseFront,   profile: horse },
};

/* =====================================================================
   7. The frame and the halo
   The frame is a patterned band between two border lines, a small
   medallion in each corner, and a quarter-fan of petals spilling into
   each inner corner. The halo is a set of patterned rings behind the
   animal's head, which turns the empty paper into part of the mandala.
   ===================================================================== */
function drawFrame(ctx) {
  const { svg, rng } = ctx;
  const o = FRAME.inset, W = FRAME.band, i = o + W;
  const inner = { x: i, y: i, w: PAGE_W - 2 * i, h: PAGE_H - 2 * i };
  const rect = (x, y, w, h) => `M${x} ${y} h${w} v${h} h${-w} Z`;

  // One family for all four sides so the frame feels like one object.
  const family = FAMILIES[weightedPick(rng, ['scales', 'chevrons', 'spirals'], ctx.weights.frame)];
  ctx.recipe.push({ part: 'frame', family: family.name });
  const spacing = W * (family === scales ? 0.9 : 0.8);
  const sides = [
    { d: rect(i, o, inner.w, W),           angle: 0 },   // top
    { d: rect(i, PAGE_H - i, inner.w, W),  angle: 0 },   // bottom
    { d: rect(o, i, W, inner.h),           angle: 90 },  // left
    { d: rect(PAGE_W - i, i, W, inner.h),  angle: 90 },  // right
  ];
  for (const s of sides) drawRegion(ctx, { d: s.d, pattern: family, spacing, opts: { angle: s.angle }, thin: true });

  // Corner medallions: a circle with a spiral, in each corner square.
  for (const [cx, cy] of [[o + W / 2, o + W / 2], [PAGE_W - o - W / 2, o + W / 2],
                          [o + W / 2, PAGE_H - o - W / 2], [PAGE_W - o - W / 2, PAGE_H - o - W / 2]]) {
    drawRegion(ctx, { d: rect(cx - W / 2, cy - W / 2, W, W), pattern: spirals, spacing: W * 0.96, thin: true });
  }

  // Border lines.
  svg.appendChild(el('rect', { x: o, y: o, width: PAGE_W - 2 * o, height: PAGE_H - 2 * o,
    fill: 'none', stroke: 'black', 'stroke-width': STROKE.outline }));
  svg.appendChild(el('rect', { x: i, y: i, width: inner.w, height: inner.h,
    fill: 'none', stroke: 'black', 'stroke-width': STROKE.outline }));

  return inner;
}

// A quarter-circle fan at a corner of the inner area. sx and sy say
// which way the quarter opens (+1 right/down, -1 left/up).
function cornerFan(ctx, cx, cy, sx, sy) {
  const { rng } = ctx;
  const R = 118;
  const sweep = sx * sy > 0 ? 1 : 0;
  const d = `M${cx} ${cy} L${cx + sx * R} ${cy} A${R} ${R} 0 0 ${sweep} ${cx} ${cy + sy * R} Z`;
  drawRegion(ctx, { d, pattern: ringMotif, spacing: 30,
    opts: { cx, cy, rIn: R * 0.3, rOut: R * 0.92, kind: rng.pick(['petals', 'rays', 'zigzag']) }, thin: true });
}

function drawHalo(ctx, halo) {
  const { rng, detail } = ctx;
  const width = 38, gap = 24;
  const kinds = ['petals', 'beads', 'rays', 'zigzag'];
  let last = null;
  for (let k = 0; k < detail.rings; k++) {
    const rIn = halo.r + k * (width + gap), rOut = rIn + width;
    const kind = weightedPick(rng, kinds.filter(x => x !== last), ctx.weights.halo);
    last = kind;
    ctx.recipe.push({ part: 'halo', band: k, family: kind });
    drawRegion(ctx, { d: ringPath(halo.cx, halo.cy, rIn, rOut), evenodd: true,
      pattern: ringMotif, spacing: kind === 'rays' ? 20 : 30,
      opts: { cx: halo.cx, cy: halo.cy, rIn, rOut, kind }, thin: true });
  }
}

/* =====================================================================
   8. Putting a page together
   ===================================================================== */
function render(svg, settings) {
  const subject = settings.subject, detailName = settings.detail, seed = settings.seed;
  const pose = ANIMALS[subject][settings.pose] ? settings.pose : 'front';
  svg.innerHTML = '';
  renderCounter++;
  idCounter = 0;
  const rng = makeRng(seed);
  const detail = DETAIL[detailName];
  // The recipe is the list of choices this page made: which family went
  // in each band, ring and frame. Favorites save it so we can later see
  // which choices keep getting liked.
  const recipe = [];
  const weights = settings.weights || WEIGHTS;

  const defs = el('defs');
  svg.appendChild(defs);
  svg.appendChild(el('rect', { width: PAGE_W, height: PAGE_H, fill: 'white' }));

  const frameLayer = el('g');
  svg.appendChild(frameLayer);
  const inner = drawFrame({ svg, defs, layer: frameLayer, rng, detail, recipe, weights });

  // Everything inside the inner border lives in one clipped group, so
  // the neck and the halo run cleanly off the edge and the border
  // closes them.
  const artClip = nextId();
  defs.appendChild(el('clipPath', { id: artClip }, [
    el('rect', { x: inner.x, y: inner.y, width: inner.w, height: inner.h })]));
  const art = el('g', { 'clip-path': `url(#${artClip})` });
  const layer = el('g');
  const details = el('g', { fill: 'none', stroke: 'black', 'stroke-width': STROKE.divider,
    'stroke-linecap': 'round' });
  art.append(layer, details);
  svg.appendChild(art);

  const ctx = { svg, defs, layer, rng, detail, recipe, weights };
  const animal = ANIMALS[subject][pose]();
  cornerFan(ctx, inner.x, inner.y, 1, 1);
  cornerFan(ctx, inner.x + inner.w, inner.y, -1, 1);
  cornerFan(ctx, inner.x, inner.y + inner.h, 1, -1);
  cornerFan(ctx, inner.x + inner.w, inner.y + inner.h, -1, -1);
  drawHalo(ctx, animal.halo);
  for (const region of animal.regions) drawRegion(ctx, region);
  for (const d of animal.details) details.appendChild(d);

  // A small label in the bottom band so the seed survives on paper.
  const label = `${subject} ${pose} · seed ${seed} · detail ${detailName} · v${GENERATOR_VERSION}`;
  const lw = label.length * 6.2 + 24, ly = PAGE_H - FRAME.inset - FRAME.band / 2;
  svg.appendChild(el('rect', { x: PAGE_W / 2 - lw / 2, y: ly - 11, width: lw, height: 22,
    fill: 'white', stroke: 'black', 'stroke-width': STROKE.pattern }));
  svg.appendChild(el('text', { x: PAGE_W / 2, y: ly + 4, 'text-anchor': 'middle',
    'font-family': 'Georgia, serif', 'font-size': 11, fill: 'black' }, [document.createTextNode(label)]));

  return { label, recipe, weights };
}
