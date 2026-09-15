import { SIGNATURE_IDENTITY } from "@/lib/company";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SignatureField() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Assinatura</CardTitle>
        <CardDescription>Assine no espaço acima da identificação já digitada.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mx-auto max-w-sm text-center">
          <div className="mb-1 h-28 rounded-sm border border-dashed border-foreground/30 bg-white" />
          <div className="border-t border-foreground pt-3 text-sm leading-relaxed text-foreground">
            <p>{SIGNATURE_IDENTITY.role}</p>
            <p>{SIGNATURE_IDENTITY.company}</p>
            <p>{SIGNATURE_IDENTITY.cnpjLine}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
