import { slugify } from "../lib/slug";

const TOOL_TAXONOMY: { label: string; aliases: string[] }[] = [
  { label: "Airbyte", aliases: ["airbyte"] },
  { label: "Airflow", aliases: ["airflow", "apache airflow"] },
  { label: "Amplitude", aliases: ["amplitude"] },
  { label: "Anthropic", aliases: ["anthropic", "claude"] },
  { label: "Apache Iceberg", aliases: ["apache iceberg", "iceberg"] },
  { label: "AWS", aliases: ["aws", "amazon web services", "sagemaker", "redshift"] },
  { label: "Azure", aliases: ["azure", "microsoft azure"] },
  { label: "BigQuery", aliases: ["bigquery", "google bigquery"] },
  { label: "Census", aliases: ["census"] },
  { label: "ChatGPT", aliases: ["chatgpt"] },
  { label: "Claude Code", aliases: ["claude code"] },
  { label: "ClickHouse", aliases: ["clickhouse"] },
  { label: "Cursor", aliases: ["cursor"] },
  { label: "Dagster", aliases: ["dagster"] },
  { label: "Databricks", aliases: ["databricks"] },
  { label: "dbt", aliases: ["dbt", "dbt labs", "dbt cloud", "dbt core"] },
  { label: "Fivetran", aliases: ["fivetran"] },
  { label: "GitHub Copilot", aliases: ["github copilot", "copilot"] },
  { label: "Google Cloud", aliases: ["google cloud", "gcp", "vertex ai"] },
  { label: "Hex", aliases: ["hex"] },
  { label: "Hightouch", aliases: ["hightouch"] },
  { label: "Kafka", aliases: ["kafka", "apache kafka"] },
  { label: "Lakekeeper", aliases: ["lakekeeper"] },
  { label: "LanceDB", aliases: ["lancedb", "lance db"] },
  { label: "Lightdash", aliases: ["lightdash"] },
  { label: "Looker", aliases: ["looker", "looker studio"] },
  { label: "Metabase", aliases: ["metabase"] },
  { label: "MetricFlow", aliases: ["metricflow", "metricsflow"] },
  { label: "Mixpanel", aliases: ["mixpanel"] },
  { label: "Nao", aliases: ["getnao", "nao"] },
  { label: "Omni", aliases: ["omni"] },
  { label: "OpenAI", aliases: ["openai", "gpt-5", "gpt-4", "gpt-4o"] },
  { label: "OpenClaw", aliases: ["openclaw", "open claw"] },
  { label: "PostgreSQL", aliases: ["postgres", "postgresql"] },
  { label: "Power BI", aliases: ["power bi", "powerbi"] },
  { label: "Segment", aliases: ["segment"] },
  { label: "Sigma", aliases: ["sigma"] },
  { label: "Snowflake", aliases: ["snowflake", "snowpark", "cortex"] },
  { label: "SYNQ", aliases: ["synq"] },
  { label: "Tableau", aliases: ["tableau"] },
];

export const TOOL_LABELS: Record<string, string> = Object.fromEntries(
  TOOL_TAXONOMY.map((tool) => [slugify(tool.label), tool.label]),
);

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function includesAlias(text: string, alias: string): boolean {
  const normalized = normalizeText(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${normalized}([^a-z0-9]|$)`, "i").test(text);
}

export interface EpisodeForToolExtraction {
  title: string;
  summary?: string | null;
  descriptionText?: string;
  recommendations?: Array<{ title?: string; url?: string }>;
}

export function extractToolsForEpisode(episode: EpisodeForToolExtraction): string[] {
  const text = normalizeText(
    [
      episode.title,
      episode.summary ?? "",
      episode.descriptionText ?? "",
      ...(episode.recommendations ?? []).flatMap((r) => [r.title ?? "", r.url ?? ""]),
    ].join("\n"),
  );

  return TOOL_TAXONOMY
    .filter((tool) => tool.aliases.some((alias) => includesAlias(text, alias)))
    .map((tool) => slugify(tool.label))
    .slice(0, 12);
}
