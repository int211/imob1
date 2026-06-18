import path from "path";
import express from "express";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { createApp } from "./server/app.js";
import { calculateAllNetworkMatches } from "./server/matcher.js";

dotenv.config();

async function startServer() {
  const app = await createApp();
  const PORT = process.env.PORT || 3000;

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    calculateAllNetworkMatches();
    console.log(`Initial match calculation completed`);
  } catch (err: any) {
    console.error(`Initial match calculation failed: ${err.message}`);
  }

  app.listen(Number(PORT), "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
