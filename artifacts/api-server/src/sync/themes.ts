import { openai } from "@workspace/integrations-openai-ai-server";
import { slugify } from "../lib/slug";

const TAXONOMY: { slug: string; label: string }[] = [
  { slug: "data-engineering", label: "Data Engineering" },
  { slug: "data-science", label: "Data Science" },
  { slug: "machine-learning", label: "Machine Learning" },
  { slug: "ia-generative", label: "IA Générative" },
  { slug: "llm", label: "LLM" },
  { slug: "data-analytics", label: "Data Analytics" },
  { slug: "data-product", label: "Data Product" },
  { slug: "data-strategy", label: "Data Strategy" },
  { slug: "data-platform", label: "Data Platform" },
  { slug: "data-warehouse", label: "Data Warehouse" },
  { slug: "data-mesh", label: "Data Mesh" },
  { slug: "data-quality", label: "Data Quality" },
  { slug: "data-governance", label: "Data Gouvernance" },
  { slug: "data-culture", label: "Data Culture" },
  { slug: "data-leadership", label: "Data Leadership" },
  { slug: "data-team", label: "Équipes Data" },
  { slug: "recrutement", label: "Recrutement" },
  { slug: "carriere", label: "Carrière" },
  { slug: "experimentation", label: "Expérimentation / AB Testing" },
  { slug: "analytics-engineering", label: "Analytics Engineering" },
  { slug: "business-intelligence", label: "Business Intelligence" },
  { slug: "real-time", label: "Temps Réel / Streaming" },
  { slug: "mlops", label: "MLOps" },
  { slug: "produit-tech", label: "Produit Tech" },
  { slug: "startup", label: "Startup" },
  { slug: "scale-up", label: "Scale-up" },
  { slug: "grand-groupe", label: "Grand Groupe" },
  { slug: "ecommerce", label: "E-commerce" },
  { slug: "fintech", label: "Fintech" },
  { slug: "healthtech", label: "Healthtech" },
  { slug: "saas", label: "SaaS" },
  { slug: "marketplace", label: "Marketplace" },
  { slug: "media", label: "Média" },
  { slug: "open-source", label: "Open Source" },
  { slug: "cloud", label: "Cloud" },
  { slug: "rgpd", label: "RGPD / Privacy" },
  { slug: "monetisation-data", label: "Monétisation Data" },
];

export const THEME_LABELS: Record<string, string> = Object.fromEntries(
  TAXONOMY.map((t) => [t.slug, t.label]),
);

const ALLOWED_SLUGS = new Set(TAXONOMY.map((t) => t.slug));

const SYSTEM_PROMPT = `Tu es un classifieur d'épisodes du podcast français "DataGen" (data, IA, tech). Pour chaque épisode, choisis entre 1 et 5 thèmes parmi la taxonomie fournie. Tu ne peux utiliser QUE des slugs présents dans la taxonomie. Renvoie un JSON strict.

Taxonomie autorisée:
${TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n")}

Format de sortie strict (un objet JSON):
{"themes": ["slug1", "slug2", ...]}

Choisis les thèmes les plus pertinents pour l'épisode. N'invente jamais de slug. Maximum 5 thèmes.`;

export interface EpisodeForExtraction {
  id: string;
  title: string;
  summary?: string | null;
  descriptionText?: string;
}

export async function extractThemesForEpisode(
  episode: EpisodeForExtraction,
): Promise<string[]> {
  const userContent = [
    `Titre: ${episode.title}`,
    episode.summary ? `Résumé: ${episode.summary}` : "",
    `Description: ${(episode.descriptionText ?? "").slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const themesRaw =
    typeof parsed === "object" && parsed && "themes" in parsed
      ? (parsed as { themes?: unknown }).themes
      : null;
  if (!Array.isArray(themesRaw)) return [];
  const themes = themesRaw
    .filter((t): t is string => typeof t === "string")
    .map((t) => slugify(t))
    .filter((t) => ALLOWED_SLUGS.has(t));
  return Array.from(new Set(themes)).slice(0, 5);
}
