import { describe, it, expect, vi, afterEach } from "vitest";
import { compareVersions, fetchLatestVersion } from "../src/utils/version.js";

afterEach(() => vi.unstubAllGlobals());

describe("compareVersions", () => {
  it("orders numerically, not lexically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.1")).toBeLessThan(0);
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
  });
});

describe("fetchLatestVersion", () => {
  it("reads version from the registry response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "1.5.0" }) }));
    await expect(fetchLatestVersion()).resolves.toBe("1.5.0");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(fetchLatestVersion()).rejects.toThrow("404");
  });
});
