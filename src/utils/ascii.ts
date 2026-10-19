import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

function findPackageRoot(): string {
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

export function getAsciiArt(): string {
  const packageRoot = findPackageRoot();
  const asciiPath = path.join(packageRoot, "ascii.txt");
  return fs.readFileSync(asciiPath, "utf-8");
}

export function printAsciiArt(): void {
  console.log(getAsciiArt());
}
