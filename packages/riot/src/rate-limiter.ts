export interface RateWindow {
  limit: number;
  windowMs: number;
}

export interface Clock {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
}

export const systemClock: Clock = {
  now: () => Date.now(),
  sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
};

export const DEVELOPMENT_KEY_WINDOWS: RateWindow[] = [
  { limit: 20, windowMs: 1_000 },
  { limit: 100, windowMs: 120_000 },
];

export function createRateLimiter(windows: RateWindow[], clock: Clock = systemClock) {
  const longestWindow = Math.max(...windows.map((window) => window.windowMs));
  const sent: number[] = [];
  let blockedUntil = 0;
  let queue: Promise<void> = Promise.resolve();

  function waitTime(now: number): number {
    let wait = blockedUntil - now;
    for (const { limit, windowMs } of windows) {
      const inWindow = sent.filter((time) => time > now - windowMs);
      if (inWindow.length >= limit) {
        wait = Math.max(wait, inWindow[inWindow.length - limit]! + windowMs - now);
      }
    }
    return wait;
  }

  async function acquire(): Promise<void> {
    for (;;) {
      const now = clock.now();
      const wait = waitTime(now);
      if (wait <= 0) {
        sent.push(now);
        while (sent.length > 0 && sent[0]! <= now - longestWindow) {
          sent.shift();
        }
        return;
      }
      await clock.sleep(wait);
    }
  }

  return {
    schedule(): Promise<void> {
      const turn = queue.then(acquire);
      queue = turn.catch(() => undefined);
      return turn;
    },
    pause(milliseconds: number) {
      blockedUntil = Math.max(blockedUntil, clock.now() + milliseconds);
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
