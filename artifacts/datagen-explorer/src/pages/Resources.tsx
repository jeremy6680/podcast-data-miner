import { Layout } from "@/components/Layout";
import { useListResources, useListThemes } from "@workspace/api-client-react";
import type { Resource, ListResourcesKind, ListResourcesSortBy, ResourceMention } from "@workspace/api-client-react";
import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, BookOpen, Podcast, Video, Newspaper, User, ExternalLink, Library, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { formatRelativeDateFR } from "@/lib/format";

const ANY_KIND = "__any__";

type Kind = "book" | "podcast" | "video" | "article" | "profile" | "other";

const KIND_ICONS: Record<Kind, React.ElementType> = {
  book: BookOpen,
  podcast: Podcast,
  video: Video,
  article: Newspaper,
  profile: User,
  other: ExternalLink,
};

const KIND_LABELS: Record<Kind, string> = {
  book: "Livres",
  podcast: "Podcasts",
  video: "Vidéos",
  article: "Articles",
  profile: "Profils",
  other: "Liens",
};

function useDebounce<T>(value: T, delay: number): T {
  const [d, setD] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function Resources() {
  const [, setLocation] = useLocation();
  const params = new URLSearchParams(window.location.search);

  const [q, setQ] = useState(params.get("q") || "");
  const debouncedQ = useDebounce(q, 300);
  const [kind, setKind] = useState<string>(params.get("kind") || ANY_KIND);
  const [sortBy, setSortBy] = useState<ListResourcesSortBy>((params.get("sortBy") as ListResourcesSortBy) || "mentions");
  const [selectedThemes, setSelectedThemes] = useState<string[]>(params.getAll("themes"));
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const p = new URLSearchParams();
    if (debouncedQ) p.set("q", debouncedQ);
    if (kind && kind !== ANY_KIND) p.set("kind", kind);
    if (sortBy !== "mentions") p.set("sortBy", sortBy);
    selectedThemes.forEach((t) => p.append("themes", t));
    const search = p.toString();
    const newUrl = search ? `/resources?${search}` : "/resources";
    if (window.location.search !== `?${search}` && (window.location.search !== "" || search !== "")) {
      setLocation(newUrl, { replace: true });
    }
  }, [debouncedQ, kind, sortBy, selectedThemes, setLocation]);

  const { data: themesList } = useListThemes();
  const { data, isLoading } = useListResources({
    q: debouncedQ || undefined,
    kind: kind && kind !== ANY_KIND ? (kind as ListResourcesKind) : undefined,
    sortBy,
    themes: selectedThemes.length > 0 ? selectedThemes : undefined,
    limit: 200,
  });

  const toggleTheme = (slug: string) =>
    setSelectedThemes((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));

  const items = (data?.items ?? []) as Resource[];
  const kindCounts = data?.kindCounts ?? {};
  const totalForKind = (k: Kind) => kindCounts[k] ?? 0;

  return (
    <Layout>
      <section className="bg-card border-b py-10 lg:py-14">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-primary mb-3">
              <Library className="w-4 h-4" />
              Ressources
            </div>
            <h1 className="text-4xl lg:text-5xl font-mono font-bold tracking-tight mb-3">
              Toutes les ressources citées dans les <span className="text-primary">podcasts suivis</span>
            </h1>
            <p className="text-base text-muted-foreground max-w-2xl">
              Livres, podcasts, articles, vidéos et profils mentionnés au fil des épisodes, agrégés, dédupliqués et triables.
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <aside className={`lg:w-72 flex-shrink-0 ${showFilters ? "block" : "hidden lg:block"}`}>
            <div className="sticky top-24 space-y-8">
              <div>
                <h3 className="font-mono font-bold mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-primary" />
                  Filtres
                </h3>

                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Recherche</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="Titre, domaine…"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setKind(ANY_KIND)}
                        className={`flex items-center justify-between text-left text-sm py-1.5 px-2 rounded-md transition-colors ${kind === ANY_KIND ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                      >
                        <span>Tous les types</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {Object.values(kindCounts).reduce((a, b) => a + b, 0)}
                        </span>
                      </button>
                      {(Object.keys(KIND_LABELS) as Kind[]).map((k) => {
                        const Icon = KIND_ICONS[k];
                        const active = kind === k;
                        return (
                          <button
                            key={k}
                            onClick={() => setKind(k)}
                            className={`flex items-center justify-between text-left text-sm py-1.5 px-2 rounded-md transition-colors ${active ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                          >
                            <span className="flex items-center gap-2">
                              <Icon className="w-4 h-4" />
                              {KIND_LABELS[k]}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">{totalForKind(k)}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-muted-foreground">Thèmes de l'épisode</label>
                      {selectedThemes.length > 0 && (
                        <button onClick={() => setSelectedThemes([])} className="text-xs text-primary hover:underline">
                          Tout effacer
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {themesList?.slice(0, 12).map((theme) => (
                        <Badge
                          key={theme.slug}
                          variant={selectedThemes.includes(theme.slug) ? "default" : "secondary"}
                          className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                          onClick={() => toggleTheme(theme.slug)}
                        >
                          {theme.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters(!showFilters)}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filtres
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  {data?.total ?? 0} ressource{(data?.total ?? 0) > 1 ? "s" : ""}
                </span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as ListResourcesSortBy)}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Trier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mentions">Plus mentionnées</SelectItem>
                    <SelectItem value="recent">Plus récentes</SelectItem>
                    <SelectItem value="title">Titre A-Z</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[...Array(8)].map((_, i) => (
                  <Card key={i} className="overflow-hidden">
                    <CardContent className="p-4 flex items-center gap-4">
                      <Skeleton className="w-10 h-10 rounded-md" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="text-center py-20 bg-card rounded-xl border border-dashed">
                <Library className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Aucune ressource</h3>
                <p className="text-muted-foreground mb-6">Ajustez vos filtres ou votre recherche.</p>
                <Button variant="outline" onClick={() => { setQ(""); setKind(ANY_KIND); setSelectedThemes([]); }}>
                  Réinitialiser
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((r, i) => {
                  const Icon = KIND_ICONS[r.kind as Kind] ?? ExternalLink;
                  return (
                    <motion.div
                      key={r.url}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.015, 0.3), duration: 0.3 }}
                    >
                      <Card className="hover-elevate transition-colors group">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-shrink-0 p-2.5 rounded-md bg-primary/10 text-primary">
                              <Icon className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
                                <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">
                                  {KIND_LABELS[r.kind as Kind] ?? r.kind}
                                </span>
                                {r.domain && <span className="truncate">{r.domain}</span>}
                              </div>
                              <a
                                href={r.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block group/link"
                              >
                                <h3 className="font-semibold text-foreground leading-snug group-hover/link:text-primary transition-colors line-clamp-2 mb-2">
                                  {r.title}
                                </h3>
                              </a>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                                <span className="font-mono font-bold text-foreground">
                                  {r.mentionCount} mention{r.mentionCount > 1 ? "s" : ""}
                                </span>
                                <span>•</span>
                                <span>Dernière : {formatRelativeDateFR(r.lastMentionAt)}</span>
                                {r.mentionCount > 1 && (
                                  <>
                                    <span>•</span>
                                    <span>Première : {formatRelativeDateFR(r.firstMentionAt)}</span>
                                  </>
                                )}
                              </div>

                              {r.mentions.length > 0 && (
                                <details className="mt-3 group/det">
                                  <summary className="text-xs font-medium text-primary cursor-pointer list-none flex items-center gap-1 hover:underline">
                                    <ChevronRight className="w-3 h-3 transition-transform group-open/det:rotate-90" />
                                    Voir les épisodes
                                  </summary>
                                  <ul className="mt-2 space-y-1.5 pl-4 border-l border-border">
                                    {r.mentions.slice(0, 12).map((m: ResourceMention) => (
                                      <li key={m.episodeId} className="text-sm">
                                        <Link
                                          href={`/episodes/${encodeURIComponent(m.episodeId)}`}
                                          className="text-foreground hover:text-primary transition-colors"
                                        >
                                          {m.episodeNumber != null && <span className="text-primary font-bold mr-1.5">#{m.episodeNumber}</span>}
                                          {m.episodeTitle}
                                        </Link>
                                        <span className="text-xs text-muted-foreground ml-2">— {formatRelativeDateFR(m.episodePubDate)}</span>
                                      </li>
                                    ))}
                                    {r.mentions.length > 12 && (
                                      <li className="text-xs text-muted-foreground">+{r.mentions.length - 12} autres</li>
                                    )}
                                  </ul>
                                </details>
                              )}
                            </div>
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Ouvrir le lien"
                              className="flex-shrink-0 p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
