import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

export function findPackageRoot(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  let current = path.resolve(__dirname);
  while (current !== path.dirname(current)) {
    if (fs.existsSync(path.join(current, "package.json"))) {
      return current;
    }
    current = path.dirname(current);
  }
  return process.cwd();
}
