import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MarketPrice {
  crop_name: string;
  price_per_kg: number;
  market: string;
  state: string;
  district: string;
  trend: string;
  change_percent: number;
  source: string;
  min_price: number;
  max_price: number;
  arrival_date: string;
}

interface PricePrediction {
  crop_name: string;
  current_price: number;
  predicted_price: number;
  trend: string;
  horizon_days: number;
  confidence: number;
  reasoning: string;
  advisory_note: string;
}

// Public demo key published on data.gov.in — not a secret.
const DATA_GOV_KEY = "579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b";
const AGMARKNET_RESOURCE = "9ef84268-d588-465a-a308-a864a43d0070";

function buildAgmarknetUrl(state: string, limit: number, offset: number): string {
  let url = `https://api.data.gov.in/resource/${AGMARKNET_RESOURCE}?api-key=${DATA_GOV_KEY}&format=json&limit=${limit}&offset=${offset}`;
  if (state) {
    url += `&filters%5Bstate.keyword%5D=${encodeURIComponent(state)}`;
  }
  return url;
}

function parseAgmarknetRecords(records: any[], fallbackState: string, fallbackDistrict: string): MarketPrice[] {
  const seen = new Set<string>();
  const prices: MarketPrice[] = [];

  for (const r of records) {
    const cropName = String(r.commodity || "").trim();
    if (!cropName) continue;

    const modal = Number(r.modal_price);
    const minP = Number(r.min_price);
    const maxP = Number(r.max_price);
    if (!modal || modal <= 0) continue;

    const market = String(r.market || "").trim();
    const state = String(r.state || fallbackState || "").trim();
    const district = String(r.district || fallbackDistrict || "").trim();
    const arrivalDate = String(r.arrival_date || "").trim();

    // Dedupe by crop+market — keep first occurrence
    const key = `${cropName}|${market}`;
    if (seen.has(key)) continue;
    seen.add(key);

    prices.push({
      crop_name: cropName,
      price_per_kg: Math.round((modal / 100) * 100) / 100,
      market,
      state,
      district,
      trend: "stable",
      change_percent: 0,
      source: "Agmarknet (Govt)",
      min_price: minP > 0 ? Math.round((minP / 100) * 100) / 100 : 0,
      max_price: maxP > 0 ? Math.round((maxP / 100) * 100) / 100 : 0,
      arrival_date: arrivalDate,
    });
  }

  return prices;
}

async function fetchAgmarknetPrices(state: string, district: string): Promise<MarketPrice[]> {
  // The demo key caps at 10 records per request. Fetch a few pages.
  const allRecords: any[] = [];
  const limit = 10;
  const maxPages = 20; // 200 records max per state

  for (let page = 0; page < maxPages; page++) {
    const url = buildAgmarknetUrl(state, limit, page * limit);
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "KishanBhai/1.0" },
      });
      if (!res.ok) break;
      const data = await res.json();
      const records = data?.records ?? [];
      if (!Array.isArray(records) || records.length === 0) break;
      allRecords.push(...records);
      // If we got fewer than the limit, we've reached the end
      if (records.length < limit) break;
    } catch {
      break;
    }
  }

  if (allRecords.length === 0) return [];

  let prices = parseAgmarknetRecords(allRecords, state, district);

  // If we have a district, filter to prefer records from that district
  if (district && prices.length > 0) {
    const districtPrices = prices.filter((p) =>
      p.district.toLowerCase().includes(district.toLowerCase())
    );
    if (districtPrices.length >= 5) {
      prices = districtPrices;
    }
  }

  // Limit to 15 crops, prefer variety
  return prices.slice(0, 15);
}

