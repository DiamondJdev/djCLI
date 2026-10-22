import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("child_process", () => ({ spawnSync: vi.fn(), execFileSync: vi.fn() }));
vi.mock("@inquirer/prompts", () => ({ select: vi.fn(), input: vi.fn() }));
import { spawnSync, execFileSync } from "child_process";
import { input, select } from "@inquirer/prompts";
import { deployCommand, sshArgs } from "../src/commands/deploy/index.js";
import { writeTarget } from "../src/commands/deploy/config.js";

const KEY = "github.com/DiamondJdev/bt-assistant";
const t = { host: "nixos", command: "bt-deploy" };
const ttys = { stdin: process.stdin.isTTY, stdout: process.stdout.isTTY };
const homeBefore = process.env.HOME;
let home: string;

const setTTY = (on: boolean) => {
  process.stdin.isTTY = on;
  process.stdout.isTTY = on;
};
const run = (...args: string[]) => deployCommand.parseAsync(args, { from: "user" });

beforeEach(() => {
  home = fs.mkdtempSync(path.join(os.tmpdir(), "dj-cmd-"));
  process.env.HOME = home;
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(execFileSync).mockReset().mockReturnValue("git@github.com:DiamondJdev/bt-assistant.git\n");
  vi.mocked(spawnSync).mockReset().mockReturnValue({ status: 3 } as ReturnType<typeof spawnSync>);
  vi.mocked(input).mockReset();
  vi.mocked(select).mockReset();
  setTTY(false);
  process.exitCode = undefined;
});

afterEach(() => {
  process.env.HOME = homeBefore;
  process.stdin.isTTY = ttys.stdin;
  process.stdout.isTTY = ttys.stdout;
  process.exitCode = undefined;
});

describe("sshArgs", () => {
  it("adds -t only for now on a TTY", () => {
    expect(sshArgs(t, "now", true)).toEqual(["-t", "nixos", "bt-deploy", "now"]);
    expect(sshArgs(t, "now", false)).toEqual(["nixos", "bt-deploy", "now"]);
    expect(sshArgs(t, "status", true)).toEqual(["nixos", "bt-deploy", "status"]);
  });
});

describe("deployCommand", () => {
  it("has status, now, log and setup", () => {
    expect(deployCommand.commands.map((c) => c.name())).toEqual(["status", "now", "log", "setup"]);
  });

  it("runs the saved target and passes the exit code through", async () => {
    writeTarget(home, KEY, t);
    await run("status");
    expect(spawnSync).toHaveBeenCalledWith("ssh", ["nixos", "bt-deploy", "status"], { stdio: "inherit" });
    expect(process.exitCode).toBe(3);
  });

  it("fails without prompting when there is no target and no TTY", async () => {
    await run("status");
    expect(process.exitCode).toBe(1);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining(`No deploy target for ${KEY}.`));
    expect(input).not.toHaveBeenCalled();
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it("runs setup first on a TTY", async () => {
    setTTY(true);
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stderr: Buffer.from("") } as unknown as ReturnType<typeof spawnSync>);
    vi.mocked(input).mockResolvedValueOnce("nixos").mockResolvedValueOnce("bt-deploy");
    await run("status");
    expect(input).toHaveBeenCalledTimes(2);
    expect(spawnSync).toHaveBeenLastCalledWith("ssh", ["nixos", "bt-deploy", "status"], { stdio: "inherit" });
  });

  it("setup takes flags", async () => {
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stderr: Buffer.from("") } as unknown as ReturnType<typeof spawnSync>);
    await run("setup", "--host", "nixos", "--command", "bt-deploy");
    expect(JSON.parse(fs.readFileSync(path.join(home, ".dj", "config.json"), "utf-8")).deploy[KEY]).toEqual(t);
    expect(process.exitCode).toBeUndefined();
  });

  it("bare deploy without a TTY prints help and does not prompt", async () => {
    const help = vi.spyOn(deployCommand, "outputHelp").mockImplementation(() => {});
    await run();
    expect(help).toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it("bare deploy on a TTY runs the picked command", async () => {
    setTTY(true);
    writeTarget(home, KEY, t);
    vi.mocked(select).mockResolvedValueOnce("log");
    await run();
    expect(input).not.toHaveBeenCalled();
    expect(spawnSync).toHaveBeenCalledWith("ssh", ["nixos", "bt-deploy", "log"], { stdio: "inherit" });
  });

  it("bare deploy on a TTY with no target runs setup, then the menu", async () => {
    setTTY(true);
    vi.mocked(spawnSync).mockReturnValueOnce({ status: 0, stderr: Buffer.from("") } as unknown as ReturnType<typeof spawnSync>);
    vi.mocked(input).mockResolvedValueOnce("nixos").mockResolvedValueOnce("bt-deploy");
    vi.mocked(select).mockResolvedValueOnce("status");
    await run();
    expect(input).toHaveBeenCalledTimes(2);
    expect(select).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenLastCalledWith("ssh", ["nixos", "bt-deploy", "status"], { stdio: "inherit" });
  });

  it("Ctrl+C in the menu exits quietly", async () => {
    setTTY(true);
    writeTarget(home, KEY, t);
    vi.mocked(select).mockRejectedValueOnce(Object.assign(new Error("closed"), { name: "ExitPromptError" }));
    await run();
    expect(console.error).not.toHaveBeenCalled();
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
