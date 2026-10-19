import { describe, it, expect } from "vitest";
import {
  packageManagerSteps,
  pmCommands,
  exampleTest,
  gitignoreFor,
} from "../src/commands/base/package-manager.js";
import type { BaseAnswers } from "../src/commands/base/answers.js";

const a: BaseAnswers = {
  name: "demo",
  description: `Say "hi" & bye`,
  pm: "pnpm",
  docker: false,
  git: true,
  author: "Me",
};

describe("packageManagerSteps", () => {
  it("passes the description through as one argument", () => {
    expect(packageManagerSteps(a)[1].args).toContain(`description=Say "hi" & bye`);
  });

  it("pnpm sets name, author, license and the test script", () => {
    expect(packageManagerSteps(a)).toEqual([
      { cmd: "pnpm", args: ["init", "--init-type", "module"] },
      {
        cmd: "pnpm",
        args: [
          "pkg",
          "set",
          "name=demo",
          `description=Say "hi" & bye`,
          "author=Me",
          "license=MIT",
          "scripts.test=vitest run",
        ],
      },
      { cmd: "pnpm", args: ["add", "-D", "vitest"] },
    ]);
  });

  it("npm passes author and license to init", () => {
    expect(packageManagerSteps({ ...a, pm: "npm" })[0]).toEqual({
      cmd: "npm",
      args: ["init", "-y", "--init-type", "module", "--init-author-name", "Me", "--init-license", "MIT"],
    });
  });

  it("uv uses --lib and --vcs none", () => {
    expect(packageManagerSteps({ ...a, pm: "uv" })[0]).toEqual({
      cmd: "uv",
      args: ["init", "--lib", "--vcs", "none", "--name", "demo", "--description", `Say "hi" & bye`, "--author-from", "git", "."],
    });
  });

  it("every package manager installs a test runner as its last step", () => {
    expect(packageManagerSteps(a).at(-1)).toEqual({ cmd: "pnpm", args: ["add", "-D", "vitest"] });
    expect(packageManagerSteps({ ...a, pm: "npm" }).at(-1)).toEqual({ cmd: "npm", args: ["install", "-D", "vitest"] });
    expect(packageManagerSteps({ ...a, pm: "uv" }).at(-1)).toEqual({ cmd: "uv", args: ["add", "--dev", "pytest"] });
  });
});

describe("pmCommands", () => {
  it("returns the uv commands", () => {
    expect(pmCommands("uv")).toEqual({
      install: "uv sync",
      test: "uv run pytest",
      singleTest: "uv run pytest tests/test_example.py",
    });
  });

  it("returns the npm commands", () => {
    expect(pmCommands("npm").singleTest).toBe("npx vitest run tests/example.test.ts");
  });
});

describe("exampleTest", () => {
  it("is a vitest file for pnpm", () => {
    const t = exampleTest("pnpm");
    expect(t.path).toBe("tests/example.test.ts");
    expect(t.content).toContain('from "vitest"');
  });

  it("is a pytest file for uv", () => {
    const t = exampleTest("uv");
    expect(t.path).toBe("tests/test_example.py");
    expect(t.content).toContain("def test_example():");
  });
});

describe("gitignoreFor", () => {
  it("ignores node_modules for node package managers", () => {
    expect(gitignoreFor("npm")).toContain("node_modules/");
  });

  it("ignores .venv for uv", () => {
    expect(gitignoreFor("uv")).toContain(".venv/");
  });
});
