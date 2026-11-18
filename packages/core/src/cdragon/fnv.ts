const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function fnv1a32(text: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const char of text.toLowerCase()) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, FNV_PRIME) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

export function hashedKey(name: string): string {
  return `{${fnv1a32(name)}}`;
}

export const HASHED_KEY_PATTERN = /^\{([0-9a-f]{8})\}$/;
