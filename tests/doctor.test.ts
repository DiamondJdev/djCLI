import { describe, it, expect } from "vitest";
import { runChecks, exitCode, type DoctorDeps } from "../src/commands/doctor.js";

const base: DoctorDeps = {
  nodeVersion: "v22.1.0",
  minNode: "18.0.0",
  djVersion: "1.2.0",
  fetchLatest: async () => "1.2.0",
  run: (cmd) => (cmd === "git" ? "git version 2.45.0" : "9.0.0"),
  gitConfig: (key) => (key === "user.name" ? "DJ" : "dj@example.com"),
  djOnPath: "/usr/local/bin/dj",
  runningDj: "/usr/local/bin/dj",
  skillInstalled: true,
};

const find = async (deps: Partial<DoctorDeps>, name: string) =>
  (await runChecks({ ...base, ...deps })).find((c) => c.name === name)!;

describe("runChecks", () => {
  it("passes everything on a healthy machine", async () => {
    const checks = await runChecks(base);
    expect(checks.every((c) => c.status === "ok")).toBe(true);
    expect(exitCode(checks)).toBe(0);
  });

  it("fails when node is older than engines", async () => {
    expect((await find({ nodeVersion: "v16.0.0" }, "Node")).status).toBe("fail");
  });

  it("warns when dj is behind npm, pointing at dj upgrade", async () => {
    const c = await find({ fetchLatest: async () => "1.3.0" }, "dj version");
    expect(c.status).toBe("warn");
    expect(c.fix).toContain("dj upgrade");
  });

  it("warns, not fails, when the registry is unreachable", async () => {
    const c = await find({ fetchLatest: async () => { throw new Error("offline"); } }, "dj version");
    expect(c.status).toBe("warn");
  });

  it("warns when dj on PATH is a different install", async () => {
    expect((await find({ djOnPath: "/opt/old/dj" }, "dj on PATH")).status).toBe("warn");
    expect((await find({ djOnPath: null }, "dj on PATH")).status).toBe("warn");
  });

  it("fails without npm but only warns without pnpm or uv", async () => {
    const noTool = (missing: string) => (cmd: string) => (cmd === missing ? null : "1.0.0");
    expect((await find({ run: noTool("npm") }, "npm")).status).toBe("fail");
    expect((await find({ run: noTool("pnpm") }, "pnpm")).status).toBe("warn");
    expect((await find({ run: noTool("uv") }, "uv")).status).toBe("warn");
  });

  it("fails without git, warns when user.name or user.email is unset", async () => {
    expect((await find({ run: (c) => (c === "git" ? null : "1") }, "git")).status).toBe("fail");
    const c = await find({ gitConfig: () => null }, "git identity");
    expect(c.status).toBe("warn");
    expect(exitCode([c])).toBe(0);
  });

  it("warns when the dj-init skill is missing", async () => {
    expect((await find({ skillInstalled: false }, "dj-init skill")).status).toBe("warn");
  });

  it("exits 1 only when a check fails", async () => {
    expect(exitCode(await runChecks({ ...base, nodeVersion: "v16.0.0" }))).toBe(1);
  });
});
