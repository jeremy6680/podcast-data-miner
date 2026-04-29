import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListTools } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { PageHero } from "@/components/PageHero";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowRight, ArrowDownAZ, Hash, Wrench } from "lucide-react";

export default function Tools() {
  const { data: tools, isLoading } = useListTools();
  const [sortBy, setSortBy] = useState<"count" | "alpha">("count");
  const [, navigate] = useLocation();

  const sortedTools = tools ? [...tools].sort((a, b) => {
    if (sortBy === "count") {
      if (b.count !== a.count) return b.count - a.count;
      return a.name.localeCompare(b.name, "fr");
    }
    return a.name.localeCompare(b.name, "fr");
  }) : [];

  return (
    <Layout>
      <PageHero
        icon={Wrench}
        label="Outils"
        title={<>Tous les outils cités dans les <span className="text-primary">podcasts suivis</span></>}
        description="Plateformes, frameworks, apps et services mentionnés au fil des épisodes, regroupés pour retrouver rapidement les conversations associées."
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 border-b pb-4">
          <div className="text-sm font-medium text-muted-foreground">
            {tools?.length || 0} outils au total
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
        ) : !tools || tools.length === 0 ? (
          <div className="text-center py-20 bg-muted/30 rounded-2xl border border-dashed">
            <h2 className="text-xl font-bold mb-2">Aucun outil détecté</h2>
            <p className="text-muted-foreground mb-6">Les outils apparaîtront ici une fois les épisodes synchronisés.</p>
            <Button onClick={() => navigate("/")}>
              Retour à l'accueil
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {sortedTools.map((tool) => (
              <Link key={tool.slug} href={`/?tools=${encodeURIComponent(tool.slug)}`}>
                <Card className="h-full hover-elevate cursor-pointer border-border group transition-all overflow-hidden bg-card hover:border-primary/50">
                  <CardContent className="p-6 flex flex-col h-full relative">
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all text-primary">
                      <ArrowRight className="w-5 h-5" />
                    </div>
                    <Badge variant="secondary" className="w-fit mb-auto">
                      {tool.count} épisode{tool.count > 1 ? "s" : ""}
                    </Badge>
                    <h3 className="text-xl font-bold mt-6 group-hover:text-primary transition-colors">
                      {tool.name}
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
