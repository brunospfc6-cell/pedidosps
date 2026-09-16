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
          <div className="pt-3 text-sm leading-relaxed text-foreground">
            <p>{SIGNATURE_IDENTITY.role}</p>
            <p>{SIGNATURE_IDENTITY.company}</p>
            <p>{SIGNATURE_IDENTITY.cnpjLine}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
