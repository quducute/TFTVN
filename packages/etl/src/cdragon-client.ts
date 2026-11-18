import type { Locale, RawGameData, RawTeamPlanner } from "@tftvn/core";
import { CDRAGON_BASE_URL } from "@tftvn/core";
import axios from "axios";

const http = axios.create({
  baseURL: CDRAGON_BASE_URL,
  timeout: 120_000,
  responseType: "text",
  transformResponse: (body: string) => body,
});

const LOCALE_FILES: Record<Locale, string> = { vi: "vi_vn", en: "en_us" };

export interface CDragonDownload {
  version: string;
  patch: string;
  sources: Record<Locale, RawGameData>;
  teamPlanner: RawTeamPlanner;
  rawFiles: Record<string, string>;
}

async function getText(path: string): Promise<string> {
  const response = await http.get<string>(path);
  return response.data;
}

export function patchFromVersion(version: string): string {
  const match = /^(\d+)\.(\d+)/.exec(version);
  if (!match) {
    throw new Error(`Unexpected CommunityDragon version "${version}"`);
  }
  return `${match[1]}.${match[2]}`;
}

export async function downloadCDragon(): Promise<CDragonDownload> {
  const [metadata, vi, en, teamPlanner] = await Promise.all([
    getText("/content-metadata.json"),
    getText(`/cdragon/tft/${LOCALE_FILES.vi}.json`),
    getText(`/cdragon/tft/${LOCALE_FILES.en}.json`),
    getText("/plugins/rcp-be-lol-game-data/global/default/v1/tftchampions-teamplanner.json"),
  ]);
  const version = (JSON.parse(metadata) as { version: string }).version;
  return {
    version,
    patch: patchFromVersion(version),
    sources: { vi: JSON.parse(vi) as RawGameData, en: JSON.parse(en) as RawGameData },
    teamPlanner: JSON.parse(teamPlanner) as RawTeamPlanner,
    rawFiles: {
      "content-metadata.json": metadata,
      "vi_vn.json": vi,
      "en_us.json": en,
      "tftchampions-teamplanner.json": teamPlanner,
    },
  };
}
