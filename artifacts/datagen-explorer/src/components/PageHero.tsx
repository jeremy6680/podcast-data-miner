import type { ElementType, ReactNode } from "react";

type PageHeroProps = {
  icon: ElementType;
  label: string;
  title: ReactNode;
  description: string;
};

export function PageHero({ icon: Icon, label, title, description }: PageHeroProps) {
  return (
    <section className="bg-card border-b py-10 lg:py-14">
      <div className="container mx-auto px-4">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-wider font-medium text-primary mb-3">
            <Icon className="w-4 h-4" />
            {label}
          </div>
          <h1 className="text-4xl lg:text-5xl font-mono font-bold tracking-tight mb-3">
            {title}
          </h1>
          <p className="text-base text-muted-foreground max-w-2xl">
            {description}
          </p>
        </div>
      </div>
    </section>
  );
}
