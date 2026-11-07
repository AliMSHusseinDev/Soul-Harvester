`browser-check.mjs` is the reproducible end-to-end validation suite. Run it against a production preview to avoid hot reloads interrupting pointer lock.

`inspect.mjs` captures higher-resolution menu and gameplay screenshots against the development server. It is a visual inspection helper, not a substitute for the browser suite.

`visual-check.mjs` captures the textured forest, dagger, rifle sights and 360-degree sky. It uses actual pointer input, checks rifle ADS alignment and records browser/renderer errors. Run it against a production preview with `npm run test:visual`. Images are saved in ignored `artifacts/`.

`polish-check.mjs` starts an isolated Vite fixture on localhost:5190 and renders the actual gameplay classes in a controlled scene. It verifies four alpha-preserving enemy atlas frames, captures the white body flash, normal/critical numbers, pixel impacts and open-hand casting, then kills forty enemies and checks the resulting loot stream, level-up banner and real rewards. Run `npm run test:polish`; no production preview is needed. The scene is a test fixture, not gameplay footage, and is excluded from the production build.
