import { expect, test } from "@playwright/test";
import { type Clock, createRateLimiter } from "./rate-limiter";

function fakeClock() {
  let time = 0;
  const clock: Clock = {
    now: () => time,
    sleep: async (milliseconds) => {
      time += milliseconds;
    },
  };
  return { clock, now: () => time };
}

test.describe("rate limiter", () => {
  test("lets requests through until a window is full", async () => {
    const { clock, now } = fakeClock();
    const limiter = createRateLimiter([{ limit: 3, windowMs: 1_000 }], clock);
    for (let index = 0; index < 3; index += 1) {
      await limiter.schedule();
    }
    expect(now()).toBe(0);
    await limiter.schedule();
    expect(now()).toBe(1_000);
  });

  test("respects the strictest of several windows", async () => {
    const { clock, now } = fakeClock();
    const limiter = createRateLimiter(
      [
        { limit: 20, windowMs: 1_000 },
        { limit: 100, windowMs: 120_000 },
      ],
      clock,
    );
    for (let index = 0; index < 100; index += 1) {
      await limiter.schedule();
    }
    expect(now()).toBe(4_000);
    await limiter.schedule();
    expect(now()).toBe(120_000);
  });

  test("waits out a Retry-After pause", async () => {
    const { clock, now } = fakeClock();
    const limiter = createRateLimiter([{ limit: 10, windowMs: 1_000 }], clock);
    limiter.pause(5_000);
    await limiter.schedule();
    expect(now()).toBe(5_000);
  });

  test("serves concurrent callers in order", async () => {
    const { clock } = fakeClock();
    const limiter = createRateLimiter([{ limit: 1, windowMs: 100 }], clock);
    const order: number[] = [];
    await Promise.all([1, 2, 3].map((id) => limiter.schedule().then(() => order.push(id))));
    expect(order).toEqual([1, 2, 3]);
  });
});
