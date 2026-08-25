import { GoogleGenAI } from "@google/genai";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
];

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Vercel.");
  }
  return key;
}

async function reflect(prompt: string, history: any[] = []) {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const contents = [
    ...history.slice(-6).map((m) => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      parts: [{ text: String(m.text).slice(0, 2000) }],
    })),
    {
      role: "user",
      parts: [{ text: prompt }],
    },
  ];

  let lastError: any;

  for (const model of FALLBACK_MODELS) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction:
            "You are an empathetic, supportive and thoughtful personal journaling companion. Give warm, concise reflective feedback. Ask 1-2 gentle follow-up questions or offer a constructive perspective. If the user celebrates, celebrate with them. If stressed, provide calm validation.",
          temperature: 0.7,
          maxOutputTokens: 1000,
        },
      });

      if (response.text) {
        return response.text;
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error("Gemini generation failed.");
}

async function actionPlan(prompt: string, reflection: string) {
  const ai = new GoogleGenAI({ apiKey: getApiKey() });

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Create a concise action plan from this journal entry and reflection.

Journal:
${prompt}

Reflection:
${reflection}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        'Return ONLY valid JSON with exactly these keys: "keyInsight", "practicalNextStep", "smallActionToday", "goalToRevisitLater".',
      temperature: 0.5,
      maxOutputTokens: 800,
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("No action plan was generated.");
  }

  return JSON.parse(response.text);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const path = String(req.url || "")
  .split("?")[0]
  .replace(/^\/api\/?/, "")
  .replace(/^\/+/, "");

    if (req.method === "GET" && path === "health") {
      return res.status(200).json({
        status: "ok",
        app: "Personal Gemini Journal",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    if (path === "journal/reflect") {
      const { prompt, history } = req.body || {};

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
          error: "A valid journal entry prompt is required.",
        });
      }

      const reflection = await reflect(prompt.trim(), Array.isArray(history) ? history : []);

      return res.status(200).json({
        success: true,
        reflection,
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "journal/action-plan") {
      const { prompt, reflection } = req.body || {};

      if (!prompt || !reflection) {
        return res.status(400).json({
          error: "Journal entry and reflection are required.",
        });
      }

      const plan = await actionPlan(prompt, reflection);

      return res.status(200).json({
        success: true,
        actionPlan: plan,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(404).json({
      error: `Unknown API route: ${path}`,
    });
  } catch (error: any) {
    console.error("API error:", error);

    return res.status(500).json({
      error: error?.message || "Internal server error",
      isApiKeyMissing: String(error?.message || "").includes("GEMINI_API_KEY"),
    });
  }
}