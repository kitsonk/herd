/**
 * # herd
 *
 * A message queue router for Deno KV queues.
 *
 * ## Logging
 *
 * This package uses the [`@logtape/logtape`](https://logtape.org/) library for
 * logging. To enable logging check out the LogTape
 * [Quick Start](https://logtape.org/manual/start). This package uses the
 * category `herd` for logging.
 *
 * @module
 */

import { getLogger } from "@logtape/logtape";

import { Router, type RouterOptions } from "./router.ts";

export type { Context } from "./context.ts";
export type { Plugin, PluginOptions, Router, RouterOptions } from "./router.ts";
export type {
  Enqueue,
  EnqueueInit,
  Handler,
  Message,
  ParamsDictionary,
} from "./types.ts";

const logger = getLogger(["herd"]);
const routerMap = new WeakMap<Deno.Kv, Router>();

async function getRouter(
  db?: Deno.Kv | string,
  options?: RouterOptions,
): Promise<Router> {
  db = await resolveDb(db);
  if (routerMap.has(db) && options) {
    logger.warn("Router already initialized with options, ignoring.");
  }
  return routerMap.get(db) ?? setRouter(db, options);
}

function resolveDb(db?: Deno.Kv | string): Promise<Deno.Kv> {
  if (db instanceof Deno.Kv) {
    return Promise.resolve(db);
  }
  return Deno.openKv(db);
}

function setRouter(db: Deno.Kv, options: RouterOptions = {}): Router {
  const router = new Router(db, options);
  routerMap.set(db, router);
  return router;
}

/**
 * Initialize a router (or get an existing one) for the given KV store.
 */
export function init(
  db?: Deno.Kv | string,
  options?: RouterOptions,
): Promise<Router> {
  return getRouter(db, options);
}
