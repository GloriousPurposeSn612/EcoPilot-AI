import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { Leaf, Zap, TrendingDown, Sparkles, AlertCircle, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import {
  calculateFootprint,
  simulate,
  EMPTY_TOGGLES,
  SOURCE_LABEL,
  type Profile,
  type SimToggles,
  type Recommendation,
} from "@/features/carbon/calc";
import { getCoachingPlan } from "@/features/carbon/ai.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EcoPilot AI — Personal Carbon Reduction Coach" },
      {
        name: "description",
        content:
          "Calculate your carbon footprint, visualize your impact, and get AI-powered personalized sustainability recommendations.",
      },
      { property: "og:title", content: "EcoPilot AI — Personal Carbon Reduction Coach" },
      {
        property: "og:description",
        content:
          "Understand and reduce your carbon footprint with AI-powered eco-coaching.",
      },
    ],
  }),
  component: HomePage,
});

const ProfileSchema = z.object({
  transport: z.enum(["walking", "bicycle", "public", "motorcycle", "car"]),
  diet: z.enum(["vegan", "vegetarian", "mixed", "high-meat"]),
  electricity: z.enum(["low", "medium", "high"]),
  shopping: z.enum(["minimal", "average", "frequent"]),
  flights: z.enum(["none", "occasional", "frequent"]),
});

const DEFAULT_PROFILE: Profile = {
  transport: "car",
  diet: "mixed",
  electricity: "medium",
  shopping: "average",
  flights: "occasional",
};

const CATEGORY_COLOR: Record<string, string> = {
  Excellent: "bg-emerald-600",
  Good: "bg-green-600",
  Moderate: "bg-amber-500",
  "High Impact": "bg-orange-600",
  Critical: "bg-red-600",
};

