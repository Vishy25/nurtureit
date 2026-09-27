/** Generic structured-output AI call with provider fallback. Server-only. */
export const FALLBACK_MODEL = "google/gemini-3-flash-preview";

class Retryable extends Error {}

async function call(model: string, instructions: string, input: string, name: string, schema: object) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: instructions }, { role: "user", content: input }],
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
    }),
  });
  if (!res.ok) {
    if (res.status === 429 || res.status >= 500) throw new Retryable(`AI request failed (${res.status})`);
    throw new Error(res.status === 402 ? "AI credits are used up. Add credits in Settings → Plans & credits." : `AI request failed (${res.status}).`);
  }
  const j: any = await res.json();
  const text = j.choices?.[0]?.message?.content;
  if (!text) throw new Error("The AI returned no answer.");
  return JSON.parse(text);
}

export async function structuredCall<T>(model: string, instructions: string, input: string, name: string, schema: object): Promise<T & { model_used: string }> {
  try {
    return { ...(await call(model, instructions, input, name, schema)), model_used: model };
  } catch (e) {
    if (!(e instanceof Retryable)) throw e;
    return { ...(await call(FALLBACK_MODEL, instructions, input, name, schema)), model_used: FALLBACK_MODEL };
  }
}
