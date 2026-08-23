const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

// =====================================================
// GLOBAL STATE
// =====================================================
let time = 0;
let ringRotation = 0;
let globalMagicIntensity = 0; // Ranges from 0 to 1
let lastFrameTime = performance.now();
let fps = 60;

// Throttling limits (adaptive based on FPS)
let particleThrottlingLimit = 350;
let wispCountMultiplier = 1.0;
let arcCountLimit = 4;
let auraDetailLevel = 1.0;

// Hand Tracking State
const handsState = {
    Left: {
        x: 0, y: 0,
        rawX: 0, rawY: 0,
        radius: 0, rawRadius: 0,
        active: false,
        activation: 0 // Smooth transition 0 -> 1
    },
    Right: {
        x: 0, y: 0,
        rawX: 0, rawY: 0,
        radius: 0, rawRadius: 0,
        active: false,
        activation: 0
    }
};

// Face Tracking State
const faceState = {
    detected: false,
    center: { x: 0, y: 0 },
    rawCenter: { x: 0, y: 0 },
    width: 0, rawWidth: 0,
    height: 0, rawHeight: 0,
    
    leftEye: { x: 0, y: 0 },
    rightEye: { x: 0, y: 0 },
    rawLeftEye: { x: 0, y: 0 },
    rawRightEye: { x: 0, y: 0 },
    
    leftEyebrow: { x: 0, y: 0 },
    rightEyebrow: { x: 0, y: 0 },
    rawLeftEyebrow: { x: 0, y: 0 },
    rawRightEyebrow: { x: 0, y: 0 },

    noseTip: { x: 0, y: 0 },
    rawNoseTip: { x: 0, y: 0 },

    mouthCenter: { x: 0, y: 0 },
    rawMouthCenter: { x: 0, y: 0 },

    contour: [], // {x, y}
    rawContour: []
};

// Global active particle array
const particles = [];

// =====================================================
// UTILITIES
// =====================================================
function distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
}

function lerp(start, end, amt) {
    return (1 - amt) * start + amt * end;
}

