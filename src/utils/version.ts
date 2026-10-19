export const PACKAGE_NAME = "djmond";
const REGISTRY_URL = `https://registry.npmjs.org/${PACKAGE_NAME}/latest`;
const REGISTRY_TIMEOUT_MS = 5000;

type FetchFn = (
  url: string,
  init?: { signal?: AbortSignal },
) => Promise<{ ok: boolean; status?: number; json(): Promise<unknown> }>;

function parts(version: string): number[] {
  return version
    .replace(/^v/, "")
    .split("-")[0]
    .split(".")
    .map((n) => Number.parseInt(n, 10) || 0);
}

export function compareVersions(a: string, b: string): number {
  const pa = parts(a);
  const pb = parts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export async function fetchLatestVersion(
  fetchFn: FetchFn = fetch,
): Promise<string> {
  const res = await fetchFn(REGISTRY_URL, {
    signal: AbortSignal.timeout(REGISTRY_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`npm registry returned ${res.status}`);
  const body = (await res.json()) as { version?: unknown };
  if (typeof body.version !== "string") {
    throw new Error("npm registry response had no version");
  }
  return body.version;
}
