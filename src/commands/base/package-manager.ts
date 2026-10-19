import type { BaseAnswers, PackageManager } from "./answers.js";

export interface Step {
  cmd: string;
  args: string[];
}

export interface PmCommands {
  install: string;
  test: string;
  singleTest: string;
}

const LICENSE = "MIT";
const VITEST_SCRIPT = "scripts.test=vitest run";

export function packageManagerSteps(a: BaseAnswers): Step[] {
  switch (a.pm) {
    case "pnpm":
      return [
        { cmd: "pnpm", args: ["init", "--init-type", "module"] },
        {
          cmd: "pnpm",
          args: [
            "pkg",
            "set",
            `name=${a.name}`,
            `description=${a.description}`,
            `author=${a.author}`,
            `license=${LICENSE}`,
            VITEST_SCRIPT,
          ],
        },
        { cmd: "pnpm", args: ["add", "-D", "vitest"] },
      ];
    case "npm":
      return [
        {
          cmd: "npm",
          args: ["init", "-y", "--init-type", "module", "--init-author-name", a.author, "--init-license", LICENSE],
        },
        {
          cmd: "npm",
          args: ["pkg", "set", `name=${a.name}`, `description=${a.description}`, VITEST_SCRIPT],
        },
        { cmd: "npm", args: ["install", "-D", "vitest"] },
      ];
    case "uv":
      // uv init has no explicit author flag; it reads git config only.
      return [
        {
          cmd: "uv",
          args: ["init", "--lib", "--vcs", "none", "--name", a.name, "--description", a.description, "--author-from", "git", "."],
        },
        { cmd: "uv", args: ["add", "--dev", "pytest"] },
      ];
  }
}

export function pmCommands(pm: PackageManager): PmCommands {
  switch (pm) {
    case "pnpm":
      return {
        install: "pnpm install",
        test: "pnpm test",
        singleTest: "pnpm vitest run tests/example.test.ts",
      };
    case "npm":
      return {
        install: "npm install",
        test: "npm test",
        singleTest: "npx vitest run tests/example.test.ts",
      };
    case "uv":
      return {
        install: "uv sync",
        test: "uv run pytest",
        singleTest: "uv run pytest tests/test_example.py",
      };
  }
}

export function exampleTest(pm: PackageManager): { path: string; content: string } {
  if (pm === "uv") {
    return {
      path: "tests/test_example.py",
      content: "def test_example():\n    assert 1 + 1 == 2\n",
    };
  }
  return {
    path: "tests/example.test.ts",
    content: `import { expect, test } from "vitest";\n\ntest("example", () => {\n  expect(1 + 1).toBe(2);\n});\n`,
  };
}

export function gitignoreFor(pm: PackageManager): string {
  const lines =
    pm === "uv"
      ? [".venv/", "__pycache__/", "*.pyc", ".pytest_cache/", "dist/", ".env", ".DS_Store"]
      : ["node_modules/", "dist/", "coverage/", ".env", ".DS_Store"];
  return lines.join("\n") + "\n";
}
