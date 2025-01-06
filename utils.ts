import type { Message } from "./types.ts";

/**
 * An exponential backoff schedule starting at 1 second and doubling each time
 * up to 16 seconds.
 */
const BACKOFF_SCHEDULE = [1000, 2000, 4000, 8000, 16000];

/**
 * Assert that a value is a message.
 */
export function assertIsMessage(value: unknown): asserts value is Message {
  if (typeof value !== "object" || value === null) {
    throw new Error("Message must be an object.");
  }
  if (!("path" in value) || typeof value.path !== "string") {
    throw new Error("Message must have a string path.");
  }
  if (!("body" in value)) {
    throw new Error("Message must have a body.");
  }
  if (!("headers" in value) || typeof value.headers !== "object") {
    throw new Error("Message must have headers.");
  }
}

/**
 * An infallible version of `decodeURIComponent()`.
 */
export function decodeComponent(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Get a random number of milliseconds between 1 and 1000.
 */
function getRandomMilliseconds(): number {
  return Math.floor(Math.random() * (1000 - 1 + 1) + 1);
}

/**
 * Get a backoff schedule with random jitter.
 */
export function getBackoffSchedule() {
  return BACKOFF_SCHEDULE.map((delay) => delay + getRandomMilliseconds());
}
