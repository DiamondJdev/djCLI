import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { execFileSync } from "child_process";
import { resolveCommonAnswers, type CommonAnswers, type InitOptions } from "./answers.js";

/** What a template will do, decided after all questions are answered. */
export interface Plan {
  /** Fills `dir`, which exists and holds at most ALLOWED_EXISTING files. */
  populate(dir: string): void | Promise<void>;
  /** Printed after `cd <dir>`. */
  nextSteps: string[];
}

export interface Template {
  description: string;
  /** Asks the questions and throws on bad input. Writes nothing. */
  prepare(dir: string, flags: InitOptions): Promise<Plan>;
}

export function substituteVariables(dir: string, values: Record<string, string>): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      substituteVariables(full, values);
    } else if (entry.isFile()) {
      const text = fs.readFileSync(full, "utf-8");
      if (text.includes("\0")) continue; // binary
      let out = text;
      for (const [placeholder, value] of Object.entries(values)) {
        out = out.replaceAll(placeholder, () => value);
      }
      if (out !== text) fs.writeFileSync(full, out);
    }
  }
}

function cloneInto(dir: string, gitUrl: string, a: CommonAnswers): void {
  // Clone aside, then copy in, so a failed clone never touches `dir`
  // and files already there (README.md, .gitignore) win.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dj-"));
  try {
    console.log(`Cloning template from ${gitUrl}...`);
    try {
      execFileSync("git", ["clone", "--depth", "1", gitUrl, tmp], { stdio: "inherit" });
    } catch {
      throw new Error("Failed to clone template");
    }
    fs.rmSync(path.join(tmp, ".git"), { recursive: true, force: true });
    substituteVariables(tmp, {
      "{{PROJECT_NAME}}": a.name,
      "{{AUTHOR}}": a.author,
      "{{DESCRIPTION}}": a.description,
    });
    fs.cpSync(tmp, dir, { recursive: true, force: false });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/** A template that is a git repo with {{PROJECT_NAME}}, {{AUTHOR}}, {{DESCRIPTION}} placeholders. */
export function cloned(description: string, gitUrl: string, nextSteps: string[]): Template {
  return {
    description,
    async prepare(dir, flags) {
      if (flags.pm !== undefined || flags.docker !== undefined || flags.git === false) {
        throw new Error("--pm, --docker and --no-git only work with the base template");
      }
      const answers = await resolveCommonAnswers(dir, flags);
      return { populate: (target) => cloneInto(target, gitUrl, answers), nextSteps };
    },
  };
}
