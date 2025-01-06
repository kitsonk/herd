/**
 * A router for handling messages from a Deno KV queue.
 *
 * @module
 */

import { getLogger } from "@logtape/logtape";
import { assert } from "@std/assert/assert";
import {
  type Key,
  pathToRegexp,
  type PathToRegexpOptions,
} from "path-to-regexp";

import { Context } from "./context.ts";
import type {
  Enqueue,
  EnqueueInit,
  Handler,
  ParamsDictionary,
  PathParameters,
} from "./types.ts";
import {
  assertIsMessage,
  decodeComponent,
  getBackoffSchedule,
} from "./utils.ts";

export interface ListenOptions {
  signal?: AbortSignal;
}

export interface Plugin {
  init(router: Router): void;
}

export interface PluginOptions {
  prefix: string;
}

type RouteOptions = PathToRegexpOptions;

export interface RouterOptions {
  /**
   * Determines if the router should automatically manage a dead letter queue
   * (DLQ) for undelivered messages. Setting this to `true` will ensure that
   * when values are enqueued but are not handled, they will be moved to the
   * DLQ.
   */
  enabledDlq?: boolean;
  /**
   * The prefix to use for the dead letter queue (DLQ) keys. This is only used
   * if `enabledDlq` is set to `true`. This defaults to `["herd", "dlq"]`.
   * When a message is not delivered, it will be moved to the DLQ with a key
   * that is prefixed with this value and the current timestamp.
   */
  dlqPrefix?: Deno.KvKey;
  /**
   * The delay to use when enqueueing messages. This will delay the delivery of
   * the message by the specified number of milliseconds. By default, this is
   * `undefined` and no delay is applied.
   */
  delay?: number;
  /**
   * Specify the retry policy for failed message delivery. Each element in the
   * array represents the number of milliseconds to wait before retrying the
   * delivery. For example, `[1000, 5000, 10000]` means that a failed delivery
   * will be retried at most 3 times, with 1 second, 5 seconds, and 10 seconds
   * delay between each retry.
   *
   * By default this is an exponential backoff schedule starting at 1 second and
   * doubling each time up to 32 seconds along with a random delay between 1 and
   * 1000 milliseconds.
   */
  backoffSchedule?: number[];
  /**
   * Should the router reject messages that are not intended for it. By default,
   * the router will reject messages that are not properly formed, likely
   * due to being enqueued by a different party. Messages that are not properly
   * formed will follow the backoff schedule and be retried, eventually being
   * moved to the dead letter queue (DLQ) if enabled.
   *
   * By setting the value explicitly to `false`, the router will not reject
   * these messages and they will be effectively ignored.
   *
   * Irrespectively of this setting, the router will always log a warning when
   * it receives a message that is not properly formed.
   */
  rejectForeign?: boolean;
  /**
   * Should the router reject messages that do not match any route. By default,
   * the router will reject messages that do not match any route. Messages that
   * do not match any route will follow the backoff schedule and be retried,
   * eventually being moved to the dead letter queue (DLQ) if enabled.
   *
   * By setting the value explicitly to `false`, the router will not reject
   * these messages and they will be effectively ignored.
   *
   * Irrespectively of this setting, the router will always log a warning when
   * it receives a message that does not match any route.
   */
  rejectUnmatched?: boolean;
}

const DEFAULT_DLQ_PREFIX: Deno.KvKey = ["herd", "dlq"];

const logger = getLogger(["herd", "router"]);

class Route {
  #handler: Handler;
  #keys: Key[];
  #params: ParamsDictionary = Object.create(null);
  #regexp: RegExp;
  #router: Router;

  constructor(
    router: Router,
    path: string,
    handler: Handler,
    options?: RouteOptions,
  ) {
    const { regexp, keys } = pathToRegexp(path, { ...options });
    this.#regexp = regexp;
    this.#keys = keys;
    this.#handler = handler;
    this.#router = router;
  }

  handle(
    path: string,
    body: unknown,
    headers: Record<string, string>,
  ): Promise<void> | void {
    const context = new Context(
      path,
      body,
      headers,
      this.#params,
      this.#router,
    );
    logger.debug("Route.prototype.handle()", {
      path,
      body,
      headers,
    });
    return this.#handler(context);
  }

