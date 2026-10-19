import { execFileSync, spawn } from "child_process";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import packageJson from "../../package.json" with { type: "json" };
import { PACKAGE_NAME, compareVersions, fetchLatestVersion } from "../utils/version.js";

export type Manager = "npm" | "pnpm";
export type UpgradeResult = "not-installed" | "up-to-date" | "available" | "declined" | "upgraded";

export interface UpgradeDeps {
  currentVersion: string;
  fetchLatest: () => Promise<string>;
  isInstalled: (manager: Manager) => boolean;
  confirm: (message: string) => Promise<boolean>;
  install: (manager: Manager) => Promise<void>;
  log: (message: string) => void;
}

export interface UpgradeOptions {
  check?: boolean;
  yes?: boolean;
}

const MANAGERS: readonly Manager[] = ["npm", "pnpm"];

export function detectManager(isInstalled: (m: Manager) => boolean): Manager | null {
  return MANAGERS.find(isInstalled) ?? null;
}

export async function upgrade(d: UpgradeDeps, opts: UpgradeOptions): Promise<UpgradeResult> {
  const manager = detectManager(d.isInstalled);
  if (!manager) {
    d.log(`${PACKAGE_NAME} isn't globally installed via npm or pnpm, nothing to upgrade`);
    return "not-installed";
  }

  const latest = await d.fetchLatest();
  if (compareVersions(d.currentVersion, latest) >= 0) {
    d.log(`dj is up to date (${d.currentVersion})`);
    return "up-to-date";
  }

  d.log(`${d.currentVersion} → ${latest} (installed with ${manager})`);
  if (opts.check) return "available";
  if (!opts.yes && !(await d.confirm(`Upgrade to ${latest}?`))) return "declined";

  await d.install(manager);
  d.log(`Upgraded to ${latest}`);
  return "upgraded";
}

function installedVia(manager: Manager): boolean {
  const args = manager === "npm" ? ["ls", "-g", PACKAGE_NAME, "--depth=0"] : ["ls", "-g", PACKAGE_NAME];
  try {
    const out = execFileSync(manager, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return out.includes(PACKAGE_NAME);
  } catch {
    return false;
  }
}

function installLatest(manager: Manager): Promise<void> {
  const args = manager === "npm" ? ["install", "-g"] : ["add", "-g"];
  return new Promise((resolve, reject) => {
    const child = spawn(manager, [...args, `${PACKAGE_NAME}@latest`], { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`${manager} exited with code ${code}`)),
    );
  });
}

async function upgradeAction(opts: UpgradeOptions): Promise<void> {
  try {
    const result = await upgrade(
      {
        currentVersion: packageJson.version,
        fetchLatest: () => fetchLatestVersion(),
        isInstalled: installedVia,
        confirm: (message) => confirm({ message }),
        install: installLatest,
        log: (m) => console.log(m),
      },
      opts,
    );
    if (result === "not-installed") process.exitCode = 1;
  } catch (err) {
    console.error(chalk.red(`Upgrade failed: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const upgradeCommand = new Command("upgrade")
  .description("Update dj to the latest version")
  .option("--check", "only report whether an update is available")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(upgradeAction);
