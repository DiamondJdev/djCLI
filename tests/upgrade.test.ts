import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
vi.mock("@inquirer/prompts", () => ({ confirm: vi.fn() }));
import { execFileSync } from "child_process";
import { confirm } from "@inquirer/prompts";
import { upgradeAction } from "../src/commands/upgrade.js";

const latest = (version: string) =>
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version }) }));
const installs = () => vi.mocked(execFileSync).mock.calls.filter(([, args]) => args?.includes("-g") && !args.includes("ls"));

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(execFileSync).mockReturnValue("djmond@1.0.0");
  vi.mocked(confirm).mockResolvedValue(true);
  process.exitCode = undefined;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  process.exitCode = undefined;
});

describe("upgradeAction", () => {
  it("installs after confirming", async () => {
    latest("999.0.0");
    await upgradeAction({});
    expect(confirm).toHaveBeenCalled();
    expect(installs()).toHaveLength(1);
  });

  it("-y skips the prompt", async () => {
    latest("999.0.0");
    await upgradeAction({ yes: true });
    expect(confirm).not.toHaveBeenCalled();
    expect(installs()).toHaveLength(1);
  });

  it("does nothing when already current", async () => {
    latest("0.0.1");
    await upgradeAction({});
    expect(installs()).toHaveLength(0);
  });

  it("does not install when the user declines", async () => {
    latest("999.0.0");
    vi.mocked(confirm).mockResolvedValue(false);
    await upgradeAction({});
    expect(installs()).toHaveLength(0);
  });

  it("exits 1 when neither manager has it", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("missing");
    });
    await upgradeAction({});
    expect(process.exitCode).toBe(1);
  });
});
