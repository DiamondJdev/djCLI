import { describe, it, expect, vi } from "vitest";
import { detectManager, upgrade, type UpgradeDeps } from "../src/commands/upgrade.js";

const make = (over: Partial<UpgradeDeps> = {}): UpgradeDeps => ({
  currentVersion: "1.2.0",
  fetchLatest: async () => "1.3.0",
  isInstalled: (m) => m === "npm",
  confirm: vi.fn().mockResolvedValue(true),
  install: vi.fn().mockResolvedValue(undefined),
  log: vi.fn(),
  ...over,
});

describe("detectManager", () => {
  it("prefers npm, then pnpm, else null", () => {
    expect(detectManager(() => true)).toBe("npm");
    expect(detectManager((m) => m === "pnpm")).toBe("pnpm");
    expect(detectManager(() => false)).toBeNull();
  });
});

describe("upgrade", () => {
  it("installs with the detected manager after confirming", async () => {
    const d = make({ isInstalled: (m) => m === "pnpm" });
    expect(await upgrade(d, {})).toBe("upgraded");
    expect(d.install).toHaveBeenCalledWith("pnpm");
  });

  it("does nothing when already current", async () => {
    const d = make({ fetchLatest: async () => "1.2.0" });
    expect(await upgrade(d, {})).toBe("up-to-date");
    expect(d.install).not.toHaveBeenCalled();
  });

  it("--check reports without prompting or installing", async () => {
    const d = make();
    expect(await upgrade(d, { check: true })).toBe("available");
    expect(d.confirm).not.toHaveBeenCalled();
    expect(d.install).not.toHaveBeenCalled();
  });

  it("-y skips the prompt", async () => {
    const d = make();
    expect(await upgrade(d, { yes: true })).toBe("upgraded");
    expect(d.confirm).not.toHaveBeenCalled();
  });

  it("does not install when the user declines", async () => {
    const d = make({ confirm: vi.fn().mockResolvedValue(false) });
    expect(await upgrade(d, {})).toBe("declined");
    expect(d.install).not.toHaveBeenCalled();
  });

  it("reports not-installed when neither manager has it", async () => {
    const d = make({ isInstalled: () => false });
    expect(await upgrade(d, {})).toBe("not-installed");
    expect(d.install).not.toHaveBeenCalled();
  });

  it("propagates registry errors", async () => {
    const d = make({ fetchLatest: async () => { throw new Error("offline"); } });
    await expect(upgrade(d, {})).rejects.toThrow("offline");
  });
});
