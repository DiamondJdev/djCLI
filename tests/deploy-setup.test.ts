import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

vi.mock("child_process", () => ({ spawnSync: vi.fn(), execFileSync: vi.fn() }));
vi.mock("@inquirer/prompts", () => ({ select: vi.fn(), input: vi.fn() }));
import { spawnSync } from "child_process";
import { select, input } from "@inquirer/prompts";
import { sshHosts, checkTarget, setupTarget } from "../src/commands/deploy/setup.js";
import { readTarget, writeTarget } from "../src/commands/deploy/config.js";

const KEY = "github.com/DiamondJdev/bt-assistant";
const spawnResult = (status: number, stderr = "") =>
  ({ status, stderr: Buffer.from(stderr) }) as unknown as ReturnType<typeof spawnSync>;

const tmpHome = (sshConfig?: string) => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "dj-setup-"));
  if (sshConfig !== undefined) {
    fs.mkdirSync(path.join(home, ".ssh"));
    fs.writeFileSync(path.join(home, ".ssh", "config"), sshConfig);
  }
  return home;
};

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.mocked(spawnSync).mockReset().mockReturnValue(spawnResult(0));
  vi.mocked(select).mockReset();
  vi.mocked(input).mockReset();
});

describe("sshHosts", () => {
  it("lists concrete host names once, in order", () => {
    expect(sshHosts("Host a b\n  HostName x\nHost *\nhost c\nHost !d\nHost a\n")).toEqual(["a", "b", "c"]);
  });

  it("drops patterns with ?", () => {
    expect(sshHosts("Host web? db\n")).toEqual(["db"]);
  });
});

describe("checkTarget", () => {
  const t = { host: "nixos", command: "bt-deploy" };

  it("runs the exact ssh check", () => {
    expect(checkTarget(t)).toEqual({ ok: true });
    expect(spawnSync).toHaveBeenCalledWith(
      "ssh",
      ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "nixos", "bt-deploy", "status"],
      expect.objectContaining({ stdio: ["ignore", "ignore", "pipe"] }),
    );
  });

  it("maps exit codes to messages", () => {
    vi.mocked(spawnSync).mockReturnValueOnce(spawnResult(255));
    expect(checkTarget(t)).toEqual({ ok: false, message: `Can't reach nixos over SSH. Check that "ssh nixos" works.` });
    vi.mocked(spawnSync).mockReturnValueOnce(spawnResult(127));
    expect(checkTarget(t)).toEqual({ ok: false, message: `nixos has no "bt-deploy". Enable its deploy module on the server.` });
    vi.mocked(spawnSync).mockReturnValueOnce(spawnResult(1, "boom\nmore"));
    expect(checkTarget(t)).toEqual({ ok: false, message: "bt-deploy status failed on nixos: boom" });
  });
});

describe("setupTarget", () => {
  it("uses flags and the default command without prompting", async () => {
    const home = tmpHome();
    const t = await setupTarget({ host: "nixos", interactive: false, home, key: KEY });
    expect(t).toEqual({ host: "nixos", command: "bt-deploy" });
    expect(readTarget(home, KEY)).toEqual(t);
    expect(select).not.toHaveBeenCalled();
    expect(input).not.toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Saved. Change it later with: dj deploy setup"));
  });

  it("refuses to guess a host without a TTY", async () => {
    await expect(setupTarget({ interactive: false, home: tmpHome(), key: KEY })).rejects.toThrow(
      `No deploy target for ${KEY}. Run: dj deploy setup --host <ssh-host> --command <remote-command>`,
    );
  });

  it("asks for the host as text when ~/.ssh/config has no hosts", async () => {
    vi.mocked(input).mockResolvedValueOnce("nixos").mockResolvedValueOnce("bt-deploy");
    const t = await setupTarget({ interactive: true, home: tmpHome(), key: KEY });
    expect(t).toEqual({ host: "nixos", command: "bt-deploy" });
    expect(select).not.toHaveBeenCalled();
    expect(vi.mocked(input).mock.calls[1][0]).toMatchObject({ default: "bt-deploy" });
  });

  it("offers ssh hosts plus Other…", async () => {
    vi.mocked(select).mockResolvedValueOnce("Other…");
    vi.mocked(input).mockResolvedValueOnce("nixos").mockResolvedValueOnce("bt-deploy");
    const t = await setupTarget({ interactive: true, home: tmpHome("Host piclustermaster\n"), key: KEY });
    const choices = (vi.mocked(select).mock.calls[0][0] as { choices: { value: string }[] }).choices;
    expect(choices.map((c) => c.value)).toEqual(["piclustermaster", "Other…"]);
    expect(t.host).toBe("nixos");
  });

  it("defaults the prompts to the saved target", async () => {
    const home = tmpHome();
    writeTarget(home, KEY, { host: "old", command: "old-deploy" });
    vi.mocked(input).mockResolvedValueOnce("old").mockResolvedValueOnce("old-deploy");
    await setupTarget({ interactive: true, home, key: KEY });
    expect(vi.mocked(input).mock.calls[0][0]).toMatchObject({ default: "old" });
    expect(vi.mocked(input).mock.calls[1][0]).toMatchObject({ default: "old-deploy" });
  });

  it("saves nothing when the check fails", async () => {
    const home = tmpHome();
    writeTarget(home, KEY, { host: "old", command: "bt-deploy" });
    const before = fs.readFileSync(path.join(home, ".dj", "config.json"), "utf-8");
    vi.mocked(spawnSync).mockReturnValueOnce(spawnResult(255));
    await expect(setupTarget({ host: "nixos", interactive: false, home, key: KEY })).rejects.toThrow("Can't reach nixos");
    expect(fs.readFileSync(path.join(home, ".dj", "config.json"), "utf-8")).toBe(before);
  });

  it("rejects an unsafe host before running ssh", async () => {
    await expect(setupTarget({ host: "-oProxyCommand=x", interactive: false, home: tmpHome(), key: KEY })).rejects.toThrow(
      "Invalid host",
    );
    expect(spawnSync).not.toHaveBeenCalled();
  });
});
