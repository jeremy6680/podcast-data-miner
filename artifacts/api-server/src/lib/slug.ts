export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " et ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 64);
}

export function themeLabelFromSlug(slug: string): string {
  return slug
    .split("-")
    .map((p) => (p.length ? p[0]!.toUpperCase() + p.slice(1) : p))
    .join(" ");
}
