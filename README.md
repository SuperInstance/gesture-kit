# gesture-kit

**Read the shape of motion through any abstraction space.** A tensor approximates a *function*; this approximates the *abstraction* — the smooth motion between states. Give it an ordered sequence of numeric vectors — a melody's notes, a room's mood readings, a conversation, a model's training path, a cell's value history — and it reads that path's geometry, **order by order**.

Zero dependencies. Pure ES module. Ships with an embeddable `<gesture-hull>` widget.

```js
import { Gesture, gestureDistance, readGesture } from '@superinstance/gesture-kit';

const g = new Gesture([[0,0], [1,2], [2,1], [3,3], [2,5]]);
g.arcLength();      // total distance travelled
g.heading();        // unit direction it's going now — the d_mu
g.bendingEnergy();  // curvature: turning within a plane
g.twistEnergy();    // torsion: turning that leaves the plane
g.planarity();      // scale-free inverse of twist
```

## The three orders

| Order | Method | Reads | Zero when… |
|---|---|---|---|
| 1st | `arcLength()` / `heading()` | distance, and the direction now (a velocity, the **d_mu**) | it isn't moving |
| 2nd | `bendingEnergy()` | **curvature** — turning *within* a plane | it moves in a straight line |
| 3rd | `twistEnergy()` | **torsion** — turning *out of* that plane, into a new dimension | its whole motion stays in one plane |

Curvature rearranges what's already there; **torsion reaches what wasn't**. An arch bends hard but never leaves its plane (twist ≈ 0); a helix bends the same and keeps opening a new axis (twist > 0). *The property is in the twist.*

## Compare motions, not moments

```js
import { gestureDistance, headingAlignment } from '@superinstance/gesture-kit';

gestureDistance(a, b);   // how differently two paths MOVE — free of position,
                         // scale, and sampling rate. 0 = same motion, 2 = opposed.
headingAlignment(a, b);  // do two things trend the same way? cosine of their d_mu.
```

`gestureDistance` arc-length-resamples both paths before comparing unit directions, so a melody's rise-and-fall through *pitch* space and a room's rise-and-fall through *mood* space — different coordinates, scale, and length — come out **close**, while a steady climb comes out far. Motion compared by shape alone, across axes that never touch.

## The embeddable widget

```html
<script type="module" src="https://.../gesture-kit/src/widget.js"></script>
<gesture-hull points="[[0,0],[1,2],[2,1],[3,3]]"></gesture-hull>
```

or drive it from JS with vectors of any dimension:

```js
import '@superinstance/gesture-kit/widget';
document.querySelector('gesture-hull').points = myTrajectory; // array of number[]
```

`<gesture-hull>` draws the path as a **vibrating hull**: each segment tinted by its local turning (blue = calm, red = taut) and thickened where the path whips around, with live `arc / bend / twist / planarity / |d_mu|` readouts. High-dimensional gestures are projected to their two highest-variance axes for drawing, while the geometry is always computed in full dimension. It's a plain custom element — no framework, no build step. See [`demo/`](demo/index.html).

## API

- `new Gesture(points)` — `points` is an array of numeric vectors (any dimension).
- `Gesture.fromSeries(numbers)` — a scalar history as a 1-D path.
- `.arcLength() .speed() .heading() .bendingEnergy() .twistEnergy() .planarity()`
- `.stressProfile()` — per-vertex local turning (the stress line the widget draws).
- `.resample(n)` — resample to `n` points spaced evenly by arc length.
- `gestureDistance(a, b, samples=32)` · `headingAlignment(a, b)` · `readGesture(points)`
- `readTrajectory(rows, { dims, normalize })` — read a path whose dimensions live on different scales. Selects `dims` (default all), **per-column min–max normalizes** so no axis dominates (default on), then reads the geometry. Returns the `readGesture` summary **plus** `points` (the exact cloud it measured, so a view draws what was read) and `{ dims, normalized }`.
- `normalizeColumns(rows)` — the per-column [0,1] rescale on its own (a constant column → 0).

All methods are total: empty and single-point gestures return sensible zeros, never throw.

### Reading a trajectory whose axes have different scales

```js
import { readTrajectory } from '@superinstance/gesture-kit';

// A breed run's ℚ¹⁶ dials, or a robot's (x, z, heading): mixed units, so a raw
// reading would let the biggest-magnitude axis drown the rest. Normalize first.
const g = readTrajectory(rows, { dims: [0, 1, 3, 4] }); // keep the meaningful axes
g.bendingEnergy;   // 2nd order — turning within a plane
g.twistEnergy;     // 3rd order — turning out of it
g.points;          // the normalized cloud, ready to hand a <gesture-hull>
```

This is the reading `quilt-gan` (ℚ¹⁶ breed dials) and `Scrapcraft` (a robot's `(x,z,heading)` drive) each re-derived — now canonical here, so the whole fleet reads a path the same way.

## Why it exists

The SuperInstance fleet kept re-deriving this same reading — over notes ([musician-soul](https://github.com/SuperInstance/musician-soul)), a room's dials ([elephant](https://github.com/SuperInstance/elephant)), conversation events ([tensor-midi](https://github.com/SuperInstance/tensor-midi)), cell state ([quilt](https://github.com/SuperInstance/quilt)), and a federated model's convergence ([federated-tinyml-vessel](https://github.com/SuperInstance/federated-tinyml-vessel)). `gesture-kit` is the canonical, dependency-free home for it, and the widget makes the shape visible anywhere.

## Test

```
npm test   # node --test, zero-dependency
```

## License

MIT
