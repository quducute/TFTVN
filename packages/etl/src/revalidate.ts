import axios from "axios";
import { optionalEnv } from "./env";

export async function revalidate(tag: string): Promise<boolean> {
  const url = optionalEnv("REVALIDATE_URL");
  const secret = optionalEnv("REVALIDATE_SECRET");
  if (!url || !secret) {
    return false;
  }
  try {
    await axios.post(
      url,
      { tag },
      { headers: { Authorization: `Bearer ${secret}` }, timeout: 30_000 },
    );
    return true;
  } catch (error) {
    console.warn(`Revalidate "${tag}" failed: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}
