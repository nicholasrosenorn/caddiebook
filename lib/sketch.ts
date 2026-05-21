// Deterministic "hand-drawn" geometry helpers for the SVG visual language.
// Everything is seeded so shapes look sketched but never reflow between renders.

export type Point = { x: number; y: number };

function hashSeed(seed: string | number): number {
  if (typeof seed === 'number') return seed >>> 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// mulberry32 — small, fast, deterministic PRNG.
export function makeRng(seed: string | number): () => number {
  let a = hashSeed(seed);
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

// Smooth closed path through points via Catmull-Rom → cubic bezier.
export function smoothClosedPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return '';
  const p = (i: number) => points[((i % n) + n) % n];
  let d = `M ${round(p(0).x)} ${round(p(0).y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${round(cp1x)} ${round(cp1y)}, ${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return `${d} Z`;
}

// Smooth open path through points (used for wavy grass lines, topo lines).
export function smoothOpenPath(points: Point[]): string {
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) return `M ${round(points[0].x)} ${round(points[0].y)} L ${round(points[1].x)} ${round(points[1].y)}`;
  const p = (i: number) => points[Math.max(0, Math.min(n - 1, i))];
  let d = `M ${round(points[0].x)} ${round(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${round(cp1x)} ${round(cp1y)}, ${round(cp2x)} ${round(cp2y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

// A ball-flight arc: a clean parabola from a tee point to a landing point on a
// shared ground line. apexH is the rise at the midpoint (bigger = loftier /
// longer carry). Deterministic — no jitter; the trajectory reads as a precise
// drafted curve, and length encodes distance (DESIGN.md P2/P3).
export function trajectoryPath(
  x0: number,
  x1: number,
  groundY: number,
  apexH: number,
): string {
  const xMid = (x0 + x1) / 2;
  return `M ${round(x0)} ${round(groundY)} Q ${round(xMid)} ${round(groundY - apexH)} ${round(x1)} ${round(groundY)}`;
}

// A slightly irregular ring/disc outline.
export function roughCirclePath(
  cx: number,
  cy: number,
  r: number,
  seed: string | number,
  { jitter = 0.04, points = 18 }: { jitter?: number; points?: number } = {},
): string {
  const rng = makeRng(seed);
  const pts: Point[] = [];
  const amp = r * jitter;
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    const rr = r + (rng() - 0.5) * 2 * amp;
    pts.push({ x: cx + Math.cos(theta) * rr, y: cy + Math.sin(theta) * rr });
  }
  return smoothClosedPath(pts);
}

// A peanut / kidney bunker silhouette. lobe controls the waist pinch.
export function bunkerPath(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: string | number,
  { lobe = 0.32, jitter = 0.07, points = 22, rotation = 0 }: {
    lobe?: number;
    jitter?: number;
    points?: number;
    rotation?: number;
  } = {},
): string {
  const rng = makeRng(seed);
  const pts: Point[] = [];
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    // Pinch the waist along the x axis to read as two lobes.
    const pinch = 1 - lobe * Math.cos(theta * 2);
    const wobble = 1 + (rng() - 0.5) * 2 * jitter;
    const px = Math.cos(theta) * rx * wobble;
    const py = Math.sin(theta) * ry * pinch * wobble;
    const rx2 = px * Math.cos(rotation) - py * Math.sin(rotation);
    const ry2 = px * Math.sin(rotation) + py * Math.cos(rotation);
    pts.push({ x: cx + rx2, y: cy + ry2 });
  }
  return smoothClosedPath(pts);
}

// Tall rounded "surfboard" fairway silhouette (vertical oval, gently tapered ends).
export function fairwayPath(
  width: number,
  height: number,
  seed: string | number,
  { jitter = 0.025, points = 28 }: { jitter?: number; points?: number } = {},
): string {
  const rng = makeRng(seed);
  const cx = width / 2;
  const cy = height / 2;
  const rx = width / 2;
  const ry = height / 2;
  const pts: Point[] = [];
  for (let i = 0; i < points; i++) {
    const theta = (i / points) * Math.PI * 2;
    // Taper the horizontal radius toward the poles for a board-like nose/tail.
    const taper = 0.82 + 0.18 * Math.abs(Math.sin(theta));
    const wob = 1 + (rng() - 0.5) * 2 * jitter;
    pts.push({
      x: cx + Math.cos(theta) * rx * taper * wob,
      y: cy + Math.sin(theta) * ry * wob,
    });
  }
  return smoothClosedPath(pts);
}

// Vertical wavy "grain" lines inside a box.
export function wavyLines(
  width: number,
  height: number,
  count: number,
  seed: string | number,
  { amplitude = 6, segments = 10, marginY = 0.08 }: {
    amplitude?: number;
    segments?: number;
    marginY?: number;
  } = {},
): string[] {
  const rng = makeRng(seed);
  const out: string[] = [];
  const top = height * marginY;
  const bottom = height * (1 - marginY);
  for (let c = 0; c < count; c++) {
    const baseX = (width * (c + 1)) / (count + 1);
    const phase = rng() * Math.PI * 2;
    const amp = amplitude * (0.6 + rng() * 0.7);
    const pts: Point[] = [];
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const y = top + (bottom - top) * t;
      const x = baseX + Math.sin(phase + t * Math.PI * 3) * amp;
      pts.push({ x, y });
    }
    out.push(smoothOpenPath(pts));
  }
  return out;
}

// Random stipple dots inside an ellipse (sand grain / paper grain).
export function stippleInEllipse(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  count: number,
  seed: string | number,
  { minR = 0.5, maxR = 1.3, inset = 0.86 }: { minR?: number; maxR?: number; inset?: number } = {},
): { x: number; y: number; r: number }[] {
  const rng = makeRng(seed);
  const dots: { x: number; y: number; r: number }[] = [];
  let guard = 0;
  while (dots.length < count && guard < count * 12) {
    guard++;
    const u = rng() * 2 - 1;
    const v = rng() * 2 - 1;
    if (u * u + v * v > inset * inset) continue;
    dots.push({
      x: round(cx + u * rx),
      y: round(cy + v * ry),
      r: round(minR + rng() * (maxR - minR)),
    });
  }
  return dots;
}

// A barely-irregular rounded rectangle outline — crisp enough to read as a
// frame, hand-drawn enough to sit with the rest of the language. Used for
// card / button / input borders. Keep jitter low (restrained, not sketchy).
export function roughRectPath(
  width: number,
  height: number,
  radius: number,
  seed: string | number,
  { jitter = 0.6, perSide = 3, inset = 0.75 }: {
    jitter?: number;
    perSide?: number;
    inset?: number;
  } = {},
): string {
  const rng = makeRng(seed);
  const x0 = inset;
  const y0 = inset;
  const x1 = width - inset;
  const y1 = height - inset;
  const r = Math.max(0, Math.min(radius, (x1 - x0) / 2, (y1 - y0) / 2));
  const j = () => (rng() - 0.5) * 2 * jitter;

  // Walk the four straight edges (inset by the corner radius) with a few
  // jittered waypoints each, joining corners with quadratic arcs.
  const pts: Point[] = [];
  const edge = (
    ax: number,
    ay: number,
    bx: number,
    by: number,
  ) => {
    for (let i = 0; i <= perSide; i++) {
      const t = i / perSide;
      pts.push({ x: ax + (bx - ax) * t + j(), y: ay + (by - ay) * t + j() });
    }
  };

  let d = `M ${round(x0 + r)} ${round(y0)}`;
  edge(x0 + r, y0, x1 - r, y0);
  for (const p of pts) d += ` L ${round(p.x)} ${round(p.y)}`;
  d += ` Q ${round(x1)} ${round(y0)} ${round(x1)} ${round(y0 + r)}`;
  pts.length = 0;
  edge(x1, y0 + r, x1, y1 - r);
  for (const p of pts) d += ` L ${round(p.x)} ${round(p.y)}`;
  d += ` Q ${round(x1)} ${round(y1)} ${round(x1 - r)} ${round(y1)}`;
  pts.length = 0;
  edge(x1 - r, y1, x0 + r, y1);
  for (const p of pts) d += ` L ${round(p.x)} ${round(p.y)}`;
  d += ` Q ${round(x0)} ${round(y1)} ${round(x0)} ${round(y1 - r)}`;
  pts.length = 0;
  edge(x0, y1 - r, x0, y0 + r);
  for (const p of pts) d += ` L ${round(p.x)} ${round(p.y)}`;
  d += ` Q ${round(x0)} ${round(y0)} ${round(x0 + r)} ${round(y0)} Z`;
  return d;
}

// A near-straight divider stroke with a faint hand-drawn waver.
export function sketchDividerPath(
  width: number,
  seed: string | number,
  { amplitude = 0.7, segments = 6, y = 1 }: {
    amplitude?: number;
    segments?: number;
    y?: number;
  } = {},
): string {
  const rng = makeRng(seed);
  const pts: Point[] = [];
  for (let s = 0; s <= segments; s++) {
    const t = s / segments;
    pts.push({ x: width * t, y: y + (rng() - 0.5) * 2 * amplitude });
  }
  return smoothOpenPath(pts);
}

// Random stipple dots inside a rectangle (paper grain / tooth).
export function stippleInRect(
  width: number,
  height: number,
  count: number,
  seed: string | number,
  { minR = 0.4, maxR = 1.1 }: { minR?: number; maxR?: number } = {},
): { x: number; y: number; r: number }[] {
  const rng = makeRng(seed);
  const dots: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < count; i++) {
    dots.push({
      x: round(rng() * width),
      y: round(rng() * height),
      r: round(minR + rng() * (maxR - minR)),
    });
  }
  return dots;
}

// Concentric topo contour rings for the little "map" chip.
export function topoRings(
  cx: number,
  cy: number,
  maxR: number,
  count: number,
  seed: string | number,
): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const r = (maxR * (i + 1)) / count;
    out.push(roughCirclePath(cx, cy, r, `${seed}-topo-${i}`, { jitter: 0.1, points: 14 }));
  }
  return out;
}
