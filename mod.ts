interface EnqueueInit {
  body?: unknown;
  headers?: Record<string, string>;
}

interface Enqueue {
  (path: string, init?: EnqueueInit): void;
}

interface Listen {
  (): void;
}

interface Plugin {
  init(router: Router): void;
}

interface PluginOptions {
  prefix: string;
}

interface Handler<
  Body = unknown,
  Headers extends Record<string, string> = Record<string, string>,
> {
  (context: Context<Body, Headers>): void;
}

class Context<
  Body = unknown,
  Headers extends Record<string, string> = Record<string, string>,
> {
  get db(): Deno.Kv {
    return new Deno.Kv();
  }

  get path(): string {
    return "";
  }

  get body(): Body {
    return undefined as Body;
  }

  get headers(): Headers {
    return {} as Headers;
  }
}

class Route {}

class Router {
  constructor() {}

  on<
    Body = unknown,
    Headers extends Record<string, string> = Record<string, string>,
  >(path: string, handler: Handler<Body, Headers>): void {}

  register(plugin: Plugin, options?: PluginOptions): void {}
}

function resolveDb(db?: Deno.Kv | string): Promise<Deno.Kv> {
  if (db instanceof Deno.Kv) {
    return Promise.resolve(db);
  }
  return Deno.openKv(db);
}

export async function init(
  db?: Deno.Kv | string,
): Promise<{ router: Router; listen: Listen; enqueue: Enqueue }> {
  db = await resolveDb(db);
  return {
    router: await getRouter(db),
    listen: await getListen(db),
    enqueue: await getEnqueue(db),
  };
}

const enqueueMap = new Map<Deno.Kv, Enqueue>();

export function getEnqueue(db?: Deno.Kv | string): Promise<Enqueue> {
  return Promise.resolve((_path: string, _payload: unknown) => {});
}

const listenMap = new Map<Deno.Kv, Listen>();

export function getListen(db?: Deno.Kv | string): Promise<Listen> {
  return Promise.resolve(() => {});
}

const routerMap = new Map<Deno.Kv, Router>();

export function getRouter(db?: Deno.Kv | string): Promise<Router> {
  return Promise.resolve(new Router());
}
