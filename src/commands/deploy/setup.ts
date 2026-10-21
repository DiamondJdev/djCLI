import { spawnSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { input, select } from "@inquirer/prompts";
import chalk from "chalk";
import { type DeployTarget, readTarget, validateTarget, writeTarget } from "./config.js";

export const DEFAULT_COMMAND = "bt-deploy";
const OTHER = "Other…";

export const noTargetMessage = (key: string): string =>
  `No deploy target for ${key}. Run: dj deploy setup --host <ssh-host> --command <remote-command>`;

export function sshHosts(sshConfig: string): string[] {
  const names = sshConfig
    .split("\n")
    .map((l) => l.trim().match(/^host\s+(.+)$/i)?.[1])
    .flatMap((rest) => (rest ? rest.split(/\s+/) : []))
    .filter((h) => !/[*?]/.test(h) && !h.startsWith("!"));
  return [...new Set(names)];
}

export function checkTarget(t: DeployTarget): { ok: true } | { ok: false; message: string } {
  const r = spawnSync(
    "ssh",
    ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", t.host, t.command, "status"],
    { stdio: ["ignore", "ignore", "pipe"] },
  );
  if (r.status === 0) return { ok: true };
  if (r.status === 255) return { ok: false, message: `Can't reach ${t.host} over SSH. Check that "ssh ${t.host}" works.` };
  if (r.status === 127) return { ok: false, message: `${t.host} has no "${t.command}". Enable its deploy module on the server.` };
  const firstLine = String(r.stderr ?? r.error?.message ?? "").split("\n")[0];
  return { ok: false, message: `${t.command} status failed on ${t.host}: ${firstLine}` };
}

function readSshConfig(home: string): string {
  try {
    return fs.readFileSync(path.join(home, ".ssh", "config"), "utf-8");
  } catch {
    return "";
  }
}

async function askHost(home: string, saved?: string): Promise<string> {
  const hosts = sshHosts(readSshConfig(home));
  const typed = () => input({ message: "SSH host", default: saved });
  if (hosts.length === 0) return typed();
  const picked = await select({
    message: "SSH host",
    choices: [...hosts, OTHER].map((value) => ({ value })),
    default: saved && hosts.includes(saved) ? saved : undefined,
  });
  return picked === OTHER ? typed() : picked;
}

export async function setupTarget(opts: {
  host?: string;
  command?: string;
  interactive: boolean;
  home: string;
  key: string;
}): Promise<DeployTarget> {
  if (!opts.host && !opts.interactive) throw new Error(noTargetMessage(opts.key));
  const saved = opts.interactive ? readTarget(opts.home, opts.key) : undefined;
  const host = opts.host ?? (await askHost(opts.home, saved?.host));
  const command =
    opts.command ??
    (opts.interactive
      ? await input({ message: "Remote deploy command", default: saved?.command ?? DEFAULT_COMMAND })
      : DEFAULT_COMMAND);
  const target = validateTarget({ host: host.trim(), command: command.trim() });

  console.log(chalk.dim(`Checking ssh ${target.host} ${target.command} status ...`));
  const check = checkTarget(target);
  if (!check.ok) throw new Error(check.message);

  writeTarget(opts.home, opts.key, target);
  console.log(chalk.green("Saved. Change it later with: dj deploy setup"));
  return target;
}
