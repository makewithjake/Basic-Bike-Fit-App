# Angle Visibility Update – Implementation Plan

## Goal
Two visual improvements to angle labels on the canvas:
1. **Translucent background pill/box** behind each angle label text so it remains legible on a busy photo background.
2. **Arc (pie-wedge) between the two skeleton lines** at each joint vertex so it is visually clear which opening the angle measurement refers to.

---

## Feature 1 – Translucent Label Background

### Where to change
Inside `draw()` in `script.js`, in the existing `if (angle !== null)` block, just before the `ctx.fillText(...)` call (currently around line 176–179).

### What to do

1. After setting `ctx.font = 'bold 16px Arial'`, measure the text string with `ctx.measureText(...)` to get its pixel width.
2. Define padding constants: `const PAD_X = 6; const PAD_Y = 4;` (horizontal/vertical inner padding in px).
3. Compute the background rectangle:
   - `labelX = p.x + 15`, `labelY = p.y - 15` (same offset used for `fillText`)
   - rect left:   `labelX - PAD_X`
   - rect top:    `labelY - fontSize - PAD_Y`  (where `fontSize = 16`)
   - rect width:  `textWidth + PAD_X * 2`
   - rect height: `fontSize + PAD_Y * 2`
4. Draw the background rectangle using `ctx.save()` / `ctx.restore()`:
   - `ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'`
   - Use a rounded rectangle path:  `ctx.roundRect(left, top, width, height, 4)` (radius 4px corner) or `fillRect` if `roundRect` is not available (fallback).
   - `ctx.fill()`
5. Restore and then draw the text as before (colour-coded green/red over the dark pill).

### Notes
- `ctx.roundRect` is available in all modern browsers (Chrome 99+, Firefox 112+, Safari 15.4+). Add a simple fallback to plain `fillRect` if needed for older targets.
- The text colour remains `isOk ? COLOR_GOOD : COLOR_WARN` (green or red) — the dark background makes both colours pop more.
- Keep `ctx.font` set before measuring so the measurement uses the same font as the actual draw call.

---

## Feature 2 – Arc / Pie-Wedge at Joint Vertices

### Where to add
Create a new helper function `drawAngleArc(ctx, vertex, pA, pB, color)` and call it from within the `if (angle !== null)` block, before drawing the label text.

### Helper function logic – `drawAngleArc(ctx, vertex, pA, pB, color)`

Parameters:
- `vertex` – the middle joint point `{x, y}` (the apex of the angle)
- `pA` – one outer point `{x, y}`
- `pB` – the other outer point `{x, y}`
- `color` – the colour string (green or red) for this joint

Steps:
1. Compute the two vector angles from the vertex toward each outer point:
   - `aA = Math.atan2(pA.y - vertex.y, pA.x - vertex.x)`
   - `aB = Math.atan2(pB.y - vertex.y, pB.x - vertex.x)`
2. Determine arc direction: always draw the *shorter* arc between the two rays.
   - Compute `delta = aB - aA`. Normalise to `(-π, π]` by adding or subtracting `2π` if needed.
   - If `|delta| > Math.PI`, flip the arc direction (swap `aA` / `aB` or toggle the `anticlockwise` flag) so we always sweep the interior (smaller) angle.
3. Define arc radius: `const ARC_RADIUS = 30;` (pixels on canvas — scales naturally with canvas size).
4. Draw a translucent filled sector (pie wedge):
   - `ctx.save()`
   - `ctx.fillStyle = color` with **global alpha** dropped to `0.25` (`ctx.globalAlpha = 0.25`)
   - `ctx.beginPath()`
   - `ctx.moveTo(vertex.x, vertex.y)`
   - `ctx.arc(vertex.x, vertex.y, ARC_RADIUS, aA, aB, anticlockwise)`
   - `ctx.closePath()` — closes back to `vertex`, making the filled pie shape
   - `ctx.fill()`
5. Draw a stroke arc (the curved edge only, no spokes) on top at full opacity:
   - `ctx.globalAlpha = 0.85`
   - `ctx.strokeStyle = color`
   - `ctx.lineWidth = 2`
   - `ctx.beginPath()`
   - `ctx.arc(vertex.x, vertex.y, ARC_RADIUS, aA, aB, anticlockwise)`
   - `ctx.stroke()`
   - `ctx.restore()`

### Per-joint arguments for the call site

| Index | Joint    | `vertex`    | `pA`        | `pB`        | Special?  |
|-------|----------|-------------|-------------|-------------|-----------|
| 1     | Ankle    | `points[1]` | `points[0]` | `points[2]` | No        |
| 2     | Knee     | `points[2]` | `points[1]` | `points[3]` | No        |
| 3     | Back     | `points[3]` | — see below | `points[4]` | **Yes**   |
| 4     | Shoulder | `points[4]` | `points[3]` | `points[5]` | No        |
| 5     | Elbow    | `points[5]` | `points[4]` | `points[6]` | No        |

### Back angle special case
The Back angle is measured from horizontal (not a standard three-point flex). For the arc:
- `pA` is a synthetic horizontal reference point to the right of the hip: `{ x: points[3].x + 60, y: points[3].y }`
- `pB` = `points[4]` (Shoulder)
- This matches what the angle actually measures (torso tilt from horizontal).

### Elbow display vs. arc note
The displayed Elbow value is `180 - calcAngle(...)` (the flexion/bend amount). The arc, however, shows the geometric interior angle at the joint between the upper arm and forearm — the same sector `calcAngle` returns. This is visually accurate (the arc spans the bend gap between the two limb segments).

---

## Draw Order (important for clarity)

Within the existing `forEach` loop's `if (angle !== null)` block, execute in this order:
1. **`drawAngleArc(...)`** — drawn first so the skeleton lines and dots render on top of the arc.
2. **Label background rectangle** — drawn after the arc.
3. **Label text** — drawn last (on top of everything).

The arc helper itself should call `ctx.save()` / `ctx.restore()` to avoid polluting global canvas state.

---

## PDF Export Consideration
Per the project rules, any canvas visuals that need to appear in the PDF must be duplicated in the PDF code path (which builds the PDF programmatically without reading the canvas). The angle labels already have a PDF parallel. For this update:
- The **translucent label box** can optionally be added to the PDF path using jsPDF rectangle drawing before the text — low priority, cosmetic only.
- The **arc** visual may be skipped in the PDF initially (the PDF already has a results table). Flag this as a future improvement if desired.

---

## Files to Change
- `script.js` — all changes (new `drawAngleArc` helper + label background code in the `draw()` function)
- No HTML or CSS changes required.
