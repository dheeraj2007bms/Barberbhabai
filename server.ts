import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { GoogleGenerativeAI } from "@google/generative-ai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Gemini Setup
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "operational", version: "1.0.4" });
  });

  app.post("/api/suggest-style", async (req, res) => {
    const { hairType, faceShape, occasion } = req.body;
    try {
      const prompt = `Suggest a professional haircut for a man with ${hairType} hair and a ${faceShape} face shape for a ${occasion}. Keep it brief and stylish. Return only the suggestion name and a 1-sentence description.`;
      const result = await model.generateContent(prompt);
      const response = await result.response;
      res.json({ suggestion: response.text() });
    } catch (err) {
      res.status(500).json({ error: "Intelligence node offline" });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer();
