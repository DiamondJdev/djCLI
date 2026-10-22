import { spawnSync } from "child_process";
import * as os from "os";
import { Command } from "commander";
import { select } from "@inquirer/prompts";
import chalk from "chalk";
import { type DeployTarget, currentRepoKey, readTarget } from "./config.js";
import { setupTarget } from "./setup.js";

type Sub = "status" | "now" | "log";

export function sshArgs(t: DeployTarget, sub: Sub, tty: boolean): string[] {
  const args = [t.host, t.command, sub];
  if (!tty) return ["-T", "-o", "BatchMode=yes", ...args];
  return sub === "now" ? ["-t", ...args] : args;
}

const interactive = (): boolean => Boolean(process.stdin.isTTY && process.stdout.isTTY);

async function guarded(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    if ((err as Error).name === "ExitPromptError") return; // Ctrl+C in a prompt
    console.error(chalk.red(`Error: ${(err as Error).message}`));
    process.exitCode = 1;
  }
}

const loadTarget = (): Promise<DeployTarget> => {
  const home = os.homedir();
  const key = currentRepoKey();
  const saved = readTarget(home, key);
  return saved ? Promise.resolve(saved) : setupTarget({ interactive: interactive(), home, key });
};

function runSub(target: DeployTarget, sub: Sub): void {
  const r = spawnSync("ssh", sshArgs(target, sub, interactive()), { stdio: "inherit" });
  if (r.error) throw r.error;
  process.exitCode = r.status ?? 1;
}

const passThrough = (sub: Sub) => () => guarded(async () => runSub(await loadTarget(), sub));

const menuAction = () =>
  guarded(async () => {
    if (!interactive()) return deployCommand.outputHelp();
    const target = await loadTarget();
    const choice = await select<Sub | "setup">({
      message: `Deploy on ${target.host}`,
      choices: deployCommand.commands.map((c) => ({ value: c.name() as Sub | "setup", description: c.description() })),
    });
    if (choice === "setup") return setupAction({});
    runSub(target, choice);
  });

const setupAction = (opts: { host?: string; command?: string }) =>
  guarded(async () => {
    await setupTarget({ ...opts, interactive: interactive(), home: os.homedir(), key: currentRepoKey() });
  });

export const deployCommand = new Command("deploy")
  .description("Check or run this repo's deploy on its server over SSH")
  .allowExcessArguments(false)
  .action(menuAction);

deployCommand.command("status").description("Show what the server runs and is testing").action(passThrough("status"));
deployCommand.command("now").description("Deploy the latest main now").action(passThrough("now"));
deployCommand.command("log").description("Show the server's recent deploy log").action(passThrough("log"));
deployCommand
  .command("setup")
  .description("Choose the SSH host and remote command for this repo")
  .option("--host <ssh-host>", "SSH host to deploy on")
  .option("--command <remote-command>", "deploy command on the server (default: bt-deploy)")
  .action(setupAction);
