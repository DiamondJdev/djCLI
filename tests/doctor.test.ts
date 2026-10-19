import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("child_process", () => ({ execFileSync: vi.fn() }));
import { execFileSync } from "child_process";
import { runChecks } from "../src/commands/doctor.js";

const find = async (name: string) => (await runChecks()).find((c) => c.name === name)!;

afterEach(() => vi.unstubAllGlobals());

describe("runChecks", () => {
  it("fails without npm and git but only warns without pnpm or uv", async () => {
    vi.mocked(execFileSync).mockImplementation(() => {
      throw new Error("not found");
    });
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await find("npm")).status).toBe("fail");
    expect((await find("git")).status).toBe("fail");
    expect((await find("pnpm")).status).toBe("warn");
    expect((await find("uv")).status).toBe("warn");
  });

  it("warns, not fails, when dj is behind or the registry is unreachable", async () => {
    vi.mocked(execFileSync).mockReturnValue("1.0.0");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: "999.0.0" }) }));
    const behind = await find("dj version");
    expect(behind.status).toBe("warn");
    expect(behind.fix).toContain("dj upgrade");

    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect((await find("dj version")).status).toBe("warn");
  });

  it("warns when dj is missing from PATH or a different install is on it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    vi.mocked(execFileSync).mockImplementation((cmd) => {
      if (cmd === "which") throw new Error("not found");
      return "1.0.0";
    });
    expect((await find("dj on PATH")).status).toBe("warn");

    vi.mocked(execFileSync).mockImplementation((cmd) => (cmd === "which" ? "/opt/old/dj" : "1.0.0"));
    expect((await find("dj on PATH")).detail).toContain("/opt/old/dj");
  });
});
