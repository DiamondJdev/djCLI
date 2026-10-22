import { describe, it, expect } from "vitest";
import * as fs from "fs";
import { initCommand } from "../src/commands/init.js";
import { deployCommand } from "../src/commands/deploy/index.js";

describe("dj-init skill files", () => {
  it("SKILL.md has Agent Skills frontmatter", () => {
    const md = fs.readFileSync("skills/dj-init/SKILL.md", "utf-8");
    expect(md).toMatch(/^---\nname: dj-init\ndescription: .+\n---\n/);
  });

  it("references/flags.md documents exactly the flags dj init defines", () => {
    const doc = fs.readFileSync("skills/dj-init/references/flags.md", "utf-8");
    const documented = new Set(
      [...doc.matchAll(/^\| `(--[a-z-]+)/gm)].map((m) => m[1]),
    );
    const defined = new Set(initCommand.options.map((o) => o.long));
    expect(documented).toEqual(defined);
  });

  it("the package ships the skills folder", () => {
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf-8"));
    expect(pkg.files).toContain("skills");
  });
});

describe("dj-deploy skill file", () => {
  const md = () => fs.readFileSync("skills/dj-deploy/SKILL.md", "utf-8");

  it("SKILL.md has Agent Skills frontmatter", () => {
    expect(md()).toMatch(/^---\nname: dj-deploy\ndescription: .+\n---\n/);
  });

  it("names every dj deploy subcommand", () => {
    for (const c of deployCommand.commands) expect(md()).toContain(`\`dj deploy ${c.name()}\``);
  });

  it("names every setup option", () => {
    const setup = deployCommand.commands.find((c) => c.name() === "setup")!;
    for (const o of setup.options) expect(md()).toContain(o.long!);
  });
});
