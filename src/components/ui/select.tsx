import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full appearance-none rounded-md border border-input bg-card bg-[length:1rem] bg-[right_0.7rem_center] bg-no-repeat px-3 pr-9 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60",
        className,
      )}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='none' stroke='%235c6570' stroke-width='1.6' viewBox='0 0 24 24'><path d='m6 9 6 6 6-6'/></svg>")`,
      }}
      {...props}
    >
      {children}
    </select>
  );
}
