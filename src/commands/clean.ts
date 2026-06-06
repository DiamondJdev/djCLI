import * as fs from "fs";
import * as path from "path";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";

export const HEAVY_DIRS = [
  "node_modules",
  "dist",
  "build",
  ".next",
  "target",
  ".turbo",
  "out",
];

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["K", "M", "G", "T", "P", "E"];
  let value = bytes;
  let unitIndex = -1;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex++;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}B`;
}

export function findTargetDirectories(
  root: string,
  maxDepth: number,
): string[] {
  const targets: string[] = [];

  function walk(dir: string, depth: number): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;

      const fullPath = path.join(dir, entry.name);
      const entryDepth = depth + 1;

      if (maxDepth > 0 && entryDepth > maxDepth) continue;

      if (entry.name === ".git") continue;

      if (HEAVY_DIRS.includes(entry.name)) {
        targets.push(fullPath);
        continue;
      }

      walk(fullPath, entryDepth);
    }
  }

  walk(root, 0);
  return targets;
}

export function calculateDirSize(dirPath: string): number {
  let size = 0;

  function walk(current: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else {
        try {
          size += fs.statSync(fullPath).size;
        } catch {
          // skip inaccessible files
        }
      }
    }
  }

  walk(dirPath);
  return size;
}

export async function cleanAction(options: {
  dryRun: boolean;
  yes: boolean;
  depth: string;
}): Promise<void> {
  const maxDepth = parseInt(options.depth, 10);
  console.log("Scanning for heavy directories...");

  const cwd = process.cwd();
  const targets = findTargetDirectories(cwd, maxDepth);

  if (targets.length === 0) {
    console.log(chalk.green("No heavy directories found"));
    return;
  }

  const dirSizes = new Map<string, number>();
  let totalSize = 0;
  for (const dir of targets) {
    const size = calculateDirSize(dir);
    dirSizes.set(dir, size);
    totalSize += size;
  }

  console.log(`\nFound ${targets.length} director(ies) to clean:`);
  for (const dir of targets) {
    const relPath = path.relative(cwd, dir);
    console.log(`   • ${relPath} (${formatSize(dirSizes.get(dir) ?? 0)})`);
  }
  console.log(`\nTotal space to be freed: ${formatSize(totalSize)}\n`);

  if (options.dryRun) {
    console.log("Dry-run mode: No directories were deleted");
    return;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: "Delete these directories?",
      default: false,
    });
    if (!confirmed) {
      console.log(chalk.red("Cleanup cancelled"));
      return;
    }
  }

  let deletedCount = 0;
  let failedCount = 0;
  const failedDirs: string[] = [];
  let freedSpace = 0;

  for (const dir of targets) {
    const relPath = path.relative(cwd, dir);
    try {
      fs.rmSync(dir, { recursive: true });
      console.log(
        `Deleted: ${relPath} (${formatSize(dirSizes.get(dir) ?? 0)})`,
      );
      deletedCount++;
      freedSpace += dirSizes.get(dir) ?? 0;
    } catch {
      console.log(chalk.red(`Failed to delete ${relPath}`));
      failedCount++;
      failedDirs.push(relPath);
    }
  }

  console.log();
  if (deletedCount > 0) {
    console.log(
      chalk.green(`Successfully deleted ${deletedCount} director(ies)`),
    );
    console.log(`Freed up ${formatSize(freedSpace)} of disk space`);
  }
  if (failedCount > 0) {
    console.log(
      chalk.yellow(
        `Failed to delete ${failedCount} director(ies): ${failedDirs.join(", ")}`,
      ),
    );
  }
}

export const cleanCommand = new Command("clean")
  .description("Recursively remove heavy dependency and build folders")
  .option("--dry-run", "Show what would be deleted without actually deleting")
  .option("-y, --yes", "Skip confirmation prompt")
  .option("--depth <n>", "Limit directory traversal depth (0 = unlimited)", "0")
  .action(cleanAction);
