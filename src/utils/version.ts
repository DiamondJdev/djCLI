export const PACKAGE_NAME = "djmond";

const strip = (v: string) => v.replace(/^v/, "");

export const compareVersions = (a: string, b: string): number =>
  strip(a).localeCompare(strip(b), undefined, { numeric: true });

export async function fetchLatestVersion(): Promise<string> {
  const res = await fetch(`https://registry.npmjs.org/${PACKAGE_NAME}/latest`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const { version } = (await res.json()) as { version?: unknown };
  if (typeof version !== "string") throw new Error("npm registry response had no version");
  return version;
}
