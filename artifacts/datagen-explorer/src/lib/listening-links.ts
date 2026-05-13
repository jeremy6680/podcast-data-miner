export type ListeningPlatform = "source" | "apple" | "spotify";

export type ListeningLink = {
  platform: ListeningPlatform;
  label: string;
  url: string;
  isExact: boolean;
};

type ListeningLinkInput = {
  title: string;
  podcastName: string;
  link?: string | null;
  descriptionHtml?: string | null;
};

function platformForUrl(rawUrl: string): ListeningPlatform {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace(/^www\./, "");
    if (host === "podcasts.apple.com") return "apple";
    if (host === "open.spotify.com") return "spotify";
  } catch {
    return "source";
  }
  return "source";
}

function labelForPlatform(platform: ListeningPlatform): string {
  if (platform === "apple") return "Apple Podcasts";
  if (platform === "spotify") return "Spotify";
  return "Source";
}

function searchQuery(input: ListeningLinkInput): string {
  return `${input.podcastName} ${input.title}`.replace(/\s+/g, " ").trim();
}

function plainWords(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function spotifySearchQuery(input: ListeningLinkInput): string {
  const titleMatch = input.title.match(/^#?(\d+)\s*[-–—:]\s*(.*)$/);
  if (!titleMatch) return plainWords(searchQuery(input));

  const episodeNumber = titleMatch[1];
  const title = titleMatch[2] ?? "";
  const guestMatch = title.match(/\b(?:avec|with)\s+(.+)$/i);
  const guest = guestMatch ? plainWords(guestMatch[1] ?? "") : "";

  return plainWords([input.podcastName, episodeNumber, guest].filter(Boolean).join(" "));
}

export function getListeningLinks(input: ListeningLinkInput): ListeningLink[] {
  const links: ListeningLink[] = [];
  const sourceUrl = input.link?.trim();

  if (sourceUrl) {
    const platform = platformForUrl(sourceUrl);
    links.push({
      platform,
      label: labelForPlatform(platform),
      url: sourceUrl,
      isExact: true,
    });
  }

  const query = searchQuery(input);
  const presentPlatforms = new Set(links.map((link) => link.platform));

  if (!presentPlatforms.has("apple")) {
    links.push({
      platform: "apple",
      label: "Apple Podcasts",
      url: `https://podcasts.apple.com/search?term=${encodeURIComponent(query)}`,
      isExact: false,
    });
  }

  if (!presentPlatforms.has("spotify")) {
    const spotifyQuery = spotifySearchQuery(input);
    links.push({
      platform: "spotify",
      label: "Spotify",
      url: `https://open.spotify.com/search/${encodeURIComponent(spotifyQuery)}/episodes`,
      isExact: false,
    });
  }

  return links;
}
