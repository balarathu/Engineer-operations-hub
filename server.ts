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

  // Proxy GET request to Google Sheet
  app.get("/api/proxy-sheet", async (req, res) => {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        return res.json({ success: false, error: "No Google Sheets URL configured on server." });
      }
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      const url = data.sheetUrl;
      if (!url) {
        return res.json({ success: false, error: "No Google Sheets URL configured on server." });
      }
      
      const fetchUrl = `${url}${url.includes('?') ? '&' : '?'}t=${Date.now()}`;
      const response = await fetch(fetchUrl);
      const resText = await response.text();
      
      try {
        const resJson = JSON.parse(resText);
        return res.json(resJson);
      } catch (parseError) {
        return res.status(502).json({ 
          success: false, 
          error: "Received non-JSON response from Google Sheet. Verify that the URL is a deployed Google Apps Script Web App.",
          raw: resText 
        });
      }
    } catch (error) {
      console.error("Proxy GET failed:", error);
      return res.status(500).json({ success: false, error: String(error) });
    }
  });

  // Proxy POST request to Google Sheet
  app.post("/api/proxy-sheet", async (req, res) => {
    try {
      if (!fs.existsSync(CONFIG_FILE)) {
        return res.json({ success: false, error: "No Google Sheets URL configured on server." });
      }
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
      const url = data.sheetUrl;
      if (!url) {
        return res.json({ success: false, error: "No Google Sheets URL configured on server." });
      }
      
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify(req.body)
      });
      const resText = await response.text();
      
      try {
        const resJson = JSON.parse(resText);
        return res.json(resJson);
      } catch (parseError) {
        return res.status(502).json({ 
          success: false, 
          error: "Received non-JSON response from Google Sheet. Verify that the URL is a deployed Google Apps Script Web App.",
          raw: resText 
        });
      }
    } catch (error) {
      console.error("Proxy POST failed:", error);
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
