import * as path from "path";
import { execFileSync } from "child_process";
import { input, select, confirm } from "@inquirer/prompts";

export type PackageManager = "npm" | "pnpm" | "uv";

export const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "uv"];

const DEFAULT_PM: PackageManager = "pnpm";
const FALLBACK_AUTHOR = "DiamondJdev";
const MAX_NAME_LENGTH = 214;

export interface BaseFlags {
  name?: string;
  description?: string;
  pm?: string;
  docker?: boolean;
  yes?: boolean;
  git?: boolean;
  force?: boolean;
}

export interface BaseAnswers {
  name: string;
  description: string;
  pm: PackageManager;
  docker: boolean;
  git: boolean;
  author: string;
}

export function toPackageName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidPackageName(name: string): boolean {
  return name.length <= MAX_NAME_LENGTH && /^[a-z0-9][a-z0-9._-]*$/.test(name);
}

export function readGitAuthor(): string {
  try {
    const name = String(
      execFileSync("git", ["config", "user.name"], { encoding: "utf-8" }) ?? "",
    ).trim();
    return name || FALLBACK_AUTHOR;
  } catch {
    return FALLBACK_AUTHOR;
  }
}

function isPackageManager(value: string): value is PackageManager {
  return (PACKAGE_MANAGERS as readonly string[]).includes(value);
}

function checkPm(pm: string): PackageManager {
  if (!isPackageManager(pm)) {
    throw new Error(
      `Invalid --pm '${pm}'. Use one of: ${PACKAGE_MANAGERS.join(", ")}`,
    );
  }
  return pm;
}

function checkName(name: string): string {
  if (!isValidPackageName(name)) {
    throw new Error(
      `Invalid --name '${name}'. Use lowercase letters, digits, '.', '_' or '-'`,
    );
  }
  return name;
}

async function resolveName(dir: string, flags: BaseFlags): Promise<string> {
  if (flags.name !== undefined) return checkName(flags.name);
  const fallback = toPackageName(path.basename(path.resolve(dir)));
  if (flags.yes) return checkName(fallback);
  const answer = await input({
    message: "Project name",
    default: fallback,
    validate: (v) => isValidPackageName(v) || "Use lowercase letters, digits, '.', '_' or '-'",
  });
  return checkName(answer);
}

async function resolveDescription(flags: BaseFlags): Promise<string> {
  if (flags.description !== undefined && flags.description.trim()) {
    return flags.description.trim();
  }
  if (flags.yes) throw new Error("Missing --description (required with --yes)");
  const answer = await input({
    message: "One-line description",
    validate: (v) => v.trim().length > 0 || "A description is required",
  });
  return answer.trim();
}

async function resolvePm(flags: BaseFlags): Promise<PackageManager> {
  if (flags.pm !== undefined) return checkPm(flags.pm);
  if (flags.yes) return DEFAULT_PM;
  return select<PackageManager>({
    message: "Package manager",
    choices: PACKAGE_MANAGERS.map((pm) => ({ name: pm, value: pm })),
    default: DEFAULT_PM,
  });
}

async function resolveDocker(flags: BaseFlags): Promise<boolean> {
  if (flags.docker !== undefined) return flags.docker;
  if (flags.yes) return false;
  return confirm({ message: "Will this project run in Docker?", default: false });
}

export async function resolveBaseAnswers(
  dir: string,
  flags: BaseFlags,
  author: string,
): Promise<BaseAnswers> {
  const pm = flags.pm !== undefined ? checkPm(flags.pm) : undefined;
  const name = await resolveName(dir, flags);
  const description = await resolveDescription(flags);
  return {
    name,
    description,
    pm: pm ?? (await resolvePm(flags)),
    docker: await resolveDocker(flags),
    git: flags.git !== false,
    author,
  };
}
