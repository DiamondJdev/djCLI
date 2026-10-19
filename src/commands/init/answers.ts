import * as path from "path";
import { execFileSync } from "child_process";
import { input } from "@inquirer/prompts";

const FALLBACK_AUTHOR = "DiamondJdev";
const MAX_NAME_LENGTH = 214;

export interface InitOptions {
  force?: boolean;
  name?: string;
  description?: string;
  yes?: boolean;
  // base only
  pm?: string;
  docker?: boolean;
  git?: boolean;
}

/** Asked for by every template. */
export interface CommonAnswers {
  name: string;
  description: string;
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

const NAME_HINT = "Use lowercase letters, digits, '.', '_' or '-'";

function checkName(name: string): string {
  if (!isValidPackageName(name)) {
    throw new Error(`Invalid --name '${name}'. ${NAME_HINT}`);
  }
  return name;
}

async function resolveName(dir: string, flags: InitOptions): Promise<string> {
  if (flags.name !== undefined) return checkName(flags.name);
  const fallback = toPackageName(path.basename(path.resolve(dir)));
  if (flags.yes) return checkName(fallback);
  const answer = await input({
    message: "Project name",
    default: fallback,
    validate: (v) => isValidPackageName(v) || NAME_HINT,
  });
  return checkName(answer);
}

async function resolveDescription(flags: InitOptions): Promise<string> {
  if (flags.description?.trim()) return flags.description.trim();
  if (flags.yes) throw new Error("Missing --description (required with --yes)");
  const answer = await input({
    message: "One-line description",
    validate: (v) => v.trim().length > 0 || "A description is required",
  });
  return answer.trim();
}

export async function resolveCommonAnswers(
  dir: string,
  flags: InitOptions,
): Promise<CommonAnswers> {
  const name = await resolveName(dir, flags);
  const description = await resolveDescription(flags);
  return { name, description, author: readGitAuthor() };
}
