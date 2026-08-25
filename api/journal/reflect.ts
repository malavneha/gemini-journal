import { GoogleGenAI } from "@google/genai";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt, history = [] } = req.body || {};

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "A valid journal entry prompt is required.",
      });
    }

    const apiKey =
  process.env.GEMINI_API_KEY ||
  process.env.GOOGLE_API_KEY ||
  process.env.GOOGLE_GENAI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: "GEMINI_API_KEY is not configured in Vercel.",
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const contents = [
      ...history.slice(-6).map((item: any) => ({
        role:
          item?.role === "assistant" || item?.role === "model"
            ? "model"
            : "user",
        parts: [{ text: String(item?.text || "").slice(0, 2000) }],
      })),
      {
        role: "user",
        parts: [{ text: prompt.trim() }],
      },
    ];

    const response = await ai.models.generateContent({
      model: "gemini-flash-latest",
      contents,
      config: {
        systemInstruction:
          "You are an empathetic, supportive personal journaling companion. Give warm, thoughtful, concise reflections. Offer a constructive perspective and 1-2 gentle questions when appropriate. Use readable markdown.",
        temperature: 0.7,
        maxOutputTokens: 1000,
      },
    });

    const reflection = response.text;

    if (!reflection) {
      throw new Error("Gemini returned an empty response.");
    }

    return res.status(200).json({
      success: true,
      reflection,
      modelUsed: "gemini-flash-latest",
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Reflection API error:", error);

    return res.status(500).json({
      error: error?.message || "Failed to generate Gemini reflection.",
    });
  }
}