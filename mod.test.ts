import { assert } from "jsr:@std/assert@^1.0/assert";
import { assertEquals } from "jsr:@std/assert@^1.0/equals";
import { assertInstanceOf } from "jsr:@std/assert@^1.0/instance-of";
import { configure, type LogRecord } from "@logtape/logtape";

import { init } from "./mod.ts";
import { Router } from "./router.ts";

Deno.test("init returns instance of Router", async () => {
  const router = await init();
  assertInstanceOf(router, Router);
  router.db.close();
});

Deno.test("init returns instance of Router with options", async () => {
  const router = await init(undefined, { enabledDlq: true });
  assert(router.backoffSchedule);
  assert(router.dlqPrefix);
  router.db.close();
});

Deno.test("init returns instance of Router with string db", async () => {
  const tempFileName = await Deno.makeTempFile();
  const router = await init(tempFileName);
  assertInstanceOf(router, Router);
  const router2 = await init();
  assertInstanceOf(router2, Router);
  assert(router.db !== router2.db);
  assert(router !== router2);
  router.db.close();
  router2.db.close();
});

Deno.test("init returns instance of Router with existing router", async () => {
  const router = await init();
  const router2 = await init(router.db);
  assert(router === router2);
  router.db.close();
});

Deno.test("init warns when options are passed to existing router", async () => {
  const logs: LogRecord[] = [];
  await configure({
    sinks: {
      memory(record) {
        logs.push(record);
      },
    },
    loggers: [
      {
        category: ["logtape", "meta"],
        lowestLevel: "error",
        sinks: ["memory"],
      },
      { category: "herd", lowestLevel: "debug", sinks: ["memory"] },
    ],
  });
  const router = await init();
  const router2 = await init(router.db, { enabledDlq: true });
  assert(router === router2);
  assertEquals(logs.length, 1);
  assertEquals(
    logs[0].rawMessage,
    "Router already initialized with options, ignoring.",
  );
  assertEquals(logs[0].category, ["herd"]);
  assertEquals(logs[0].level, "warning");
  router.db.close();
});
