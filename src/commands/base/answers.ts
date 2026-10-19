import { select, confirm } from "@inquirer/prompts";
import {
  resolveCommonAnswers,
  type CommonAnswers,
  type InitOptions,
} from "../init/answers.js";

export type PackageManager = "npm" | "pnpm" | "uv";

export const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "pnpm", "uv"];

const DEFAULT_PM: PackageManager = "pnpm";

export interface BaseAnswers extends CommonAnswers {
  pm: PackageManager;
  docker: boolean;
  git: boolean;
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

async function resolvePm(flags: InitOptions): Promise<PackageManager> {
  if (flags.yes) return DEFAULT_PM;
  return select<PackageManager>({
    message: "Package manager",
    choices: PACKAGE_MANAGERS.map((pm) => ({ name: pm, value: pm })),
    default: DEFAULT_PM,
  });
}

async function resolveDocker(flags: InitOptions): Promise<boolean> {
  if (flags.docker !== undefined) return flags.docker;
  if (flags.yes) return false;
  return confirm({ message: "Will this project run in Docker?", default: false });
}

export async function resolveBaseAnswers(
  dir: string,
  flags: InitOptions,
): Promise<BaseAnswers> {
  // Check --pm first so a typo fails before any prompt.
  const flagPm = flags.pm !== undefined ? checkPm(flags.pm) : undefined;
  const common = await resolveCommonAnswers(dir, flags);
  return {
    ...common,
    pm: flagPm ?? (await resolvePm(flags)),
    docker: await resolveDocker(flags),
    git: flags.git !== false,
  };
}
