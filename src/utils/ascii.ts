import * as fs from "fs";
import * as path from "path";
import { findPackageRoot } from "./package-root.js";

export function getAsciiArt(): string {
  const packageRoot = findPackageRoot();
  const asciiPath = path.join(packageRoot, "ascii.txt");
  return fs.readFileSync(asciiPath, "utf-8");
}

export function printAsciiArt(): void {
  console.log(getAsciiArt());
}
