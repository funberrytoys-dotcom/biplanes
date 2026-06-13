function appBaseUrl(): string {
  const meta = import.meta as ImportMeta & { env?: { BASE_URL?: string } };
  const base = meta.env?.BASE_URL ?? '/';
  return base.endsWith('/') ? base : `${base}/`;
}

export function assetUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${appBaseUrl()}${cleanPath}`;
}
