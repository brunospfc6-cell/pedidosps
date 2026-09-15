import { cn } from "@/lib/utils";

export function BrandLogo({ className }: { className?: string }) {
  return (
    <img
      src="/logo-prosystems.png"
      alt="Pro-Systems"
      className={cn("h-9 w-auto max-w-[200px] object-contain object-left", className)}
    />
  );
}
