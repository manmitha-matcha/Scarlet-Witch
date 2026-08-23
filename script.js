const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");


// =====================================================
// GLOBAL STATE
// =====================================================

const activeHands = [];
const particles = [];

const MAX_PARTICLES = 350;

let time = 0;
let ringRotation = 0;


// =====================================================
// MEDIAPIPE HANDS
// =====================================================

const hands = new Hands({

    locateFile: (file) => {

        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;

    }

});


hands.setOptions({

    maxNumHands: 2,

    modelComplexity: 1,

    minDetectionConfidence: 0.6,

    minTrackingConfidence: 0.6

});


// =====================================================
// DISTANCE
// =====================================================

function distance(a, b) {

    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(
        dx * dx + dy * dy
    );
}


// =====================================================
// OPEN PALM DETECTION
// =====================================================

function isPalmOpen(hand) {

    const wrist = hand[0];

    const fingers = [

        [8, 6],
        [12, 10],
        [16, 14],
        [20, 18]

    ];

    let extended = 0;


    for (const [tip, joint] of fingers) {

        const tipDistance =
            distance(
                hand[tip],
                wrist
            );

        const jointDistance =
            distance(
                hand[joint],
                wrist
            );


        if (tipDistance > jointDistance) {

            extended++;

        }

    }


    return extended >= 3;
}


// =====================================================
// PALM CENTER
// =====================================================

