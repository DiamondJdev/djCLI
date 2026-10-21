import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export type DeployTarget = { host: string; command: string };

const HOST_RE = /^[A-Za-z0-9][A-Za-z0-9._@:-]*$/;
const COMMAND_RE = /^[A-Za-z0-9_./-]+$/;

export function repoKey(remoteUrl: string): string {
  return remoteUrl
    .trim()
    .replace(/^[a-z+]+:\/\//, "")
    .replace(/^[^@/]+@/, "")
    .replace(/^([^/:]+):(?!\d+\/)/, "$1/")
    .replace(/\.git$/, "")
    .replace(/\/+$/, "");
}

export function currentRepoKey(): string {
  try {
    const url = execFileSync("git", ["remote", "get-url", "origin"], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return repoKey(url);
  } catch {
    throw new Error('dj deploy needs a git repo with an "origin" remote.');
  }
}

export function validateTarget(t: DeployTarget): DeployTarget {
  if (typeof t.host !== "string" || !HOST_RE.test(t.host)) throw new Error(`Invalid host "${t.host}"`);
  if (typeof t.command !== "string" || !COMMAND_RE.test(t.command)) throw new Error(`Invalid command "${t.command}"`);
  return t;
}

const configPath = (home: string): string => path.join(home, ".dj", "config.json");

function readConfig(home: string): Record<string, unknown> {
  const file = configPath(home);
  if (!fs.existsSync(file)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf-8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("not an object");
    return parsed;
  } catch {
    throw new Error(`Can't read ${file}. Fix or delete it.`);
  }
}

const deploySection = (config: Record<string, unknown>): Record<string, DeployTarget> =>
  (config.deploy as Record<string, DeployTarget> | undefined) ?? {};

export function readTarget(home: string, key: string): DeployTarget | undefined {
  const t = deploySection(readConfig(home))[key];
  return t === undefined ? undefined : validateTarget(t);
}

export function writeTarget(home: string, key: string, t: DeployTarget): void {
  const config = readConfig(home);
  const next = { ...config, deploy: { ...deploySection(config), [key]: validateTarget(t) } };
  fs.mkdirSync(path.dirname(configPath(home)), { recursive: true });
  fs.writeFileSync(configPath(home), JSON.stringify(next, null, 2) + "\n");
}
