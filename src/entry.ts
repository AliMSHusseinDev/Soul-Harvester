// Apply the validated local project before importing any modules that cache game constants.
import { loadDeveloperProject } from "./game/developer-project";
loadDeveloperProject();
void import("./main");
