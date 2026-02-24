// ============================================================
// Cycl3D Basic Bike Fit Tool – script.js
// ============================================================
// This file contains all the logic for:
//   • Drawing the skeleton overlay on top of the uploaded photo
//   • Calculating joint angles from the placed point markers
//   • Comparing those angles against ideal ranges for each riding style
//   • Displaying the results table with feedback and corrections
//   • Handling all user interactions (click, drag, and touch)
//   • Loading a demo image, saving/restoring sessions, and exporting to PDF
// ============================================================

'use strict'; // Strict mode: catches silent bugs and prevents unsafe JavaScript patterns.

// Wait until the entire HTML page has fully loaded before running any code.
// This prevents errors caused by trying to access elements that don't exist yet.
document.addEventListener('DOMContentLoaded', () => {

    // ── DOM References ────────────────────────────────────────────────────────
    // Cache references to the HTML elements we interact with frequently.
    // Storing them once at the top is faster than searching the DOM repeatedly.
    const canvas        = document.getElementById('skeletonCanvas');  // The drawing overlay on top of the photo
    const ctx           = canvas.getContext('2d');                    // The 2D drawing context (the "paintbrush")
    const img           = document.getElementById('displayImg');       // The bike photo element
    const fitTypeSelect = document.getElementById('fitType');          // The riding style dropdown
    const resultsArea   = document.getElementById('results-area');     // The feedback table below the image

    // ── Brand Colors ──────────────────────────────────────────────────────────
    // Defined as constants so they are easy to change in one place.
    // Note: CSS custom properties (like --brand-green) cannot be read inside a
    // <canvas> drawing context, so we define them here as JavaScript constants.
    const COLOR_GOOD  = '#28a745'; // Green  – angle is within the ideal range
    const COLOR_WARN  = '#dc3545'; // Red    – angle is outside the ideal range
    const COLOR_SKEL  = '#00ff00'; // Lime   – skeleton lines and joint dots

    // ── Joint Point Placement Order ───────────────────────────────────────────
    // The user clicks joint markers in this exact left-to-right order on the photo.
    // The index (position in the array) determines which joint calculation applies.
    //
    //   Index 0 → Toe        (starting reference point)
    //   Index 1 → Ankle      (angle calculated here)
    //   Index 2 → Knee       (angle calculated here)
    //   Index 3 → Hip        (back angle calculated here)
    //   Index 4 → Shoulder   (angle calculated here)
    //   Index 5 → Elbow      (angle calculated here)
    //   Index 6 → Hand       (endpoint)
    const MAX_POINTS = 7; // Maximum number of joint markers the user can place

    // ── Ideal Angle Ranges (degrees) ──────────────────────────────────────────
    // These are the target angle ranges for each joint at each riding style.
    // If a measured angle falls between [min, max] it is considered optimal.
    // Format: { JointName: { StyleName: [minDegrees, maxDegrees] } }
    const IDEAL_RANGES = {
        Knee:     { Relaxed: [145, 150], Balanced: [140, 145], Aggressive: [138, 142] },
        Back:     { Relaxed: [45, 50],   Balanced: [40, 45],   Aggressive: [30, 40]  },
        Shoulder: { Relaxed: [80, 90],   Balanced: [90, 95],   Aggressive: [95, 105] },
        Elbow:    { Relaxed: [10, 15],   Balanced: [15, 20],   Aggressive: [20, 30]  },
        Ankle:    { Relaxed: [95, 105],  Balanced: [100, 115], Aggressive: [110, 125] }
    };

    // ── Application State ─────────────────────────────────────────────────────
    // These variables track what the user has placed and what is being dragged.
    // They are scoped inside DOMContentLoaded (not global) to prevent accidental
    // modification by other scripts on the page.
    let points        = [];    // Array of { x, y } joint marker positions (grows as user clicks)
    let draggingPoint = null;  // The specific point currently being dragged (null if none)
    let ghostPoint    = null;  // Live drag-preview position – committed to points on pointerup
    let isTouchDrag   = false; // True only while a touch-pointer drag is active (Phase 3 loupe)
    let lastX         = 0;    // Last recorded pointer X position during drag
    let lastY         = 0;    // Last recorded pointer Y position during drag
    let demoLoading   = false; // Prevents multiple simultaneous demo image requests

    // ── Demo Image URL ────────────────────────────────────────────────────────
    const DEMO_URL = 'Assets/Jake_bike_fit_demo.png';

    // ============================================================
    // DRAWING
    // ============================================================

    /**
     * draw()
     *
     * Redraws the entire canvas overlay from scratch:
     *   1. Resizes the canvas to match the photo's current display size.
     *   2. Clears any previous drawing.
     *   3. Draws a skeleton line connecting all placed joint markers.
     *   4. Draws a circular dot at each joint marker.
     *   5. Calculates the angle at qualifying joints and labels them on the canvas.
     *   6. Passes the angle data to updateTable() to refresh the results below.
     *
     * This function is called every time a point is added, moved, or the
     * riding style dropdown changes.
     */
    function draw() {
        // Resize the canvas to exactly match the displayed image size.
        // This keeps the drawing coordinates aligned with the photo at all zoom levels.
        canvas.width  = img.clientWidth;
        canvas.height = img.clientHeight;

        // Clear any previous drawing before painting a fresh frame.
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Nothing to draw if the user hasn't placed any markers yet.
        if (points.length < 1) return;

        // ── Draw Skeleton Lines ───────────────────────────────────────────────
        // Connect all placed points with a single continuous lime-green polyline.
        ctx.strokeStyle = COLOR_SKEL;
        ctx.lineWidth   = 4;
        ctx.lineJoin    = 'round'; // Rounds the corners where lines meet
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        points.forEach(p => ctx.lineTo(p.x, p.y));
        ctx.stroke();

        // ── Draw Joint Dots & Calculate Angles ───────────────────────────────
        // Loop through every placed marker. Draw a dot, then check if this marker
        // is the middle point of a three-point angle calculation.
        const angleData = []; // Collects results to pass to the results table

        points.forEach((p, i) => {

            // Draw a filled circle at each joint position.
            ctx.fillStyle = COLOR_SKEL;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
            ctx.fill();

            // Each angle is calculated at a MIDDLE point using the point before and after it.
            // We check that the next required point actually exists before calculating.
            let angle = null; // Stays null if this point is not a middle joint
            let name  = '';

            if (i === 1 && points[2]) {
                name  = 'Ankle';
                angle = calcAngle(points[0], points[1], points[2]);
            }
            if (i === 2 && points[3]) {
                name  = 'Knee';
                angle = calcAngle(points[1], points[2], points[3]);
            }
            if (i === 3 && points[4]) {
                name  = 'Back';
                // The back angle is measured against the horizontal plane,
                // not as a three-point joint flex. Math.atan2 returns the
                // angle of the torso line (hip-to-shoulder) from horizontal.
                angle = Math.abs(
                    Math.atan2(points[4].y - points[3].y, points[4].x - points[3].x) * (180 / Math.PI)
                );
            }
            if (i === 4 && points[5]) {
                name  = 'Shoulder';
                angle = calcAngle(points[3], points[4], points[5]);
            }
            if (i === 5 && points[6]) {
                name  = 'Elbow';
                // Elbow flexion is expressed as degrees of bend.
                // 180° = fully straight arm. We subtract from 180 to get the bend amount.
                angle = Math.abs(180 - calcAngle(points[4], points[5], points[6]));
            }

            // Only render a label if an angle was actually calculated at this point.
            // We check `!== null` explicitly (not just `if (angle)`) to avoid a
            // false-negative in the unlikely case that angle evaluates to 0.
            if (angle !== null) {
                const range   = IDEAL_RANGES[name][fitTypeSelect.value];
                const isOk    = (angle >= range[0] && angle <= range[1]);
                const display = angle.toFixed(1); // Format to one decimal for display only

                // Draw a colour-coded angle label next to the joint dot on the canvas.
                ctx.fillStyle = isOk ? COLOR_GOOD : COLOR_WARN;
                ctx.font      = 'bold 16px Arial';
                ctx.fillText(`${name}: ${display}°`, p.x + 15, p.y - 15);

                // Collect this joint's data for the results table.
                angleData.push({ name, angle, display, isOk, range });
            }
        });

        // Refresh the results table with the latest angle data.
        updateTable(angleData);

        // ── Draw Ghost Dot (Phase 2 – drag preview) ──────────────────────────
        // During a drag, ghostPoint holds the live pointer position but the real
        // point in `points` stays frozen so all angle math remains stable.
        // Rendered last so it always appears on top of skeleton lines and labels.
        if (ghostPoint) {
            ctx.save();
            // Dashed cyan outline to distinguish the ghost from committed points.
            ctx.strokeStyle = 'rgba(0, 220, 255, 0.9)';
            ctx.lineWidth   = 3;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(ghostPoint.x, ghostPoint.y, 12, 0, Math.PI * 2);
            ctx.stroke();
            // Semi-transparent fill so the photo is still visible underneath.
            ctx.fillStyle = 'rgba(0, 220, 255, 0.35)';
            ctx.fill();
            ctx.restore();
        }

        // Phase 3: draw the drag loupe for touch interactions.
        drawLoupe();
    }

    // ============================================================
    // DRAG LOUPE (Phase 3 – touch magnifier)
    // ============================================================

    /**
     * drawLoupe()
     *
     * Renders a circular magnifying loupe above the user's finger during a
     * touch drag so the exact placement position is always visible.
     *
     * Only active when:
     *   - isTouchDrag is true  (pointer type was 'touch')
     *   - ghostPoint is set    (a drag is in progress)
     *   - the photo is loaded  (img.naturalWidth > 0)
     *
     * ghostPoint is the single source of truth: it is what the loupe samples
     * AND what handleEnd() commits into draggingPoint – so the loupe center
     * and the final placement are identical by construction.
     */
    function drawLoupe() {
        // ── Early exit on desktop / no drag / no image ───────────────────────
        if (!ghostPoint || !isTouchDrag || !img.naturalWidth) return;

        const LOUPE_RADIUS    = 60;  // Display radius of the loupe circle (px)
        const LOUPE_DIAMETER  = LOUPE_RADIUS * 2;
        const MAGNIFICATION   = 1.5;
        // Radius of the canvas-space window that the loupe shows.
        const SRC_RADIUS      = LOUPE_RADIUS / MAGNIFICATION; // 40px canvas-space

        // ── Loupe centre position (clamped to stay inside the canvas) ────────
        const rawLoupeX = ghostPoint.x;
        const rawLoupeY = ghostPoint.y - 150; // Default: 150px above the finger

        const loupeX = Math.max(LOUPE_RADIUS + 10, Math.min(canvas.width  - LOUPE_RADIUS - 10, rawLoupeX));
        const loupeY = Math.max(LOUPE_RADIUS + 10, rawLoupeY);

        // ── Map canvas-space ghost position to natural-image pixels ──────────
        const scaleX = img.naturalWidth  / canvas.width;
        const scaleY = img.naturalHeight / canvas.height;

        const srcW = SRC_RADIUS * 2 * scaleX;
        const srcH = SRC_RADIUS * 2 * scaleY;
        const srcX = (ghostPoint.x - SRC_RADIUS) * scaleX;
        const srcY = (ghostPoint.y - SRC_RADIUS) * scaleY;

        ctx.save();

        // ── Clip to a circle so the photo crop appears circular ───────────────
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, LOUPE_RADIUS, 0, Math.PI * 2);
        ctx.clip();

        // Draw the magnified photo crop filling the clipped circle.
        ctx.drawImage(
            img,
            srcX, srcY, srcW, srcH,                                        // source rect (natural-image coords)
            loupeX - LOUPE_RADIUS, loupeY - LOUPE_RADIUS, LOUPE_DIAMETER, LOUPE_DIAMETER // dest rect
        );

        ctx.restore(); // removes clip

        // ── Dark backdrop ring for edge definition ────────────────────────────
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth   = 6;
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, LOUPE_RADIUS + 1, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // ── Cyan dashed border (matches ghost dot style) ─────────────────────
        ctx.save();
        ctx.strokeStyle = 'rgba(0, 220, 255, 0.9)';
        ctx.lineWidth   = 3;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, LOUPE_RADIUS, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // ── Small filled centre dot – marks exact landing position ────────────
        ctx.save();
        ctx.fillStyle = 'rgba(0, 220, 255, 0.9)';
        ctx.beginPath();
        ctx.arc(loupeX, loupeY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // ============================================================
    // ANGLE CALCULATION
    // ============================================================

    /**
     * calcAngle(p1, p2, p3)
     *
     * Calculates the angle in degrees at point p2, formed by the two vectors
     * p2→p1 and p2→p3. Uses the dot-product formula for 2D vectors.
     *
     * Returns a plain NUMBER so comparisons against the ideal ranges are
     * always numerically accurate (conversion to string only happens at display time).
     *
     * @param {{ x: number, y: number }} p1 – First outer point
     * @param {{ x: number, y: number }} p2 – Middle joint (the vertex of the angle)
     * @param {{ x: number, y: number }} p3 – Second outer point
     * @returns {number} Angle in degrees (0–180)
     */
    function calcAngle(p1, p2, p3) {
        // Build vectors pointing from the middle joint (p2) toward each outer point.
        const vA = { x: p1.x - p2.x, y: p1.y - p2.y };
        const vC = { x: p3.x - p2.x, y: p3.y - p2.y };

        // Dot product tells us how much the two vectors point in the same direction.
        const dot  = (vA.x * vC.x) + (vA.y * vC.y);

        // Magnitudes are the lengths of the two vectors.
        const magA = Math.sqrt(vA.x ** 2 + vA.y ** 2);
        const magC = Math.sqrt(vC.x ** 2 + vC.y ** 2);

        // Clamp the cosine value to the valid range [-1, 1] before passing to Math.acos.
        // Floating-point arithmetic can occasionally produce values like 1.0000000002,
        // which would cause Math.acos to return NaN (Not a Number).
        const cosTheta = Math.max(-1, Math.min(1, dot / (magA * magC)));

        // Convert from radians to degrees and return as a plain number.
        return Math.acos(cosTheta) * (180 / Math.PI);
    }

    // ============================================================
    // RESULTS TABLE
    // ============================================================

    /**
     * updateTable(data)
     *
     * Builds and injects an HTML results table into the results area element.
     * Displays each measured angle, its ideal target range, and a corrective
     * suggestion if the angle is outside the ideal window.
     *
     * @param {Array} data – Array of angle result objects from draw()
     */
    function updateTable(data) {
        // Clear the results area if there is nothing to show yet.
        if (!data.length) {
            resultsArea.innerHTML = '';
            return;
        }

        // Corrective advice for each joint when the angle is too low or too high.
        // "low" = angle is below the minimum of the ideal range.
        // "high" = angle is above the maximum of the ideal range.
        const ADVICE = {
            Knee:     { low: 'RAISE saddle height',       high: 'LOWER saddle height'       },
            Back:     { low: 'Higher bars (add spacers)', high: 'Lower bars (remove spacers)' },
            Shoulder: { low: 'Longer stem',               high: 'Shorter stem'               },
            Elbow:    { low: 'Shorten reach',             high: 'Increase reach'             },
            Ankle:    { low: 'Check cleat fore/aft',      high: 'Check cleat fore/aft'       }
        };

        // Build the table HTML row by row.
        // All values here come from internal calculations, not from user text input,
        // so using innerHTML is safe in this context.
        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Joint</th>
                        <th>Measured</th>
                        <th>Ideal Range</th>
                        <th>Recommendation</th>
                    </tr>
                </thead>
                <tbody>`;

        data.forEach(m => {
            // Determine which direction the angle is out of range.
            const direction  = m.angle < m.range[0] ? 'low' : 'high';
            const adviceText = m.isOk ? 'Optimal ✓' : ADVICE[m.name][direction];

            html += `
                    <tr>
                        <td>${m.name}</td>
                        <td class="${m.isOk ? 'status-ok' : 'status-warn'}">${m.display}°</td>
                        <td>${m.range[0]}&ndash;${m.range[1]}°</td>
                        <td class="advice-box">${adviceText}</td>
                    </tr>`;
        });

        html += `
                </tbody>
            </table>`;

        resultsArea.innerHTML = html;

        // Tell the parent iframe to resize now that the results table is visible.
        if (typeof window.cycl3dSendHeight === 'function') {
            requestAnimationFrame(window.cycl3dSendHeight);
        }
    }

    // ============================================================
    // POINTER & TOUCH EVENT HELPERS
    // ============================================================

    /**
     * getPos(e)
     *
     * Extracts the pointer coordinates relative to the canvas element.
     * Uses the Pointer Events API – e.clientX / e.clientY are always present
     * for mouse, touch, and stylus events, with no per-frame getBoundingClientRect
     * drift risk during a drag.
     *
     * @param {PointerEvent} e
     * @returns {{ x: number, y: number }}
     */
    function getPos(e) {
        const rect = canvas.getBoundingClientRect(); // Canvas position on the screen
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * handleStart(e)
     *
     * Called when the user presses down on the canvas (pointerdown).
     * setPointerCapture ensures pointermove/pointerup continue firing even if
     * the finger or cursor leaves the canvas boundary during a drag.
     *
     * If the pointer lands within 25px of an existing joint dot, that dot becomes
     * the active drag target. Otherwise, if fewer than MAX_POINTS exist, a new
     * joint marker is placed at the pointer position.
     */
    function handleStart(e) {
        canvas.setPointerCapture(e.pointerId); // Keep receiving events outside the canvas
        const pos = getPos(e);

        ghostPoint  = null; // Clear any stale ghost from a previous drag
        isTouchDrag = (e.pointerType === 'touch'); // Phase 3: track whether this is a touch drag

        // Look for an existing joint dot within the 25px grab radius.
        draggingPoint = points.find(p =>
            Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2) < 25
        );

        // If no nearby dot was found and there is still room, create a new marker.
        // The point is added at the tap position so the ghost can track from here.
        if (!draggingPoint && points.length < MAX_POINTS) {
            draggingPoint = { x: pos.x, y: pos.y };
            points.push(draggingPoint);
        }

        lastX = pos.x;
        lastY = pos.y;
        draw();
    }

    /**
     * handleMove(e)
     *
     * Called while the pointer moves (pointermove).
     * If a joint is being dragged, updates its position to follow the pointer.
     * Scroll suppression is handled automatically by `touch-action: none` on the
     * canvas – no e.preventDefault() needed here.
     */
    function handleMove(e) {
        if (!draggingPoint) return; // No active drag – nothing to do
        const pos = getPos(e);
        // Phase 2: write to ghostPoint instead of mutating the real point.
        // This keeps `points` frozen during the drag so angle math in draw()
        // always operates on the last committed state – preventing the
        // stale-coordinate bug that affected points 5 & 6.
        ghostPoint = { x: pos.x, y: pos.y };
        lastX = pos.x;
        lastY = pos.y;
        draw();
    }

    /**
     * handleEnd()
     *
     * Called when the pointer is released (pointerup or pointercancel).
     * Clears the active drag reference so the next press starts fresh.
     */
    function handleEnd() {
        // Phase 2: commit the ghost position into the real point before clearing.
        // If the user only tapped (no move), ghostPoint is null – the point is
        // already in its correct position from handleStart, so nothing extra needed.
        if (draggingPoint && ghostPoint) {
            draggingPoint.x = ghostPoint.x;
            draggingPoint.y = ghostPoint.y;
        }
        ghostPoint    = null;
        isTouchDrag   = false; // Phase 3: hide the loupe on release
        draggingPoint = null;
        draw();
    }

    // ============================================================
    // CANVAS EVENT LISTENERS
    // ============================================================

    // Unified Pointer Events API – handles mouse, touch, and stylus with a single
    // set of listeners. setPointerCapture() (called in handleStart) ensures
    // pointermove/pointerup fire even when the pointer leaves the canvas boundary,
    // replacing the previous window-level mousemove/mouseup listeners.
    // Scroll suppression is handled declaratively by `touch-action: none` in CSS,
    // so no `passive: false` overrides are needed.
    canvas.addEventListener('pointerdown',   handleStart);
    canvas.addEventListener('pointermove',   handleMove);
    canvas.addEventListener('pointerup',     handleEnd);
    canvas.addEventListener('pointercancel', handleEnd);

    // ============================================================
    // IMAGE UPLOAD
    // ============================================================

    // When the user selects a photo, read it as a data URL and display it in the image element.
    document.getElementById('upload').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return; // User closed the file dialog without selecting anything

        const reader  = new FileReader(); // Browser built-in API for reading local files
        reader.onload = (event) => {
            img.src    = event.target.result; // Assign the base64-encoded image data as the src
            img.onload = () => {
                img.style.display = 'block'; // Make the image visible once it has loaded
                draw();
                // Tell the parent iframe to resize now that the image is visible.
                if (typeof window.cycl3dSendHeight === 'function') {
                    requestAnimationFrame(window.cycl3dSendHeight);
                }
            };
        };
        reader.readAsDataURL(file); // Encode the file as a base64 data URL string
    });

    // ============================================================
    // DEMO IMAGE LOADER
    // ============================================================

    /**
     * loadDemoImage(url, clearMarkers)
     *
     * Loads a remote image into the photo display area.
     * The demoLoading flag prevents double-clicks from firing two simultaneous loads.
     *
     * @param {string}  url          – Full URL of the image to display
     * @param {boolean} clearMarkers – If true, resets all existing joint markers
     */
    function loadDemoImage(url, clearMarkers) {
        if (demoLoading) return; // Guard against duplicate simultaneous requests
        demoLoading = true;

        img.onload = () => {
            demoLoading       = false;
            img.style.display = 'block';
            draw();
            // Tell the parent iframe to resize now that the demo image is visible.
            if (typeof window.cycl3dSendHeight === 'function') {
                requestAnimationFrame(window.cycl3dSendHeight);
            }
        };

        img.onerror = () => {
            demoLoading = false;
            console.warn('Demo image failed to load:', url);
            alert('Failed to load the demo image. Please ensure the Assets folder is present.');
        };

        if (clearMarkers) points = []; // Optionally wipe existing joint markers
        img.src = url;
    }

    // ============================================================
    // BUTTON ACTIONS
    // ============================================================

    // Demo: loads the built-in sample image. Existing markers are kept so users
    // can immediately see what positioned markers look like.
    document.getElementById('demoBtn').addEventListener('click', () => loadDemoImage(DEMO_URL, false));

    // Clear: removes all joint markers, hides the image, and wipes saved session data.
    document.getElementById('clearBtn').addEventListener('click', () => {
        points                = [];
        resultsArea.innerHTML = '';
        demoLoading           = false;
        img.onload            = null;  // Cancel any pending image load callbacks
        img.onerror           = null;
        img.src               = '';
        img.style.display     = 'none';

        // Remove the previously saved session from browser storage (safe to fail silently).
        try { localStorage.removeItem('cycl3d_save'); } catch (e) { /* ignore */ }

        // Reset the file input field so the same file can be re-uploaded if needed.
        const uploadInput = document.getElementById('upload');
        if (uploadInput) uploadInput.value = '';

        draw();
    });

    // Redraw the canvas whenever the riding style changes (new angle ranges apply).
    fitTypeSelect.addEventListener('change', draw);

    // Help modal: toggle the instruction panel open or closed.
    document.getElementById('helpBtn').addEventListener('click', () =>
        document.getElementById('help-modal').style.display = 'block'
    );
    document.getElementById('closeModal').addEventListener('click', () =>
        document.getElementById('help-modal').style.display = 'none'
    );
    document.getElementById('closeHelpBtn').addEventListener('click', () =>
        document.getElementById('help-modal').style.display = 'none'
    );

    // PDF Export – direct jsPDF construction (no html2canvas / no DOM screenshot).
    // Composites the photo + skeleton at full natural resolution, then builds the
    // PDF document programmatically: addImage() for the banner and photo, autoTable()
    // for the measurements, and splitTextToSize() for the disclaimer. Because no DOM
    // rendering is involved there are zero blank-page failure modes.
    document.getElementById('pdfBtn').addEventListener('click', async () => {

        // Guard: require a loaded photo before exporting.
        if (!img.src || img.style.display === 'none' || !img.naturalWidth) {
            alert('Please upload a photo before exporting. Place joint markers to include measurements.');
            return;
        }

        const pdfBtn       = document.getElementById('pdfBtn');
        pdfBtn.disabled    = true;
        pdfBtn.textContent = 'Generating\u2026';
        try {
            // ── Step 1: Composite photo + skeleton overlay at full natural resolution ──
            const naturalW = img.naturalWidth;
            const naturalH = img.naturalHeight;
            const displayW = img.clientWidth;
            const displayH = img.clientHeight;

            // Scale factors map display-space marker coordinates to natural-image pixels.
            const scaleX = naturalW / displayW;
            const scaleY = naturalH / displayH;

            const offCanvas  = document.createElement('canvas');
            offCanvas.width  = naturalW;
            offCanvas.height = naturalH;
            const offCtx     = offCanvas.getContext('2d');

            // Paint the photo at full resolution.
            offCtx.drawImage(img, 0, 0, naturalW, naturalH);

            // Skeleton lines
            if (points.length >= 2) {
                offCtx.strokeStyle = COLOR_SKEL;
                offCtx.lineWidth   = 4 * scaleX;
                offCtx.lineJoin    = 'round';
                offCtx.beginPath();
                offCtx.moveTo(points[0].x * scaleX, points[0].y * scaleY);
                points.forEach(p => offCtx.lineTo(p.x * scaleX, p.y * scaleY));
                offCtx.stroke();
            }

            // Joint dots and angle labels, scaled to match their browser positions.
            points.forEach((p, i) => {
                const sx = p.x * scaleX;
                const sy = p.y * scaleY;

                offCtx.fillStyle = COLOR_SKEL;
                offCtx.beginPath();
                offCtx.arc(sx, sy, 8 * scaleX, 0, Math.PI * 2);
                offCtx.fill();

                let angle = null;
                let name  = '';

                if (i === 1 && points[2]) { name = 'Ankle';    angle = calcAngle(points[0], points[1], points[2]); }
                if (i === 2 && points[3]) { name = 'Knee';     angle = calcAngle(points[1], points[2], points[3]); }
                if (i === 3 && points[4]) {
                    name  = 'Back';
                    angle = Math.abs(
                        Math.atan2(points[4].y - points[3].y, points[4].x - points[3].x) * (180 / Math.PI)
                    );
                }
                if (i === 4 && points[5]) { name = 'Shoulder'; angle = calcAngle(points[3], points[4], points[5]); }
                if (i === 5 && points[6]) { name = 'Elbow';    angle = Math.abs(180 - calcAngle(points[4], points[5], points[6])); }

                if (angle !== null) {
                    const range = IDEAL_RANGES[name][fitTypeSelect.value];
                    const isOk  = (angle >= range[0] && angle <= range[1]);
                    offCtx.fillStyle = isOk ? COLOR_GOOD : COLOR_WARN;
                    offCtx.font      = `bold ${Math.round(16 * scaleX)}px Arial`;
                    offCtx.fillText(`${name}: ${angle.toFixed(1)}\u00b0`, sx + 15 * scaleX, sy - 15 * scaleY);
                }
            });

            const compositeDataURL = offCanvas.toDataURL('image/jpeg', 0.92);

            // ── Step 2: Embed banner as a PNG data URL ────────────────────────────────
            const bannerImgEl = document.querySelector('.banner img');
            let bannerDataURL = '';
            let bannerNatW    = 0;
            let bannerNatH    = 0;
            try {
                const bc  = document.createElement('canvas');
                bc.width  = bannerImgEl.naturalWidth  || bannerImgEl.width;
                bc.height = bannerImgEl.naturalHeight || bannerImgEl.height;
                bannerNatW = bc.width;
                bannerNatH = bc.height;
                bc.getContext('2d').drawImage(bannerImgEl, 0, 0);
                bannerDataURL = bc.toDataURL('image/png');
            } catch (e) {
                console.warn('Banner image could not be embedded in PDF:', e);
            }

            // ── Step 3: Build table rows from angle data (pure JS, no DOM) ──────────
            // Replicates the same angle calculations used in draw() / updateTable().
            // Produces a structured array that autoTable() can render directly.
            const ADVICE = {
                Knee:     { low: 'RAISE saddle height',        high: 'LOWER saddle height'        },
                Back:     { low: 'Higher bars (add spacers)',  high: 'Lower bars (remove spacers)' },
                Shoulder: { low: 'Longer stem',                high: 'Shorter stem'                },
                Elbow:    { low: 'Shorten reach',              high: 'Increase reach'              },
                Ankle:    { low: 'Check cleat fore/aft',       high: 'Check cleat fore/aft'        }
            };

            const fitType   = fitTypeSelect.value;
            const COLOR_OK  = [40, 167, 69];  // green
            const COLOR_BAD = [220, 53, 69];  // red

            const jointDefs = [
                { name: 'Ankle',    calc: () => (points[0] && points[1] && points[2]) ? calcAngle(points[0], points[1], points[2]) : null },
                { name: 'Knee',     calc: () => (points[1] && points[2] && points[3]) ? calcAngle(points[1], points[2], points[3]) : null },
                { name: 'Back',     calc: () => (points[3] && points[4]) ? Math.abs(Math.atan2(points[4].y - points[3].y, points[4].x - points[3].x) * (180 / Math.PI)) : null },
                { name: 'Shoulder', calc: () => (points[3] && points[4] && points[5]) ? calcAngle(points[3], points[4], points[5]) : null },
                { name: 'Elbow',    calc: () => (points[4] && points[5] && points[6]) ? Math.abs(180 - calcAngle(points[4], points[5], points[6])) : null }
            ];

            const tableRows = [];
            for (const { name, calc } of jointDefs) {
                const angle = calc();
                if (angle === null) continue;
                const range      = IDEAL_RANGES[name][fitType];
                const isOk       = angle >= range[0] && angle <= range[1];
                const direction  = angle < range[0] ? 'low' : 'high';
                const adviceText = isOk ? 'Optimal ✓' : ADVICE[name][direction];
                tableRows.push([
                    { content: name },
                    { content: `${angle.toFixed(1)}°`, styles: { textColor: isOk ? COLOR_OK : COLOR_BAD, fontStyle: 'bold' } },
                    { content: `${range[0]}–${range[1]}°` },
                    { content: adviceText }
                ]);
            }

            // ── Step 4: Build PDF directly with jsPDF + autoTable ────────────────────
            // addImage() embeds pixel data straight into the PDF stream – no DOM
            // rendering, no html2canvas, no blank-page risk.
            const { jsPDF }  = window.jspdf;
            const doc        = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            const margin     = 15;           // mm
            const pageW      = 210;          // A4 width in mm
            const contentW   = pageW - margin * 2;
            let   cursorY    = margin;

            // Banner image
            if (bannerDataURL && bannerNatW && bannerNatH) {
                const maxBannerH = 22;
                const bannerH    = Math.min((bannerNatH / bannerNatW) * contentW, maxBannerH);
                const bannerW    = (bannerNatW / bannerNatH) * bannerH;
                const bannerX    = margin + (contentW - bannerW) / 2;
                doc.addImage(bannerDataURL, 'PNG', bannerX, cursorY, bannerW, bannerH);
                cursorY += bannerH + 5;
            }

            // Title
            doc.setFontSize(16);
            doc.setFont('helvetica', 'bold');
            doc.text('Cycl3D Basic Bike Fit Report', pageW / 2, cursorY, { align: 'center' });
            cursorY += 7;

            // Riding style label
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`Riding Style: ${fitTypeSelect.value}`, pageW / 2, cursorY, { align: 'center' });
            cursorY += 8;

            // Composite photo – capped at 100 mm tall so the table fits on the same page
            const maxPhotoH  = 100;
            const photoAspect = naturalW / naturalH;
            let photoW = contentW;
            let photoH = photoW / photoAspect;
            if (photoH > maxPhotoH) { photoH = maxPhotoH; photoW = photoH * photoAspect; }
            const photoX = margin + (contentW - photoW) / 2;
            doc.addImage(compositeDataURL, 'JPEG', photoX, cursorY, photoW, photoH);
            cursorY += photoH + 6;

            // Measurements table
            if (tableRows.length > 0) {
                doc.autoTable({
                    startY:              cursorY,
                    head:                [['Joint', 'Measured', 'Ideal Range', 'Recommendation']],
                    body:                tableRows,
                    margin:              { left: margin, right: margin },
                    headStyles:          { fillColor: [34, 34, 34], textColor: 255, fontStyle: 'bold' },
                    alternateRowStyles:  { fillColor: [247, 247, 247] },
                    styles:              { fontSize: 11, cellPadding: 3 },
                    tableWidth:          contentW
                });
                cursorY = doc.lastAutoTable.finalY + 8;
            }

            // Legal disclaimer
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(150);
            const disclaimerText = 'Legal Disclaimer: This tool is provided for informational and educational purposes only. Make with Jake LLC and Cycl3D assume no liability for injuries or mechanical failures resulting from use of this application. This software-generated analysis is based on 2D imagery and does not replace the comprehensive assessment of a certified professional bike fitter.';
            const disclaimerLines = doc.splitTextToSize(disclaimerText, contentW);
            doc.text(disclaimerLines, margin, cursorY);

            // Save to disk
            doc.save('Cycl3D_Bike_Fit_Report.pdf');

        } catch (err) {
            console.error('PDF export failed:', err);
            alert('PDF export failed. Please try again.');
        } finally {
            pdfBtn.disabled    = false;
            pdfBtn.textContent = 'Download PDF Report';
        }
    });

    // Save Session: stores the current joint marker positions in browser localStorage
    // so the layout is preserved if the user closes and reopens the page.
    document.getElementById('saveBtn').addEventListener('click', () => {
        try {
            localStorage.setItem('cycl3d_save', JSON.stringify(points));
            alert('Session saved to your browser!');
        } catch (e) {
            // localStorage can fail if the user has disabled it or storage is full.
            console.error('Could not save session:', e);
            alert('Unable to save session. Your browser storage may be full or disabled.');
        }
    });

}); // End of DOMContentLoaded – all code above runs only after the page is ready.
