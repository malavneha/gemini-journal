 export const maxDuration = 60;

const MODEL = "gemini-2.5-flash-lite";

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured in Vercel.");
  }

  return key;
}

async function callGemini(
  prompt: string,
  history: Array<{ role: string; text: string }> = []
): Promise<string> {
  const controller = new AbortController();

  // Never allow Gemini to keep the Vercel function waiting.
  const timeout = setTimeout(() => {
    controller.abort();
  }, 7000);

  try {
    const contents = [
      ...history.slice(-4).map((message) => ({
        role:
          message.role === "assistant" || message.role === "model"
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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
        getApiKey()
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents,
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
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 300,
          },
        }),
        signal: controller.signal,
      }
    );

    const rawText = await response.text();

    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Gemini returned an invalid response (${response.status}).`
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

    const text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      throw new Error("Gemini returned an empty reflection.");
    }

    return text;
  } finally {
    clearTimeout(timeout);
  }
}

async function createActionPlan(
  prompt: string,
  reflection: string
) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, 7000);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(
        getApiKey()
      )}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
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
          systemInstruction: {
            parts: [
              {
                text:
                  'Return ONLY valid JSON with exactly these four string keys: ' +
                  '"keyInsight", "practicalNextStep", "smallActionToday", "goalToRevisitLater".',
              },
            ],
          },
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 400,
            responseMimeType: "application/json",
          },
        }),
        signal: controller.signal,
      }
    );

    const rawText = await response.text();

    let data: any;

    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(
        `Gemini returned an invalid response (${response.status}).`
      );
    }

    if (!response.ok) {
      throw new Error(
        data?.error?.message ||
          `Gemini request failed with status ${response.status}.`
      );
    }

    let text =
      data?.candidates?.[0]?.content?.parts
        ?.map((part: any) => part?.text || "")
        .join("")
        .trim() || "";

    if (!text) {
      throw new Error("Gemini returned an empty action plan.");
    }

    if (text.startsWith("```")) {
      text = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
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

    // HEALTH CHECK
    if (req.method === "GET" && path === "health") {
      return res.status(200).json({
        status: "ok",
        app: "Personal Gemini Journal",
        geminiConfigured: Boolean(
          process.env.GEMINI_API_KEY
        ),
        model: MODEL,
      });
    }

    if (req.method !== "POST") {
      return res.status(405).json({
        error: "Method not allowed",
      });
    }

    // REFLECTION
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

      try {
        const reflection = await callGemini(
          prompt.trim(),
          safeHistory
        );

        return res.status(200).json({
          success: true,
          reflection,
          modelUsed: MODEL,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return res.status(504).json({
            success: false,
            error:
              "Gemini took too long to respond. Please try again.",
          });
        }

        throw error;
      }
    }

    // ACTION PLAN
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

      try {
        const actionPlan = await createActionPlan(
          prompt.trim(),
          reflection.trim()
        );

        return res.status(200).json({
          success: true,
          actionPlan,
          modelUsed: MODEL,
          timestamp: new Date().toISOString(),
        });
      } catch (error: any) {
        if (error?.name === "AbortError") {
          return res.status(504).json({
            success: false,
            error:
              "Gemini took too long to create the action plan.",
          });
        }

        throw error;
      }
    }

    return res.status(404).json({
      error: `Unknown API route: ${path}`,
    });
  } catch (error: any) {
    console.error("API error:", error);

    return res.status(500).json({
      success: false,
      error:
        error?.message ||
        "Gemini request failed.",
      isApiKeyMissing: String(
        error?.message || ""
      ).includes("GEMINI_API_KEY"),
    });
  }
}
                
      
      
        