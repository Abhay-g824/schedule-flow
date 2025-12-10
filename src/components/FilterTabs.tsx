import { cn } from "@/lib/utils";

export type FilterType = "all" | "active" | "completed";

interface FilterTabsProps {
  activeFilter: FilterType;
  onFilterChange: (filter: FilterType) => void;
  counts: {
    all: number;
    active: number;
    completed: number;
  };
}

const filters: { value: FilterType; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
];

export function FilterTabs({ activeFilter, onFilterChange, counts }: FilterTabsProps) {
  return (
    <div className="flex items-center gap-1 p-1 bg-secondary/50 rounded-lg">
      {filters.map((filter) => (
        <button
          key={filter.value}
          onClick={() => onFilterChange(filter.value)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all duration-200",
            activeFilter === filter.value
              ? "bg-card text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {filter.label}
          <span
            className={cn(
              "text-xs px-1.5 py-0.5 rounded-full",
              activeFilter === filter.value
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            )}
          >
            {counts[filter.value]}
          </span>
        </button>
      ))}
    </div>
  );
}
