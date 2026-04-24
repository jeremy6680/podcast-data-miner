import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListThemes } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDownAZ, Hash } from "lucide-react";

export default function Themes() {
  const { data: themes, isLoading } = useListThemes();
  const [sortBy, setSortBy] = useState<"count" | "alpha">("count");
  const [, navigate] = useLocation();

  const sortedThemes = themes ? [...themes].sort((a, b) => {
    if (sortBy === "count") {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "fr");
    } else {
      return a.name.localeCompare(b.name, "fr");
    }
  }) : [];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-10 text-center max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight">Thèmes</h1>
          <p className="text-xl text-muted-foreground">
            Explorez les épisodes par sujet.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 border-b pb-4">
          <div className="text-sm font-medium text-muted-foreground">
            {themes?.length || 0} thèmes au total
          </div>
          
          <div className="flex bg-muted/50 rounded-lg p-1 border">
            <Button 
              variant={sortBy === "count" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSortBy("count")}
              className="text-xs"
            >
              <Hash className="w-3 h-3 mr-1.5" />
              Par popularité
            </Button>
            <Button 
              variant={sortBy === "alpha" ? "secondary" : "ghost"} 
              size="sm" 
              onClick={() => setSortBy("alpha")}
              className="text-xs"
            >
              <ArrowDownAZ className="w-3 h-3 mr-1.5" />
              Alphabétique
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {[...Array(12)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-xl" />
            ))}
          </div>
        ) : !themes || themes.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed">
            <h2 className="text-xl font-bold mb-2">Synchronisation en cours…</h2>
            <p className="text-muted-foreground mb-6">Les thèmes apparaîtront ici une fois synchronisés.</p>
            <Button onClick={() => navigate("/")}>
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {sortedThemes.map(theme => (
              <Link key={theme.slug} href={`/?themes=${theme.slug}`}>
                <Card className="h-full hover-elevate cursor-pointer border-border group transition-all overflow-hidden bg-card hover:border-primary/50">
                  <CardContent className="p-6 flex flex-col h-full relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className="w-fit mb-auto">
                      {theme.count} épisode{theme.count > 1 ? 's' : ''}
                    </Badge>
                    <h3 className="text-xl font-bold mt-6 group-hover:text-primary transition-colors">
                      {theme.name}
                    </h3>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
