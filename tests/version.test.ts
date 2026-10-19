import { describe, it, expect, vi } from "vitest";
import { compareVersions, fetchLatestVersion } from "../src/utils/version.js";

describe("compareVersions", () => {
  it("orders numerically, not lexically", () => {
    expect(compareVersions("1.10.0", "1.9.0")).toBeGreaterThan(0);
    expect(compareVersions("1.2.0", "1.2.1")).toBeLessThan(0);
    expect(compareVersions("1.2.0", "1.2.0")).toBe(0);
  });

  it("ignores a leading v and prerelease suffix", () => {
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.3.0-beta.1", "1.2.0")).toBeGreaterThan(0);
  });
});

describe("fetchLatestVersion", () => {
  it("reads version from the registry response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "1.4.0" }),
    });
    await expect(fetchLatestVersion(fetchFn)).resolves.toBe("1.4.0");
    expect(fetchFn.mock.calls[0][0]).toBe("https://registry.npmjs.org/djmond/latest");
  });

  it("throws on a non-ok response", async () => {
    const fetchFn = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    await expect(fetchLatestVersion(fetchFn)).rejects.toThrow("404");
  });

  it("throws when the request fails", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new Error("offline"));
    await expect(fetchLatestVersion(fetchFn)).rejects.toThrow("offline");
  });
});
