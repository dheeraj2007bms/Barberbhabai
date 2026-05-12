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
    console.log("Generating suggestion for:", { hairType, faceShape, occasion });
    
    if (!process.env.GEMINI_API_KEY) {
      console.error("GEMINI_API_KEY missing");
      return res.status(500).json({ error: "Intelligence node configuration missing" });
    }

    try {
      const prompt = `You are a high-end futuristic barber consultant. Suggest a specific professional haircut for a man with ${hairType} hair and a ${faceShape} face shape for a ${occasion}. 
      Format:
      Style: [Style Name]
      Reasoning: [1-2 sentences why it works]
      Pro Tip: [Brief grooming tip]`;
      
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      console.log("Suggestion generated successfully");
      res.json({ suggestion: text });
    } catch (err) {
      console.error("Gemini Error:", err);
      res.status(500).json({ error: "Intelligence node offline or blocked. Check API key and quota." });
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
