import { Palette } from "lucide-react";
import { useTheme } from "@/contexts/theme-context";
import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { openCustomizer } = useTheme();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={openCustomizer}
      className={className}
      title="Theme Studio"
    >
      <Palette className="h-4 w-4" />
    </Button>
  );
}
