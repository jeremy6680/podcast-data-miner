import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { Database, Search, AudioLines, HardDrive, LayoutGrid, RotateCw } from "lucide-react";
import { Button } from "./ui/button";
import { useGetStats, useGetSyncStatus, useTriggerSync } from "@workspace/api-client-react";
import { Badge } from "./ui/badge";

interface LayoutProps {
  children: ReactNode;
}

function SyncStatus() {
  const { data: syncStatus } = useGetSyncStatus({ query: { refetchInterval: 2000 } });
  const { mutate: triggerSync, isPending: isSyncing } = useTriggerSync();

  const handleSync = () => {
    triggerSync({ data: { extractThemes: true } });
  };

  const isRunning = syncStatus?.state !== "idle" && syncStatus?.state !== "done" && syncStatus?.state !== "error";

  return (
    <div className="flex items-center gap-4">
      {isRunning ? (
        <div className="flex items-center gap-2 text-sm text-primary">
          <RotateCw className="w-4 h-4 animate-spin" />
          <span className="hidden sm:inline">
            Syncing: {syncStatus?.processedEpisodes} / {syncStatus?.totalEpisodes}
          </span>
        </div>
      ) : (
        <Button variant="ghost" size="sm" onClick={handleSync} disabled={isSyncing} className="hidden sm:flex">
          <RotateCw className={`w-4 h-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
          Sync RSS
        </Button>
      )}
    </div>
  );
}

export function Layout({ children }: LayoutProps) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-md group-hover:bg-primary/90 transition-colors">
              <AudioLines className="w-5 h-5" />
            </div>
            <span className="font-mono font-bold text-lg tracking-tight">DataGen Explorer</span>
          </Link>
          
          <nav className="flex items-center gap-6 text-sm font-medium">
            <Link href="/" className={`${location === "/" ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"} transition-colors flex items-center gap-2`}>
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">Épisodes</span>
            </Link>
            <Link href="/themes" className={`${location.startsWith("/themes") ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"} transition-colors flex items-center gap-2`}>
              <LayoutGrid className="w-4 h-4" />
              <span className="hidden sm:inline">Thèmes</span>
            </Link>
            
            <div className="h-4 w-px bg-border mx-2 hidden sm:block" />
            
            <SyncStatus />
          </nav>
        </div>
      </header>

      <main className="flex-1 flex flex-col">
        {children}
      </main>

      <footer className="border-t py-8 mt-auto bg-card">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DataGen Explorer — Unofficial archive of the DataGen podcast.</p>
        </div>
      </footer>
    </div>
  );
}
