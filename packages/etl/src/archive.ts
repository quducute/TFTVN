import { gzipSync } from "node:zlib";
import axios, { isAxiosError } from "axios";
import { optionalEnv } from "./env";

interface Release {
  id: number;
  assets: { name: string; browser_download_url: string }[];
}

export interface ArchiveInput {
  patch: string;
  sourceHash: string;
  rawFiles: Record<string, string>;
}

export async function archiveToGithubRelease(input: ArchiveInput): Promise<string | null> {
  const token = optionalEnv("GITHUB_TOKEN");
  const repository = optionalEnv("GITHUB_REPOSITORY");
  if (!token || !repository) {
    return null;
  }

  const api = axios.create({
    baseURL: `https://api.github.com/repos/${repository}`,
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json" },
  });
  const tag = `gamedata-${input.patch}`;
  const assetName = `cdragon-${input.sourceHash.slice(0, 16)}.json.gz`;

  let release: Release;
  try {
    release = (await api.get<Release>(`/releases/tags/${tag}`)).data;
  } catch (error) {
    if (!isAxiosError(error) || error.response?.status !== 404) {
      throw error;
    }
    release = (
      await api.post<Release>("/releases", {
        tag_name: tag,
        name: `Game data ${input.patch}`,
        body: `CommunityDragon snapshot for patch ${input.patch}`,
      })
    ).data;
  }

  const existing = release.assets.find((asset) => asset.name === assetName);
  if (existing) {
    return existing.browser_download_url;
  }

  const content = gzipSync(JSON.stringify(input.rawFiles));
  const uploaded = await axios.post<{ browser_download_url: string }>(
    `https://uploads.github.com/repos/${repository}/releases/${release.id}/assets`,
    content,
    {
      params: { name: assetName },
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/gzip" },
      maxBodyLength: Infinity,
    },
  );
  return uploaded.data.browser_download_url;
}
