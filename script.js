const canvas = document.getElementById('skeletonCanvas');
const ctx = canvas.getContext('2d');
const img = document.getElementById('displayImg');
const fitTypeSelect = document.getElementById('fitType');
const resultsArea = document.getElementById('results-area');

let points = [];
let draggingPoint = null;
let lastX = 0, lastY = 0;

const ranges = {
    Knee:     { Relaxed: [145, 150], Balanced: [140, 145], Aggressive: [138, 142] },
    Back:     { Relaxed: [45, 50],   Balanced: [40, 45],   Aggressive: [30, 40] },
    Shoulder: { Relaxed: [80, 90],   Balanced: [90, 95],   Aggressive: [95, 105] },
    Elbow:    { Relaxed: [10, 15],   Balanced: [15, 20],   Aggressive: [20, 30] },
    Ankle:    { Relaxed: [95, 105],  Balanced: [100, 115], Aggressive: [110, 125] }
};

function draw() {
    canvas.width = img.clientWidth;
    canvas.height = img.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (points.length < 1) return;

    // Draw Skeleton Lines
    ctx.strokeStyle = "#00ff00";
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    let data = [];
    points.forEach((p, i) => {
        // Draw Joint Dots
        ctx.fillStyle = "#00ff00";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
        ctx.fill();

        let angle = null;
        let name = "";

        // Logic for specific joints based on point order
        if (i === 1 && points[2]) { 
            name = "Ankle"; 
            angle = calcAngle(points[0], points[1], points[2]); 
        }
        if (i === 2 && points[3]) { 
            name = "Knee"; 
            angle = calcAngle(points[1], points[2], points[3]); 
        }
        if (i === 3 && points[4]) { 
            name = "Back"; 
            // Back angle is calculated against the horizontal plane
            angle = Math.abs(Math.atan2(points[4].y - points[3].y, points[4].x - points[3].x) * 180 / Math.PI).toFixed(1); 
        }
        if (i === 4 && points[5]) { 
            name = "Shoulder"; 
            angle = calcAngle(points[3], points[4], points[5]); 
        }
        if (i === 5 && points[6]) { 
            name = "Elbow"; 
            // Elbow is typically expressed as the angle of flexion (180 - internal angle)
            angle = Math.abs(180 - calcAngle(points[4], points[5], points[6])).toFixed(1); 
        }

        if (angle) {
            const r = ranges[name][fitTypeSelect.value];
            const ok = (angle >= r[0] && angle <= r[1]);
            
            // Draw Label on Canvas
            ctx.fillStyle = ok ? "#28a745" : "#dc3545";
            ctx.font = "bold 16px Arial";
            ctx.fillText(`${name}: ${angle}°`, p.x + 15, p.y - 15);
            
            data.push({ name, angle, ok, range: r });
        }
    });
    updateTable(data);
}

function calcAngle(p1, p2, p3) {
    const BA = { x: p1.x - p2.x, y: p1.y - p2.y };
    const BC = { x: p3.x - p2.x, y: p3.y - p2.y };
    const dot = (BA.x * BC.x) + (BA.y * BC.y);
    const magA = Math.sqrt(BA.x**2 + BA.y**2);
    const magC = Math.sqrt(BC.x**2 + BC.y**2);
    return (Math.acos(dot / (magA * magC)) * 180 / Math.PI).toFixed(1);
}

function updateTable(data) {
    if (!data.length) {
        resultsArea.innerHTML = "";
        return;
    }

    let html = `<table><tr><th>Part</th><th>Value</th><th>Ideal</th><th>Advice</th></tr>`;
    data.forEach(m => {
        const advice = {
            Knee: m.angle < m.range[0] ? "RAISE saddle height" : "LOWER saddle height",
            Back: m.angle < m.range[0] ? "Higher bars (add spacers)" : "Lower bars (remove spacers)",
            Shoulder: m.angle < m.range[0] ? "Longer stem" : "Shorter stem",
            Elbow: m.angle < m.range[0] ? "Shorten reach" : "Increase reach",
            Ankle: "Check cleat fore/aft position"
        };
        html += `<tr>
            <td>${m.name}</td>
            <td class="${m.ok ? 'status-ok' : 'status-warn'}">${m.angle}°</td>
            <td>${m.range[0]}-${m.range[1]}°</td>
            <td class="advice-box">${m.ok ? "Optimal" : advice[m.name]}</td>
        </tr>`;
    });
    resultsArea.innerHTML = html + "</table>";
}

// Event Handlers
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return {
        x: t.clientX - rect.left,
        y: t.clientY - rect.top
    };
}

function handleStart(e) {
    const pos = getPos(e);
    draggingPoint = points.find(p => Math.sqrt((p.x - pos.x)**2 + (p.y - pos.y)**2) < 25);
    
    if (!draggingPoint && points.length < 7) {
        draggingPoint = { x: pos.x, y: pos.y };
        points.push(draggingPoint);
    }
    lastX = pos.x; lastY = pos.y;
    draw();
}

function handleMove(e) {
    if (!draggingPoint) return;
    e.preventDefault();
    const pos = getPos(e);
    draggingPoint.x = pos.x;
    draggingPoint.y = pos.y;
    lastX = pos.x; lastY = pos.y;
    draw();
}

function handleEnd() {
    if (draggingPoint) {
        draggingPoint.x = lastX;
        draggingPoint.y = lastY;
    }
    draggingPoint = null;
    draw();
}

// Listeners
canvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);

canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });
canvas.addEventListener('touchmove', handleMove, { passive: false });
canvas.addEventListener('touchend', handleEnd);

document.getElementById('upload').onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => {
        img.src = event.target.result;
        img.onload = () => draw();
    };
    reader.readAsDataURL(e.target.files[0]);
};

document.getElementById('clearBtn').onclick = () => { points = []; draw(); };
fitTypeSelect.onchange = draw;

// UI Handlers
document.getElementById('helpBtn').onclick = () => document.getElementById('help-modal').style.display = 'block';
document.getElementById('closeModal').onclick = () => document.getElementById('help-modal').style.display = 'none';
document.getElementById('closeHelpBtn').onclick = () => document.getElementById('help-modal').style.display = 'none';

document.getElementById('pdfBtn').onclick = () => {
    const element = document.getElementById('report-wrapper');
    html2pdf().from(element).save('Cycl3D_Report.pdf');
};

document.getElementById('saveBtn').onclick = () => {
    localStorage.setItem('cycl3d_save', JSON.stringify(points));
    alert("Session saved to your browser!");
};