import { init } from "./mod.ts";

Deno.test("basic init", async () => {
  const { router } = await init();
  router.on("/", (_context) => {
    console.log("Hello world!");
  });
});
