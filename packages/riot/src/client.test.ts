import { expect, test } from "@playwright/test";
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { RiotApiError, createRiotClient } from "./client";
import { createRateLimiter } from "./rate-limiter";

type Reply = { status: number; data?: unknown; headers?: Record<string, string> };

function fakeRiot(replies: Reply[]) {
  const requests: InternalAxiosRequestConfig[] = [];
  const http = axios.create({
    adapter: async (config) => {
      requests.push(config);
      const reply = replies.shift() ?? { status: 500 };
      const response = {
        data: reply.data ?? {},
        status: reply.status,
        statusText: String(reply.status),
        headers: reply.headers ?? {},
        config,
      } as AxiosResponse;
      if (reply.status >= 400) {
        throw new AxiosError("failed", "ERR_BAD_RESPONSE", config, null, response);
      }
      return response;
    },
  });
  let time = 0;
  const limiter = createRateLimiter([{ limit: 100, windowMs: 1_000 }], {
    now: () => time,
    sleep: async (milliseconds) => {
      time += milliseconds;
    },
  });
  const client = createRiotClient({ apiKey: "RGAPI-test", http, limiter });
  return { client, requests, elapsed: () => time };
}

test.describe("riot client", () => {
  test("calls the right host with the API key and encoded Riot ID", async () => {
    const { client, requests } = fakeRiot([
      { status: 200, data: { puuid: "p1", gameName: "Quý Đức", tagLine: "VN2" } },
    ]);
    const account = await client.accountByRiotId("Quý Đức", "VN2");
    expect(account.puuid).toBe("p1");
    expect(requests[0]!.url).toBe(
      "https://asia.api.riotgames.com/riot/account/v1/accounts/by-riot-id/Qu%C3%BD%20%C4%90%E1%BB%A9c/VN2",
    );
    expect(requests[0]!.headers["X-Riot-Token"]).toBe("RGAPI-test");
  });

  test("routes league calls to vn2 and match calls to sea", async () => {
    const { client, requests } = fakeRiot([
      { status: 200, data: { entries: [] } },
      { status: 200, data: ["VN2_1"] },
    ]);
    await client.apexLeague("challenger");
    await client.matchIdsByPuuid("p1", 10);
    expect(requests[0]!.url).toBe("https://vn2.api.riotgames.com/tft/league/v1/challenger");
    expect(requests[1]!.url).toContain(
      "https://sea.api.riotgames.com/tft/match/v1/matches/by-puuid/p1/ids",
    );
    expect(requests[1]!.params).toEqual({ count: 10 });
  });

  test("retries after a 429 using Retry-After", async () => {
    const { client, requests, elapsed } = fakeRiot([
      { status: 429, headers: { "retry-after": "3" } },
      { status: 200, data: ["VN2_1"] },
    ]);
    expect(await client.matchIdsByPuuid("p1", 1)).toEqual(["VN2_1"]);
    expect(requests).toHaveLength(2);
    expect(elapsed()).toBe(3_000);
  });

  test("does not retry a 404 and reports it as notFound", async () => {
    const { client, requests } = fakeRiot([{ status: 404 }]);
    const error = await client.accountByRiotId("ghost", "VN2").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(RiotApiError);
    expect((error as RiotApiError).kind).toBe("notFound");
    expect(requests).toHaveLength(1);
  });

  test("gives up after the retry budget on repeated server errors", async () => {
    const { client, requests } = fakeRiot([
      { status: 503 },
      { status: 503 },
      { status: 503 },
      { status: 503 },
    ]);
    const error = await client.match("VN2_1").catch((caught: unknown) => caught);
    expect((error as RiotApiError).kind).toBe("unavailable");
    expect(requests).toHaveLength(4);
  });

  test("reports an invalid key as unauthorized", async () => {
    const { client } = fakeRiot([{ status: 403 }]);
    const error = await client.apexLeague("master").catch((caught: unknown) => caught);
    expect((error as RiotApiError).kind).toBe("unauthorized");
  });
});
