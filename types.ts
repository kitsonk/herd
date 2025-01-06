/**
 * General types and interfaces used throughout the router.
 *
 * @module
 */

import type { Context } from "./context.ts";

/**
 * Initialization options when enqueuing a message.
 */
export interface EnqueueInit {
  /**
   * The body of the message.
   */
  body?: unknown;
  /**
   * The headers of the message.
   */
  headers?: Record<string, string>;
  /**
   * The delay in milliseconds before the message is delivered.
   *
   * When specified, this will override the default delay set on the router.
   */
  delay?: number;
  /**
   * Keys to use if the message is not properly handled or delivered. This is
   * in addition to any automatic handling of the deal letter queue in the
   * router.
   */
  keysIfUndelivered?: Deno.KvKey[];
  /**
   * Specify the retry policy for failed message delivery. Each element in the
   * array represents the number of milliseconds to wait before retrying the
   * delivery. For example, `[1000, 5000, 10000]` means that a failed delivery
   * will be retried at most 3 times, with 1 second, 5 seconds, and 10 seconds
   * delay between each retry.
   *
   * When specified, this will override the default backoff schedule set on the
   * router.
   */
  backoffSchedule?: number[];
}

/**
 * The function signature for enqueuing a message.
 */
export interface Enqueue {
  (path: string, init?: EnqueueInit): Promise<Deno.KvCommitResult>;
}

/**
 * The shape of the message that is enqueued when using the router.
 */
export interface Message {
  /**
   * The path of the message.
   */
  path: string;
  /**
   * The body of the message.
   */
  body: unknown;
  /**
   * The headers of the message.
   */
  headers: Record<string, string>;
}

export interface ParamsDictionary {
  [key: string]: string;
}

/**
 * The function signature for a message handler. Handlers should conform to this
 * signature when using the router. When registering a handler with the router,
 * the params, body, and headers will be contextually typed based.
 *
 * @template Params The type of the path parameters.
 * @template Body The type of the message body.
 * @template Headers The type of the message headers.
 */
export interface Handler<
  Params = ParamsDictionary,
  Body = unknown,
  Headers extends Record<string, string> = Record<string, string>,
> {
  (context: Context<Params, Body, Headers>): void | Promise<void>;
}

type RemoveTail<S extends string, Tail extends string> = S extends
  `${infer P}${Tail}` ? P : S;

type GetPathParameter<S extends string> = RemoveTail<
  RemoveTail<RemoveTail<S, `/${string}`>, `-${string}`>,
  `.${string}`
>;

/**
 * Attempts to infer the path parameters from a path string. This is used to
 * infer the type of the `Params` generic in the `Handler` interface.
 */
export type PathParameters<Path extends string> = string extends Path
  ? ParamsDictionary
  : Path extends `${string}(${string}` ? ParamsDictionary
  : Path extends `${string}:${infer Rest}` ?
      & (
        GetPathParameter<Rest> extends never ? ParamsDictionary
          : GetPathParameter<Rest> extends `${infer ParamName}?`
            ? { [P in ParamName]?: string }
          : { [P in GetPathParameter<Rest>]: string }
      )
      & (Rest extends `${GetPathParameter<Rest>}${infer Next}`
        ? PathParameters<Next>
        : unknown)
  // deno-lint-ignore ban-types
  : {};
