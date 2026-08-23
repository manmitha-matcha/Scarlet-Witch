# Scarlet Witch 🔴✨

A browser-based hand-tracking experience that turns your webcam feed into a canvas for magic — no gauntlet, no Mind Stone, just your hand and a bit of JavaScript sorcery.

Point your camera, move your hand, and watch chaos magic (well, canvas-rendered effects) follow your fingertips in real time.

## How it works

- Your webcam stream is captured via `<video>` and fed into [MediaPipe Hands](https://google.github.io/mediapipe/solutions/hands.html), which detects 21 hand landmarks per frame.
- Those landmarks drive drawing on an overlaid `<canvas>` element, layered on top of the live video.
- [MediaPipe Camera Utils](https://google.github.io/mediapipe/solutions/hands.html) handles the plumbing between the camera stream and the detection pipeline.

Everything runs client-side in the browser — no backend, no build step, no dependencies to install.

## Tech stack

| Piece | Role |
|---|---|
| `index.html` | Page shell, video/canvas layout, loads MediaPipe scripts via CDN |
| `style.css` | Layout and visual styling for the video/canvas container |
| `script.js` | Hand-tracking logic and canvas rendering |
| [MediaPipe Hands](https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js) | Real-time hand landmark detection |
| [MediaPipe Camera Utils](https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js) | Webcam capture helper |

## Getting started

No installation required — it's plain HTML/CSS/JS.

1. Clone the repo:
   ```bash
   git clone https://github.com/manmitha-matcha/Scarlet-Witch.git
   cd Scarlet-Witch
   ```
2. Serve it locally (opening `index.html` directly may block camera access in some browsers, so a local server is recommended):
   ```bash
   python3 -m http.server 8000
   ```
3. Open `http://localhost:8000` in your browser and grant camera permission when prompted.

## Browser support

Requires a modern browser with `getUserMedia` (webcam) support — recent versions of Chrome, Edge, or Firefox work best.

## License

No license specified yet — add one (e.g. MIT) if you plan to let others reuse this.
