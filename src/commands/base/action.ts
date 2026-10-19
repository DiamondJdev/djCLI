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

function prepareTarget(dir: string, force: boolean | undefined): TargetState {
  if (force && fs.existsSync(dir)) {
    console.log(`Removing existing directory: ${dir}`);
    fs.rmSync(dir, { recursive: true });
  }
  try {
    return inspectTargetDir(dir);
  } catch (error) {
    return fail(messageOf(error));
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
  const state = prepareTarget(dir, flags.force);

  let answers;
  try {
    answers = await resolveBaseAnswers(dir, flags, readGitAuthor());
  } catch (error) {
    return fail(messageOf(error));
  }

  fs.mkdirSync(dir, { recursive: true });
  for (const step of packageManagerSteps(answers)) runStep(step, dir);

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

  console.log(chalk.green(`\nProject initialized successfully in ${dir}!`));
  console.log("\nNext steps:");
  console.log(`  1. cd ${dir}`);
  console.log(`  2. ${pmCommands(answers.pm).test}`);
}
