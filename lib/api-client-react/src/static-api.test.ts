import test from "node:test";
import assert from "node:assert/strict";
import { createStaticApiFetch, type StaticDataCatalog } from "./static-api";

const catalog: StaticDataCatalog = {
  generatedAt: "2026-04-29T10:00:00.000Z",
  episodes: [
    {
      id: "ep-1",
      podcastSlug: "datagen",
      podcastName: "DataGen",
      podcastAuthor: "Robin Conquet",
      episodeNumber: 1,
      title: "Data Engineering avec Airflow",
      summary: "Pipelines et orchestration",
      descriptionHtml: "<p>Airflow et dbt</p>",
      descriptionText: "Airflow et dbt",
      pubDate: "2026-04-20T00:00:00.000Z",
      durationSec: 3600,
      audioUrl: "https://example.com/1.mp3",
      link: "https://example.com/1",
      imageUrl: "https://example.com/1.jpg",
      language: "fr",
      themes: ["data-engineering"],
      tools: ["airflow", "dbt"],
      recommendations: [],
      chapters: [],
      relatedLinks: [],
    },
    {
      id: "ep-2",
      podcastSlug: "lennys-podcast",
      podcastName: "Lenny's Podcast",
      podcastAuthor: "Lenny Rachitsky",
      episodeNumber: 2,
      title: "Product analytics",
      summary: "Metrics",
      descriptionHtml: "<p>Analytics</p>",
      descriptionText: "Analytics",
      pubDate: "2026-04-22T00:00:00.000Z",
      durationSec: 5400,
      audioUrl: "https://example.com/2.mp3",
      link: "https://example.com/2",
      imageUrl: "https://example.com/2.jpg",
      language: "en",
      themes: ["data-analytics"],
      tools: [],
      recommendations: [],
      chapters: [],
      relatedLinks: [],
    },
  ],
  resources: [
    {
      url: "https://amazon.fr/example",
      title: "High Output Management (Andrew Grove)",
      kind: "book",
      domain: "amazon.fr",
      mentionCount: 1,
      firstMentionAt: "2026-04-20T00:00:00.000Z",
      lastMentionAt: "2026-04-20T00:00:00.000Z",
      themes: ["data-engineering"],
      mentions: [
        {
          episodeId: "ep-1",
          episodeNumber: 1,
          episodeTitle: "Data Engineering avec Airflow",
          episodePubDate: "2026-04-20T00:00:00.000Z",
        },
      ],
    },
  ],
};

test("static API lists episodes with query filters, sort and pagination", async () => {
  const staticFetch = createStaticApiFetch(async () => catalog);

  const result = await staticFetch(
    "/api/episodes?themes=data-engineering&sortBy=pub_date&sortOrder=desc&limit=10&offset=0",
  );

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.id, "ep-1");
  assert.equal(result.items[0]?.descriptionHtml, undefined);
});

test("static API returns detailed episodes by id", async () => {
  const staticFetch = createStaticApiFetch(async () => catalog);

  const result = await staticFetch("/api/episodes/ep-2");

  assert.equal(result.id, "ep-2");
  assert.equal(result.descriptionText, "Analytics");
});

test("static API serves precomputed normalized resources", async () => {
  const staticFetch = createStaticApiFetch(async () => catalog);

  const result = await staticFetch("/api/resources?kind=book");

  assert.equal(result.total, 1);
  assert.equal(result.items[0]?.title, "High Output Management (Andrew Grove)");
  assert.deepEqual(result.kindCounts, {
    book: 1,
    podcast: 0,
    video: 0,
    article: 0,
    profile: 0,
    other: 0,
  });
});
