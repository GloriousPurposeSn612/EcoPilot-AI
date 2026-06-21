import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { callGemini } from "@/lib/ai-gateway.server";
import {
  calculateFootprint,
  fallbackRecommendations,
  SOURCE_LABEL,
  type Recommendation,
} from "./calc";

const ProfileSchema = z.object({
  transport: z.enum(["walking", "bicycle", "public", "motorcycle", "car"]),
  diet: z.enum(["vegan", "vegetarian", "mixed", "high-meat"]),
  electricity: z.enum(["low", "medium", "high"]),
  shopping: z.enum(["minimal", "average", "frequent"]),
  flights: z.enum(["none", "occasional", "frequent"]),
});

const RecSchema = z.object({
  title: z.string().min(3).max(120),
  detail: z.string().min(10).max(500),
  impact: z.enum(["Low", "Medium", "High"]),
  difficulty: z.enum(["Easy", "Moderate", "Challenging"]),
  estimatedReductionKg: z.number().min(0).max(10000),
});

export interface CoachingResult {
  source: "ai" | "fallback";
  recommendations: Recommendation[];
  summary?: string;
  error?: string;
}

export const getCoachingPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ProfileSchema.parse(input))
  .handler(async ({ data }): Promise<CoachingResult> => {
    const footprint = calculateFootprint(data);
    const fallback = fallbackRecommendations(data, footprint);

    const system = `You are EcoPilot, a concise, friendly personal sustainability coach.
You write practical, evidence-based carbon reduction advice grounded in the user's lifestyle.
Always prioritize the user's largest emission source first.
Respond ONLY with valid JSON, no markdown fences, no commentary.`;

    const user = `User lifestyle:
- Transport: ${data.transport}
- Diet: ${data.diet}
- Home electricity: ${data.electricity}
- Shopping habits: ${data.shopping}
- Flights: ${data.flights}

Footprint analysis (deterministic):
- Total: ${footprint.total} kg CO2e/year (${footprint.category})
- Largest source: ${SOURCE_LABEL[footprint.largestSource]} (${Math.round(
      footprint.largestSourceShare * 100,
    )}%)
- Breakdown kg/yr: ${JSON.stringify(footprint.breakdown)}

Return JSON with shape:
{
  "summary": "2-3 sentence personalized weekly plan summary",
  "recommendations": [
    {
      "title": "short action title",
      "detail": "1-2 sentence concrete how-to",
      "impact": "Low" | "Medium" | "High",
      "difficulty": "Easy" | "Moderate" | "Challenging",
      "estimatedReductionKg": number
    }
  ]
}
Provide 4-6 recommendations. Start with the largest source. Be specific and realistic.`;

    try {
      const raw = await callGemini(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { timeoutMs: 12000 },
      );

      const cleaned = raw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```$/i, "")
        .trim();

      const parsed = JSON.parse(cleaned);
      const recs = z.array(RecSchema).min(1).max(8).parse(parsed.recommendations);
      const summary = typeof parsed.summary === "string" ? parsed.summary : undefined;
      return { source: "ai", recommendations: recs, summary };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown AI error";
      return {
        source: "fallback",
        recommendations: fallback,
        error: msg,
        summary: `Showing curated recommendations based on your largest emission source: ${SOURCE_LABEL[footprint.largestSource]}.`,
      };
    }
  });
