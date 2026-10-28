import { app } from "./main.ts";
import { waitWebhooks } from "./routes/webhooks.ts";

const syncEnv = (env: Record<string, string>) => {
  Object.entries(env).forEach(([k, v]) => {
    if (typeof v === "string") {
      Deno.env.set(k, v);
    }
  });
};

type ExecutionContext = {
  waitUntil?: (promise: Promise<unknown>) => void;
};

export const worker = {
  fetch: async (
    req: Request,
    env: Record<string, string>,
    ctx?: ExecutionContext,
  ) => {
    syncEnv(env);
    const response = await app.fetch(req);
    ctx?.waitUntil?.(waitWebhooks());
    return response;
  },
};

export default worker;
