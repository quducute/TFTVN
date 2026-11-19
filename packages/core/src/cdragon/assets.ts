export const CDRAGON_BASE_URL = "https://raw.communitydragon.org/latest";

export function assetUrl(path: string | null | undefined): string | null {
  if (!path || !path.includes("/")) {
    return null;
  }
  const normalized = path
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/\.(tex|dds)$/, ".png");
  return `${CDRAGON_BASE_URL}/game/${normalized}`;
}

export const TEXT_ICON_BASE_URL = `${CDRAGON_BASE_URL}/plugins/rcp-be-lol-game-data/global/default/assets/ux/fonts/texticons`;

const STATS_ICONS = new Set([
  "scalead",
  "scaleadaptiveforce",
  "scaleah",
  "scaleap",
  "scaleapen",
  "scalearmor",
  "scaleas",
  "scalecooldown",
  "scalecrit",
  "scalecritmult",
  "scaleda",
  "scaledr",
  "scalehealshield",
  "scalehealth",
  "scalehpregen",
  "scalelevel",
  "scalels",
  "scalemana",
  "scalemanaregen",
  "scalempen",
  "scalemr",
  "scalems",
  "scalerange",
  "scalesv",
  "scaletenacity",
]);

const TEXT_ICON_FILES: Record<string, string> = {
  goldcoins: "lol/gameplay/goldcoins.png",
  tftmanaregen: "lol/statsicon/scalemanaregen.png",
  tftbasead: "lol/statsicon/scalead.png",
};

export function textIconUrl(name: string): string | null {
  const key = name.toLowerCase();
  const file = TEXT_ICON_FILES[key] ?? (STATS_ICONS.has(key) ? `lol/statsicon/${key}.png` : null);
  return file ? `${TEXT_ICON_BASE_URL}/${file}` : null;
}

const ROLE_DAMAGE: Record<string, string> = { AD: "attack", AP: "magic", H: "hybrid" };

export function roleIconUrl(roleApiName: string): string | null {
  const match = /^(AD|AP|H)(Carry|Caster|Fighter|Reaper|Specialist|Tank)$/.exec(roleApiName);
  if (!match) {
    return null;
  }
  return `${TEXT_ICON_BASE_URL}/tft/characterroles/tft_${ROLE_DAMAGE[match[1]!]}_${match[2]!.toLowerCase()}.png`;
}
