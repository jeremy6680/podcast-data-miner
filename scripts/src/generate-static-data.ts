import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fetchAndParseFeed } from "../../artifacts/api-server/src/sync/rss";
import { extractThemesForEpisode } from "../../artifacts/api-server/src/sync/themes";
import { extractToolsForEpisode } from "../../artifacts/api-server/src/sync/tools";

const DEFAULT_OUTPUT = "artifacts/datagen-explorer/public/static-data.json";
const REPO_ROOT = path.resolve(import.meta.dirname, "../..");

function getOutputPath(): string {
  const outputArg = process.argv.find((arg) => arg.startsWith("--output="));
  return outputArg?.slice("--output=".length) || process.env.STATIC_DATA_OUTPUT || DEFAULT_OUTPUT;
}

function shouldExtractThemes(): boolean {
  return !process.argv.includes("--no-themes") && process.env.STATIC_EXTRACT_THEMES !== "false";
}

async function main() {
  const configuredOutput = getOutputPath();
  const outputPath = path.isAbsolute(configuredOutput)
    ? configuredOutput
    : path.resolve(REPO_ROOT, configuredOutput);
  const extractThemes = shouldExtractThemes();

  const { items } = await fetchAndParseFeed();

  const numberToId = new Map<string, string>();
  for (const item of items) {
    if (item.episodeNumber != null) {
      numberToId.set(`${item.podcastSlug}:${item.episodeNumber}`, item.id);
    }
  }

  const episodes = await Promise.all(
    items.map(async (item) => {
      const relatedLinks = item.relatedLinks.map((link) => {
        const key = link.episodeNumber != null ? `${item.podcastSlug}:${link.episodeNumber}` : null;
        return {
          ...link,
          episodeId: key && numberToId.has(key) ? numberToId.get(key)! : null,
        };
      });

      const themes = extractThemes
        ? await extractThemesForEpisode({
            id: item.id,
            title: item.title,
            summary: item.summary,
            descriptionText: item.descriptionText,
          })
        : [];

      return {
        id: item.id,
        podcastSlug: item.podcastSlug,
        podcastName: item.podcastName,
        podcastAuthor: item.podcastAuthor,
        episodeNumber: item.episodeNumber,
        title: item.title,
        summary: item.summary,
        descriptionHtml: item.descriptionHtml,
        descriptionText: item.descriptionText,
        pubDate: item.pubDate.toISOString(),
        durationSec: item.durationSec,
        audioUrl: item.audioUrl,
        link: item.link,
        imageUrl: item.imageUrl,
        language: item.language,
        themes,
        tools: extractToolsForEpisode(item),
        recommendations: item.recommendations,
        chapters: item.chapters,
        relatedLinks,
      };
    }),
  );

  episodes.sort((a, b) => b.pubDate.localeCompare(a.pubDate));
  process.env.DATABASE_URL ??= "postgres://static-build:static-build@localhost:5432/static-build";
  const { aggregateResourcesFromEpisodes } = await import(
    "../../artifacts/api-server/src/routes/resources"
  );
  const resources = aggregateResourcesFromEpisodes(
    episodes.map((episode) => ({
      id: episode.id,
      episodeNumber: episode.episodeNumber ?? null,
      title: episode.title,
      pubDate: new Date(episode.pubDate),
      themes: episode.themes,
      recommendations: episode.recommendations,
    })),
    { limit: Number.MAX_SAFE_INTEGER, offset: 0 },
  ).items;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(
    outputPath,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), episodes, resources }, null, 2)}\n`,
    "utf8",
  );

  console.log(`Generated ${episodes.length} episodes and ${resources.length} resources at ${outputPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
