import serverless from "serverless-http";
import { createApp } from "../../server/app.js";

let cachedHandler: any = null;

export const handler = async (event: any, context: any) => {
  if (!cachedHandler) {
    try {
      console.log("[function] Initializing Express app...");
      const app = await createApp();
      cachedHandler = serverless(app, {
        binary: ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"]
      });
      console.log("[function] Express app ready");
    } catch (err: any) {
      console.error("[function] Init error:", err.message, err.stack);
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: `Init failed: ${err.message}` })
      };
    }
  }
  return cachedHandler(event, context);
};
