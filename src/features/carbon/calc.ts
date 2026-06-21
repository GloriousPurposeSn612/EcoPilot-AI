/**
 * Deterministic carbon footprint calculator.
 * All values are rough annual CO2e estimates (kg/year) derived from publicly
 * available lifestyle averages. Logic is intentionally transparent and audit-friendly.
 */

export type Transport = "walking" | "bicycle" | "public" | "motorcycle" | "car";
export type Diet = "vegan" | "vegetarian" | "mixed" | "high-meat";
export type Electricity = "low" | "medium" | "high";
export type Shopping = "minimal" | "average" | "frequent";
export type Flights = "none" | "occasional" | "frequent";

export interface Profile {
  transport: Transport;
  diet: Diet;
  electricity: Electricity;
  shopping: Shopping;
  flights: Flights;
}

export const TRANSPORT_KG: Record<Transport, number> = {
  walking: 0,
  bicycle: 50,
  public: 700,
  motorcycle: 1800,
  car: 3500,
};

export const DIET_KG: Record<Diet, number> = {
  vegan: 1000,
  vegetarian: 1500,
  mixed: 2500,
  "high-meat": 3700,
};

export const ELECTRICITY_KG: Record<Electricity, number> = {
  low: 800,
  medium: 1800,
  high: 3200,
};

export const SHOPPING_KG: Record<Shopping, number> = {
  minimal: 500,
  average: 1500,
  frequent: 3000,
};

export const FLIGHTS_KG: Record<Flights, number> = {
  none: 0,
  occasional: 900,
  frequent: 3500,
};

export interface Breakdown {
  transport: number;
  diet: number;
  electricity: number;
  shopping: number;
  flights: number;
}

export interface Footprint {
  total: number; // kg CO2e / year
  breakdown: Breakdown;
  category: "Excellent" | "Good" | "Moderate" | "High Impact" | "Critical";
  explanation: string;
  largestSource: keyof Breakdown;
  largestSourceShare: number; // 0-1
  globalAverage: number;
  perDay: number;
}

const GLOBAL_AVG = 4800; // kg CO2e per capita / year (approx world average)

export function calculateFootprint(p: Profile): Footprint {
  const breakdown: Breakdown = {
    transport: TRANSPORT_KG[p.transport],
    diet: DIET_KG[p.diet],
    electricity: ELECTRICITY_KG[p.electricity],
    shopping: SHOPPING_KG[p.shopping],
    flights: FLIGHTS_KG[p.flights],
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);

  const entries = Object.entries(breakdown) as [keyof Breakdown, number][];
  entries.sort((a, b) => b[1] - a[1]);
  const [largestSource, largestValue] = entries[0];
  const largestSourceShare = total > 0 ? largestValue / total : 0;

  let category: Footprint["category"];
  if (total < 3000) category = "Excellent";
  else if (total < 6000) category = "Good";
  else if (total < 9000) category = "Moderate";
  else if (total < 13000) category = "High Impact";
  else category = "Critical";

  const explanation =
    total < GLOBAL_AVG
      ? `Your footprint is below the global per-capita average (${GLOBAL_AVG} kg).`
      : `Your footprint is above the global per-capita average (${GLOBAL_AVG} kg).`;

  return {
    total,
    breakdown,
    category,
    explanation,
    largestSource,
    largestSourceShare,
    globalAverage: GLOBAL_AVG,
    perDay: Math.round(total / 365),
  };
}

export const SOURCE_LABEL: Record<keyof Breakdown, string> = {
  transport: "Transportation",
  diet: "Food & Diet",
  electricity: "Home Electricity",
  shopping: "Shopping",
  flights: "Flights",
};

/* ---------------- Simulation ---------------- */

export interface SimToggles {
  publicTransportTwiceWeekly: boolean;
  oneMeatFreeDay: boolean;
  reduceElectricity: boolean;
  fewerFlights: boolean;
  mindfulShopping: boolean;
}

export const EMPTY_TOGGLES: SimToggles = {
  publicTransportTwiceWeekly: false,
  oneMeatFreeDay: false,
  reduceElectricity: false,
  fewerFlights: false,
  mindfulShopping: false,
};

export interface Simulation {
  projectedTotal: number;
  reductionKg: number;
  reductionPct: number;
  annualSavingsUsd: number; // rough cost-of-carbon proxy
  projectedBreakdown: Breakdown;
}

