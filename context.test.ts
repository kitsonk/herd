import { assertEquals } from "jsr:@std/assert@^1.0/equals";
import { assertStrictEquals } from "jsr:@std/assert@^1.0/strict-equals";

import { Context } from "./context.ts";
import { Router } from "./router.ts";

Deno.test("Context constructor", async () => {
  const router = new Router(await Deno.openKv());
  const context = new Context("/", {}, {}, {}, router);
  assertEquals(context.path, "/");
  assertEquals(context.body, {});
  assertEquals(context.headers, {});
  assertEquals(context.params, {});
  assertStrictEquals(context.router, router);
  context.router.db.close();
});
