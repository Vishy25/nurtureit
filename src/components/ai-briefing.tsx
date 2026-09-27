import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateBriefing } from "@/lib/ai-insights.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Result = Awaited<ReturnType<typeof generateBriefing>>;

export function AiBriefing({ tenantId }: { tenantId: string }) {
  const run = useServerFn(generateBriefing);
  const [res, setRes] = useState<Result | null>(null);
  const gen = useMutation({
    mutationFn: () => run({ data: { tenantId } }),
    onSuccess: setRes,
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle>Executive briefing</CardTitle>
          <CardDescription>AI summary of the last 30 days. Every point cites the metric it is based on.</CardDescription>
        </div>
        <Button size="sm" variant="outline" disabled={gen.isPending} onClick={() => gen.mutate()}>
          <Sparkles className="mr-1 h-4 w-4" />{gen.isPending ? "Writing…" : res ? "Refresh" : "Generate"}
        </Button>
      </CardHeader>
      {res && (
        <CardContent className="space-y-3 text-sm">
          <p className="font-medium">{res.output.headline}</p>
          <ul className="list-disc space-y-1 pl-5">
            {res.output.points.map((p, i) => (
              <li key={i}>{p.text}{p.citations.map((c) => <sup key={c} className="ml-1 text-xs text-muted-foreground">[{c}]</sup>)}</li>
            ))}
          </ul>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Sources ({Object.keys(res.metrics).length} metrics, {new Date(res.generatedAt).toLocaleString()})</summary>
            <ul className="mt-1 space-y-0.5">
              {Object.entries(res.metrics).map(([k, m]) => <li key={k}>[{k}] {m.label}: <span className="text-foreground">{m.value}</span></li>)}
            </ul>
          </details>
        </CardContent>
      )}
    </Card>
  );
}
