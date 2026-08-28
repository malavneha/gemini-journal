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

/*
 * Gemini can temporarily return 503 when a model is busy.
 * Instead of failing immediately, try another stable model.
 */
const GEMINI_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
];

function isTemporaryGeminiError(error: any): boolean {
  const status = getErrorStatus(error);
  const message = getErrorMessage(error).toUpperCase();

  return (
    status === 503 ||
    status === 429 ||
    message.includes("UNAVAILABLE") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("HIGH DEMAND") ||
    message.includes("OVERLOADED")
  );
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateWithFallback(
  ai: GoogleGenAI,
  request: any
) {
  let lastError: any = null;

  for (let i = 0; i < GEMINI_MODELS.length; i++) {
    const model = GEMINI_MODELS[i];

    try {
      console.log(`Trying Gemini model: ${model}`);

      const response = await ai.models.generateContent({
        ...request,
        model,
        config: {
          ...(request.config || {}),
          httpOptions: {
            timeout: 20000,
          },
        },
      });

      if (!response.text) {
        throw new Error("Gemini returned an empty response.");
      }

      console.log(`Gemini succeeded with model: ${model}`);

      return {
        response,
        model,
      };
    } catch (error: any) {
      lastError = error;

      const status = getErrorStatus(error);
      const message = getErrorMessage(error);

      console.error(`Gemini ${model} failed:`, {
        status,
        message,
      });

      if (!isTemporaryGeminiError(error)) {
        throw error;
      }

      if (i < GEMINI_MODELS.length - 1) {
        await sleep(500);
      }
    }
  }

  throw lastError || new Error("All Gemini models failed.");
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
    const result = await generateWithFallback(ai, {
      contents,

      config: {
        systemInstruction:
          "You are an empathetic, supportive and thoughtful personal journaling companion. Give warm, concise reflective feedback. Ask one gentle follow-up question or offer one constructive perspective. If the user celebrates, celebrate with them. If stressed, provide calm validation. Keep the response concise.",

        maxOutputTokens: 350,
      },
    });

    return {
      text: result.response.text,
      model: result.model,
    };
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

    if (status === 408 || message.toLowerCase().includes("timeout")) {
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

  const models = [
    "gemini-3.6-flash",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
  ];

  let lastError: any = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
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
          systemInstruction: `
Return ONLY a valid JSON object.

Do not use markdown.
Do not use code fences.
Do not add explanations before or after the JSON.

The JSON must contain exactly these four string fields:

{
  "keyInsight": "...",
  "practicalNextStep": "...",
  "smallActionToday": "...",
  "goalToRevisitLater": "..."
}
          `,

          temperature: 0.3,
          maxOutputTokens: 500,

          responseMimeType: "application/json",

          httpOptions: {
            timeout: 20000,
          },
        },
      });

      if (!response.text) {
        throw new Error("No action plan was generated.");
      }

      let cleaned = response.text.trim();

      // Remove accidental markdown fences if Gemini adds them.
      cleaned = cleaned
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);

      const requiredKeys = [
        "keyInsight",
        "practicalNextStep",
        "smallActionToday",
        "goalToRevisitLater",
      ];

      const valid =
        parsed &&
        typeof parsed === "object" &&
        requiredKeys.every(
          (key) => typeof parsed[key] === "string"
        );

      if (!valid) {
        throw new Error(
          "Gemini returned an action plan with an invalid structure."
        );
      }

      console.log(`Action plan succeeded with model: ${model}`);

      return parsed;
    } catch (error: any) {
      lastError = error;

      console.error(`Action plan failed with ${model}:`, {
        status: getErrorStatus(error),
        message: getErrorMessage(error),
      });

      const status = getErrorStatus(error);
      const message = getErrorMessage(error);

      // Try another model for temporary Gemini failures.
      if (
        status === 503 ||
        status === 429 ||
        message.includes("UNAVAILABLE") ||
        message.includes("RESOURCE_EXHAUSTED")
      ) {
        continue;
      }

      // If JSON parsing failed, try another model too.
      if (
        message.includes("JSON") ||
        message.includes("action plan")
      ) {
        continue;
      }

      throw error;
    }
  }

  throw lastError || new Error("All Gemini action-plan attempts failed.");
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
        models: GEMINI_MODELS,
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

      const reflectionResult = await reflect(
        prompt.trim(),
        Array.isArray(history) ? history : []
      );

      return res.status(200).json({
        success: true,
        reflection: reflectionResult.text,
        timestamp: new Date().toISOString(),
        modelUsed: reflectionResult.model,
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

      const planResult = await actionPlan(prompt, reflection);

      return res.status(200).json({
        success: true,
        actionPlan: planResult.plan,
        modelUsed: planResult.model,
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

        

        
     