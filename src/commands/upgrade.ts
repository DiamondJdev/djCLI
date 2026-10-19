import { execFileSync } from "child_process";
import { Command } from "commander";
import { confirm } from "@inquirer/prompts";
import chalk from "chalk";
import packageJson from "../../package.json" with { type: "json" };
import { PACKAGE_NAME, compareVersions, fetchLatestVersion } from "../utils/version.js";

type Manager = "npm" | "pnpm";

function installedVia(manager: Manager): boolean {
  try {
    const out = execFileSync(manager, ["ls", "-g", PACKAGE_NAME], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] });
    return out.includes(PACKAGE_NAME);
  } catch {
    return false;
  }
}

export async function upgradeAction(opts: { yes?: boolean }): Promise<void> {
  try {
    const manager = (["npm", "pnpm"] as const).find(installedVia);
    if (!manager) {
      console.log(`${PACKAGE_NAME} isn't globally installed via npm or pnpm, nothing to upgrade`);
      process.exitCode = 1;
      return;
    }

    const current = packageJson.version;
    const latest = await fetchLatestVersion();
    if (compareVersions(current, latest) >= 0) {
      console.log(`dj is up to date (${current})`);
      return;
    }

    console.log(`${current} → ${latest} (installed with ${manager})`);
    if (!opts.yes && !(await confirm({ message: `Upgrade to ${latest}?` }))) return;

    execFileSync(manager, [manager === "npm" ? "install" : "add", "-g", `${PACKAGE_NAME}@latest`], { stdio: "inherit" });
    console.log(`Upgraded to ${latest}`);
  } catch (err) {
    console.error(chalk.red(`Upgrade failed: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

export const upgradeCommand = new Command("upgrade")
  .description("Update dj to the latest version")
  .option("-y, --yes", "skip the confirmation prompt")
  .action(upgradeAction);
