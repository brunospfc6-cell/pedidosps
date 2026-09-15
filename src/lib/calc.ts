import { DEFAULT_HUBGOV_PCT, MIN_NET_BRL } from "./company";
import type { ClientType, OdcItem } from "./types";

export type CalcInput = {
  items: Pick<OdcItem, "qty" | "listPriceUsd">[];
  dollarRate: number;
  discountPct: number;
  clientType: ClientType;
  hubgovCreditPct: number;
  creditUsed: number;
};

export type CalcResult = {
  listTotalUsd: number;
  listTotalBrl: number;
  discountAmount: number;
  afterDiscount: number;
  creditGenerated: number;
  netTotalBrl: number;
  belowMinimum: boolean;
};

export function computeOdc(input: CalcInput): CalcResult {
  const listTotalUsd = input.items.reduce(
    (acc, it) => acc + (Number(it.qty) || 0) * (Number(it.listPriceUsd) || 0),
    0,
  );
  const rate = Number(input.dollarRate) || 0;
  const listTotalBrl = listTotalUsd * rate;
  const discountPct = Math.max(0, Number(input.discountPct) || 0);
  const discountAmount = listTotalBrl * (discountPct / 100);
  const afterDiscount = listTotalBrl - discountAmount;
  const pct =
    input.clientType === "governo"
      ? Math.max(0, Number(input.hubgovCreditPct) || 0)
      : 0;
  const creditGenerated = input.clientType === "governo" ? listTotalBrl * (pct / 100) : 0;
  const creditUsed = Math.max(0, Number(input.creditUsed) || 0);
  const netTotalBrl = afterDiscount - creditUsed;
  const belowMinimum = creditUsed > 0 && netTotalBrl < MIN_NET_BRL;
  return {
    listTotalUsd,
    listTotalBrl,
    discountAmount,
    afterDiscount,
    creditGenerated,
    netTotalBrl,
    belowMinimum,
  };
}

export function buildMemo(input: CalcInput & CalcResult): string {
  const lines = [
    "Memória de cálculo — Ordem de Compra",
    `Lista USD: ${input.listTotalUsd.toFixed(2)}`,
    `Câmbio do dia: R$ ${input.dollarRate.toFixed(4)}`,
    `Lista BRL: R$ ${input.listTotalBrl.toFixed(2)}`,
    `Desconto (${input.discountPct}%): − R$ ${input.discountAmount.toFixed(2)}`,
    `Após desconto: R$ ${input.afterDiscount.toFixed(2)}`,
  ];
  if (input.clientType === "governo") {
    lines.push(
      `Crédito HubGov gerado (${input.hubgovCreditPct || DEFAULT_HUBGOV_PCT}% sobre lista): R$ ${input.creditGenerated.toFixed(2)}`,
    );
  } else {
    lines.push("Cliente privado — não gera crédito HubGov.");
  }
  lines.push(`Crédito utilizado: R$ ${input.creditUsed.toFixed(2)}`);
  lines.push(`Valor líquido: R$ ${input.netTotalBrl.toFixed(2)}`);
  if (input.belowMinimum) {
    lines.push(`Atenção: valor líquido inferior ao mínimo de R$ ${MIN_NET_BRL.toFixed(2)}.`);
  }
  return lines.join("\n");
}
