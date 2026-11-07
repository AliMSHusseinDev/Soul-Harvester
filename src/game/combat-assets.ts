import type { CombatSheet } from "./combat-sprites";

// Filled by scripts/prepare-combat-assets.py after the original PNG files are
// available and their frame rectangles/backgrounds have been inspected.
// An empty catalog deliberately retains the existing effects; no substitute
// artwork is generated or represented as the user's supplied sprite sheets.
export const COMBAT_ASSETS: readonly CombatSheet[] = [];
