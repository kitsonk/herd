import { Router } from "./router.ts";

Deno.test("listen supports abort signal", async () => {
  const db = await Deno.openKv();
  const router = new Router(db);
  const abortController = new AbortController();
  const { signal } = abortController;
  const promise = router.listen({ signal });
  abortController.abort();
  await promise;
});
