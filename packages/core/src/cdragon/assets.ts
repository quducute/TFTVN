export const CDRAGON_BASE_URL = "https://raw.communitydragon.org/latest";

export function assetUrl(path: string | null | undefined): string | null {
  if (!path) {
    return null;
  }
  const normalized = path
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\.(tex|dds)$/, ".png");
  return `${CDRAGON_BASE_URL}/game/${normalized}`;
}
