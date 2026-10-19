import * as fs from "fs";
import * as path from "path";
import { execFileSync } from "child_process";
import type { Template } from "../init/template.js";
import { resolveBaseAnswers, type BaseAnswers } from "./answers.js";
import {
  packageManagerSteps,
  exampleTest,
  gitignoreFor,
  pmCommands,
  type Step,
} from "./package-manager.js";
import { renderAgentsMd, CLAUDE_MD } from "./agents-md.js";

const PROJECT_DIRS = ["docs", "src", "tests"];

function runStep(step: Step, cwd: string): void {
  try {
    execFileSync(step.cmd, step.args, { cwd, stdio: "inherit" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${step.cmd} is not installed or not on PATH`);
    }
    throw new Error(
      `Command failed: ${[step.cmd, ...step.args].join(" ")}\nThe project folder was left in place. Fix the problem and rerun that command inside it.`,
    );
  }
}

function writeIfMissing(file: string, content: string): void {
  if (!fs.existsSync(file)) fs.writeFileSync(file, content);
}

function generate(dir: string, a: BaseAnswers): void {
  // The test-runner install needs the network, so it runs last: if it fails,
  // the project is otherwise complete and rerunning that one command finishes it.
  const steps = packageManagerSteps(a);
  const install = steps[steps.length - 1];
  for (const step of steps.slice(0, -1)) runStep(step, dir);

  const test = exampleTest(a.pm);
  fs.mkdirSync(path.join(dir, path.dirname(test.path)), { recursive: true });
  fs.writeFileSync(path.join(dir, test.path), test.content);

  for (const sub of PROJECT_DIRS) {
    const full = path.join(dir, sub);
    fs.mkdirSync(full, { recursive: true });
    if (fs.readdirSync(full).length === 0) fs.writeFileSync(path.join(full, ".gitkeep"), "");
  }

  fs.writeFileSync(path.join(dir, "AGENTS.md"), renderAgentsMd(a));
  writeIfMissing(path.join(dir, "CLAUDE.md"), CLAUDE_MD);

  if (a.git) {
    writeIfMissing(path.join(dir, ".gitignore"), gitignoreFor(a.pm));
    if (!fs.existsSync(path.join(dir, ".git"))) runStep({ cmd: "git", args: ["init"] }, dir);
  }

  runStep(install, dir);
}

export const baseTemplate: Template = {
  description:
    "Empty project: AGENTS.md, docs/, src/, tests/ and a test runner (npm, pnpm or uv)",
  async prepare(dir, flags) {
    const answers = await resolveBaseAnswers(dir, flags);
    return {
      populate: (target) => generate(target, answers),
      nextSteps: [pmCommands(answers.pm).test],
    };
  },
};
