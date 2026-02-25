import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Palette } from "lucide-react";
import { cn } from "@/lib/utils";

const colorOptions = [
  { value: null, label: "None", color: "bg-transparent border-2 border-border" },
  { value: "#ef4444", label: "Red", color: "bg-red-500" },
  { value: "#f97316", label: "Orange", color: "bg-orange-500" },
  { value: "#eab308", label: "Yellow", color: "bg-yellow-500" },
  { value: "#22c55e", label: "Green", color: "bg-green-500" },
  { value: "#06b6d4", label: "Cyan", color: "bg-cyan-500" },
  { value: "#3b82f6", label: "Blue", color: "bg-blue-500" },
  { value: "#8b5cf6", label: "Purple", color: "bg-purple-500" },
  { value: "#ec4899", label: "Pink", color: "bg-pink-500" },
  { value: "#f43f5e", label: "Rose", color: "bg-rose-500" },
];

interface ColorPickerProps {
  value: string | null | undefined;
  onChange: (color: string | null) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const selectedColor = colorOptions.find(c => c.value === value) || colorOptions[0];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={cn("h-8 gap-2", className)}>
          <div 
            className={cn("h-3 w-3 rounded-full border border-border", selectedColor.value === null && "bg-transparent")} 
            style={selectedColor.value ? { backgroundColor: selectedColor.value } : undefined}
          />
          <Palette className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-5 gap-2">
          {colorOptions.map((option) => (
            <button
              key={option.value || "none"}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "h-8 w-8 rounded-md border-2 transition-all",
                option.value === null && "bg-transparent",
                value === option.value && "ring-2 ring-primary ring-offset-2"
              )}
              style={option.value ? { backgroundColor: option.value } : undefined}
              title={option.label}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

