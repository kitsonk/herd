/**
 * This module provides the {@linkcode Context} class which is used to provide
 * contextual information to a {@linkcode Handler} when it is invoked by the
 * router when a route matches a message.
 *
 * @module
 */

import type { Router } from "./router.ts";
import type { ParamsDictionary } from "./types.ts";

/**
 * The `Context` class provides contextual information to a {@link Handler} when
 * it is invoked by the router when a route matches a message.
 *
 * @template Params The type of the path parameters.
 * @template Body The type of the message body.
 * @template Headers The type of the message headers.
 */
export class Context<
  Params = ParamsDictionary,
  Body = unknown,
  Headers extends Record<string, string> = Record<string, string>,
> {
  #path: string;
  #body: Body;
  #headers: Headers;
  #params: Params;
  #router: Router;

  constructor(
    path: string,
    body: Body,
    headers: Headers,
    params: Params,
    router: Router,
  ) {
    this.#path = path;
    this.#body = body;
    this.#headers = { ...headers };
    this.#params = params;
    this.#router = router;
  }

  /**
   * The {@linkcode Deno.Kv} instance associated with the router, where the
   * message was queued.
   */
  get db(): Deno.Kv {
    return this.#router.db;
  }

  /**
   * The path of the message.
   */
  get path(): string {
    return this.#path;
  }

  /**
   * The body of the message.
   */
  get body(): Body {
    return this.#body;
  }

  /**
   * The headers of the message.
   */
  get headers(): Headers {
    return this.#headers;
  }

  /**
   * Any path parameters extracted from the message path.
   */
  get params(): Params {
    return this.#params;
  }

  /**
   * The router instance that invoked the handler.
   */
  get router(): Router {
    return this.#router;
  }
}