function getPalmCenter(hand) {

    const points = [

        hand[0],
        hand[5],
        hand[9],
        hand[13],
        hand[17]

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


// =====================================================
// PALM SIZE
// =====================================================

function getPalmSize(hand) {

    return distance(
        hand[5],
        hand[17]
    );
}


// =====================================================
// LAYER 1
// MAIN PALM GLOW
// =====================================================

function drawPalmGlow(
    x,
    y,
    radius
) {

    const pulse =
        1 +
        Math.sin(time * 0.08) *
        0.08;


    const currentRadius =
        radius * pulse;


    const gradient =
        ctx.createRadialGradient(

            x,
            y,
            0,

            x,
            y,
            currentRadius

        );


    gradient.addColorStop(
        0,
        "rgba(255, 220, 230, 0.95)"
    );


    gradient.addColorStop(
        0.12,
        "rgba(255, 30, 60, 0.95)"
    );


    gradient.addColorStop(
        0.35,
        "rgba(230, 0, 40, 0.65)"
    );


    gradient.addColorStop(
        0.7,
        "rgba(130, 0, 25, 0.25)"
    );


    gradient.addColorStop(
        1,
        "rgba(0, 0, 0, 0)"
    );


    ctx.save();

    ctx.globalCompositeOperation =
        "screen";

    ctx.fillStyle = gradient;


    ctx.beginPath();

    ctx.arc(
        x,
        y,
        currentRadius,
        0,
        Math.PI * 2
    );

    ctx.fill();


    ctx.restore();
}


// =====================================================
// LAYER 2
// BRIGHT PALM CORE
// =====================================================

function drawPalmCore(
    x,
    y,
    radius
) {

    const pulse =
        0.85 +
        Math.sin(time * 0.12) *
        0.12;


    ctx.save();

    ctx.globalCompositeOperation =
        "screen";

    ctx.globalAlpha = 0.8;

    ctx.fillStyle = "#ff163d";

    ctx.shadowBlur = 30;

    ctx.shadowColor = "#ff0033";


    ctx.beginPath();

    ctx.arc(

        x,
        y,

        radius *
        0.18 *
        pulse,

        0,

        Math.PI * 2

    );


    ctx.fill();

    ctx.restore();
}


// =====================================================
// LAYER 3
// ROTATING PALM RINGS
// =====================================================

function drawPalmRings(
    x,
    y,
    radius
) {

    ctx.save();

    ctx.translate(x, y);

    ctx.globalCompositeOperation =
        "screen";

    ctx.shadowBlur = 18;

    ctx.shadowColor =
        "#ff0033";


    // Outer ring

    ctx.save();

    ctx.rotate(
        ringRotation
    );

    ctx.strokeStyle =
        "#ff1744";

    ctx.globalAlpha =
        0.75;

    ctx.lineWidth = 2.5;


    ctx.beginPath();

    ctx.ellipse(

        0,
        0,

        radius * 0.62,
        radius * 0.35,

        0,

        0,
        Math.PI * 2

    );

    ctx.stroke();

    ctx.restore();


    // Inner ring

    ctx.save();

    ctx.rotate(
        -ringRotation * 1.4
    );

    ctx.strokeStyle =
        "#ff5570";

    ctx.globalAlpha =
        0.5;

    ctx.lineWidth = 1.5;


    ctx.beginPath();

    ctx.ellipse(

        0,
        0,

        radius * 0.42,
        radius * 0.23,

        0,

        0,
        Math.PI * 2

    );

    ctx.stroke();

    ctx.restore();


    ctx.restore();
}


// =====================================================
// LAYER 4
// FLOATING PARTICLE CREATION
// =====================================================

function createParticle(
    x,
    y,
    radius
) {

    if (
        particles.length >=
        MAX_PARTICLES
    ) {

        particles.shift();

    }


    const angle =
        Math.random() *
        Math.PI * 2;


    const spawnRadius =
        Math.random() *
        radius *
        0.5;


    const px =
        x +
        Math.cos(angle) *
        spawnRadius;


    const py =
        y +
        Math.sin(angle) *
        spawnRadius;


    const speed =
        0.15 +
        Math.random() *
        0.55;


    particles.push({

        x: px,
        y: py,

        vx:
            Math.cos(angle) *
            speed,

        vy:
            Math.sin(angle) *
            speed -
            Math.random() * 0.2,

        size:
            1 +
            Math.random() * 2.5,

        life: 1,

        decay:
            0.01 +
            Math.random() * 0.015

    });
}


// =====================================================
// LAYER 4
// SPAWN PARTICLES
// =====================================================

function spawnPalmParticles(
    x,
    y,
    radius
) {

    for (
        let i = 0;
        i < 3;
        i++
    ) {

        createParticle(
            x,
            y,
            radius
        );

    }
}


// =====================================================
// LAYER 4
// UPDATE PARTICLES
// =====================================================

function updateParticles() {

    for (
        let i =
            particles.length - 1;

        i >= 0;

        i--
    ) {

        const p =
            particles[i];


        p.x += p.vx;
        p.y += p.vy;


        p.vy -= 0.003;


        p.life -=
            p.decay;


        if (
            p.life <= 0
        ) {

            particles.splice(
                i,
                1
            );

        }

    }
}


// =====================================================
// LAYER 4
// DRAW PARTICLES
// =====================================================

function drawParticles() {

    for (
        const p of particles
    ) {

        ctx.save();

        ctx.globalCompositeOperation =
            "screen";

        ctx.globalAlpha =
            p.life;

        ctx.fillStyle =
            "#ff3154";

        ctx.shadowBlur =
            12;

        ctx.shadowColor =
            "#ff0033";


        ctx.beginPath();

        ctx.arc(

            p.x,
            p.y,
            p.size,

            0,
            Math.PI * 2

        );

        ctx.fill();

        ctx.restore();
    }
}


// =====================================================
// LAYER 5
// SHORT ENERGY WISPS
// =====================================================

function drawPalmWisps(
    x,
    y,
    radius
) {

    const count = 8;


    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.globalCompositeOperation =
        "screen";

    ctx.strokeStyle =
        "#ff1744";

    ctx.shadowBlur =
        12;

    ctx.shadowColor =
        "#ff0033";

    ctx.lineWidth = 1.5;


    for (
        let i = 0;
        i < count;
        i++
    ) {

        const baseAngle =
            (
                Math.PI * 2 /
                count
            ) * i;


        const wave =
            Math.sin(
                time * 0.04 + i
            ) * 0.25;


        const angle =
            baseAngle + wave;


        const startRadius =
            radius * 0.2;


        const endRadius =
            radius *
            (
                0.45 +
                Math.sin(
                    time * 0.05 + i
                ) * 0.07
            );


        const sx =
            Math.cos(angle) *
            startRadius;


        const sy =
            Math.sin(angle) *
            startRadius;


        const ex =
            Math.cos(angle) *
            endRadius;


        const ey =
            Math.sin(angle) *
            endRadius;


        const controlAngle =
            angle +
            Math.sin(
                time * 0.03 + i
            ) * 0.35;


        const controlRadius =
            radius * 0.38;


        const cx =
            Math.cos(controlAngle) *
            controlRadius;


        const cy =
            Math.sin(controlAngle) *
            controlRadius;


        ctx.globalAlpha =
            0.25 +
            Math.abs(
                Math.sin(
                    time * 0.06 + i
                )
            ) * 0.3;


        ctx.beginPath();

        ctx.moveTo(
            sx,
            sy
        );


        ctx.quadraticCurveTo(

            cx,
            cy,

            ex,
            ey

        );


        ctx.stroke();

    }


    ctx.restore();
}


// =====================================================
// LAYER 6
// SMALL CHAOTIC ENERGY ARCS
// =====================================================

function drawPalmArcs(
    x,
    y,
    radius
) {

    const arcs = 4;


    ctx.save();

    ctx.translate(
        x,
        y
    );

    ctx.globalCompositeOperation =
        "screen";

    ctx.strokeStyle =
        "#ff6680";

    ctx.shadowBlur =
        15;

    ctx.shadowColor =
        "#ff0033";

    ctx.lineWidth = 1.5;


    for (
        let i = 0;
        i < arcs;
        i++
    ) {

        const angle =
            Math.random() *
            Math.PI * 2;


        let px =
            Math.cos(angle) *
            radius *
            0.2;


        let py =
            Math.sin(angle) *
            radius *
            0.2;


        ctx.beginPath();

        ctx.moveTo(
            px,
            py
        );


        for (
            let j = 0;
            j < 4;
            j++
        ) {

            const r =
                radius *
                (
                    0.2 +
                    j * 0.07
                );


            px =
                Math.cos(angle) *
                r +
                (Math.random() - 0.5) *
                7;


            py =
                Math.sin(angle) *
                r +
                (Math.random() - 0.5) *
                7;


            ctx.lineTo(
                px,
                py
            );

        }


        ctx.globalAlpha =
            0.3 +
            Math.random() * 0.5;


        ctx.stroke();

    }


    ctx.restore();
}


// =====================================================
// LAYER 7
// PULSING ENERGY
// =====================================================

function drawPalmPulse(
    x,
    y,
    radius
) {

    const pulse =
        (
            Math.sin(
                time * 0.07
            ) + 1
        ) / 2;


    ctx.save();

    ctx.globalCompositeOperation =
        "screen";

    ctx.globalAlpha =
        0.08 +
        pulse * 0.12;

    ctx.strokeStyle =
        "#ff1744";

    ctx.lineWidth = 3;

    ctx.shadowBlur = 25;

    ctx.shadowColor =
        "#ff0033";


    ctx.beginPath();

    ctx.arc(

        x,
        y,

        radius *
        (
            0.55 +
            pulse * 0.12
        ),

        0,
        Math.PI * 2

    );

    ctx.stroke();

    ctx.restore();
}


// =====================================================
// DRAW COMPLETE PALM EFFECT
// =====================================================

function drawPalmMagic(hand) {

    const x =
        hand.x;

    const y =
        hand.y;

    const radius =
        hand.radius;


    // Layer 1
    drawPalmGlow(
        x,
        y,
        radius
    );


    // Layer 2
    drawPalmCore(
        x,
        y,
        radius
    );


    // Layer 3
    drawPalmRings(
        x,
        y,
        radius
    );


    // Layer 5
    drawPalmWisps(
        x,
        y,
        radius
    );


    // Layer 6
    drawPalmArcs(
        x,
        y,
        radius
    );


    // Layer 7
    drawPalmPulse(
        x,
        y,
        radius
    );
}


// =====================================================
// MEDIAPIPE RESULTS
// =====================================================

hands.onResults(
    (results) => {

        activeHands.length = 0;


        const detectedHands =
            results.multiHandLandmarks ||
            [];


        for (
            const hand of detectedHands
        ) {

            if (
                !isPalmOpen(hand)
            ) {

                continue;

            }


            const palm =
                getPalmCenter(
                    hand
                );


            const x =
                palm.x *
                canvas.width;


            const y =
                palm.y *
                canvas.height;


            const palmSize =
                getPalmSize(
                    hand
                );


            /*
                This controls the size of
                the entire magic effect.

                Smaller = tighter palm effect.
            */

            const radius =
                Math.max(

                    45,

                    palmSize *
                    canvas.width *
                    0.75

                );


            activeHands.push({

                x: x,

                y: y,

                radius: radius

            });

        }

    }
);


// =====================================================
// MAIN ANIMATION LOOP
// =====================================================

function animate() {

    canvas.width =
        video.videoWidth;

    canvas.height =
        video.videoHeight;


    ctx.clearRect(

        0,
        0,
        canvas.width,
        canvas.height

    );


    time++;

    ringRotation += 0.018;


    // -------------------------
    // PALM MAGIC
    // -------------------------

    for (
        const hand of activeHands
    ) {

        drawPalmMagic(
            hand
        );


        spawnPalmParticles(

            hand.x,

            hand.y,

            hand.radius

        );

    }


    // -------------------------
    // PARTICLES
    // -------------------------

    updateParticles();

    drawParticles();


    requestAnimationFrame(
        animate
    );
}


animate();


// =====================================================
// CAMERA
// =====================================================

const camera =
    new Camera(

        video,

        {

            onFrame:
                async () => {

                    await hands.send({

                        image: video

                    });

                },


            width: 1280,

            height: 720

        }

    );


camera.start();