function buildPredictionQuery(currentPrices: MarketPrice[], state: string, district: string): string {
  const locStr = district && state ? `${district}, ${state}` : state || "India";
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const priceList = currentPrices.map((p) =>
    `- ${p.crop_name}: Rs.${p.price_per_kg}/kg (market: ${p.market}, min: ${p.min_price}/kg, max: ${p.max_price}/kg)`
  ).join('\n');

  return `Search the internet for current agricultural market trends, weather forecasts, seasonal demand patterns, and supply factors affecting crop prices in ${locStr}, India as of ${today}.

Here are the CURRENT real mandi prices I already have:
${priceList}

Based on your web search, analyze factors that will affect these crop prices over the next 30 days:
- Upcoming harvest season and expected supply
- Weather forecasts affecting crop yields
- Festival/seasonal demand changes
- Government policy changes (export/import bans, MSP announcements, stock limits)
- Current storage and transportation conditions
- Regional supply and demand imbalances

For EACH crop in my list above, predict the likely price in 30 days and provide reasoning.

Respond in JSON array format ONLY:
[
  {
    "crop_name": "string (must match one of the crops above)",
    "current_price": number (the current price per kg from my list),
    "predicted_price": number (predicted price per kg in 30 days, in INR),
    "trend": "up" | "down" | "stable",
    "horizon_days": 30,
    "confidence": number (0-100, how confident you are in this prediction),
    "reasoning": "2-3 sentence explanation citing specific factors found in your search",
    "advisory_note": "practical advice for the farmer about when to sell"
  }
]

Provide a prediction for EVERY crop in my list. Do not skip any.`;
}

function parsePredictions(text: string): PricePrediction[] {
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    const arr = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(arr)) return [];

    return arr.map((item: any) => ({
      crop_name: String(item.crop_name || "Unknown"),
      current_price: Math.max(0, Number(item.current_price) || 0),
      predicted_price: Math.max(0, Number(item.predicted_price) || 0),
      trend: ["up", "down", "stable"].includes(item.trend) ? item.trend : "stable",
      horizon_days: Math.max(1, Number(item.horizon_days) || 30),
      confidence: Math.min(100, Math.max(0, Number(item.confidence) || 0)),
      reasoning: String(item.reasoning || ""),
      advisory_note: String(item.advisory_note || "AI estimate — not a guaranteed price."),
    }));
  } catch {
    return [];
  }
}

async function reverseGeocode(lat: number, lng: number): Promise<{ state: string; district: string }> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "KishanBhai/1.0" },
    });
    if (!res.ok) return { state: "", district: "" };
    const data = await res.json();
    const addr = data.address || {};
    return {
      state: addr.state || addr.state_district || "",
      district: addr.county || addr.district || addr.state_district || "",
    };
  } catch {
    return { state: "", district: "" };
  }
}

async function callGeminiWithSearch(prompt: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) return "";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!res.ok) {
    console.error("Gemini error:", await res.text());
    return "";
  }

  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  let text = "";
  for (const part of parts) {
    if (part.text) text += part.text;
  }
  return text;
}

async function fetchPredictions(currentPrices: MarketPrice[], state: string, district: string): Promise<PricePrediction[]> {
  if (currentPrices.length === 0) return [];

  const prompt = buildPredictionQuery(currentPrices, state, district);
  const text = await callGeminiWithSearch(prompt);
  return parsePredictions(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const action = body.action || 'prices';
    const { latitude, longitude, state: inputState, district: inputDistrict } = body;

    let state = inputState || "";
    let district = inputDistrict || "";

    if (latitude && longitude && !state) {
      const geo = await reverseGeocode(latitude, longitude);
      state = geo.state;
      district = geo.district || inputDistrict;
    }

    // Action: predict — generate price predictions based on current real prices
    if (action === 'predict') {
      // Step 1: Get current real prices from Agmarknet API
      const currentPrices = await fetchAgmarknetPrices(state, district);

      if (currentPrices.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Could not fetch current prices to base predictions on. Please try again.",
            predictions: [],
            prices: [],
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Step 2: Generate predictions using Gemini + web search for trends
      const predictions = await fetchPredictions(currentPrices, state, district);

      if (predictions.length === 0) {
        return new Response(
          JSON.stringify({
            error: "Could not generate price predictions. Please try again.",
            predictions: [],
            prices: currentPrices,
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          predictions,
          prices: currentPrices,
          state,
          district,
          fetchedAt: new Date().toISOString(),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: prices — fetch live mandi prices from Agmarknet API
    const prices = await fetchAgmarknetPrices(state, district);

    if (prices.length === 0) {
      return new Response(
        JSON.stringify({
          error: "Could not fetch real-time market prices. The government price service may be temporarily unavailable. Please try again in a moment.",
          prices: [],
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        prices,
        state,
        district,
        fetchedAt: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Market prices error:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch market prices.", prices: [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
