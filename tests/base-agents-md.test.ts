import { describe, it, expect } from "vitest";
import {
  renderAgentsMd,
  DOCKER_TODO,
  CLAUDE_MD,
} from "../src/commands/base/agents-md.js";
import type { BaseAnswers } from "../src/commands/base/answers.js";

const a: BaseAnswers = {
  name: "demo",
  description: "A demo project",
  pm: "pnpm",
  docker: false,
  git: true,
  author: "Me",
};

describe("renderAgentsMd", () => {
  it("has the Docker TODO only with docker", () => {
    expect(renderAgentsMd(a)).not.toContain(DOCKER_TODO);
    expect(renderAgentsMd({ ...a, docker: true })).toContain(DOCKER_TODO);
  });

  it("lists the real test command and every section", () => {
    const md = renderAgentsMd({ ...a, pm: "uv" });
    expect(md).toContain("uv run pytest");
    for (const h of [
      "## Commands",
      "## Boundaries",
      "## Execution loop",
      "## Architecture",
      "## Environment variables",
      "## Learned facts",
    ]) {
      expect(md).toContain(h);
    }
  });

  it("starts with the project name and description", () => {
    const md = renderAgentsMd(a);
    expect(md.startsWith("# demo\n")).toBe(true);
    expect(md).toContain("A demo project");
    expect(md).toContain("TypeScript");
  });
});

describe("constants", () => {
  it("uses the exact Docker line", () => {
    expect(DOCKER_TODO).toBe(
      "TODO: This project will run in Docker; add a Dockerfile before shipping",
    );
  });

  it("CLAUDE.md only imports AGENTS.md", () => {
    expect(CLAUDE_MD).toBe("@AGENTS.md\n");
  });
});
