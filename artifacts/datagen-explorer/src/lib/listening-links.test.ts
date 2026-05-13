import test from "node:test";
import assert from "node:assert/strict";
import { getListeningLinks } from "./listening-links";

test("listening links include the exact source and platform searches", () => {
  const links = getListeningLinks({
    title: "#267 - L'agentique accelere",
    podcastName: "DataGen",
    link: "https://shows.acast.com/data-gen/episodes/267-lagentique-accelere",
  });

  assert.deepEqual(
    links.map((link) => link.label),
    ["Source", "Apple Podcasts", "Spotify"],
  );
  assert.equal(links[0]?.url, "https://shows.acast.com/data-gen/episodes/267-lagentique-accelere");
  assert.match(links[1]?.url ?? "", /^https:\/\/podcasts\.apple\.com\/search\?term=/);
  assert.match(links[2]?.url ?? "", /^https:\/\/open\.spotify\.com\/search\//);
});

test("spotify search links use a short punctuation-free query that survives Spotify routing", () => {
  const links = getListeningLinks({
    title: "#267 - L’agentique accélère : quel impact pour l’équipe data ? Avec Blef",
    podcastName: "DataGen",
  });

  const spotifyUrl = links.find((link) => link.platform === "spotify")?.url ?? "";

  assert.equal(
    spotifyUrl,
    "https://open.spotify.com/search/DataGen%20267%20Blef/episodes",
  );
});

test("listening links do not duplicate a source that is already Apple Podcasts", () => {
  const links = getListeningLinks({
    title: "Episode",
    podcastName: "Podcast",
    link: "https://podcasts.apple.com/fr/podcast/example/id123?i=456",
  });

  assert.deepEqual(
    links.map((link) => link.label),
    ["Apple Podcasts", "Spotify"],
  );
  assert.equal(links[0]?.isExact, true);
});

test("listening links do not use unrelated platform links from episode notes", () => {
  const links = getListeningLinks({
    title: "#267 - L'agentique accelere",
    podcastName: "DataGen",
    link: "https://shows.acast.com/data-gen/episodes/267-lagentique-accelere",
    descriptionHtml:
      '<a href="https://podcasts.apple.com/fr/podcast/242-other-episode/id1539383194?i=1000740188611">#242 - Other episode</a>',
  });

  assert.equal(
    links.find((link) => link.platform === "apple")?.isExact,
    false,
  );
});
