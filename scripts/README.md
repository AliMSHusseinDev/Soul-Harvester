`browser-check.mjs` is the reproducible end-to-end validation suite. Run it against a production preview to avoid hot reloads interrupting pointer lock.

`inspect.mjs` captures higher-resolution menu and gameplay screenshots against the development server. It is a visual inspection helper, not a substitute for the browser suite.

`visual-check.mjs` captures the textured forest, dagger, rifle sights and 360-degree sky. It uses actual pointer input, checks rifle ADS alignment and records browser/renderer errors. Run it against a production preview with `npm run test:visual`. Images are saved in ignored `artifacts/`.
