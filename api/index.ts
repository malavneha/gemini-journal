export const maxDuration = 60;

import { GoogleGenAI } from "@google/genai";

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Vercel.");
  }

  return key;
}

function getErrorStatus(error: any): number | null {
  return (
    error?.status ??
    error?.code ??
    error?.error?.code ??
    error?.response?.status ??
    null
  );
}

function getErrorMessage(error: any): string {
  return (
    error?.message ||
    error?.error?.message ||
    "Gemini request failed."
  );
}

async function reflect(prompt: string, history: any[] = []) {
  const ai = new GoogleGenAI({
    apiKey: getApiKey(),
  });

  const contents = [
    ...history.slice(-6).map((m) => ({
      role:
        m.role === "assistant" || m.role === "model"
          ? "model"
          : "user",
      parts: [
        {
          text: String(m.text || "").slice(0, 1500),
        },
      ],
    })),

    {
      role: "user",
      parts: [
        {
          text: prompt.slice(0, 4000),
        },
      ],
    },
  ];

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents,

      config: {
        systemInstruction:
          "You are an empathetic, supportive and thoughtful personal journaling companion. Give warm, concise reflective feedback. Ask one gentle follow-up question or offer one constructive perspective. If the user celebrates, celebrate with them. If stressed, provide calm validation. Keep the response concise.",

        maxOutputTokens: 350,

        temperature: 0.7,

        httpOptions: {
          timeout: 20000,

          retryOptions: {
            attempts: 1,
            httpStatusCodes: [],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error("Gemini returned an empty response.");
    }

    return response.text;
  } catch (error: any) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);

    console.error("Gemini reflection error:", {
      status,
      message,
    });

    if (status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Gemini quota is temporarily exhausted. Please wait and try again later."
      );
    }

    if (status === 503 || message.includes("UNAVAILABLE")) {
      throw new Error(
        "Gemini is temporarily unavailable. Please try again shortly."
      );
    }

    if (status === 408 || message.includes("timeout")) {
      throw new Error(
        "Gemini took too long to respond. Please try again."
      );
    }

    throw new Error(message);
  }
}

async function actionPlan(prompt: string, reflection: string) {
  const ai = new GoogleGenAI({
    apiKey: getApiKey(),
  });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash-lite",

      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Create a concise action plan from this journal entry and reflection.

Journal:
${prompt.slice(0, 3000)}

Reflection:
${reflection.slice(0, 3000)}`,
            },
          ],
        },
      ],

      config: {
        systemInstruction:
          'Return ONLY valid JSON with exactly these keys: "keyInsight", "practicalNextStep", "smallActionToday", "goalToRevisitLater".',

        temperature: 0.5,

        maxOutputTokens: 500,

        responseMimeType: "application/json",

        httpOptions: {
          timeout: 20000,

          retryOptions: {
            attempts: 1,
            httpStatusCodes: [],
          },
        },
      },
    });

    if (!response.text) {
      throw new Error("No action plan was generated.");
    }

    try {
      return JSON.parse(response.text);
    } catch {
      throw new Error("Gemini returned invalid action-plan JSON.");
    }
  } catch (error: any) {
    const status = getErrorStatus(error);
    const message = getErrorMessage(error);

    console.error("Gemini action-plan error:", {
      status,
      message,
    });

    if (status === 429 || message.includes("RESOURCE_EXHAUSTED")) {
      throw new Error(
        "Gemini quota is temporarily exhausted. Please wait and try again later."
      );
    }

    throw new Error(message);
  }
}

export default async function handler(req: any, res: any) {
  try {
    const path = String(req.query?.path || "").replace(/^\/+/, "");

    // Health check
    if (req.method === "GET" && path === "health") {
      return res.status(200).json({
        status: "ok",
        app: "Personal Gemini Journal",
        geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
        model: "gemini-3.5-flash-lite",
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    // Journal reflection
    if (path === "journal/reflect") {
      const { prompt, history } = req.body || {};

      if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
          success: false,
          error: "A valid journal entry prompt is required.",
        });
      }

      const reflection = await reflect(
        prompt.trim(),
        Array.isArray(history) ? history : []
      );

      return res.status(200).json({
        success: true,
        reflection,
        timestamp: new Date().toISOString(),
        modelUsed: "gemini-3.5-flash-lite",
      });
    }

    // Action plan
    if (path === "journal/action-plan") {
      const { prompt, reflection } = req.body || {};

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !reflection ||
        typeof reflection !== "string"
      ) {
        return res.status(400).json({
          success: false,
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
      success: false,
      error: `Unknown API route: ${path}`,
    });
  } catch (error: any) {
    console.error("API error:", error);

    const message = getErrorMessage(error);
    const status = getErrorStatus(error);

    if (
      status === 429 ||
      message.includes("quota") ||
      message.includes("RESOURCE_EXHAUSTED")
    ) {
      return res.status(429).json({
        success: false,
        error:
          "Gemini quota is temporarily exhausted. Please wait and try again later.",
      });
    }

    return res.status(500).json({
      success: false,
      error: message || "Internal server error.",
      isApiKeyMissing: message.includes("GEMINI_API_KEY"),
    });
  }
}