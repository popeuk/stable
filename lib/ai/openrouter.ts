import type { Command, InterpretContext } from "@/lib/domain/interpret";
import { sanitizeCommand } from "@/lib/domain/interpret";

/**
 * L'oreille LLM de l'assistant, via OpenRouter en mode BYOK : la clé est
 * celle de l'utilisateur, saisie dans Réglages et stockée uniquement sur son
 * appareil — jamais dans le code ni le dépôt. Toute réponse passe par
 * sanitizeCommand (noms résolus localement, types et montants bornés) et le
 * moindre échec rend null : l'appelant retombe sur l'interpréteur local.
 */
const MODEL = "openai/gpt-4o-mini";

export async function interpretLLM(
  text: string,
  ctx: InterpretContext,
  apiKey: string,
): Promise<Command | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 9000);
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://popeuk.github.io/stable",
        "X-Title": "Be Stable",
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              `Tu extrais une commande de gestion d'écurie depuis une phrase française. ` +
              `Réponds UNIQUEMENT en JSON: {"kind": string, "horses": string[], "all": boolean, "date": "YYYY-MM-DD", "cost": number|null, "revenue": number|null, "provider": string|null, "label": string|null}. ` +
              `kind parmi: vaccin, vermifuge, ferrure, dentiste, osteo, veto, soin, entrainement, cours_collectif, cours_individuel, concours, document. ` +
              `horses: les noms cités parmi [${ctx.horses.map((h) => h.name).join(", ")}] ; all=true si "tous les chevaux"/"toute l'écurie". ` +
              `Aujourd'hui: ${ctx.today}. Un montant d'un cours/concours est une recette (revenue), sinon un coût (cost). ` +
              `provider: le prestataire cité (Dr X, M. Y). label: l'heure ou le détail court. null quand absent. N'invente rien.`,
          },
          { role: "user", content: text.slice(0, 400) },
        ],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content;
    if (typeof content !== "string") return null;
    return sanitizeCommand(JSON.parse(content), ctx);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
