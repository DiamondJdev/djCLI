import * as fs from "fs";

export const ALLOWED_EXISTING: readonly string[] = [
  ".git",
  "README.md",
  ".gitignore",
  ".DS_Store",
];

export interface TargetState {
  exists: boolean;
  hasGit: boolean;
  hasGitignore: boolean;
}

export function inspectTargetDir(dir: string): TargetState {
  if (!fs.existsSync(dir)) {
    return { exists: false, hasGit: false, hasGitignore: false };
  }
  const entries = fs.readdirSync(dir);
  const unexpected = entries.filter((e) => !ALLOWED_EXISTING.includes(e)).sort();
  if (unexpected.length > 0) {
    throw new Error(`Directory '${dir}' is not empty: ${unexpected.join(", ")}`);
  }
  return {
    exists: true,
    hasGit: entries.includes(".git"),
    hasGitignore: entries.includes(".gitignore"),
  };
}
