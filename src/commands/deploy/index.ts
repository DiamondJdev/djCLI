import { spawnSync } from "child_process";
import * as os from "os";
import { Command } from "commander";
import chalk from "chalk";
import { type DeployTarget, currentRepoKey, readTarget } from "./config.js";
import { setupTarget } from "./setup.js";

type Sub = "status" | "now" | "log";

export function sshArgs(t: DeployTarget, sub: Sub, tty: boolean): string[] {
  const args = [t.host, t.command, sub];
  return sub === "now" && tty ? ["-t", ...args] : args;
}

const interactive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

const passThrough = (sub: Sub) => () =>
  guarded(async () => {
    const home = os.homedir();
    const key = currentRepoKey();
    const target = readTarget(home, key) ?? (await setupTarget({ interactive: interactive(), home, key }));
    const r = spawnSync("ssh", sshArgs(target, sub, Boolean(process.stdout.isTTY)), { stdio: "inherit" });
    if (r.error) throw r.error;
    process.exitCode = r.status ?? 1;
  });

const setupAction = (opts: { host?: string; command?: string }) =>
  guarded(async () => {
    await setupTarget({ ...opts, interactive: interactive(), home: os.homedir(), key: currentRepoKey() });
  });

export const deployCommand = new Command("deploy").description("Check or run this repo's deploy on its server over SSH");

deployCommand.command("status").description("Show what the server runs and is testing").action(passThrough("status"));
deployCommand.command("now").description("Deploy the latest main now").action(passThrough("now"));
deployCommand.command("log").description("Show the server's recent deploy log").action(passThrough("log"));
deployCommand
  .command("setup")
  .description("Choose the SSH host and remote command for this repo")
  .option("--host <ssh-host>", "SSH host to deploy on")
  .option("--command <remote-command>", "deploy command on the server (default: bt-deploy)")
  .action(setupAction);
