import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import chalk from "chalk";
import { resolveBaseAnswers, readGitAuthor, type BaseFlags } from "./answers.js";
import { inspectTargetDir, type TargetState } from "./target-dir.js";
import {
  packageManagerSteps,
  exampleTest,
  gitignoreFor,
  pmCommands,
  type Step,
} from "./package-manager.js";
import { renderAgentsMd, CLAUDE_MD } from "./agents-md.js";

const PROJECT_DIRS = ["docs", "src", "tests"];

function fail(message: string): never {
  console.log(chalk.red(message));
  process.exit(1);
  throw new Error(message);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function inspectOrFail(dir: string): TargetState {
  try {
    return inspectTargetDir(dir);
  } catch (error) {
    return fail(messageOf(error));
  }
}

// Empties the folder instead of removing it, so `--force .` works too.
function clearDir(dir: string): void {
  if (!fs.existsSync(dir)) return;
  console.log(`Removing existing contents of: ${dir}`);
  try {
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
  } catch (error) {
    fail(`Could not clear '${dir}': ${messageOf(error)}`);
  }
}

function runStep(step: Step, cwd: string): void {
  const command = [step.cmd, ...step.args].join(" ");
  try {
    execFileSync(step.cmd, step.args, { cwd, stdio: "inherit" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      fail(`${step.cmd} is not installed or not on PATH`);
    }
    fail(
      `Command failed: ${command}\nThe project folder was left in place. Fix the problem and rerun that command inside it.`,
    );
  }
}

function writeIfMissing(file: string, content: string): void {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
}

export async function baseInitAction(dir: string, flags: BaseFlags): Promise<void> {
  // Refuse a non-empty folder before asking anything; validate before deleting anything.
  if (!flags.force) inspectOrFail(dir);

  let answers;
  try {
    answers = await resolveBaseAnswers(dir, flags, readGitAuthor());
  } catch (error) {
    return fail(messageOf(error));
  }

  if (flags.force) clearDir(dir);
  const state = inspectOrFail(dir);

  // The test-runner install needs the network, so it runs last: if it fails,
  // the project is otherwise complete and rerunning that one command finishes it.
  const steps = packageManagerSteps(answers);
  const install = steps[steps.length - 1];

  fs.mkdirSync(dir, { recursive: true });
  for (const step of steps.slice(0, -1)) runStep(step, dir);

  const test = exampleTest(answers.pm);
  fs.mkdirSync(path.join(dir, path.dirname(test.path)), { recursive: true });
  fs.writeFileSync(path.join(dir, test.path), test.content);

  for (const sub of PROJECT_DIRS) {
    const full = path.join(dir, sub);
    fs.mkdirSync(full, { recursive: true });
    if (fs.readdirSync(full).length === 0) fs.writeFileSync(path.join(full, ".gitkeep"), "");
  }

  fs.writeFileSync(path.join(dir, "AGENTS.md"), renderAgentsMd(answers));
  writeIfMissing(path.join(dir, "CLAUDE.md"), CLAUDE_MD);

  if (answers.git) {
    if (!state.hasGitignore) fs.writeFileSync(path.join(dir, ".gitignore"), gitignoreFor(answers.pm));
    if (!state.hasGit) runStep({ cmd: "git", args: ["init"] }, dir);
  }

  runStep(install, dir);

  console.log(chalk.green(`\nProject initialized successfully in ${dir}!`));
  console.log("\nNext steps:");
  console.log(`  1. cd ${dir}`);
  console.log(`  2. ${pmCommands(answers.pm).test}`);
}
