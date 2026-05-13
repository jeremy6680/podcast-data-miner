import { useEffect, useRef } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  useGetEpisode,
  useGetRelatedEpisodes,
  type EpisodeSummary,
  type RecommendationKind,
} from "@workspace/api-client-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  ChevronLeft,
  Play,
  BookOpen,
  Podcast,
  Video,
  Newspaper,
  User,
  ExternalLink,
  Clock,
  Calendar,
  AudioLines,
} from "lucide-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDurationFromSeconds, formatRelativeDateFR } from "@/lib/format";
import { getListeningLinks } from "@/lib/listening-links";

function formatTimecode(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const KIND_ICONS: Record<RecommendationKind, React.ElementType> = {
  book: BookOpen,
  podcast: Podcast,
  video: Video,
  article: Newspaper,
  profile: User,
  other: ExternalLink,
};

const KIND_LABELS: Record<RecommendationKind, string> = {
  book: "Livres",
  podcast: "Podcasts",
  video: "Vidéos",
  article: "Articles",
  profile: "Profils",
  other: "Liens",
};

export default function Episode() {
  const params = useParams();
  const [, navigate] = useLocation();
  const id = params.id as string;

  const audioRef = useRef<HTMLAudioElement>(null);

  const { data: episode, isLoading, isError } = useGetEpisode(id);

  const { data: relatedEpisodes } = useGetRelatedEpisodes(
    id,
    { limit: 6 },
  );

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  const handleChapterClick = (timeSec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = timeSec;
      audioRef.current.play().catch(() => {});
    }
  };

  const handleBack = () => navigate("/");

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8 max-w-5xl">
          <Skeleton className="w-40 h-10 mb-8" />
          <div className="flex flex-col md:flex-row gap-8 mb-12">
            <Skeleton className="w-full md:w-72 aspect-square rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-4">
              <Skeleton className="w-24 h-6" />
              <Skeleton className="w-full h-12" />
              <Skeleton className="w-3/4 h-12" />
              <div className="flex gap-2">
                <Skeleton className="w-24 h-8 rounded-full" />
                <Skeleton className="w-24 h-8 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  if (isError || !episode) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-16 max-w-2xl text-center">
          <h1 className="text-2xl font-bold mb-4">Épisode introuvable</h1>
          <p className="text-muted-foreground mb-8">Cet épisode n'existe pas ou a été supprimé.</p>
          <Button onClick={handleBack}>
            <ChevronLeft className="w-4 h-4 mr-2" />
            Retour aux épisodes
          </Button>
        </div>
      </Layout>
    );
  }

  type Reco = { title: string; url: string; kind: RecommendationKind };
  const recommendations = (episode.recommendations ?? []) as Reco[];
  const groupedRecommendations: Partial<Record<RecommendationKind, Reco[]>> = {};
  for (const rec of recommendations) {
    const list = groupedRecommendations[rec.kind] ?? [];
    list.push(rec);
    groupedRecommendations[rec.kind] = list;
  }
  const listeningLinks = getListeningLinks({
    title: episode.title,
    podcastName: episode.podcastName,
    link: episode.link,
    descriptionHtml: episode.descriptionHtml,
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" onClick={handleBack} className="mb-8 -ml-4 text-muted-foreground hover:text-foreground">
          <ChevronLeft className="w-4 h-4 mr-2" />
          Retour aux épisodes
        </Button>

        <div className="flex flex-col md:flex-row gap-8 mb-12">
          {episode.imageUrl ? (
            <img
              src={episode.imageUrl}
              alt={episode.title}
              className="w-full md:w-72 aspect-square object-cover rounded-xl shadow-md border flex-shrink-0"
            />
          ) : (
            <div className="w-full md:w-72 aspect-square rounded-xl border flex items-center justify-center bg-primary/5 text-primary flex-shrink-0">
              <AudioLines className="w-16 h-16 opacity-50" />
            </div>
          )}

          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 text-sm text-muted-foreground font-medium">
              {episode.episodeNumber != null && (
                <>
                  <span className="text-primary font-bold">Épisode #{episode.episodeNumber}</span>
                  <span>•</span>
                </>
              )}
              <Link href={`/?podcasts=${encodeURIComponent(episode.podcastSlug)}`} className="hover:text-primary transition-colors">
                {episode.podcastName}
              </Link>
              <span>•</span>
              <div
                className="flex items-center gap-1.5"
                title={format(new Date(episode.pubDate), "dd MMMM yyyy", { locale: fr })}
              >
                <Calendar className="w-4 h-4" />
                {formatDistanceToNow(new Date(episode.pubDate), { locale: fr, addSuffix: true })}
              </div>
              {episode.durationSec > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-4 h-4" />
                    {formatDurationFromSeconds(episode.durationSec)}
                  </div>
                </>
              )}
              <span>•</span>
              <span className="font-mono uppercase text-[10px] tracking-wider px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                {episode.language}
              </span>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-6">{episode.title}</h1>

            {episode.themes && episode.themes.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {episode.themes.map((slug) => (
                  <Link key={slug} href={`/?themes=${encodeURIComponent(slug)}`}>
                    <Badge variant="secondary" className="hover:bg-primary hover:text-primary-foreground cursor-pointer text-sm py-1">
                      {slug}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {episode.tools && episode.tools.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-8">
                {episode.tools.map((slug) => (
                  <Link key={slug} href={`/?tools=${encodeURIComponent(slug)}`}>
                    <Badge variant="outline" className="hover:bg-primary hover:text-primary-foreground cursor-pointer text-sm py-1">
                      {slug}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {(episode.audioUrl || listeningLinks.length > 0) && (
              <Card className="bg-card shadow-sm border-border">
                <CardContent className="p-4 space-y-4">
                  {episode.audioUrl && (
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary p-3 rounded-full flex-shrink-0">
                        <Play className="w-5 h-5 fill-current" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <audio
                          ref={audioRef}
                          controls
                          preload="none"
                          src={episode.audioUrl}
                          className="w-full h-10 outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {listeningLinks.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Écouter sur
                      </span>
                      {listeningLinks.map((link) => (
                        <Button key={`${link.platform}-${link.url}`} variant="outline" size="sm" asChild>
                          <a href={link.url} target="_blank" rel="noopener noreferrer">
                            {link.label}
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </Button>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2 space-y-12">
            <section>
              <h2 className="text-2xl font-bold mb-6 font-mono">Description</h2>
              {episode.descriptionHtml ? (
                <div
                  className="prose prose-lg prose-p:text-muted-foreground prose-a:text-primary hover:prose-a:underline max-w-none"
                  dangerouslySetInnerHTML={{ __html: episode.descriptionHtml }}
                />
              ) : (
                <p className="text-muted-foreground italic">Aucune description disponible.</p>
              )}
            </section>

            {episode.chapters && episode.chapters.length > 0 && (
              <section>
                <Separator className="my-8" />
                <h2 className="text-2xl font-bold mb-6 font-mono">Chapitres</h2>
                <div className="space-y-2">
                  {episode.chapters.map((chapter, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => handleChapterClick(chapter.timeSec)}
                      className="w-full text-left flex items-start gap-4 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors group"
                    >
                      <Badge variant="outline" className="font-mono bg-background group-hover:bg-card whitespace-nowrap">
                        {formatTimecode(chapter.timeSec)}
                      </Badge>
                      <span className="text-foreground font-medium group-hover:text-primary transition-colors">
                        {chapter.title}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <div className="space-y-8">
            {(Object.keys(groupedRecommendations).length > 0 ||
              (episode.relatedLinks && episode.relatedLinks.length > 0)) && (
              <div className="bg-muted/50 rounded-xl p-6 border">
                {Object.keys(groupedRecommendations).length > 0 && (
                  <div className="mb-8">
                    <h3 className="font-bold text-lg mb-4 font-mono">Ressources mentionnées</h3>
                    <div className="space-y-6">
                      {(Object.entries(groupedRecommendations) as [RecommendationKind, Reco[]][]).map(([kind, recs]) => {
                        const Icon = KIND_ICONS[kind] || ExternalLink;
                        return (
                          <div key={kind}>
                            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {KIND_LABELS[kind]}
                            </h4>
                            <ul className="space-y-3">
                              {recs.map((rec, i) => (
                                <li key={i}>
                                  <a
                                    href={rec.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block group"
                                  >
                                    <div className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                                      {rec.title}
                                    </div>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {episode.relatedLinks && episode.relatedLinks.length > 0 && (
                  <div>
                    {Object.keys(groupedRecommendations).length > 0 && <Separator className="my-6 border-border/50" />}
                    <h3 className="font-bold text-lg mb-4 font-mono">Épisodes mentionnés</h3>
                    <ul className="space-y-3">
                      {episode.relatedLinks.map((link, i) => (
                        <li key={i}>
                          {link.episodeId ? (
                            <Link href={`/episodes/${encodeURIComponent(link.episodeId)}`} className="block group">
                              <div className="text-sm font-medium group-hover:text-primary transition-colors flex items-start gap-2">
                                <Podcast className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                <span>{link.title}</span>
                              </div>
                            </Link>
                          ) : (
                            <a href={link.url} target="_blank" rel="noopener noreferrer" className="block group">
                              <div className="text-sm font-medium group-hover:text-primary transition-colors flex items-start gap-2">
                                <ExternalLink className="w-4 h-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                                <span>{link.title}</span>
                              </div>
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {relatedEpisodes && relatedEpisodes.length > 0 && (
          <section className="mt-16 pt-12 border-t">
            <h2 className="text-2xl font-bold mb-8 font-mono">Épisodes liés</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
              {(relatedEpisodes as EpisodeSummary[]).map((rel) => (
                <Link key={rel.id} href={`/episodes/${encodeURIComponent(rel.id)}`}>
                  <Card className="h-full hover-elevate cursor-pointer border-border group overflow-hidden flex flex-col">
                    {rel.imageUrl && (
                      <div className="aspect-[2/1] overflow-hidden border-b">
                        <img
                          src={rel.imageUrl}
                          alt={rel.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      </div>
                    )}
                    <CardContent className="p-4 flex-1 flex flex-col">
                      <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                        {rel.episodeNumber != null && (
                          <>
                            <span className="font-bold text-primary">#{rel.episodeNumber}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatRelativeDateFR(rel.pubDate)}</span>
                      </div>
                      <h3 className="font-bold leading-snug group-hover:text-primary transition-colors line-clamp-3 mb-2">
                        {rel.title}
                      </h3>
                      <div className="mt-auto pt-2 flex flex-wrap gap-1">
                        {rel.themes?.slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </Layout>
  );
}
