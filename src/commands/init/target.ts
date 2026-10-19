import * as fs from "fs";
import * as path from "path";

// Leftovers of `git init` / `gh repo create` that every template keeps.
const ALLOWED_EXISTING = [".git", "README.md", ".gitignore", ".DS_Store"];

/** Throws unless the folder is missing or holds only ALLOWED_EXISTING files. */
export function assertTargetUsable(dir: string): void {
  if (!fs.existsSync(dir)) return;
  const unexpected = fs
    .readdirSync(dir)
    .filter((e) => !ALLOWED_EXISTING.includes(e))
    .sort();
  if (unexpected.length > 0) {
    throw new Error(`Directory '${dir}' is not empty: ${unexpected.join(", ")}`);
  }
}

// Empties the folder instead of removing it, so `--force .` works too.
export function emptyDir(dir: string): void {
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}
