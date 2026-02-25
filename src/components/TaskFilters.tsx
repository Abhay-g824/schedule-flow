import { useState } from "react";
import { Task, Priority } from "@/types/task";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, X, Calendar, Search } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { cn } from "@/lib/utils";

export interface FilterOptions {
  search: string;
  priority: Priority | "all";
  color: string | "all";
  completed: "all" | "active" | "completed";
  dateRange: {
    start: Date | null;
    end: Date | null;
  };
}

interface TaskFiltersProps {
  tasks: Task[];
  filters: FilterOptions;
  onFiltersChange: (filters: FilterOptions) => void;
  onClearFilters: () => void;
}

const colorOptions = [
  { value: "all", label: "All Colors" },
  { value: "#ef4444", label: "Red" },
  { value: "#f97316", label: "Orange" },
  { value: "#eab308", label: "Yellow" },
  { value: "#22c55e", label: "Green" },
  { value: "#06b6d4", label: "Cyan" },
  { value: "#3b82f6", label: "Blue" },
  { value: "#8b5cf6", label: "Purple" },
  { value: "#ec4899", label: "Pink" },
  { value: "#f43f5e", label: "Rose" },
];

export function TaskFilters({ tasks, filters, onFiltersChange, onClearFilters }: TaskFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isStartDateOpen, setIsStartDateOpen] = useState(false);
  const [isEndDateOpen, setIsEndDateOpen] = useState(false);

  const hasActiveFilters = 
    filters.search !== "" ||
    filters.priority !== "all" ||
    filters.color !== "all" ||
    filters.completed !== "all" ||
    filters.dateRange.start !== null ||
    filters.dateRange.end !== null;

  const updateFilter = (key: keyof FilterOptions, value: any) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const quickDateFilters = [
    { label: "Today", start: startOfDay(new Date()), end: endOfDay(new Date()) },
    { label: "This Week", start: startOfWeek(new Date()), end: endOfWeek(new Date()) },
    { label: "This Month", start: startOfMonth(new Date()), end: endOfMonth(new Date()) },
  ];

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => updateFilter("search", e.target.value)}
          className="pr-8"
        />
        <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      </div>

      {/* Quick Filters */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">
                {[
                  filters.search && 1,
                  filters.priority !== "all" && 1,
                  filters.color !== "all" && 1,
                  filters.completed !== "all" && 1,
                  filters.dateRange.start && 1,
                  filters.dateRange.end && 1,
                ].filter(Boolean).length}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Filters</h4>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={onClearFilters} className="h-8 text-xs">
                  Clear all
                </Button>
              )}
            </div>

            {/* Priority Filter */}
            <div className="space-y-2">
              <Label className="text-sm">Priority</Label>
              <Select value={filters.priority} onValueChange={(value) => updateFilter("priority", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Color Filter */}
            <div className="space-y-2">
              <Label className="text-sm">Color</Label>
              <Select value={filters.color} onValueChange={(value) => updateFilter("color", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {colorOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        {option.value !== "all" && (
                          <div className={cn("h-3 w-3 rounded-full", option.value === "#ef4444" && "bg-red-500")} style={option.value !== "all" ? { backgroundColor: option.value } : undefined} />
                        )}
                        {option.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Completion Status */}
            <div className="space-y-2">
              <Label className="text-sm">Status</Label>
              <Select value={filters.completed} onValueChange={(value) => updateFilter("completed", value as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tasks</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="completed">Completed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Range */}
            <div className="space-y-2">
              <Label className="text-sm">Date Range</Label>
              <div className="grid grid-cols-2 gap-2">
                <Popover open={isStartDateOpen} onOpenChange={setIsStartDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateRange.start ? format(filters.dateRange.start, "MMM d") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateRange.start || undefined}
                      onSelect={(date) => {
                        updateFilter("dateRange", { ...filters.dateRange, start: date || null });
                        setIsStartDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
                <Popover open={isEndDateOpen} onOpenChange={setIsEndDateOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="justify-start text-left font-normal">
                      <Calendar className="mr-2 h-4 w-4" />
                      {filters.dateRange.end ? format(filters.dateRange.end, "MMM d") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={filters.dateRange.end || undefined}
                      onSelect={(date) => {
                        updateFilter("dateRange", { ...filters.dateRange, end: date || null });
                        setIsEndDateOpen(false);
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="flex gap-1 flex-wrap">
                {quickDateFilters.map((filter) => (
                  <Button
                    key={filter.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      updateFilter("dateRange", { start: filter.start, end: filter.end });
                    }}
                  >
                    {filter.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="gap-2">
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}

