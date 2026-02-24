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
    }

    // ============================================================
    // POINTER & TOUCH EVENT HELPERS
    // ============================================================

    /**
     * getPos(e)
     *
     * Extracts the pointer coordinates relative to the canvas element.
     * Works for both mouse events (desktop) and touch events (mobile).
     *
     * @param {MouseEvent|TouchEvent} e
     * @returns {{ x: number, y: number }}
     */
    function getPos(e) {
        const rect    = canvas.getBoundingClientRect(); // Canvas position on the screen
        const pointer = e.touches ? e.touches[0] : e;  // Use first touch point, or mouse
        return {
            x: pointer.clientX - rect.left,
            y: pointer.clientY - rect.top
        };
    }

    /**
     * handleStart(e)
     *
     * Called when the user presses down on the canvas (mousedown or touchstart).
     *
     * If the pointer lands within 25px of an existing joint dot, that dot becomes
     * the active drag target. Otherwise, if fewer than MAX_POINTS exist, a new
     * joint marker is placed at the pointer position.
     */
    function handleStart(e) {
        const pos = getPos(e);

        // Look for an existing joint dot within the 25px grab radius.
        draggingPoint = points.find(p =>
            Math.sqrt((p.x - pos.x) ** 2 + (p.y - pos.y) ** 2) < 25
        );

        // If no nearby dot was found and there is still room, create a new marker.
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
     * Called while the pointer moves (mousemove or touchmove).
     * If a joint is being dragged, updates its position to follow the pointer.
     * e.preventDefault() stops the page from scrolling on touch devices during a drag.
     */
    function handleMove(e) {
        if (!draggingPoint) return; // No active drag – nothing to do
        e.preventDefault();
        const pos       = getPos(e);
        draggingPoint.x = pos.x;
        draggingPoint.y = pos.y;
        lastX = pos.x;
        lastY = pos.y;
        draw();
    }

    /**
     * handleEnd()
     *
     * Called when the pointer is released (mouseup or touchend).
     * Clears the active drag reference so the next press starts fresh.
     */
    function handleEnd() {
        draggingPoint = null;
        draw();
    }

    // ============================================================
    // CANVAS EVENT LISTENERS
    // ============================================================

    // Mouse events: press on the canvas, move anywhere on the window, release anywhere.
    // Listening to mousemove/mouseup on the window (not just the canvas) means dragging
    // still works even if the cursor moves outside the canvas boundary.
    canvas.addEventListener('mousedown', handleStart);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup',   handleEnd);

    // Touch events: passive:false on touchstart and touchmove allows e.preventDefault()
    // to call successfully, which blocks unwanted page scrolling during a drag.
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });
    canvas.addEventListener('touchmove',  handleMove, { passive: false });
    canvas.addEventListener('touchend',   handleEnd);

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

    // PDF Export – rebuilt from scratch.
    // Composites the photo + skeleton overlay into a single off-screen canvas at full
    // natural resolution, embeds the banner and measurements table into a self-contained
    // HTML string, then exports via html2pdf on a single A4 page.
    document.getElementById('pdfBtn').addEventListener('click', async () => {

        // Guard: require a loaded photo before exporting.
        if (!img.src || img.style.display === 'none' || !img.naturalWidth) {
            alert('Please upload a photo before exporting. Place joint markers to include measurements.');
            return;
        }

        const pdfBtn       = document.getElementById('pdfBtn');
        pdfBtn.disabled    = true;
        pdfBtn.textContent = 'Generating\u2026';
        let staging = null; // declared here so finally{} can always clean it up
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

            // ── Step 2: Embed banner as a data URL ───────────────────────────────────
            const bannerImgEl = document.querySelector('.banner img');
            let bannerDataURL = '';
            try {
                const bc    = document.createElement('canvas');
                bc.width    = bannerImgEl.naturalWidth  || bannerImgEl.width;
                bc.height   = bannerImgEl.naturalHeight || bannerImgEl.height;
                bc.getContext('2d').drawImage(bannerImgEl, 0, 0);
                bannerDataURL = bc.toDataURL('image/png');
            } catch (e) {
                console.warn('Banner image could not be embedded in PDF:', e);
            }

            // ── Step 3: Build report as a hidden off-screen DOM element ─────────────
            // html2canvas requires a real, mounted DOM node to render correctly.
            // Passing a full HTML document string via .from(str,'string') is unreliable
            // because the <!DOCTYPE>/<html> wrapper becomes malformed when set via
            // innerHTML, producing a blank canvas. We create a plain <div> instead,
            // inject only the body content, and attach it just outside the viewport
            // so html2canvas can measure and paint it, then remove it after export.
            const tableHTML = resultsArea.innerHTML || '';
            const fitLabel  = fitTypeSelect.value;

            staging = document.createElement('div');
            // Must be positioned inside the viewport (top:0, left:0) or html2canvas
            // renders a blank frame. Near-zero opacity + z-index:-9999 keeps it
            // invisible to the user without taking it out of the render area.
            staging.style.cssText = [
                'position:fixed',
                'top:0',
                'left:0',
                'width:794px',
                'background:#fff',
                'color:#111',
                'font-family:Arial,sans-serif',
                'padding:16px',
                'box-sizing:border-box',
                'z-index:-9999',
                'opacity:0.01',
                'pointer-events:none'
            ].join(';');

            staging.innerHTML = `
<style>
  .pdf-banner{text-align:center;margin-bottom:10px}
  .pdf-banner img{max-width:100%;height:auto;display:block;margin:0 auto}
  .pdf-title{text-align:center;font-size:18px;font-weight:bold;margin:8px 0 4px}
  .pdf-fit-label{text-align:center;font-size:13px;color:#555;margin-bottom:12px}
  .pdf-photo{text-align:center;margin-bottom:14px}
  .pdf-photo img{max-width:100%;height:auto;display:block;margin:0 auto}
  .pdf-staging table{width:100%;border-collapse:collapse;font-size:12px;margin-bottom:12px}
  .pdf-staging th{background:#222;color:#fff;padding:7px 9px;text-align:left}
  .pdf-staging td{padding:6px 9px;border-bottom:1px solid #ddd}
  .pdf-staging tr:nth-child(even) td{background:#f7f7f7}
  .status-ok{color:#28a745;font-weight:bold}
  .status-warn{color:#dc3545;font-weight:bold}
  .advice-box{font-style:italic}
  .pdf-disclaimer{font-size:10px;color:#999;border-top:1px solid #eee;padding-top:8px;margin-top:8px}
</style>
<div class="pdf-banner">${bannerDataURL ? `<img src="${bannerDataURL}" alt="Cycl3D Banner">` : ''}</div>
<div class="pdf-title">Cycl3D Basic Bike Fit Report</div>
<div class="pdf-fit-label">Riding Style: <strong>${fitLabel}</strong></div>
<div class="pdf-photo"><img src="${compositeDataURL}" alt="Bike Fit Analysis"></div>
${tableHTML}
<p class="pdf-disclaimer"><strong>Legal Disclaimer:</strong> This tool is provided for informational and educational purposes only. Make with Jake LLC and Cycl3D assume no liability for injuries or mechanical failures resulting from use of this application. This software-generated analysis is based on 2D imagery and does not replace the comprehensive assessment of a certified professional bike fitter.</p>`;

            staging.classList.add('pdf-staging');
            document.body.appendChild(staging);

            // ── Step 4: Export via html2pdf ──────────────────────────────────────────
            const opt = {
                margin:      [10, 10, 10, 10],
                filename:    'Cycl3D_Bike_Fit_Report.pdf',
                image:       { type: 'jpeg', quality: 0.95 },
                html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', windowWidth: 794, scrollX: 0, scrollY: 0 },
                jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
                pagebreak:   { mode: 'avoid-all' }
            };

            await html2pdf().set(opt).from(staging).save();

        } catch (err) {
            console.error('PDF export failed:', err);
            alert('PDF export failed. Please try again.');
        } finally {
            if (staging && staging.parentNode) staging.parentNode.removeChild(staging);
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
