import { Layout } from "@/components/Layout";
import { useGetStats, useListEpisodes, useListPodcasts, useListThemes, useListTools, useTriggerSync } from "@workspace/api-client-react";
import { formatRelativeDateFR, formatDurationFromSeconds } from "@/lib/format";
import { Link, useLocation } from "wouter";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Search, Filter, PlayCircle, Clock, Calendar, BarChart3, HardDrive, Database, AudioLines, Wrench, Podcast } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { ListEpisodesSortBy, ListEpisodesSortOrder } from "@workspace/api-client-react";

const ANY_LANG = "__any__";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

export default function Home() {
  const [, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);

  const initialQ = searchParams.get("q") || "";
  const initialThemes = searchParams.getAll("themes");
  const initialTools = searchParams.getAll("tools");
  const initialPodcasts = searchParams.getAll("podcasts");
  const initialSortBy = (searchParams.get("sortBy") as ListEpisodesSortBy) || "pub_date";
  const initialSortOrder = (searchParams.get("sortOrder") as ListEpisodesSortOrder) || "desc";
  const initialLang = searchParams.get("language") || ANY_LANG;

  const [q, setQ] = useState(initialQ);
  const debouncedQ = useDebounce(q, 300);
  const [selectedThemes, setSelectedThemes] = useState<string[]>(initialThemes);
  const [selectedTools, setSelectedTools] = useState<string[]>(initialTools);
  const [selectedPodcasts, setSelectedPodcasts] = useState<string[]>(initialPodcasts);
  const [sortBy, setSortBy] = useState<ListEpisodesSortBy>(initialSortBy);
  const [sortOrder, setSortOrder] = useState<ListEpisodesSortOrder>(initialSortOrder);
  const [language, setLanguage] = useState<string>(initialLang);
  const [maxDuration, setMaxDuration] = useState(searchParams.get("maxDurationSec") ? parseInt(searchParams.get("maxDurationSec")!, 10) / 60 : 90);

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedQ) params.set("q", debouncedQ);
    selectedThemes.forEach((t) => params.append("themes", t));
    selectedTools.forEach((t) => params.append("tools", t));
    selectedPodcasts.forEach((p) => params.append("podcasts", p));
    if (sortBy !== "pub_date") params.set("sortBy", sortBy);
    if (sortOrder !== "desc") params.set("sortOrder", sortOrder);
    if (language && language !== ANY_LANG) params.set("language", language);
    if (maxDuration < 90) params.set("maxDurationSec", (maxDuration * 60).toString());

    const newSearch = params.toString();
    const newUrl = newSearch ? `/?${newSearch}` : "/";
    if (window.location.search !== `?${newSearch}` && (window.location.search !== "" || newSearch !== "")) {
      setLocation(newUrl, { replace: true });
    }
  }, [debouncedQ, selectedThemes, selectedTools, selectedPodcasts, sortBy, sortOrder, language, maxDuration, setLocation]);

  const { data: stats } = useGetStats();
  const { data: themesList } = useListThemes();
  const { data: toolsList } = useListTools();
  const { data: podcastsList } = useListPodcasts();

  const { data: episodesData, isLoading } = useListEpisodes({
    q: debouncedQ || undefined,
    themes: selectedThemes.length > 0 ? selectedThemes : undefined,
    tools: selectedTools.length > 0 ? selectedTools : undefined,
    podcasts: selectedPodcasts.length > 0 ? selectedPodcasts : undefined,
    sortBy,
    sortOrder,
    language: language && language !== ANY_LANG ? language : undefined,
    maxDurationSec: maxDuration < 90 ? maxDuration * 60 : undefined,
    limit: 50,
  });

  const toggleTheme = (slug: string) => {
    setSelectedThemes((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));
  };
  const toggleTool = (slug: string) => {
    setSelectedTools((prev) => (prev.includes(slug) ? prev.filter((t) => t !== slug) : [...prev, slug]));
  };
  const togglePodcast = (slug: string) => {
    setSelectedPodcasts((prev) => (prev.includes(slug) ? prev.filter((p) => p !== slug) : [...prev, slug]));
  };

  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync();

  return (
    <Layout>
      <section className="bg-card border-b py-12 lg:py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl">
            <h1 className="text-4xl lg:text-6xl font-mono font-bold tracking-tight mb-6 text-foreground">
              L'archive des <span className="text-primary">podcasts data & IA</span>.
            </h1>
            <p className="text-lg lg:text-xl text-muted-foreground mb-8 max-w-2xl leading-relaxed">
              Parcourez et filtrez les épisodes de DataGen, The Analytics Engineering Podcast, Lenny's Podcast et AI Engineering Podcast.
            </p>

            <div className="flex flex-wrap gap-6 items-center">
              <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-4 border border-secondary-border">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold">{stats?.totalEpisodes ?? "..."}</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Épisodes</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-4 border border-secondary-border">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold">{stats ? Math.floor(stats.totalDurationSec / 3600) : "..."}h</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Heures d'écoute</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-4 border border-secondary-border">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold">{stats?.themesCount ?? "..."}</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Thèmes</div>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-secondary/50 rounded-lg p-4 border border-secondary-border">
                <div className="p-2 bg-primary/10 rounded-md text-primary">
                  <Podcast className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-2xl font-mono font-bold">{stats?.podcastsCount ?? "..."}</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Podcasts</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-8">
        {(!stats?.totalEpisodes && !isLoading) ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="bg-primary/10 p-6 rounded-full mb-6">
              <Database className="w-12 h-12 text-primary" />
            </div>
            <h2 className="text-2xl font-mono font-bold mb-4">Aucun épisode</h2>
            <p className="text-muted-foreground mb-8 max-w-md">
              La base est vide. Lancez la synchronisation pour récupérer les épisodes des flux RSS configurés.
            </p>
            <Button size="lg" onClick={() => triggerSync({ data: { extractThemes: true } })} disabled={isSyncing}>
              {isSyncing ? "Synchronisation en cours…" : "Synchroniser depuis le RSS"}
            </Button>
          </div>
        ) : (
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
                          placeholder="Entreprise, invité, sujet…"
                          value={q}
                          onChange={(e) => setQ(e.target.value)}
                          className="pl-9"
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-muted-foreground">Podcasts</label>
                        {selectedPodcasts.length > 0 && (
                          <button onClick={() => setSelectedPodcasts([])} className="text-xs text-primary hover:underline">
                            Tout effacer
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {podcastsList?.map((podcast) => (
                          <button
                            key={podcast.slug}
                            onClick={() => togglePodcast(podcast.slug)}
                            className={`flex items-center justify-between text-left text-sm py-1.5 px-2 rounded-md transition-colors ${selectedPodcasts.includes(podcast.slug) ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-foreground"}`}
                          >
                            <span className="line-clamp-1">{podcast.name}</span>
                            <span className="text-xs text-muted-foreground font-mono">{podcast.count}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-muted-foreground">Thèmes</label>
                        {selectedThemes.length > 0 && (
                          <button onClick={() => setSelectedThemes([])} className="text-xs text-primary hover:underline">
                            Tout effacer
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {themesList?.slice(0, 10).map((theme) => (
                          <Badge
                            key={theme.slug}
                            variant={selectedThemes.includes(theme.slug) ? "default" : "secondary"}
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => toggleTheme(theme.slug)}
                          >
                            {theme.name}
                          </Badge>
                        ))}
                        <Link href="/themes" className="text-xs font-medium text-primary py-1 px-2 hover:bg-primary/10 rounded-full transition-colors inline-flex items-center gap-1">
                          Voir tout <BarChart3 className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-muted-foreground">Outils</label>
                        {selectedTools.length > 0 && (
                          <button onClick={() => setSelectedTools([])} className="text-xs text-primary hover:underline">
                            Tout effacer
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {toolsList?.slice(0, 10).map((tool) => (
                          <Badge
                            key={tool.slug}
                            variant={selectedTools.includes(tool.slug) ? "default" : "secondary"}
                            className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                            onClick={() => toggleTool(tool.slug)}
                          >
                            {tool.name}
                          </Badge>
                        ))}
                        <Link href="/tools" className="text-xs font-medium text-primary py-1 px-2 hover:bg-primary/10 rounded-full transition-colors inline-flex items-center gap-1">
                          Voir tout <Wrench className="w-3 h-3" />
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <label className="text-sm font-medium text-muted-foreground">Durée max</label>
                        <span className="text-xs font-medium">{maxDuration < 90 ? `${maxDuration} min` : "Illimitée"}</span>
                      </div>
                      <Slider
                        value={[maxDuration]}
                        max={90}
                        min={10}
                        step={5}
                        onValueChange={(v) => setMaxDuration(v[0]!)}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-muted-foreground">Langue</label>
                      <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger>
                          <SelectValue placeholder="Toutes les langues" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ANY_LANG}>Toutes les langues</SelectItem>
                          <SelectItem value="fr">Français (FR)</SelectItem>
                          <SelectItem value="en">English (EN)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setShowFilters(!showFilters)}>
                    <Filter className="w-4 h-4 mr-2" />
                    Filtres
                  </Button>
                  <span className="text-sm text-muted-foreground font-medium">
                    {episodesData?.total ?? 0} épisode{(episodesData?.total ?? 0) > 1 ? "s" : ""} trouvé{(episodesData?.total ?? 0) > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <Select value={`${sortBy}-${sortOrder}`} onValueChange={(val) => {
                    const [b, o] = val.split("-");
                    setSortBy(b as ListEpisodesSortBy);
                    setSortOrder(o as ListEpisodesSortOrder);
                  }}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Trier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pub_date-desc">Plus récents d'abord</SelectItem>
                      <SelectItem value="pub_date-asc">Plus anciens d'abord</SelectItem>
                      <SelectItem value="duration-desc">Plus longs d'abord</SelectItem>
                      <SelectItem value="duration-asc">Plus courts d'abord</SelectItem>
                      <SelectItem value="title-asc">Titre A-Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="h-48 bg-muted animate-pulse" />
                      <CardContent className="p-5 space-y-3">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-4 w-2/3" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : episodesData?.items.length === 0 ? (
                <div className="text-center py-20 bg-card rounded-xl border border-dashed">
                  <Search className="w-10 h-10 text-muted-foreground mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium text-foreground mb-2">Aucun épisode ne correspond</h3>
                  <p className="text-muted-foreground mb-6">Ajustez vos filtres ou votre recherche.</p>
                  <Button variant="outline" onClick={() => {
                    setQ("");
                    setSelectedThemes([]);
                    setSelectedTools([]);
                    setSelectedPodcasts([]);
                    setLanguage(ANY_LANG);
                    setMaxDuration(90);
                  }}>
                    Réinitialiser les filtres
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {episodesData?.items.map((episode, i) => (
                    <motion.div
                      key={episode.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.03, 0.4), duration: 0.4 }}
                    >
                      <Link href={`/episodes/${encodeURIComponent(episode.id)}`}>
                        <Card className="h-full overflow-hidden hover-elevate transition-all duration-300 group cursor-pointer border-transparent hover:border-primary/30 flex flex-col">
                          <div className="relative h-48 bg-muted overflow-hidden">
                            {episode.imageUrl ? (
                              <img
                                src={episode.imageUrl}
                                alt={episode.title}
                                className="w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/5 text-primary">
                                <AudioLines className="w-12 h-12 opacity-50" />
                              </div>
                            )}
                            <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />

                            <div className="absolute top-3 left-3 flex gap-2">
                              {episode.episodeNumber != null && (
                                <Badge variant="secondary" className="bg-background/90 backdrop-blur text-foreground border-none shadow-sm">
                                  #{episode.episodeNumber}
                                </Badge>
                              )}
                              <Badge variant="secondary" className="bg-background/90 backdrop-blur text-foreground border-none shadow-sm font-mono uppercase text-[10px]">
                                {episode.language.toUpperCase()}
                              </Badge>
                              <Badge variant="secondary" className="bg-background/90 backdrop-blur text-foreground border-none shadow-sm text-[10px]">
                                {episode.podcastName}
                              </Badge>
                            </div>

                            <div className="absolute bottom-3 right-3">
                              <div className="bg-background/90 backdrop-blur rounded-full p-2 text-foreground shadow-sm group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                <PlayCircle className="w-5 h-5" />
                              </div>
                            </div>
                          </div>

                          <CardContent className="p-5 flex-1 flex flex-col">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium mb-3">
                              <span className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5" />
                                {formatRelativeDateFR(episode.pubDate)}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                {formatDurationFromSeconds(episode.durationSec)}
                              </span>
                            </div>

                            <h3 className="font-mono font-bold text-lg leading-tight mb-3 line-clamp-3 group-hover:text-primary transition-colors">
                              {episode.title}
                            </h3>

                            {episode.summary && (
                              <p className="text-sm text-muted-foreground line-clamp-2 mb-4 flex-1">
                                {episode.summary}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-1.5 mt-auto">
                              {episode.themes.slice(0, 3).map((theme) => (
                                <span key={theme} className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 bg-secondary rounded text-secondary-foreground">
                                  {theme}
                                </span>
                              ))}
                              {episode.themes.length > 3 && (
                                <span className="text-[10px] font-medium px-2 py-1 bg-transparent text-muted-foreground">
                                  +{episode.themes.length - 3}
                                </span>
                              )}
                            </div>
                            {episode.tools.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {episode.tools.slice(0, 3).map((tool) => (
                                  <span key={tool} className="text-[10px] font-medium uppercase tracking-wider px-2 py-1 bg-primary/10 rounded text-primary">
                                    {tool}
                                  </span>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </Link>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