export function simulate(p: Profile, t: SimToggles): Simulation {
  const base = calculateFootprint(p);
  const b: Breakdown = { ...base.breakdown };

  if (t.publicTransportTwiceWeekly && p.transport === "car") {
    // Replace ~2/7 of car miles with public transport
    const replaced = (TRANSPORT_KG.car - TRANSPORT_KG.public) * (2 / 7);
    b.transport = Math.max(0, b.transport - replaced);
  }
  if (t.oneMeatFreeDay && (p.diet === "mixed" || p.diet === "high-meat")) {
    const veg = DIET_KG.vegetarian;
    b.diet = b.diet - (b.diet - veg) * (1 / 7);
  }
  if (t.reduceElectricity && p.electricity !== "low") {
    b.electricity = b.electricity * 0.8; // 20% reduction
  }
  if (t.fewerFlights && p.flights !== "none") {
    b.flights = b.flights * 0.5;
  }
  if (t.mindfulShopping && p.shopping !== "minimal") {
    b.shopping = b.shopping * 0.7;
  }

  const projectedTotal = Math.round(Object.values(b).reduce((a, c) => a + c, 0));
  const reductionKg = Math.max(0, base.total - projectedTotal);
  const reductionPct = base.total > 0 ? (reductionKg / base.total) * 100 : 0;
  // Social cost of carbon proxy ≈ $50/tonne
  const annualSavingsUsd = Math.round((reductionKg / 1000) * 50);

  return {
    projectedTotal,
    reductionKg: Math.round(reductionKg),
    reductionPct: Math.round(reductionPct * 10) / 10,
    annualSavingsUsd,
    projectedBreakdown: {
      transport: Math.round(b.transport),
      diet: Math.round(b.diet),
      electricity: Math.round(b.electricity),
      shopping: Math.round(b.shopping),
      flights: Math.round(b.flights),
    },
  };
}

/* ---------------- Fallback Recommendations ---------------- */

export interface Recommendation {
  title: string;
  detail: string;
  impact: "Low" | "Medium" | "High";
  difficulty: "Easy" | "Moderate" | "Challenging";
  estimatedReductionKg: number;
}

export function fallbackRecommendations(p: Profile, f: Footprint): Recommendation[] {
  const recs: Recommendation[] = [];

  if (p.transport === "car") {
    recs.push({
      title: "Replace short car trips with biking or walking",
      detail:
        "Trips under 3 km contribute disproportionately to emissions. Replacing two short car trips per week meaningfully reduces transport CO₂.",
      impact: "High",
      difficulty: "Easy",
      estimatedReductionKg: 400,
    });
  }
  if (p.transport === "car" || p.transport === "motorcycle") {
    recs.push({
      title: "Use public transport twice per week",
      detail:
        "Switching ~2 commutes per week from private vehicle to public transit cuts roughly 28% of weekly transport emissions.",
      impact: "High",
      difficulty: "Moderate",
      estimatedReductionKg: 600,
    });
  }
  if (p.diet === "high-meat" || p.diet === "mixed") {
    recs.push({
      title: "Adopt one meat-free day per week",
      detail:
        "Replacing one meat-heavy day with plant-based meals reduces dietary emissions by ~14% without major lifestyle change.",
      impact: "Medium",
      difficulty: "Easy",
      estimatedReductionKg: 250,
    });
  }
  if (p.electricity === "high" || p.electricity === "medium") {
    recs.push({
      title: "Cut home electricity usage by 20%",
      detail:
        "Use smart power strips, switch to LED bulbs, and limit AC/heating by 2°C. Combined, these typically reduce home electricity ~20%.",
      impact: "Medium",
      difficulty: "Easy",
      estimatedReductionKg: 360,
    });
  }
  if (p.flights === "frequent") {
    recs.push({
      title: "Replace one long-haul flight with a rail or virtual option",
      detail:
        "A single long-haul flight can equal months of other emissions. Substitute one trip per year when possible.",
      impact: "High",
      difficulty: "Challenging",
      estimatedReductionKg: 1200,
    });
  }
  if (p.shopping === "frequent" || p.shopping === "average") {
    recs.push({
      title: "Practice mindful shopping",
      detail:
        "Buy second-hand, delay non-essential purchases by 30 days, and prefer durable goods. Reduces shopping emissions ~30%.",
      impact: "Medium",
      difficulty: "Moderate",
      estimatedReductionKg: 450,
    });
  }

  // Always prioritize largest source first
  const order: Record<keyof Breakdown, number> = {
    transport: 0,
    diet: 0,
    electricity: 0,
    shopping: 0,
    flights: 0,
  };
  order[f.largestSource] = -1;
  recs.sort((a, b) => {
    const ak = guessSource(a.title);
    const bk = guessSource(b.title);
    return (order[ak] ?? 0) - (order[bk] ?? 0);
  });

  return recs.slice(0, 6);
}

function guessSource(title: string): keyof Breakdown {
  const t = title.toLowerCase();
  if (t.includes("car") || t.includes("transport") || t.includes("bik") || t.includes("walk"))
    return "transport";
  if (t.includes("meat") || t.includes("diet") || t.includes("food")) return "diet";
  if (t.includes("electric") || t.includes("home") || t.includes("ac")) return "electricity";
  if (t.includes("flight") || t.includes("fly")) return "flights";
  return "shopping";
}
