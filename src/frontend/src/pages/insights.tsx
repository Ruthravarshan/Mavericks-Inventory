import { useState } from "react";
import { Brain, RefreshCw, Send, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { useGetInventoryHealth, useNLQuery } from "@/hooks/use-queries";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { QUERY_KEYS } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/utils";
import type { InsightQueryResponse } from "@/types";

const SUGGESTED_QUERIES = [
  "Top 5 most distributed items this month",
  "Which items are below minimum stock level?",
  "What is the average approval time?",
  "Show me distributions by risk level",
  "Which departments request the most stock?",
  "Items with critical health scores",
];

interface QueryHistoryItem {
  query: string;
  response: InsightQueryResponse;
  timestamp: Date;
}

export default function InsightsPage() {
  const qc = useQueryClient();
  const { data: health, isLoading: healthLoading } = useGetInventoryHealth();
  const nlQuery = useNLQuery();

  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [currentResult, setCurrentResult] = useState<InsightQueryResponse | null>(null);

  async function handleQuery(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setQuery("");
    try {
      const result = await nlQuery.mutateAsync(trimmed);
      setCurrentResult(result);
      setHistory((prev) => [{ query: trimmed, response: result, timestamp: new Date() }, ...prev.slice(0, 4)]);
    } catch {
      // AI unavailable
    }
  }

  function handleRefreshHealth() {
    void qc.invalidateQueries({ queryKey: QUERY_KEYS.INVENTORY_HEALTH });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">AI Insights</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Intelligent inventory analysis powered by Azure OpenAI
        </p>
      </div>

      {/* AI Health Card */}
      <Card className="bg-gradient-to-br from-slate-800 via-slate-800 to-teal-900/20 border-teal-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-[hsl(var(--primary))]" />
              <CardTitle className="text-base">Inventory Health Assessment</CardTitle>
            </div>
            <div className="flex items-center gap-3">
              {health && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Refreshed {formatRelativeTime(health.last_refreshed)}
                </span>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefreshHealth}
                disabled={healthLoading}
              >
                <RefreshCw className={`h-4 w-4 ${healthLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ) : !health ? (
            <div className="flex items-center gap-3 text-[hsl(var(--muted-foreground))]">
              <AlertCircle className="h-5 w-5" />
              <p>AI insights unavailable. Please check Azure OpenAI configuration.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Health score */}
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-900">
                  <span className={`text-3xl font-bold ${
                    health.health_score >= 70 ? "text-green-400" :
                    health.health_score >= 40 ? "text-yellow-400" : "text-red-400"
                  }`}>
                    {health.health_score}
                  </span>
                </div>
                <div>
                  <p className="font-medium">Overall Health Score</p>
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">{health.summary}</p>
                </div>
              </div>

              <Separator />

              <div className="grid gap-6 lg:grid-cols-2">
                {/* Observations */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    Key Observations
                  </h3>
                  <ul className="space-y-2">
                    {health.observations.map((obs, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
                        <span>{obs}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Actions */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                    Recommended Actions
                  </h3>
                  <ul className="space-y-2">
                    {health.recommended_actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[hsl(var(--primary))]" />
                        <span>{action}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Conversational Query */}
      <Card className="bg-slate-800/50 border-slate-700/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[hsl(var(--primary))]" />
            <CardTitle className="text-base">Ask Inventory</CardTitle>
          </div>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Ask questions about your inventory in plain English
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Suggested queries */}
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => handleQuery(q)}
                className="rounded-full border border-[hsl(var(--border))] bg-slate-900/50 px-3 py-1.5 text-xs text-[hsl(var(--muted-foreground))] transition-colors hover:border-[hsl(var(--primary))]/50 hover:text-[hsl(var(--foreground))]"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="e.g. What are the top 5 items by distribution volume?"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuery(query)}
              className="flex-1"
            />
            <Button
              onClick={() => handleQuery(query)}
              disabled={!query.trim() || nlQuery.isPending}
            >
              {nlQuery.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Ask
            </Button>
          </div>

          {/* Current result */}
          {nlQuery.isPending && (
            <div className="space-y-3 rounded-lg bg-slate-900/50 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}

          {currentResult && !nlQuery.isPending && (
            <div className="rounded-lg border border-[hsl(var(--primary))]/20 bg-[hsl(var(--primary))]/5 p-4 space-y-4">
              <div>
                <p className="text-xs font-medium text-[hsl(var(--primary))]">Query</p>
                <p className="text-sm font-medium">{currentResult.query}</p>
              </div>

              <div>
                <p className="text-xs font-medium text-[hsl(var(--muted-foreground))]">Answer</p>
                <p className="text-sm">{currentResult.answer}</p>
              </div>

              <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <span>Confidence: {Math.round(currentResult.confidence * 100)}%</span>
              </div>

              {currentResult.data && currentResult.data.length > 0 && currentResult.columns.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-[hsl(var(--muted-foreground))]">Data</p>
                  <div className="overflow-auto rounded-lg border border-[hsl(var(--border))]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {currentResult.columns.map((col) => (
                            <TableHead key={col} className="text-xs">{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {currentResult.data.slice(0, 10).map((row, i) => (
                          <TableRow key={i}>
                            {currentResult.columns.map((col) => (
                              <TableCell key={col} className="text-sm">
                                {String(row[col] ?? "—")}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}

          {nlQuery.isError && (
            <div className="flex items-center gap-3 rounded-lg bg-red-500/10 p-4 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <div>
                <p className="text-sm font-medium">AI query failed</p>
                <p className="text-xs text-red-400/70">Azure OpenAI may be unavailable. Please try again later.</p>
              </div>
            </div>
          )}

          {/* Query history */}
          {history.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-wide">
                Session History
              </p>
              <div className="space-y-2">
                {history.map((item, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentResult(item.response)}
                    className="w-full rounded-lg border border-[hsl(var(--border))] bg-slate-900/30 px-3 py-2 text-left text-sm transition-colors hover:border-[hsl(var(--primary))]/30"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-[hsl(var(--foreground))]">{item.query}</span>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-[hsl(var(--muted-foreground))]">
                      {item.response.answer}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
