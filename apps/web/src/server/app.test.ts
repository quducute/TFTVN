import { describe, expect, it } from "vitest";
import { app } from "./app";

describe("api", () => {
  it("GET /api/health returns ok", async () => {
    const response = await app.request("/api/health");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("unknown route returns 404", async () => {
    const response = await app.request("/api/does-not-exist");
    expect(response.status).toBe(404);
  });
});
