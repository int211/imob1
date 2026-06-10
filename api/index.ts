import { createApp } from "../server/app.js";

let app: any = null;

export default async function handler(req: any, res: any) {
  if (!app) {
    try {
      console.log("[vercel] Initializing Express app...");
      app = await createApp();
      console.log("[vercel] Express app ready");
    } catch (err: any) {
      console.error("[vercel] Init error:", err.message);
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: `Init failed: ${err.message}` }));
      return;
    }
  }
  app.handle(req, res);
}
