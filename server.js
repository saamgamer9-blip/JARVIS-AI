import "dotenv/config";
import express from "express";
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.post("/api/chat", async (req, res) => {
  const { provider, message, language = "auto", history = [] } = req.body ?? {};
  if (typeof message !== "string" || !message.trim() || message.length > 12000) {
    return res.status(400).json({ error: "Fadlan qor su'aal sax ah (ugu badnaan 12,000 xaraf)." });
  }
  const safeHistory = Array.isArray(history)
    ? history.slice(-12).filter(m => ["user", "assistant"].includes(m?.role) && typeof m?.content === "string")
    : [];
  const langInstruction = language === "so" ? "Ku jawaab Af-Soomaali." :
    language === "en" ? "Reply in English." : "Reply in the language used by the user.";
  const system = `You are JARVIS, a helpful personal AI assistant. ${langInstruction} Be clear, safe, and honest.`;
  try {
    let answer;
    if (provider === "openai") {
      if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: "OpenAI API key lama dejin." });
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const completion = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [{ role: "system", content: system }, ...safeHistory, { role: "user", content: message.trim() }]
      });
      answer = completion.choices?.[0]?.message?.content;
    } else if (provider === "gemini") {
      if (!process.env.GEMINI_API_KEY) return res.status(503).json({ error: "Gemini API key lama dejin." });
      const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const contents = [
        ...safeHistory.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        { role: "user", parts: [{ text: `${system}\n\n${message.trim()}` }] }
      ];
      const result = await client.models.generateContent({ model: "gemini-2.5-flash", contents });
      answer = result.text;
    } else {
      return res.status(400).json({ error: "Dooro Gemini ama ChatGPT." });
    }
    if (!answer) throw new Error("AI jawaab ma soo celin.");
    res.json({ answer });
  } catch (err) {
    console.error("JARVIS API error:", err?.message);
    res.status(500).json({ error: "Adeegga AI ayaa cilad galay. Hubi API key-ga iyo internetka." });
  }
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));
const port = Number(process.env.PORT) || 3000;
app.listen(port, () => console.log(`JARVIS is running on http://localhost:${port}`));