import { vi, describe, it, expect, beforeEach } from "vitest";

vi.mock("child_process", () => ({
  execFileSync: vi.fn(() => "Me\n"),
}));

vi.mock("@inquirer/prompts", () => ({
  input: vi.fn(),
  select: vi.fn(),
  confirm: vi.fn(),
}));

import { input, select, confirm } from "@inquirer/prompts";
import { toPackageName, isValidPackageName } from "../src/commands/init/answers.js";
import { resolveBaseAnswers } from "../src/commands/base/answers.js";

beforeEach(() => {
  vi.mocked(input).mockReset();
  vi.mocked(select).mockReset();
  vi.mocked(confirm).mockReset();
});

describe("toPackageName", () => {
  it("lowercases and replaces spaces", () => {
    expect(toPackageName("My App")).toBe("my-app");
  });

  it("keeps underscores", () => {
    expect(toPackageName("Foo_Bar")).toBe("foo_bar");
  });

  it("trims leading and trailing dashes", () => {
    expect(toPackageName("  !cool tool! ")).toBe("cool-tool");
  });
});

describe("isValidPackageName", () => {
  it("accepts lowercase names", () => {
    expect(isValidPackageName("my-app.v2_x")).toBe(true);
  });

  it("rejects uppercase and spaces", () => {
    expect(isValidPackageName("My App")).toBe(false);
  });

  it("rejects names longer than 214 characters", () => {
    expect(isValidPackageName("a".repeat(215))).toBe(false);
  });
});

describe("resolveBaseAnswers", () => {
  it("--yes with all flags never prompts", async () => {
    const a = await resolveBaseAnswers(
      "./x",
      { yes: true, name: "x", description: "d", pm: "uv", docker: true, git: false }
    );
    expect(a).toEqual({
      name: "x",
      description: "d",
      pm: "uv",
      docker: true,
      git: false,
      author: "Me",
    });
    expect(input).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("--yes fills defaults from the folder name", async () => {
    const a = await resolveBaseAnswers(
      "/tmp/My App",
      { yes: true, description: "d" }
    );
    expect(a).toMatchObject({
      name: "my-app",
      pm: "pnpm",
      docker: false,
      git: true,
    });
  });

  it("--yes without --description throws", async () => {
    await expect(
      resolveBaseAnswers("./x", { yes: true }),
    ).rejects.toThrow("Missing --description (required with --yes)");
  });

  it("rejects --pm yarn", async () => {
    await expect(
      resolveBaseAnswers("./x", { yes: true, description: "d", pm: "yarn" }),
    ).rejects.toThrow("Invalid --pm 'yarn'. Use one of: npm, pnpm, uv");
  });

  it("rejects an invalid --name", async () => {
    await expect(
      resolveBaseAnswers("./x", { yes: true, description: "d", name: "My App" }),
    ).rejects.toThrow("Invalid --name 'My App'");
  });

  it("prompts only for values not given as flags", async () => {
    vi.mocked(input).mockResolvedValue("desc");
    vi.mocked(confirm).mockResolvedValue(true);
    const a = await resolveBaseAnswers("./x", { name: "x", pm: "npm" });
    expect(input).toHaveBeenCalledTimes(1);
    expect(select).not.toHaveBeenCalled();
    expect(a).toMatchObject({ name: "x", description: "desc", pm: "npm", docker: true });
  });
});
