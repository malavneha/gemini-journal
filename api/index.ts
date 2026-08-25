 
                
      export const maxDuration = 60;

const MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
];

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Vercel.");
  }

  return key;
}

async function callGemini(
  model: string,
  body: any,
  timeoutMs = 8000
): Promise<any> {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
        getApiKey()
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const text = await response.text();

    let data: any;

    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(
        `Gemini returned a non-JSON response (${response.status}).`
      );
    }

    if (!response.ok) {
      const message =
        data?.error?.message ||
        `Gemini request failed with status ${response.status}.`;

      const error: any = new Error(message);
      error.status = response.status;
      throw error;
    }

    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(data: any): string {
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: any) => part?.text || "")
      .join("")
      .trim() || ""
  );
}

async function generateWithFallback(
  body: any
): Promise<{ text: string; model: string }> {
  let lastError: any = null;

  for (const model of MODELS) {
    try {
      const data = await callGemini(model, body, 8000);

      const text = extractText(data);

      if (text) {
        return {
          text,
          model,
        };
      }

      lastError = new Error(
        `${model} returned an empty response.`
      );
    } catch (error: any) {
      lastError = error;

      console.error(
        `Gemini model ${model} failed:`,
        error?.message || error
      );

      // Immediately try the next model for overload,
      // rate-limit, timeout, or other Gemini errors.
    }
  }

  throw (
    lastError ||
    new Error("All Gemini models failed.")
  );
}

async function reflect(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
) {
  const contents = [
    ...history.slice(-4).map((message) => ({
      role:
        message.role === "assistant" ||
        message.role === "model"
          ? "model"
          : "user",
      parts: [
        {
          text: String(message.text).slice(0, 1200),
        },
      ],
    })),
    {
      role: "user",
      parts: [
        {
          text: prompt.slice(0, 5000),
        },
      ],
    },
  ];

  return generateWithFallback({
    contents,
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.7,
    },
    systemInstruction: {
      parts: [
        {
          text:
            "You are an empathetic and thoughtful personal journaling companion. " +
            "Give warm, concise reflective feedback. " +
            "Validate emotions when appropriate, identify one useful insight, " +
            "and ask one gentle reflective question. " +
            "Keep the response under 150 words.",
        },
      ],
    },
  });
}

async function actionPlan(
  prompt: string,
  reflection: string
) {
  return generateWithFallback({
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
    generationConfig: {
      maxOutputTokens: 400,
      temperature: 0.4,
      responseMimeType: "application/json",
    },
    systemInstruction: {
      parts: [
        {
          text:
            'Return ONLY valid JSON with exactly these four string keys: ' +
            '"keyInsight", "practicalNextStep", "smallActionToday", "goalToRevisitLater".',
        },
      ],
    },
  });
}

function getPath(req: any): string {
  const queryPath = String(req.query?.path || "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  if (queryPath) {
    return queryPath;
  }

  const urlPath = String(req.url || "")
    .split("?")[0]
    .replace(/^\/api\/?/, "")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");

  return urlPath;
}

export default async function handler(
  req: any,
  res: any
) {
  try {
    const path = getPath(req);

    // Health check
    if (
      req.method === "GET" &&
      path === "health"
    ) {
      return res.status(200).json({
        status: "ok",
        app: "Personal Gemini Journal",
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY
        ),
        models: MODELS,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    // Reflection
    if (path === "journal/reflect") {
      const body = req.body || {};

      const prompt = body.prompt;
      const history = body.history;

      if (
        !prompt ||
        typeof prompt !== "string" ||
        !prompt.trim()
      ) {
        return res.status(400).json({
          error:
            "A valid journal entry prompt is required.",
        });
      }

      const safeHistory = Array.isArray(history)
        ? history
            .filter(
              (item: any) =>
                item &&
                typeof item.text === "string"
            )
            .map((item: any) => ({
              role:
                item.role === "assistant" ||
                item.role === "model"
                  ? "model"
                  : "user",
              text: String(item.text).slice(
                0,
                1200
              ),
            }))
        : [];

      const result = await reflect(
        prompt.trim(),
        safeHistory
      );

      return res.status(200).json({
        success: true,
        reflection: result.text,
        modelUsed: result.model,
        timestamp:
          new Date().toISOString(),
      });
    }

    // Action plan
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
          error: "Reflection is required.",
        });
      }

      const result = await actionPlan(
        prompt.trim(),
        reflection.trim()
      );

      let cleanText = result.text.trim();

      if (cleanText.startsWith("```")) {
        cleanText = cleanText
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/i, "")
          .trim();
      }

      const parsed = JSON.parse(cleanText);

      return res.status(200).json({
        success: true,
        actionPlan: parsed,
        modelUsed: result.model,
        timestamp:
          new Date().toISOString(),
      });
    }

    return res.status(404).json({
      error: `Unknown API route: ${path}`,
    });
  } catch (error: any) {
    console.error("API error:", error);

    const message =
      error?.name === "AbortError"
        ? "Gemini request timed out. Please try again."
        : error?.message ||
          "Gemini request failed.";

    return res.status(500).json({
      success: false,
      error: message,
      isApiKeyMissing:
        message.includes("GEMINI_API_KEY"),
    });
  }
}