  matches(path: string): boolean {
    const match = path.match(this.#regexp);
    if (match) {
      const params = Object.create(null);
      const captures = match.slice(1);
      for (let i = 0; i < captures.length; i++) {
        if (this.#keys[i]) {
          const capture = captures[i];
          params[this.#keys[i].name] = decodeComponent(capture);
        }
      }
      this.#params = params;
      logger.debug("Route.prototype.matches()", { path, params });
      return true;
    }
    return false;
  }
}

/**
 * A router for handling messages from a Deno KV queue.
 */
export class Router {
  #db: Deno.Kv;
  #delay?: number;
  #dlqPrefix?: Deno.KvKey;
  #backoffSchedule: number[] | undefined;
  #routes = new Map<string, Route>();
  #rejectForeign: boolean;
  #rejectUnmatched: boolean;

  #handler = async (message: unknown) => {
    try {
      assertIsMessage(message);
    } catch (error) {
      assert(error instanceof Error);
      logger.warn(error.message, { message, error });
      if (this.#rejectForeign) {
        throw error;
      }
      return;
    }
    for (const route of this.#routes.values()) {
      if (route.matches(message.path)) {
        try {
          await route.handle(message.path, message.body, message.headers);
        } catch (error) {
          logger.info("Handler failed to handle message", { message, error });
          throw error;
        }
        return;
      }
    }
    logger.warn("No route matched message", { message });
    if (this.#rejectUnmatched) {
      throw new Error("No route matched message");
    }
  };

  /**
   * The underlying KV store used by the router.
   */
  get db(): Deno.Kv {
    return this.#db;
  }

  /**
   * The default backoff schedule to use when retrying messages that have not
   * been processed.
   */
  get backoffSchedule(): ReadonlyArray<number> | undefined {
    return this.#backoffSchedule ? [...this.#backoffSchedule] : undefined;
  }

  /**
   * The prefix to use for the dead letter queue (DLQ) keys. When enabled, this
   * will be used to prefix the keys of messages that are not delivered.
   * Messages which are not handled will be moved to the DLQ with a key that is
   * prefixed with this value and the current timestamp.
   *
   * If the dead letter queue (DLQ) is not enabled, this will be `undefined`.
   */
  get dlqPrefix(): Deno.KvKey | undefined {
    return this.#dlqPrefix ? [...this.#dlqPrefix] : undefined;
  }

  constructor(db: Deno.Kv, options: RouterOptions = {}) {
    const {
      dlqPrefix = DEFAULT_DLQ_PREFIX,
      delay,
      enabledDlq = false,
      rejectForeign = true,
      rejectUnmatched = true,
    } = options;
    this.#db = db;
    this.#backoffSchedule = "backoffSchedule" in options
      ? options.backoffSchedule
      : getBackoffSchedule();
    if (enabledDlq) this.#dlqPrefix = dlqPrefix;
    this.#delay = delay;
    this.#rejectForeign = rejectForeign;
    this.#rejectUnmatched = rejectUnmatched;
  }

  /**
   * Enqueues a message to be processed by the router. The message will be sent
   * to the appropriate route handler when it is dequeued.
   */
  enqueue: Enqueue = (path: string, init: EnqueueInit = {}) => {
    const {
      body,
      headers = {},
      backoffSchedule = this.#backoffSchedule,
      keysIfUndelivered: kIU = [],
      delay = this.#delay,
    } = init;
    const keysIfUndelivered = this.#dlqPrefix
      ? [[...this.#dlqPrefix, Date.now()], ...kIU]
      : kIU;
    return this.#db.enqueue({ path, body, headers }, {
      backoffSchedule,
      keysIfUndelivered,
      delay,
    });
  };

  listen(options: ListenOptions = {}): Promise<void> {
    if (options.signal) {
      options.signal.addEventListener("abort", () => this.#db.close());
    }
    return this.#db.listenQueue(this.#handler);
  }

  on<
    Path extends string,
    Params = PathParameters<Path>,
    Body = unknown,
    Headers extends Record<string, string> = Record<string, string>,
  >(path: Path, handler: Handler<Params, Body, Headers>): void {
    this.#routes.set(path, new Route(this, path, handler as Handler));
  }

  register(_plugin: Plugin, _options?: PluginOptions): void {
    // TODO: Implement plugin registration.
  }

  [Symbol.dispose](): void {
    this.#db.close();
  }
}