// =====================================================
// MEDIAPIPE INITIALIZATION (HOLISTIC PIPELINE)
// =====================================================
const holistic = new Holistic({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`;
    }
});

holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.6,
    minTrackingConfidence: 0.6
});

// Loading screen triggers
let isInitialized = false;

function checkInitialLoading() {
    if (!isInitialized) {
        isInitialized = true;
        const loader = document.getElementById("loading-screen");
        if (loader && !loader.classList.contains("fade-out")) {
            loader.classList.add("fade-out");
            setTimeout(() => loader.remove(), 800);
        }
    }
}

// =====================================================
// OPEN PALM DETECTION
// =====================================================
function isPalmOpen(hand) {
    const wrist = hand[0];
    const fingers = [
        [8, 6],   // Index
        [12, 10], // Middle
        [16, 14], // Ring
        [20, 18]  // Pinky
    ];
    let extended = 0;
    for (const [tip, joint] of fingers) {
        const tipDistance = distance(hand[tip], wrist);
        const jointDistance = distance(hand[joint], wrist);
        if (tipDistance > jointDistance) {
            extended++;
        }
    }
    return extended >= 3;
}

function getPalmCenter(hand) {
    const points = [
        hand[0],  // Wrist
        hand[5],  // Index MCP
        hand[9],  // Middle MCP
        hand[13], // Ring MCP
        hand[17]  // Pinky MCP
    ];
    let x = 0;
    let y = 0;
    for (const point of points) {
        x += point.x;
        y += point.y;
    }
    return {
        x: x / points.length,
        y: y / points.length
    };
}

function getPalmSize(hand) {
    return distance(hand[5], hand[17]);
}

// =====================================================
// MEDIAPIPE RESULTS CALLBACKS
// =====================================================
holistic.onResults((results) => {
    checkInitialLoading();

    // Reset active status of hand state
    handsState.Left.active = false;
    handsState.Right.active = false;

    // Process Left Hand
    if (results.leftHandLandmarks) {
        const handLandmarks = results.leftHandLandmarks;
        if (isPalmOpen(handLandmarks)) {
            const palm = getPalmCenter(handLandmarks);
            const rawX = palm.x * canvas.width;
            const rawY = palm.y * canvas.height;
            const palmSize = getPalmSize(handLandmarks);
            const rawRadius = Math.max(45, palmSize * canvas.width * 0.75);

            handsState.Left.active = true;
            handsState.Left.rawX = rawX;
            handsState.Left.rawY = rawY;
            handsState.Left.rawRadius = rawRadius;
        }
    }

    // Process Right Hand
    if (results.rightHandLandmarks) {
        const handLandmarks = results.rightHandLandmarks;
        if (isPalmOpen(handLandmarks)) {
            const palm = getPalmCenter(handLandmarks);
            const rawX = palm.x * canvas.width;
            const rawY = palm.y * canvas.height;
            const palmSize = getPalmSize(handLandmarks);
            const rawRadius = Math.max(45, palmSize * canvas.width * 0.75);

            handsState.Right.active = true;
            handsState.Right.rawX = rawX;
            handsState.Right.rawY = rawY;
            handsState.Right.rawRadius = rawRadius;
        }
    }

    // Process Face Mesh
    if (results.faceLandmarks) {
        faceState.detected = true;
        const landmarks = results.faceLandmarks;

        // Compute Face Bounding Dimensions
        let minX = 1, maxX = 0, minY = 1, maxY = 0;
        for (const lm of landmarks) {
            if (lm.x < minX) minX = lm.x;
            if (lm.x > maxX) maxX = lm.x;
            if (lm.y < minY) minY = lm.y;
            if (lm.y > maxY) maxY = lm.y;
        }
        const rawWidth = (maxX - minX) * canvas.width;
        const rawHeight = (maxY - minY) * canvas.height;

        // Nose tip (index 4) - central stable point
        const rawNoseTip = {
            x: landmarks[4].x * canvas.width,
            y: landmarks[4].y * canvas.height
        };

        // Eye Centers (fallback/calculation from corners)
        const rawLeftEye = {
            x: ((landmarks[33].x + landmarks[133].x) / 2) * canvas.width,
            y: ((landmarks[33].y + landmarks[133].y) / 2) * canvas.height
        };
        const rawRightEye = {
            x: ((landmarks[263].x + landmarks[362].x) / 2) * canvas.width,
            y: ((landmarks[263].y + landmarks[362].y) / 2) * canvas.height
        };

        // Eyebrows
        const rawLeftEyebrow = {
            x: landmarks[70].x * canvas.width,
            y: landmarks[70].y * canvas.height
        };
        const rawRightEyebrow = {
            x: landmarks[300].x * canvas.width,
            y: landmarks[300].y * canvas.height
        };

        // Mouth Center
        const rawMouthCenter = {
            x: ((landmarks[13].x + landmarks[14].x) / 2) * canvas.width,
            y: ((landmarks[13].y + landmarks[14].y) / 2) * canvas.height
        };

        // Face Center (forehead center index 10 + chin index 152)
        const rawCenter = {
            x: ((landmarks[10].x + landmarks[152].x) / 2) * canvas.width,
            y: ((landmarks[10].y + landmarks[152].y) / 2) * canvas.height
        };

        // Outer boundary indices for irregular face aura contour
        const contourIndices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];
        const rawContour = contourIndices.map(idx => ({
            x: landmarks[idx].x * canvas.width,
            y: landmarks[idx].y * canvas.height
        }));

        faceState.rawWidth = rawWidth;
        faceState.rawHeight = rawHeight;
        faceState.rawCenter = rawCenter;
        faceState.rawNoseTip = rawNoseTip;
        faceState.rawLeftEye = rawLeftEye;
        faceState.rawRightEye = rawRightEye;
        faceState.rawLeftEyebrow = rawLeftEyebrow;
        faceState.rawRightEyebrow = rawRightEyebrow;
        faceState.rawMouthCenter = rawMouthCenter;
        faceState.rawContour = rawContour;
    } else {
        faceState.detected = false;
    }
});

// =====================================================
// LANDMARK SMOOTHING & INTENSITY UPDATE
// =====================================================
function smoothLandmarks() {
    const lAmt = 0.15; // hand smoothing weight
    
    for (const key in handsState) {
        const hand = handsState[key];
        
        if (hand.active) {
            hand.activation = lerp(hand.activation, 1.0, 0.08); // takes ~0.5 - 1.0s to fade in
            if (hand.activation < 0.05) {
                hand.x = hand.rawX;
                hand.y = hand.rawY;
                hand.radius = hand.rawRadius;
            } else {
                hand.x = lerp(hand.x, hand.rawX, lAmt);
                hand.y = lerp(hand.y, hand.rawY, lAmt);
                hand.radius = lerp(hand.radius, hand.rawRadius, lAmt);
            }
        } else {
            hand.activation = lerp(hand.activation, 0.0, 0.08); // smooth fade out
        }
    }

    if (faceState.detected) {
        const fAmt = 0.22; // face smoothing weight
        
        faceState.center.x = lerp(faceState.center.x, faceState.rawCenter.x, fAmt);
        faceState.center.y = lerp(faceState.center.y, faceState.rawCenter.y, fAmt);
        faceState.width = lerp(faceState.width, faceState.rawWidth, fAmt);
        faceState.height = lerp(faceState.height, faceState.rawHeight, fAmt);
        
        faceState.leftEye.x = lerp(faceState.leftEye.x, faceState.rawLeftEye.x, fAmt);
        faceState.leftEye.y = lerp(faceState.leftEye.y, faceState.rawLeftEye.y, fAmt);
        faceState.rightEye.x = lerp(faceState.rightEye.x, faceState.rawRightEye.x, fAmt);
        faceState.rightEye.y = lerp(faceState.rightEye.y, faceState.rawRightEye.y, fAmt);

        faceState.leftEyebrow.x = lerp(faceState.leftEyebrow.x, faceState.rawLeftEyebrow.x, fAmt);
        faceState.leftEyebrow.y = lerp(faceState.leftEyebrow.y, faceState.rawLeftEyebrow.y, fAmt);
        faceState.rightEyebrow.x = lerp(faceState.rightEyebrow.x, faceState.rawRightEyebrow.x, fAmt);
        faceState.rightEyebrow.y = lerp(faceState.rightEyebrow.y, faceState.rawRightEyebrow.y, fAmt);

        faceState.noseTip.x = lerp(faceState.noseTip.x, faceState.rawNoseTip.x, fAmt);
        faceState.noseTip.y = lerp(faceState.noseTip.y, faceState.rawNoseTip.y, fAmt);

        faceState.mouthCenter.x = lerp(faceState.mouthCenter.x, faceState.rawMouthCenter.x, fAmt);
        faceState.mouthCenter.y = lerp(faceState.mouthCenter.y, faceState.rawMouthCenter.y, fAmt);

        if (faceState.rawContour.length > 0) {
            if (faceState.contour.length !== faceState.rawContour.length) {
                faceState.contour = faceState.rawContour.map(pt => ({ ...pt }));
            } else {
                for (let i = 0; i < faceState.rawContour.length; i++) {
                    faceState.contour[i].x = lerp(faceState.contour[i].x, faceState.rawContour[i].x, fAmt);
                    faceState.contour[i].y = lerp(faceState.contour[i].y, faceState.rawContour[i].y, fAmt);
                }
            }
        }
    }
}

function updateMagicIntensity() {
    let openCount = 0;
    if (handsState.Left.activation > 0.1) openCount += handsState.Left.activation;
    if (handsState.Right.activation > 0.1) openCount += handsState.Right.activation;

    // Normalize intensity:
    // 0 open palms -> 0.0
    // 1 open palm -> 0.5
    // 2 open palms -> 1.0
    const targetIntensity = Math.min(1.0, openCount / 2.0);
    globalMagicIntensity = lerp(globalMagicIntensity, targetIntensity, 0.08);
}

// =====================================================
// UPGRADED ORGANIC PALM MAGIC VFX
// =====================================================
function drawPalmGlow(x, y, radius, activation) {
    const pulse = 1 + Math.sin(time * 0.08) * 0.08;
    const currentRadius = radius * pulse * activation;
    if (currentRadius <= 0) return;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, currentRadius);
    gradient.addColorStop(0, "rgba(255, 235, 240, 0.95)"); // Pink-white core
    gradient.addColorStop(0.12, "rgba(255, 26, 64, 0.95)");  // Bright scarlet
    gradient.addColorStop(0.38, "rgba(204, 0, 34, 0.65)");   // Red middle
    gradient.addColorStop(0.72, "rgba(128, 0, 21, 0.25)");   // Crimson outer
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = gradient;

    ctx.beginPath();
    ctx.arc(x, y, currentRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// Overwrite script.js with complete modular implementation of upgraded hand and face tracking and VFX.
function drawPalmCore(x, y, radius, activation) {
    const pulse = 0.85 + Math.sin(time * 0.12) * 0.12;
    const size = radius * 0.22 * pulse * activation;
    if (size <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.85 * activation;
    
    const grad = ctx.createRadialGradient(x, y, 0, x, y, size);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.35, "#ffebf0");
    grad.addColorStop(1, "#ff163d");

    ctx.fillStyle = grad;
    ctx.shadowBlur = 35;
    ctx.shadowColor = "#ff0033";

    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

function drawPalmRings(x, y, radius, activation) {
    if (activation <= 0.05) return;

    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "screen";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "#ff0033";
    
    // Outer ring
    ctx.save();
    ctx.rotate(ringRotation);
    ctx.strokeStyle = "#ff1744";
    ctx.globalAlpha = 0.75 * activation;
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.62 * activation, radius * 0.35 * activation, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Inner ring
    ctx.save();
    ctx.rotate(-ringRotation * 1.4);
    ctx.strokeStyle = "#ffebf0";
    ctx.globalAlpha = 0.65 * activation;
    ctx.lineWidth = 1.5;

    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.42 * activation, radius * 0.23 * activation, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Third chaotic ring
    ctx.save();
    ctx.rotate(ringRotation * 0.7 + Math.PI / 4);
    ctx.strokeStyle = "#800015";
    ctx.globalAlpha = 0.45 * activation;
    ctx.lineWidth = 1.0;

    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.52 * activation, radius * 0.18 * activation, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    ctx.restore();
}

function drawPalmWisps(x, y, radius, activation) {
    if (activation <= 0.05) return;

    const baseCount = Math.floor(8 * wispCountMultiplier);
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "#ff1744";
    ctx.shadowBlur = 12;
    ctx.shadowColor = "#ff0033";
    ctx.lineWidth = 1.5;

    for (let i = 0; i < baseCount; i++) {
        const baseAngle = ((Math.PI * 2) / baseCount) * i;
        const wave = Math.sin(time * 0.04 + i) * 0.25;
        const angle = baseAngle + wave;
        const startRadius = radius * 0.2 * activation;
        const endRadius = radius * (0.45 + Math.sin(time * 0.05 + i) * 0.07) * activation;

        const sx = Math.cos(angle) * startRadius;
        const sy = Math.sin(angle) * startRadius;
        const ex = Math.cos(angle) * endRadius;
        const ey = Math.sin(angle) * endRadius;

        const controlAngle = angle + Math.sin(time * 0.03 + i) * 0.35;
        const controlRadius = radius * 0.38 * activation;
        const cx = Math.cos(controlAngle) * controlRadius;
        const cy = Math.sin(controlAngle) * controlRadius;

        ctx.globalAlpha = (0.25 + Math.abs(Math.sin(time * 0.06 + i)) * 0.3) * activation;

        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.quadraticCurveTo(cx, cy, ex, ey);
        ctx.stroke();
    }
    ctx.restore();
}

function drawPalmArcs(x, y, radius, activation) {
    if (activation <= 0.05) return;

    const baseArcs = Math.min(arcCountLimit, Math.floor(4 * activation));
    ctx.save();
    ctx.translate(x, y);
    ctx.globalCompositeOperation = "screen";
    ctx.strokeStyle = "#ffebf0"; // Bright white/pink core
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#ff0033";
    ctx.lineWidth = 1.2;

    for (let i = 0; i < baseArcs; i++) {
        const angle = Math.random() * Math.PI * 2;
        let px = Math.cos(angle) * radius * 0.2 * activation;
        let py = Math.sin(angle) * radius * 0.2 * activation;

        ctx.beginPath();
        ctx.moveTo(px, py);

        const steps = 4;
        for (let j = 0; j < steps; j++) {
            const r = radius * (0.2 + (j * 0.07)) * activation;
            px = Math.cos(angle) * r + (Math.random() - 0.5) * 8 * activation;
            py = Math.sin(angle) * r + (Math.random() - 0.5) * 8 * activation;
            ctx.lineTo(px, py);
        }

        ctx.globalAlpha = (0.3 + Math.random() * 0.5) * activation;
        ctx.stroke();
    }
    ctx.restore();
}

function drawPalmPulse(x, y, radius, activation) {
    if (activation <= 0.05) return;

    const pulse = (Math.sin(time * 0.07) + 1) / 2;
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = (0.08 + pulse * 0.12) * activation;
    ctx.strokeStyle = "#ff1744";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 25;
    ctx.shadowColor = "#ff0033";

    ctx.beginPath();
    ctx.arc(x, y, radius * (0.55 + pulse * 0.12) * activation, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
}

function drawPalmMagic(hand) {
    const x = hand.x;
    const y = hand.y;
    const radius = hand.radius;
    const act = hand.activation;

    if (act <= 0.01) return;

    // Layer 1
    drawPalmGlow(x, y, radius, act);
    // Layer 2
    drawPalmCore(x, y, radius, act);
    // Layer 3
    drawPalmRings(x, y, radius, act);
    // Layer 5
    drawPalmWisps(x, y, radius, act);
    // Layer 6
    drawPalmArcs(x, y, radius, act);
    // Layer 7
    drawPalmPulse(x, y, radius, act);
}

// =====================================================
// PARTICLE PHYSICS SYSTEM (ORBITAL & DRIFT PHYSICS)
// =====================================================
function createParticle(x, y, radius, activation, sourceHandKey) {
    if (particles.length >= particleThrottlingLimit) {
        particles.shift();
    }

    const angle = Math.random() * Math.PI * 2;
    const spawnRadius = Math.random() * radius * 0.5;

    const px = x + Math.cos(angle) * spawnRadius;
    const py = y + Math.sin(angle) * spawnRadius;

    // Orbit starting velocities
    const speed = 0.5 + Math.random() * 1.5;
    const tangentX = -Math.sin(angle);
    const tangentY = Math.cos(angle);

    particles.push({
        x: px,
        y: py,
        vx: tangentX * speed + (Math.random() - 0.5) * 0.5,
        vy: tangentY * speed + (Math.random() - 0.5) * 0.5 - 0.5, // Drift slightly up
        size: 1.0 + Math.random() * 2.5,
        life: 1.0,
        decay: 0.022 + Math.random() * 0.018, // Faster general decay for transient sparks
        handKey: sourceHandKey,
        timeOffset: Math.random() * 100
    });
}

function spawnPalmParticles(handKey) {
    const hand = handsState[handKey];
    if (!hand || hand.activation <= 0.05) return;

    const count = Math.min(3, Math.floor(4 * hand.activation));
    for (let i = 0; i < count; i++) {
        createParticle(hand.x, hand.y, hand.radius, hand.activation, handKey);
    }
}

function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        
        // If particle belongs to a hand, apply orbital attractor forces
        if (p.handKey) {
            const hand = handsState[p.handKey];
            if (hand && hand.activation > 0.05) {
                const dx = p.x - hand.x;
                const dy = p.y - hand.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist > 5) {
                    const rx = dx / dist; // Radial vector
                    const ry = dy / dist;
                    const tx = -ry; // Tangential vector
                    const ty = rx;

                    // Pull toward orbit distance
                    const targetDist = hand.radius * 0.45;
                    const pullStrength = 0.08 * (dist - targetDist) / hand.radius;
                    const pullX = -rx * pullStrength;
                    const pullY = -ry * pullStrength;

                    // Tangential orbit force
                    const swirlPeriod = Math.sin(time * 0.01 + p.timeOffset);
                    const orbitStrength = (1.5 + swirlPeriod * 0.8) / (dist * 0.01 + 1);
                    const orbitX = tx * orbitStrength * 0.25;
                    const orbitY = ty * orbitStrength * 0.25;

                    // Random flutter and upward rise
                    const chaosX = (Math.random() - 0.5) * 0.15;
                    const chaosY = (Math.random() - 0.5) * 0.15;
                    const driftY = -0.06;

                    p.vx += pullX + orbitX + chaosX;
                    p.vy += pullY + orbitY + chaosY + driftY;

                    // Friction/damping
                    p.vx *= 0.96;
                    p.vy *= 0.96;
                }
            } else {
                // Hand was closed/lost: disperse particle upwards and fade out rapidly
                p.vx += (Math.random() - 0.5) * 0.1;
                p.vy -= 0.04;
                p.vx *= 0.98;
                p.vy *= 0.98;
                p.life -= 0.045; // Rapid fade out (almost immediate) when hand closes
            }
        } else {
            // Head/atmosphere particle: drift upwards and sway
            p.vx += Math.sin(time * 0.05 + p.timeOffset) * 0.05;
            p.vy -= 0.02;
            p.vx *= 0.97;
            p.vy *= 0.97;
        }

        // Apply positions
        p.x += p.vx;
        p.y += p.vy;

        // Decay life
        p.life -= p.decay;

        if (p.life <= 0) {
            particles.splice(i, 1);
        }
    }
}

function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.3, "#ff3154");
        grad.addColorStop(1, "rgba(128, 0, 21, 0)");

        ctx.fillStyle = grad;
        ctx.shadowBlur = 8;
        ctx.shadowColor = "#ff0033";

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
}

// =====================================================
// CINEMATIC EYE GLOW VFX
// =====================================================
function drawEyeGlow() {
    if (!faceState.detected || globalMagicIntensity <= 0.02) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    // Modulate intensity: pulse between crimson and bright pinkish red
    const pulse = 1.0 + Math.sin(time * 0.15) * 0.15;
    const baseOpacity = 0.55 * globalMagicIntensity * pulse;

    const eyes = [
        { center: faceState.leftEye, side: "left" },
        { center: faceState.rightEye, side: "right" }
    ];

    // Compute eye sizing based on distance
    const eyeDist = distance(faceState.leftEye, faceState.rightEye);
    const glowRx = Math.max(12, eyeDist * 0.16); // Horizontal radius
    const glowRy = glowRx * 0.65; // Vertical radius (elliptical)

    for (const eye of eyes) {
        const cx = eye.center.x;
        const cy = eye.center.y;

        // Radial elliptical gradient center
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRx);
        grad.addColorStop(0, "rgba(255, 235, 240, 1.0)");
        grad.addColorStop(0.2, "rgba(255, 26, 64, 0.95)");
        grad.addColorStop(0.55, "rgba(204, 0, 34, 0.6)");
        grad.addColorStop(0.85, "rgba(128, 0, 21, 0.25)");
        grad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.globalAlpha = baseOpacity;

        // Draw elliptical glowing iris
        ctx.beginPath();
        ctx.ellipse(cx, cy, glowRx, glowRy, 0, 0, Math.PI * 2);
        ctx.fill();

        // Atmospheric glowing bloom
        ctx.save();
        ctx.globalAlpha = baseOpacity * 0.45;
        const bloomGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRx * 2.2);
        bloomGrad.addColorStop(0, "rgba(255, 26, 64, 0.4)");
        bloomGrad.addColorStop(0.5, "rgba(128, 0, 21, 0.15)");
        bloomGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = bloomGrad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, glowRx * 2.2, glowRy * 2.2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    ctx.restore();
}

// =====================================================
// RED FACIAL CAST LIGHTING
// =====================================================
function drawFaceLighting() {
    if (!faceState.detected || globalMagicIntensity <= 0.02) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const cx = faceState.noseTip.x;
    const cy = faceState.noseTip.y;
    const rx = faceState.width * 0.95;
    const ry = faceState.height * 0.95;

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, "rgba(255, 26, 64, 0.22)");
    grad.addColorStop(0.4, "rgba(153, 0, 26, 0.12)");
    grad.addColorStop(0.8, "rgba(80, 0, 10, 0.03)");
    grad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = grad;
    const pulse = 0.85 + Math.sin(time * 0.05) * 0.15;
    ctx.globalAlpha = globalMagicIntensity * 0.8 * pulse;

    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// =====================================================
// SCARLET FACE AURA
// =====================================================
function drawFaceAura() {
    if (!faceState.detected || faceState.contour.length === 0 || globalMagicIntensity <= 0.02) return;

    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const C = faceState.center;
    const count = faceState.contour.length;
    
    // Construct dynamic, wavy, head-conforming aura path
    const outerPoints = [];
    for (let i = 0; i < count; i++) {
        const P = faceState.contour[i];
        const dx = P.x - C.x;
        const dy = P.y - C.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d === 0) continue;

        const ux = dx / d;
        const uy = dy / d;
        const angle = Math.atan2(dy, dx);

        // Sine wave calculations for chaotic shape
        const wave1 = Math.sin(angle * 5 + time * 0.08) * 14 * auraDetailLevel;
        const wave2 = Math.cos(angle * 10 - time * 0.14) * 8 * auraDetailLevel;
        const wave3 = Math.sin(time * 0.05 + i) * 6;
        
        const baseOffset = faceState.width * 0.22 * globalMagicIntensity;
        const dynamicOffset = (wave1 + wave2 + wave3) * globalMagicIntensity;
        const outerDist = d + baseOffset + dynamicOffset;
        
        outerPoints.push({
            x: C.x + ux * outerDist,
            y: C.y + uy * outerDist
        });
    }

    if (outerPoints.length < 3) return;

    // Atmospheric outer gradient fill
    const centerGradient = ctx.createRadialGradient(C.x, C.y, faceState.width * 0.4, C.x, C.y, faceState.width * 1.5);
    centerGradient.addColorStop(0, "rgba(255, 26, 64, 0.0)");
    centerGradient.addColorStop(0.3, "rgba(153, 0, 26, 0.08)");
    centerGradient.addColorStop(0.7, "rgba(128, 0, 21, 0.04)");
    centerGradient.addColorStop(1.0, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.moveTo(outerPoints[0].x, outerPoints[0].y);
    for (let i = 1; i < outerPoints.length; i++) {
        ctx.lineTo(outerPoints[i].x, outerPoints[i].y);
    }
    ctx.closePath();
    ctx.fill();



    // Floating head particles (upper hemisphere)
    if (Math.random() < 0.22 * globalMagicIntensity) {
        const upperPoints = outerPoints.filter(p => p.y < C.y - faceState.height * 0.1);
        if (upperPoints.length > 0) {
            const spawnPt = upperPoints[Math.floor(Math.random() * upperPoints.length)];
            if (particles.length < particleThrottlingLimit) {
                particles.push({
                    x: spawnPt.x,
                    y: spawnPt.y,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: -1.2 - Math.random() * 1.5,
                    size: 0.8 + Math.random() * 1.5,
                    life: 1.0,
                    decay: 0.012 + Math.random() * 0.015,
                    handKey: null,
                    timeOffset: Math.random() * 100
                });
            }
        }
    }

    ctx.restore();
}

// =====================================================
// CINEMATIC RED ATMOSPHERE & EDGE VIGNETTE
// =====================================================
function drawAtmosphereAndVignette() {
    const w = canvas.width;
    const h = canvas.height;

    // Face-focused Vignette position
    const cx = faceState.detected ? faceState.center.x : w / 2;
    const cy = faceState.detected ? faceState.center.y : h / 2;

    const innerRadius = Math.max(w, h) * (0.45 - globalMagicIntensity * 0.15);
    const outerRadius = Math.max(w, h) * (1.1 - globalMagicIntensity * 0.2);

    const vignette = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
    const maxOpacity = 0.55 + globalMagicIntensity * 0.35;
    vignette.addColorStop(1, `rgba(0, 0, 0, ${maxOpacity})`);

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();

    // Ambient Additive Glow
    if (globalMagicIntensity > 0.02) {
        ctx.save();
        ctx.globalCompositeOperation = "screen";
        
        const atmosGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 1.2);
        atmosGrad.addColorStop(0, "rgba(255, 26, 64, 0.08)");
        atmosGrad.addColorStop(0.5, "rgba(128, 0, 21, 0.04)");
        atmosGrad.addColorStop(1.0, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = atmosGrad;
        ctx.globalAlpha = globalMagicIntensity * 0.8;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
    }
}

// =====================================================
// PERFORMANCE MONITORING & DYNAMIC THROTTLING
// =====================================================
function monitorPerformance() {
    const now = performance.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    
    const currentFps = 1000 / delta;
    fps = lerp(fps, currentFps, 0.05);

    // Run throttling adjustments roughly every second
    if (time % 60 === 0 && time > 180) {
        if (fps < 28) {
            particleThrottlingLimit = Math.max(120, particleThrottlingLimit - 50);
            wispCountMultiplier = Math.max(0.5, wispCountMultiplier - 0.15);
            arcCountLimit = Math.max(2, arcCountLimit - 1);
            auraDetailLevel = Math.max(0.5, auraDetailLevel - 0.15);
        } else if (fps > 50) {
            particleThrottlingLimit = Math.min(350, particleThrottlingLimit + 10);
            wispCountMultiplier = Math.min(1.0, wispCountMultiplier + 0.05);
            arcCountLimit = Math.min(4, arcCountLimit + 1);
            auraDetailLevel = Math.min(1.0, auraDetailLevel + 0.05);
        }
    }
}

// =====================================================
// MAIN ANIMATION LOOP
// =====================================================
function animate() {
    // If the video width/height is not set yet, skip drawing
    if (video.videoWidth === 0 || video.videoHeight === 0) {
        requestAnimationFrame(animate);
        return;
    }

    // Sync canvas sizing with video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    time++;
    ringRotation += 0.018;

    // Update state variables (lerps and physics)
    smoothLandmarks();
    updateMagicIntensity();
    updateParticles();

    // 1. Edge Vignette & Screen Atmosphere
    drawAtmosphereAndVignette();

    // 2. Face Effects (Aura, Facial Cast Light, Glowing Eyes)
    drawFaceAura();
    drawFaceLighting();
    drawEyeGlow();

    // 3. Palm Magic VFX & Particle Spawning
    for (const key in handsState) {
        const hand = handsState[key];
        drawPalmMagic(hand);
        spawnPalmParticles(key);
    }

    // 4. Render Active Particles
    drawParticles();

    // 5. Monitor and Adapt Performance
    monitorPerformance();

    requestAnimationFrame(animate);
}

// =====================================================
// CAMERA INITIALIZATION & INFERENCE
// =====================================================
const camera = new Camera(video, {
    onFrame: async () => {
        await holistic.send({ image: video });
    },
    width: 1280,
    height: 720
});

camera.start();

// Launch main rendering loop
animate();