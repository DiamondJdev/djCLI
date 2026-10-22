import { describe, it, expect, vi } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("fs", { spy: true });
import { execFileSync } from "child_process";
import { repoKey, currentRepoKey, validateTarget, readTarget, writeTarget } from "../src/commands/deploy/config.js";

const tmpHome = () => fs.mkdtempSync(path.join(os.tmpdir(), "dj-deploy-"));
const configFile = (home: string) => path.join(home, ".dj", "config.json");

describe("repoKey", () => {
  it.each([
    "git@github.com:DiamondJdev/bt-assistant.git",
    "https://github.com/DiamondJdev/bt-assistant.git",
    "https://github.com/DiamondJdev/bt-assistant",
    "ssh://git@github.com/DiamondJdev/bt-assistant.git",
  ])("normalizes %s", (url) => {
    expect(repoKey(url)).toBe("github.com/DiamondJdev/bt-assistant");
  });
});

describe("readTarget / writeTarget", () => {
  it("returns undefined with no config file", () => {
    expect(readTarget(tmpHome(), "k")).toBeUndefined();
  });

  it("round-trips a target and keeps other keys", () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".dj"));
    fs.writeFileSync(configFile(home), '{"other":1}');
    writeTarget(home, "k", { host: "nixos", command: "bt-deploy" });
    expect(readTarget(home, "k")).toEqual({ host: "nixos", command: "bt-deploy" });
    const raw = fs.readFileSync(configFile(home), "utf-8");
    expect(JSON.parse(raw).other).toBe(1);
    expect(raw.endsWith("}\n")).toBe(true);
  });

  it("creates ~/.dj when missing", () => {
    const home = tmpHome();
    writeTarget(home, "k", { host: "nixos", command: "bt-deploy" });
    expect(readTarget(home, "k")).toEqual({ host: "nixos", command: "bt-deploy" });
  });

  it("refuses a corrupt config file", () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".dj"));
    fs.writeFileSync(configFile(home), "{oops");
    expect(() => readTarget(home, "k")).toThrow(configFile(home));
    expect(() => readTarget(home, "k")).toThrow("Fix or delete it");
  });

  it("preserves the original config when a write fails partway through", async () => {
    const home = tmpHome();
    fs.mkdirSync(path.join(home, ".dj"));
    const original = '{"other":1,"deploy":{"old":{"host":"old","command":"bt-deploy"}}}\n';
    fs.writeFileSync(configFile(home), original);
    const write = (await vi.importActual<typeof fs>("fs")).writeFileSync;
    const failure = vi.spyOn(fs, "writeFileSync").mockImplementationOnce((file) => {
      write(file, "{partial");
      throw new Error("ENOSPC: no space left on device");
    });
    try {
      expect(() => writeTarget(home, "new", { host: "nixos", command: "bt-deploy" })).toThrow("ENOSPC");
      expect(fs.readFileSync(configFile(home), "utf-8")).toBe(original);
      expect(fs.readdirSync(path.join(home, ".dj"))).toEqual(["config.json"]);
    } finally {
      failure.mockRestore();
    }
  });
});

describe("validateTarget", () => {
  it.each(["-oProxyCommand=x", "a b", "a;b"])("rejects host %s", (host) => {
    expect(() => validateTarget({ host, command: "bt-deploy" })).toThrow(`Invalid host "${host}"`);
  });

  it.each(["bt-deploy; rm -rf ~", "$(x)", "-V", "-t"])("rejects command %s", (command) => {
    expect(() => validateTarget({ host: "nixos", command })).toThrow(`Invalid command "${command}"`);
  });

  it.each(["nixos", "me@nixos.tail868a2f.ts.net"])("accepts host %s", (host) => {
    const t = { host, command: "bt-deploy" };
    expect(validateTarget(t)).toBe(t);
  });
});

describe("currentRepoKey", () => {
  it("reads origin", () => {
    vi.mocked(execFileSync).mockReturnValue("git@github.com:DiamondJdev/bt-assistant.git\n");
    expect(currentRepoKey()).toBe("github.com/DiamondJdev/bt-assistant");
  });

  it("fails outside a repo with origin", () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not a git repo");
    });
    expect(() => currentRepoKey()).toThrow('dj deploy needs a git repo with an "origin" remote.');
  });
});
