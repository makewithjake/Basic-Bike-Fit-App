# "More" Button & Theory Modal – Implementation Plan

## Feature from plan.md
**Add Theory and Sources Link** – A "More" button opens a modal window containing basic fit theory, explanatory text, book cover images, and affiliate/external links to applicable books.

---

## Current Button Row (baseline)

```
[ Clear Canvas & Reset ]         ← full-width row
[ Help ]  [ Demo Image ]  [ Download PDF Report ]  ← inline row
```

Target layout after this change:

```
[ Clear Canvas & Reset ]
[ Help ]  [ Demo Image ]  [ Download PDF Report ]  [ More ]
```

---

## Implementation Overview

### 1. Button – `index.html`

- Add `<button type="button" id="moreBtn" class="more-btn">More</button>` as the **last child** inside `.action-buttons`, immediately after `#pdfBtn`.
- No structural changes to the row are needed; the existing flex layout will push the new button to the right end naturally.
- Give it a distinct class (`more-btn`) so it can be styled independently.

### 2. Styling the Button – `style.css`

- Add a `.more-btn` rule. Use a neutral or accent colour that visually distinguishes it from the functional buttons (Help, Demo, PDF) without competing with them. A muted teal or slate tone works well with the existing palette.
- On mobile (≤ 600 px) the action-buttons grid collapses to 2 columns. "More" should flow into the grid naturally with no special spanning rule.
- The button does not need print/PDF visibility changes; the `.no-print-zone` wrapper already handles that.

### 3. Modal HTML – `index.html`

Add a modal overlay `<div id="moreModal" class="modal-overlay" hidden>` near the bottom of `<body>` (outside `.no-print-zone` is fine; it is invisible during PDF export).

Inner structure:

```
.modal-overlay          ← full-screen dimmed backdrop; click outside dismisses
  .modal-box            ← centred card, max-width ~640 px, scrollable
    .modal-header
      <h2>Fit Theory & Resources</h2>
      <button id="moreModalClose">✕</button>
    .modal-body
      <section class="theory-text">
        <p> … paragraph one … </p>
        <p> … paragraph two … </p>
      </section>
      <section class="theory-resources">
        <!-- one card per book -->
        <a class="book-card" href="…" target="_blank" rel="noopener noreferrer">
          <img src="…" alt="Book title cover">
          <span>Book Title</span>
        </a>
        <!-- repeat for each additional book -->
      </section>
```

Content placeholders (to be filled in when coding):
- **Theory paragraphs**: 1–2 paragraphs covering saddle height basics, knee angle targets,
  and why position affects power, comfort, and injury risk.
- **Book cards**: 2–3 books (e.g. *Bike Fit* by Phil Burt, others TBD); each card shows a
  thumbnail and title linking to the purchase page (Amazon affiliate or direct).

### 4. Modal Styling – `style.css`

- `.modal-overlay`: `position: fixed; inset: 0; background: rgba(0,0,0,0.55); display: flex; align-items: center; justify-content: center; z-index: 1000`. Hidden via the `hidden` attribute by default.
- `.modal-box`: `background: var(--panel-bg); border-radius: 10px; padding: 24px; max-width: 640px; width: 90%; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.4)`.
- `.modal-header`: `display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px`. Close button is a plain icon button with no background fill.
- `.theory-text p`: normal body text, line-height ~1.6.
- `.theory-resources`: `display: flex; flex-wrap: wrap; gap: 16px; margin-top: 24px`.
- `.book-card`: `display: flex; flex-direction: column; align-items: center; width: 120px; text-align: center; text-decoration: none; color: inherit; gap: 8px`.
- `.book-card img`: `width: 100%; border-radius: 4px; box-shadow: 0 2px 8px rgba(0,0,0,0.3)`.
- On mobile, book cards wrap and shrink naturally via `flex-wrap` — no extra media query needed.

### 5. JavaScript – `script.js`

Three small additions at the bottom of the existing event-listener section:

1. **Open**: click listener on `#moreBtn` → remove `hidden` attribute from `#moreModal`.
2. **Close (button)**: click listener on `#moreModalClose` → set `hidden` on `#moreModal`.
3. **Close (backdrop click)**: click listener on `.modal-overlay` that checks `e.target === moreModal` before closing, so clicking inside the card does not accidentally dismiss it.

No new state variables or canvas interactions are required.

---

## Files to Change

| File | Change |
|------|--------|
| `index.html` | Add `#moreBtn` button; add `#moreModal` overlay with inner structure |
| `style.css` | Add `.more-btn`, `.modal-overlay`, `.modal-box`, `.modal-header`, `.theory-text`, `.theory-resources`, `.book-card` rules |
| `script.js` | Add three event listeners: open, close-button, backdrop-click |

---

## Implementation Order

1. **HTML structure** – add button and modal skeleton; verify modal renders correctly (temporarily remove `hidden` to inspect).
2. **CSS** – style button and modal; confirm mobile layout.
3. **JS** – wire up open/close events; confirm backdrop-click dismissal works.
4. **Content** – fill in theory paragraphs and book card data (images + links).

---

## Out of Scope for This Item

- No changes to the PDF export path (the modal is UI-only and never included in the PDF).
- No changes to the canvas, angle logic, or localStorage.
- Affiliate link tracking / analytics deferred to a later item.
