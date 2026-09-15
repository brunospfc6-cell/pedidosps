import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Input } from "@/components/ui/input";
import type { Product, SaleKind } from "@/lib/types";
import { DEPLOY_LABEL, LICENSE_LABEL, TERM_LABEL } from "@/lib/types";
import { cn, usd } from "@/lib/utils";

function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
}

function matchesSaleKind(product: Product, saleKind?: SaleKind) {
  const license = product.licenseType.toLowerCase();
  if (saleKind === "renovacao") return license.includes("renewal");
  if (saleKind === "nova") return license.includes("new") || license.includes("switch");
  return true;
}

export function ProductPicker({
  products,
  value,
  saleKind,
  disabled,
  onSelect,
}: {
  products: Product[];
  value: number | null;
  saleKind?: SaleKind;
  disabled?: boolean;
  onSelect: (product: Product) => void;
}) {
  const selected = products.find((p) => p.id === value) ?? null;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  function place() {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const width = Math.min(Math.max(r.width, 360), window.innerWidth - 24);
    let left = r.left;
    if (left + width > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - width - 12);
    }
    const gap = 4;
    const below = window.innerHeight - r.bottom - 12;
    const above = r.top - 12;
    const openUp = below < 200 && above > below;
    const maxHeight = Math.min(320, Math.max(160, openUp ? above : below));
    const top = openUp ? Math.max(12, r.top - gap - maxHeight) : r.bottom + gap;
    setCoords({ top, left, width, maxHeight });
  }

  useEffect(() => {
    function onDoc(ev: MouseEvent) {
      const t = ev.target as Node;
      if (rootRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  useEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    place();
    const onWin = () => place();
    window.addEventListener("resize", onWin);
    document.addEventListener("scroll", onWin, true);
    return () => {
      window.removeEventListener("resize", onWin);
      document.removeEventListener("scroll", onWin, true);
    };
  }, [open, query]);

  const results = useMemo(() => {
    const active = products.filter((p) => p.active);
    const q = normalize(query.trim());
    const searching = q.length > 0;
    const showNfr = q.includes("nfr") || q.includes("resale");
    let list = active.filter((p) => {
      if (!showNfr && p.usageType === "Not For Resale") return false;
      if (!searching && !matchesSaleKind(p, saleKind)) return false;
      if (!searching) return true;
      const hay = normalize(
        `${p.name} ${p.sku} ${p.productLine} ${p.sapName} ${p.licenseType} ${p.contractTerm}`,
      );
      return hay.includes(q);
    });
    list.sort((a, b) => {
      const line = a.productLine.localeCompare(b.productLine, "pt-BR");
      if (line !== 0) return line;
      return a.name.localeCompare(b.name, "pt-BR");
    });
    return list.slice(0, 80);
  }, [products, query, saleKind]);

  const display = selected ? `${selected.productLine || selected.name}` : "";

  const menu =
    open && !disabled && coords && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={listRef}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
            }}
            className="z-[80] overflow-y-auto rounded-lg border border-border bg-card shadow-lg"
          >
            {results.length === 0 ? (
              <p className="px-3 py-4 text-sm text-muted-foreground">
                Nenhum SKU encontrado na tabela vigente.
              </p>
            ) : (
              <ul role="listbox">
                {results.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col gap-0.5 px-3 py-2.5 text-left hover:bg-accent",
                        p.id === value && "bg-accent",
                      )}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onSelect(p);
                        setOpen(false);
                        setQuery("");
                      }}
                    >
                      <span className="text-sm leading-tight">{p.name}</span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {p.sku}
                        {p.productLine ? ` · ${p.productLine}` : ""}
                        {p.contractTerm ? ` · ${TERM_LABEL[p.contractTerm] ?? p.contractTerm}` : ""}
                        {p.licenseType ? ` · ${LICENSE_LABEL[p.licenseType] ?? p.licenseType}` : ""}
                        {p.deployment ? ` · ${DEPLOY_LABEL[p.deployment] ?? p.deployment}` : ""}
                        {` · ${usd(p.listPriceUsd)}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative min-w-[220px]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          disabled={disabled}
          value={open ? query : selected ? display : query}
          placeholder="Buscar SKU, produto ou linha…"
          className="pl-9"
          onFocus={() => {
            setOpen(true);
            setQuery("");
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
        />
      </div>
      {selected && !open ? (
        <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {selected.sku} · {TERM_LABEL[selected.contractTerm] ?? selected.contractTerm} ·{" "}
          {usd(selected.listPriceUsd)}
        </p>
      ) : null}
      {menu}
    </div>
  );
}
