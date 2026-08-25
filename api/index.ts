
      
    
     import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

const MODEL = "gemini-3.5-flash-lite";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Vercel.");
  }

  return key;
}

function createAI() {
  return new GoogleGenAI({
    apiKey: getApiKey(),
    httpOptions: {
      timeout: 15000,
      retryOptions: {
        attempts: 1,
      },
    },
  });
}

async function reflect(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
) {
  const ai = createAI();

  const contents = [
    ...history.slice(-4).map((message) => ({
      role:
        message.role === "assistant" || message.role === "model"
          ? "model"
          : "user",
      parts: [
        {
          text: String(message.text).slice(0, 1500),
        },
      ],
    })),
    {
      role: "user",
      parts: [
        {
          text: prompt,
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: {
      systemInstruction:
        "You are an empathetic and thoughtful personal journaling companion. " +
        "Give a warm, concise reflection on the user's journal entry. " +
        "Validate emotions when appropriate, highlight one useful insight, " +
        "and end with one gentle reflective question. " +
        "Keep the response under 150 words.",
      maxOutputTokens: 300,
      thinkingConfig: {
        thinkingLevel: "minimal",
      },
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty reflection.");
  }

  return response.text;
}

async function actionPlan(
  prompt: string,
  reflection: string
) {
  const ai = createAI();

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Create a concise action plan from this journal entry and reflection.\n\n` +
              `Journal:\n${prompt}\n\n` +
              `Reflection:\n${reflection}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction:
        'Return ONLY valid JSON with exactly these four string keys: ' +
        '"keyInsight", "practicalNextStep", "smallActionToday", "goalToRevisitLater".',
      maxOutputTokens: 400,
      thinkingConfig: {
        thinkingLevel: "minimal",
      },
      responseMimeType: "application/json",
    },
  });

  if (!response.text) {
    throw new Error("Gemini returned an empty action plan.");
  }

  let cleanText = response.text.trim();

  if (cleanText.startsWith("```")) {
    cleanText = cleanText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  const parsed = JSON.parse(cleanText);

  if (
    typeof parsed.keyInsight !== "string" ||
    typeof parsed.practicalNextStep !== "string" ||
    typeof parsed.smallActionToday !== "string" ||
    typeof parsed.goalToRevisitLater !== "string"
  ) {
    throw new Error("Gemini returned an invalid action plan.");
  }

  return {
    keyInsight: parsed.keyInsight.trim(),
    practicalNextStep: parsed.practicalNextStep.trim(),
    smallActionToday: parsed.smallActionToday.trim(),
    goalToRevisitLater: parsed.goalToRevisitLater.trim(),
  };
}

export default async function handler(req: any, res: any) {
  try {
    const path = String(req.query?.path || "").replace(/^\/+/, "");

    if (req.method === "GET" && path === "health") {
      return res.status(200).json({
        status: "ok",
        app: "Personal Gemini Journal",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    if (path === "journal/reflect") {
      const body = req.body || {};
      const prompt = body.prompt;
      const history = body.history;

      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return res.status(400).json({
          error: "A valid journal entry prompt is required.",
        });
      }

      if (prompt.length > 5000) {
        return res.status(400).json({
          error: "Journal entry is too long.",
        });
      }

      const safeHistory = Array.isArray(history)
        ? history
            .filter(
              (item: any) =>
                item &&
                typeof item === "object" &&
                typeof item.text === "string"
            )
            .map((item: any) => ({
              role:
                item.role === "assistant" || item.role === "model"
                  ? "model"
                  : "user",
              text: String(item.text).slice(0, 1500),
            }))
        : [];

      const reflection = await reflect(
        prompt.trim(),
        safeHistory
      );

      return res.status(200).json({
        success: true,
        reflection,
        modelUsed: MODEL,
        timestamp: new Date().toISOString(),
      });
    }

    if (path === "journal/action-plan") {
      const body = req.body || {};
      const prompt = body.prompt;
      const reflection = body.reflection;

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          error: "Journal entry is required.",
        });
      }

      if (
        !reflection ||
        typeof reflection !== "string" ||
        !reflection.trim()
      ) {
        return res.status(400).json({
          error: "Gemini reflection is required.",
        });
      }

      const plan = await actionPlan(
        prompt.trim(),
        reflection.trim()
      );

      return res.status(200).json({
        success: true,
        actionPlan: plan,
        modelUsed: MODEL,
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(404).json({
      error: `Unknown API route: ${path}`,
    });
  } catch (error: any) {
    console.error("API error:", error);

    const message =
      error?.message ||
      "Gemini request failed. Please try again.";

    return res.status(500).json({
      success: false,
      error: message,
      isApiKeyMissing: message.includes("GEMINI_API_KEY"),
    });
  }
}