# Soul Harvester 0.15.0 — Developer workspace

[Play 0.15.0](https://alimshusseindev.github.io/Soul-Harvester/?v=0.15.0).

The main menu now includes Developer Button. Left Alt toggles flight/noclip; F1 opens the editor cursor/panels. The workspace includes searchable effects/game tuning, weight/color controls, slow/frozen effect previews, a texture hotbar, editable placed props, terrain raise/lower strokes, world colors, lighting and local texture import.

Projects autosave locally and support undo/redo, reset of tuning groups, JSON import/export and saved reload. Saved values load before cached game constants. Returning to normal play rebuilds scene collision and navigation from the project. No new runtime dependencies are added.

See the [full guide](developer-mode.md) for controls, live versus reload behavior and explicit bounds: the inspector edits newly placed objects, fixed authored scenery is not individually editable, terrain edits retain the original playable-map rules, and local projects are not published/shared automatically. Numeric/boolean settings are exposed through the tuning registry; this is a game-specific editor rather than a general-purpose engine.

Validation includes 129 unit tests, strict build/formatting, the real-input developer browser scenario and normal gameplay regression. Software rendering and bounded scenarios do not establish every hardware/scene configuration.

Unedited captures: [Map Design](screenshots/0.15.0-developer-map.png), [Effects](screenshots/0.15.0-developer-effects.png).
