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

const KEYWORDS: Record<string, string[]> = {
  "data-engineering": ["data engineering", "data engineer", "etl", "elt", "pipeline", "ingestion", "orchestration"],
  "data-science": ["data science", "data scientist", "statistique", "scoring", "algorithme", "prediction", "modèle"],
  "machine-learning": ["machine learning", "ml", "modèle", "model", "recommandation", "ranking", "classification"],
  "ia-generative": ["ia generative", "genai", "generative ai", "chatgpt", "agent", "agentique", "agents ia"],
  llm: ["llm", "large language model", "rag", "prompt", "semantic layer"],
  "data-analytics": ["analytics", "analyse", "analyst", "kpi", "metric", "dashboard", "reporting"],
  "data-product": ["data product", "produit data", "approche produit", "product manager"],
  "data-strategy": ["strategie data", "stratégie data", "roadmap", "priorites", "priorités"],
  "data-platform": ["data platform", "plateforme data", "lakehouse", "databricks", "snowflake", "bigquery"],
  "data-warehouse": ["data warehouse", "warehouse", "dbt", "modelisation", "modélisation", "medaillon", "médaillon"],
  "data-mesh": ["data mesh", "mesh"],
  "data-quality": ["data quality", "qualite des donnees", "qualité des données", "observability", "fiabilite", "fiabilité"],
  "data-governance": ["gouvernance", "governance", "catalog", "data catalog", "data contract", "contract"],
  "data-culture": ["culture data", "acculturation", "adoption", "democratiser", "démocratiser"],
  "data-leadership": ["leadership", "cdo", "vp data", "head of data", "lead data", "chief data"],
  "data-team": ["equipe data", "équipe data", "organisation", "orga", "reorganisation", "réorganisation"],
  recrutement: ["recrutement", "recruter", "onboarding", "hiring"],
  carriere: ["carriere", "carrière", "reconversion", "freelance", "devenir", "lancer sa carrière"],
  experimentation: ["ab testing", "a/b testing", "experimentation", "expérimentation", "test"],
  "analytics-engineering": ["analytics engineering", "analytics engineer", "dbt", "self-service analytics"],
  "business-intelligence": ["business intelligence", "bi", "visualisation", "data visualisation", "dashboard"],
  "real-time": ["temps reel", "temps réel", "real-time", "streaming", "kafka", "clickhouse"],
  mlops: ["mlops", "ml engineering", "industrialiser", "production", "feature store"],
  "produit-tech": ["produit tech", "product", "embedded analytics", "low code"],
  startup: ["startup", "lancer le departement", "lancer le département"],
  "scale-up": ["scale-up", "scaleup", "scaler", "licorne", "centaure"],
  "grand-groupe": ["grand groupe", "groupe", "ministere", "ministère", "sncf", "bnpparibas", "axa"],
  ecommerce: ["e-commerce", "ecommerce", "marketplace", "retail", "carrefour", "back market"],
  fintech: ["fintech", "banque", "paiement", "qonto", "payfit", "pennylane"],
  healthtech: ["healthtech", "sante", "santé", "doctolib", "alan", "sanofi"],
  saas: ["saas", "software", "arr", "b2b"],
  marketplace: ["marketplace", "malt", "vestiaire collective", "leboncoin"],
  media: ["media", "média", "youtube", "arte", "brut"],
  "open-source": ["open source", "oss"],
  cloud: ["cloud", "google cloud", "aws", "azure", "snowflake", "databricks"],
  rgpd: ["rgpd", "privacy", "privee", "privée", "confidentialite", "confidentialité"],
  "monetisation-data": ["monetisation", "monétisation", "revenu", "croissance", "growth", "marketing"],
};

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function inferThemesForEpisode(episode: EpisodeForExtraction): string[] {
  const text = normalizeText(
    [episode.title, episode.summary, episode.descriptionText]
      .filter(Boolean)
      .join("\n"),
  );

  const scored = Object.entries(KEYWORDS)
    .map(([slug, keywords]) => ({
      slug,
      score: keywords.reduce((score, keyword) => {
        const normalizedKeyword = normalizeText(keyword);
        return score + (text.includes(normalizedKeyword) ? 1 : 0);
      }, 0),
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.slug.localeCompare(b.slug));

  return scored.map((item) => item.slug).slice(0, 5);
}

const SYSTEM_PROMPT = `Tu es un classifieur d'épisodes du podcast français "DataGen" (data, IA, tech). Pour chaque épisode, choisis entre 1 et 5 thèmes parmi la taxonomie fournie. Tu ne peux utiliser QUE des slugs présents dans la taxonomie. Renvoie un JSON strict.

Taxonomie autorisée:
${TAXONOMY.map((t) => `- ${t.slug}: ${t.label}`).join("\n")}

Format de sortie strict (un objet JSON):
{"themes": ["slug1", "slug2", ...]}

Choisis les thèmes les plus pertinents pour l'épisode. N'invente jamais de slug. Maximum 5 thèmes.`;

function getUserContent(episode: EpisodeForExtraction): string {
  return [
    `Titre: ${episode.title}`,
    episode.summary ? `Résumé: ${episode.summary}` : "",
    `Description: ${(episode.descriptionText ?? "").slice(0, 4000)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function parseThemes(raw: string): string[] {
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

  return Array.from(
    new Set(
      themesRaw
        .filter((t): t is string => typeof t === "string")
        .map((t) => slugify(t))
        .filter((t) => ALLOWED_SLUGS.has(t)),
    ),
  ).slice(0, 5);
}

function getAnthropicText(response: unknown): string {
  if (!response || typeof response !== "object") return "{}";
  const content = (response as { content?: unknown }).content;
  if (!Array.isArray(content)) return "{}";

  return content
    .map((block) => {
      if (!block || typeof block !== "object") return "";
      const type = (block as { type?: unknown }).type;
      const text = (block as { text?: unknown }).text;
      return type === "text" && typeof text === "string" ? text : "";
    })
    .join("")
    .trim();
}

function getGeminiText(response: unknown): string {
  if (!response || typeof response !== "object") return "{}";
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "{}";

  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const content = (candidate as { content?: unknown }).content;
      if (!content || typeof content !== "object") return [];
      const parts = (content as { parts?: unknown }).parts;
      if (!Array.isArray(parts)) return [];
      return parts.map((part) => {
        if (!part || typeof part !== "object") return "";
        const text = (part as { text?: unknown }).text;
        return typeof text === "string" ? text : "";
      });
    })
    .join("")
    .trim();
}

async function extractThemesWithGemini(
  episode: EpisodeForExtraction,
): Promise<string[]> {
  const baseUrl = (
    process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"
  ).replace(/\/+$/, "");
  const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

  const response = await fetch(
    `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: getUserContent(episode) }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
        generationConfig: {
          maxOutputTokens: 300,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Gemini theme extraction failed: ${response.status} ${message}`);
  }

  return parseThemes(getGeminiText(await response.json()));
}

async function extractThemesWithAnthropic(
  episode: EpisodeForExtraction,
): Promise<string[]> {
  const baseUrl = (
    process.env.ANTHROPIC_BASE_URL ?? "https://api.anthropic.com"
  ).replace(/\/+$/, "");
  const model = process.env.ANTHROPIC_MODEL ?? "claude-3-5-haiku-latest";

  const response = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: getUserContent(episode) }],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Anthropic theme extraction failed: ${response.status} ${message}`);
  }

  return parseThemes(getAnthropicText(await response.json()));
}

async function extractThemesWithOpenAI(
  episode: EpisodeForExtraction,
): Promise<string[]> {
  const { openai } = await import("@workspace/integrations-openai-ai-server");

  const completion = await openai.chat.completions.create({
    model: "gpt-5-mini",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: getUserContent(episode) },
    ],
    response_format: { type: "json_object" },
  });

  return parseThemes(completion.choices[0]?.message?.content ?? "{}");
}

export interface EpisodeForExtraction {
  id: string;
  title: string;
  summary?: string | null;
  descriptionText?: string;
}

export async function extractThemesForEpisode(
  episode: EpisodeForExtraction,
): Promise<string[]> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const themes = await extractThemesWithGemini(episode);
      if (themes.length > 0) return themes;
    } catch {
      // Fall through to the next configured provider or local inference.
    }
  }

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const themes = await extractThemesWithAnthropic(episode);
      if (themes.length > 0) return themes;
    } catch {
      // Fall through to the next configured provider or local inference.
    }
  }

  if (
    process.env.AI_INTEGRATIONS_OPENAI_BASE_URL &&
    process.env.AI_INTEGRATIONS_OPENAI_API_KEY
  ) {
    try {
      const themes = await extractThemesWithOpenAI(episode);
      if (themes.length > 0) return themes;
    } catch {
      // Fall through to local inference.
    }
  }

  return inferThemesForEpisode(episode);
}
