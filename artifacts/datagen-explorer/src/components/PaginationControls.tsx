import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getPaginationItems } from "@/lib/pagination";
import { cn } from "@/lib/utils";

type PaginationControlsProps = {
  currentPage: number;
  pageSize: number;
  total: number;
  itemLabel: string;
  itemLabelPlural: string;
  onPageChange: (page: number) => void;
};

export function PaginationControls({
  currentPage,
  pageSize,
  total,
  itemLabel,
  itemLabelPlural,
  onPageChange,
}: PaginationControlsProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, total);
  const label = total > 1 ? itemLabelPlural : itemLabel;
  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage) return;
    onPageChange(page);
  };

  return (
    <div className="mt-8 flex flex-col items-center gap-3 border-t pt-6">
      <p className="text-sm text-muted-foreground">
        {firstItem}-{lastItem} sur {total} {label}
      </p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={currentPage === 1}
              className={cn(currentPage === 1 && "pointer-events-none opacity-50")}
              onClick={(event) => {
                event.preventDefault();
                goToPage(currentPage - 1);
              }}
            />
          </PaginationItem>

          {getPaginationItems({ currentPage, totalPages }).map((item) => (
            <PaginationItem key={item}>
              {typeof item === "number" ? (
                <PaginationLink
                  href="#"
                  isActive={item === currentPage}
                  onClick={(event) => {
                    event.preventDefault();
                    goToPage(item);
                  }}
                >
                  {item}
                </PaginationLink>
              ) : (
                <PaginationEllipsis />
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={currentPage === totalPages}
              className={cn(currentPage === totalPages && "pointer-events-none opacity-50")}
              onClick={(event) => {
                event.preventDefault();
                goToPage(currentPage + 1);
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
