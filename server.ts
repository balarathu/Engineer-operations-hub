import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  const CONFIG_FILE = path.join(process.cwd(), "config-db.json");

  // API/config routes
  app.get("/api/config", (req, res) => {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
        return res.json({ success: true, sheetUrl: data.sheetUrl || "" });
      }
      return res.json({ success: true, sheetUrl: "" });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/config", (req, res) => {
    try {
      const { sheetUrl } = req.body;
      fs.writeFileSync(CONFIG_FILE, JSON.stringify({ sheetUrl: sheetUrl || "" }), "utf-8");
      return res.json({ success: true, sheetUrl: sheetUrl || "" });
    } catch (error) {
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
