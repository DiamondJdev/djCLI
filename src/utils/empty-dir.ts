import * as fs from "fs";
import * as path from "path";

// Empties the folder instead of removing it, so `--force .` works too.
// Throws if an entry can't be removed.
export function emptyDir(dir: string): void {
  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
}