const PIE_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toggles, setToggles] = useState<SimToggles>(EMPTY_TOGGLES);
  const [coaching, setCoaching] = useState<{
    loading: boolean;
    recommendations: Recommendation[];
    summary?: string;
    source?: "ai" | "fallback";
    error?: string;
  }>({ loading: false, recommendations: [] });

  const askCoach = useServerFn(getCoachingPlan);

  const form = useForm<Profile>({
    resolver: zodResolver(ProfileSchema),
    defaultValues: DEFAULT_PROFILE,
  });

  const footprint = useMemo(() => (profile ? calculateFootprint(profile) : null), [profile]);
  const sim = useMemo(
    () => (profile ? simulate(profile, toggles) : null),
    [profile, toggles],
  );

  async function onSubmit(values: Profile) {
    setProfile(values);
    setToggles(EMPTY_TOGGLES);
    setCoaching({ loading: true, recommendations: [] });
    try {
      const result = await askCoach({ data: values });
      setCoaching({
        loading: false,
        recommendations: result.recommendations,
        summary: result.summary,
        source: result.source,
        error: result.error,
      });
    } catch (err) {
      setCoaching({
        loading: false,
        recommendations: [],
        error: err instanceof Error ? err.message : "Could not load recommendations.",
      });
    }
  }

  const breakdownData = footprint
    ? (Object.keys(footprint.breakdown) as Array<keyof typeof footprint.breakdown>).map(
        (k) => ({ name: SOURCE_LABEL[k], value: footprint.breakdown[k] }),
      )
    : [];

  const comparisonData = footprint
    ? [
        { name: "You", value: footprint.total },
        { name: "Global avg", value: footprint.globalAverage },
        { name: "Sustainable target", value: 2000 },
      ]
    : [];

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Leaf aria-hidden className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight">EcoPilot AI</h1>
            <p className="text-xs text-muted-foreground">
              Personal carbon reduction coach
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <section aria-labelledby="intro-heading" className="mb-8">
          <h2 id="intro-heading" className="text-3xl font-bold tracking-tight">
            Understand and shrink your footprint.
          </h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Answer five quick questions. Get a transparent carbon score, visual analytics,
            and an AI-powered weekly plan tailored to your largest emission source.
          </p>
        </section>

        <div className="grid gap-6 lg:grid-cols-[420px_1fr]">
          {/* FORM */}
          <Card>
            <CardHeader>
              <CardTitle>Your lifestyle</CardTitle>
              <CardDescription>All calculations stay on this device.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
                aria-describedby="form-help"
              >
                <p id="form-help" className="sr-only">
                  Select an option for each lifestyle category, then calculate your footprint.
                </p>

                <SelectField
                  id="transport"
                  label="Primary transportation"
                  value={form.watch("transport")}
                  onChange={(v) => form.setValue("transport", v as Profile["transport"])}
                  options={[
                    { value: "walking", label: "Walking" },
                    { value: "bicycle", label: "Bicycle" },
                    { value: "public", label: "Public transport" },
                    { value: "motorcycle", label: "Motorcycle" },
                    { value: "car", label: "Car" },
                  ]}
                />
                <SelectField
                  id="diet"
                  label="Diet"
                  value={form.watch("diet")}
                  onChange={(v) => form.setValue("diet", v as Profile["diet"])}
                  options={[
                    { value: "vegan", label: "Vegan" },
                    { value: "vegetarian", label: "Vegetarian" },
                    { value: "mixed", label: "Mixed diet" },
                    { value: "high-meat", label: "High meat consumption" },
                  ]}
                />
                <SelectField
                  id="electricity"
                  label="Home electricity usage"
                  value={form.watch("electricity")}
                  onChange={(v) => form.setValue("electricity", v as Profile["electricity"])}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                />
                <SelectField
                  id="shopping"
                  label="Shopping habits"
                  value={form.watch("shopping")}
                  onChange={(v) => form.setValue("shopping", v as Profile["shopping"])}
                  options={[
                    { value: "minimal", label: "Minimal" },
                    { value: "average", label: "Average" },
                    { value: "frequent", label: "Frequent" },
                  ]}
                />
                <SelectField
                  id="flights"
                  label="Flight frequency"
                  value={form.watch("flights")}
                  onChange={(v) => form.setValue("flights", v as Profile["flights"])}
                  options={[
                    { value: "none", label: "None" },
                    { value: "occasional", label: "Occasional (1–2 / year)" },
                    { value: "frequent", label: "Frequent (3+ / year)" },
                  ]}
                />

                <Button type="submit" className="w-full" size="lg">
                  <Sparkles aria-hidden className="mr-2 h-4 w-4" />
                  Calculate my footprint
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* RESULTS */}
          <div className="space-y-6">
            {!footprint && (
              <Card className="flex h-full min-h-[400px] items-center justify-center border-dashed">
                <CardContent className="pt-6 text-center">
                  <Leaf aria-hidden className="mx-auto h-12 w-12 text-primary/40" />
                  <p className="mt-4 text-muted-foreground">
                    Your personalized footprint analysis will appear here.
                  </p>
                </CardContent>
              </Card>
            )}

            {footprint && sim && profile && (
              <>
                {/* SCORE */}
                <Card>
                  <CardHeader>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <CardTitle>Your annual footprint</CardTitle>
                        <CardDescription>{footprint.explanation}</CardDescription>
                      </div>
                      <Badge
                        className={`${CATEGORY_COLOR[footprint.category]} text-white`}
                        aria-label={`Category: ${footprint.category}`}
                      >
                        {footprint.category}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Metric
                        label="Total CO₂e / year"
                        value={`${footprint.total.toLocaleString()} kg`}
                      />
                      <Metric label="Per day" value={`${footprint.perDay} kg`} />
                      <Metric
                        label="Largest source"
                        value={`${SOURCE_LABEL[footprint.largestSource]} (${Math.round(
                          footprint.largestSourceShare * 100,
                        )}%)`}
                      />
                    </div>
                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-muted-foreground">
                        <span>vs global average ({footprint.globalAverage} kg)</span>
                        <span>
                          {Math.round((footprint.total / footprint.globalAverage) * 100)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(
                          200,
                          (footprint.total / footprint.globalAverage) * 100,
                        )}
                        aria-label="Your footprint relative to global average"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* CHARTS */}
                <div className="grid gap-6 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Emission breakdown</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64" role="img" aria-label="Pie chart of emission sources">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={breakdownData}
                              dataKey="value"
                              nameKey="name"
                              outerRadius={80}
                              label={(d: { name: string; percent?: number }) =>
                                `${d.name} ${Math.round((d.percent ?? 0) * 100)}%`
                              }
                            >
                              {breakdownData.map((_, i) => (
                                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip formatter={(v: number) => `${v} kg`} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">How you compare</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div
                        className="h-64"
                        role="img"
                        aria-label="Bar chart comparing your footprint to global average and sustainable target"
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={comparisonData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="name" fontSize={12} />
                            <YAxis fontSize={12} />
                            <Tooltip formatter={(v: number) => `${v} kg`} />
                            <Bar dataKey="value" fill="var(--color-chart-1)" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* SIMULATOR */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingDown aria-hidden className="h-5 w-5 text-primary" />
                      Simulation engine
                    </CardTitle>
                    <CardDescription>
                      Toggle changes and see the projected impact instantly.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <ToggleRow
                        id="t-transit"
                        label="Public transport twice weekly"
                        checked={toggles.publicTransportTwiceWeekly}
                        onChange={(v) =>
                          setToggles((t) => ({ ...t, publicTransportTwiceWeekly: v }))
                        }
                      />
                      <ToggleRow
                        id="t-meat"
                        label="One meat-free day per week"
                        checked={toggles.oneMeatFreeDay}
                        onChange={(v) => setToggles((t) => ({ ...t, oneMeatFreeDay: v }))}
                      />
                      <ToggleRow
                        id="t-elec"
                        label="Reduce home electricity 20%"
                        checked={toggles.reduceElectricity}
                        onChange={(v) => setToggles((t) => ({ ...t, reduceElectricity: v }))}
                      />
                      <ToggleRow
                        id="t-fly"
                        label="Halve flight frequency"
                        checked={toggles.fewerFlights}
                        onChange={(v) => setToggles((t) => ({ ...t, fewerFlights: v }))}
                      />
                      <ToggleRow
                        id="t-shop"
                        label="Mindful shopping (-30%)"
                        checked={toggles.mindfulShopping}
                        onChange={(v) => setToggles((t) => ({ ...t, mindfulShopping: v }))}
                      />
                    </div>

                    <div className="mt-6 grid gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-4">
                      <Metric label="Current" value={`${footprint.total.toLocaleString()} kg`} />
                      <Metric
                        label="Projected"
                        value={`${sim.projectedTotal.toLocaleString()} kg`}
                        accent
                      />
                      <Metric label="Reduction" value={`${sim.reductionPct}%`} accent />
                      <Metric
                        label="Annual savings"
                        value={`$${sim.annualSavingsUsd.toLocaleString()}`}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* COACHING */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles aria-hidden className="h-5 w-5 text-accent" />
                      Your AI sustainability plan
                    </CardTitle>
                    {coaching.summary && (
                      <CardDescription>{coaching.summary}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    {coaching.loading && (
                      <div
                        className="flex items-center gap-2 text-muted-foreground"
                        aria-live="polite"
                      >
                        <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
                        Generating personalized recommendations…
                      </div>
                    )}

                    {!coaching.loading && coaching.source === "fallback" && (
                      <Alert className="mb-4">
                        <AlertCircle aria-hidden className="h-4 w-4" />
                        <AlertTitle>Showing curated recommendations</AlertTitle>
                        <AlertDescription>
                          AI coach unavailable right now — these are deterministic, evidence-based
                          recommendations prioritized for your largest emission source.
                        </AlertDescription>
                      </Alert>
                    )}

                    {!coaching.loading && coaching.recommendations.length > 0 && (
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {coaching.recommendations.map((rec, i) => (
                          <li
                            key={i}
                            className="rounded-lg border bg-card p-4 transition hover:shadow-md"
                          >
                            <h3 className="font-semibold">{rec.title}</h3>
                            <p className="mt-1 text-sm text-muted-foreground">{rec.detail}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <Badge variant="secondary">Impact: {rec.impact}</Badge>
                              <Badge variant="outline">Difficulty: {rec.difficulty}</Badge>
                              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-primary">
                                <Zap aria-hidden className="h-3 w-3" />
                                ~{rec.estimatedReductionKg} kg/yr
                              </span>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    {!coaching.loading &&
                      coaching.recommendations.length === 0 &&
                      coaching.error && (
                        <Alert variant="destructive">
                          <AlertCircle aria-hidden className="h-4 w-4" />
                          <AlertTitle>Recommendations unavailable</AlertTitle>
                          <AlertDescription>{coaching.error}</AlertDescription>
                        </Alert>
                      )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>

        <footer className="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
          EcoPilot AI · Calculations are estimation models for awareness, not certified accounting.
        </footer>
      </main>
    </div>
  );
}

/* ---------------- small helpers ---------------- */

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger id={id} aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-md border bg-card p-3">
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-1 text-xl font-semibold ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </div>
    </div>
  );
}

// avoid unused import lint
void useRouter;
