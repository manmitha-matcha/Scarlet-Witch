# Scarlet Witch - Chaos Magic VFX Experience

An interactive, browser-based webcam experience that upgrades real-time video feeds with cinematic **Scarlet-Witch-inspired red chaos magic**.

Powered by **MediaPipe Holistic**, **Canvas 2D**, and **Vanilla HTML/CSS/JavaScript**, this application overlays real-time procedural visual effects centered around the user's palms, eyes, and face.

---

## Visual & VFX Features

### 👤 Facial & Atmospheric Effects
*   **Red Glowing Eyes (Eye VFX)**: Tracks eye pupils continuously. Generates a glowing, elliptical gradient with a bright pinkish-white core and soft red outer bloom that pulses with chaos energy while keeping the user's real eyes visible underneath.
*   **Red Facial Lighting**: Simulates red cast lighting on the face using a soft radial gradient centered on the nose tip, matching hand activation intensity.
*   **Scarlet Face Aura**: Generates a soft, misty background radial red glow around the user's head boundary. 
*   **Floating Crown Particles**: Spawns tiny crimson sparks that drift upwards from the upper head boundary.
*   **Edge Vignette & Atmosphere**: Adds a cinematic full-screen dark vignette that closes in, combined with a subtle additive red screen atmosphere, as magic intensity increases.

### 🖐️ Palm Magic & Particle Physics
*   **Multi-layered Palm Magic**: Each open palm generates a bright glowing core, dual rotating wavy rings, organic wisps, and chaotic pink electric arcs.
*   **Orbital Particle Physics**: Sparks orbit the palm center using radial attractor pulls and tangential orbit forces, creating a swirling magical vortex.
*   **Dynamic Hand Activation**: Triggers smooth fade-in and fade-out animations (0.5–1s) when transition states change between closed fists and open palms.
*   **Instant Dismissal**: Sparks dissolve immediately when a palm is closed or removed from tracking.
*   **Dual-Hand Scale**: Global magic intensity is mapped directly to palm states (0 hands = 0, 1 hand = 0.5, 2 hands = 1.0), scaling all screen vignettes and visual elements dynamically.

---

## Architecture & Technology Stack

The project operates entirely in the browser using CDN-loaded libraries:

```
                  Webcam Feed
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
       Holistic.js        Camera_utils.js
             │
             ▼
      onResults callback
      ┌──────┼──────┐
      ▼      ▼      ▼
    Hands  Face   Eyes
      │      │      │
      ▼      ▼      ▼
   VFX Layers rendered to Canvas 2D
```

### Why MediaPipe Holistic?
Initially, separate packages for `@mediapipe/hands` and `@mediapipe/face_mesh` were loaded in parallel. However, their CDN scripts poll and write to a shared Emscripten namespace globally on `window`. This caused resource loading collisions (such as the hands solution attempting to load face mesh asset data) and aborted WebAssembly compilations. 

We transitioned to a **unified MediaPipe Holistic pipeline** which:
1.  Resolves all WebAssembly library and path collisions.
2.  Reduces network and CPU overhead by running a single unified graph on the video frames.
3.  Pre-separates left and right hands cleanly without manual handedness mapping.

---

## File Structure

```text
scarlet-magic/
├── index.html   # HTML5 canvas, video element, loading screen and Holistic CDN script tags
├── style.css    # Layout, absolute layers, and custom loading screen animations
├── script.js     # Main engine (state tracking, physics particles, and canvas drawings)
└── README.md    # Documentation
```

---

## How to Run Locally

### 1. Clone the Repository
First, clone this repository to your local machine:
```bash
git clone https://github.com/manmitha-matcha/Scarlet-Witch.git
cd Scarlet-Witch
```

### 2. Serve Files
Since MediaPipe dynamically loads WASM assets and requires camera permissions, the page must be served over a local server (`localhost`) or HTTPS. 

You can use any local server utility. For example, using Node.js:
```bash
npx http-server -p 8085
```
Or using Python:
```bash
python -m http.server 8085
```

### 3. Access in Browser
Open your browser and navigate to:
**`http://localhost:8085`**

Grant camera access when prompted. The stylized loading screen will fade out as soon as the Holistic models finish compiling and process the first frame.

---

## Customization in `script.js`

You can easily customize the magic experience by modifying the variables at the top of `script.js`:
*   `minDetectionConfidence` / `minTrackingConfidence`: Adjusts how easily the camera detects your hands and face.
*   `particleThrottlingLimit`: Maximum number of simultaneous sparks (automatically throttles lower if FPS drops).
*   `decay` (in `createParticle`): Change how long sparks live during active spells.
*   `activation` lerp speeds: Modulates how fast magic starts or fades.
*   `RGBA/Hex colors`: Adjust colors in gradients inside the draw functions for custom color schemes (e.g. green chaos magic, blue space magic).
