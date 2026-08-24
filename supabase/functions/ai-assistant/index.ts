import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ChatMessage {
  role: string;
  content: string;
}

function weatherCodeToDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Showers";
  if (code <= 99) return "Thunderstorm";
  return "Unknown";
}

async function fetchWeather(lat: number, lon: number): Promise<string> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;
    const res = await fetch(url);
    if (!res.ok) return "Weather data unavailable.";
    const data = await res.json();

    const c = data.current;
    const desc = weatherCodeToDescription(c?.weather_code ?? 0);
    let summary = `Current weather: ${desc}, ${Math.round(c?.temperature_2m ?? 0)}°C, humidity ${c?.relative_humidity_2m ?? 0}%, wind ${Math.round(c?.wind_speed_10m ?? 0)} km/h, precipitation ${c?.precipitation ?? 0} mm.\n`;

    const daily = data.daily;
    if (daily?.time?.length) {
      summary += "7-day forecast:\n";
      for (let i = 0; i < Math.min(daily.time.length, 7); i++) {
        const dDesc = weatherCodeToDescription(daily.weather_code?.[i] ?? 0);
        summary += `  ${daily.time[i]}: ${dDesc}, ${Math.round(daily.temperature_2m_max?.[i] ?? 0)}°/${Math.round(daily.temperature_2m_min?.[i] ?? 0)}°C, rain ${daily.precipitation_sum?.[i] ?? 0}mm\n`;
      }
    }
    return summary.trim();
  } catch {
    return "Weather data unavailable.";
  }
}

async function fetchMarketPrices(): Promise<string> {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceKey) return "Market price data unavailable.";

    const res = await fetch(`${supabaseUrl}/rest/v1/market_prices?order=recorded_date.desc&limit=10`, {
      headers: {
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
    });
    if (!res.ok) return "Market price data unavailable.";
    const prices = await res.json();
    if (!Array.isArray(prices) || prices.length === 0) return "No market price data available yet.";

    const lines = prices.map((p: any) =>
      `${p.crop_name}: ₹${p.price_per_kg}/kg (${p.market || "local market"}, ${p.recorded_date})${p.is_demo ? " [demo]" : ""}`
    );
    return "Current market prices:\n" + lines.join("\n");
  } catch {
    return "Market price data unavailable.";
  }
}

async function callOpenAI(messages: any[], temperature: number, maxTokens: number): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("NO_OPENAI_KEY");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI API error:", errText);
    throw new Error("OPENAI_API_ERROR");
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || "";
}

async function callGemini(systemPrompt: string, history: ChatMessage[], temperature: number, maxTokens: number): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("NO_GEMINI_KEY");

  const contents = history.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini API error:", errText);
    throw new Error("GEMINI_API_ERROR");
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, messages, language, context, lat, lon } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!openaiKey && !geminiKey) {
      return new Response(
        JSON.stringify({
          reply: language === "hi"
            ? "AI सहायक अभी उपलब्ध नहीं है। कृपया बाद में पुनः प्रयास करें। (OPENAI_API_KEY या GEMINI_API_KEY कॉन्फ़िगर नहीं है)"
            : "AI assistant is not available right now. (Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured)",
          configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch real-time data in parallel
    const latitude = lat ?? 28.6139;
    const longitude = lon ?? 77.209;
    const [weatherData, marketData] = await Promise.all([
      fetchWeather(latitude, longitude),
      fetchMarketPrices(),
    ]);

    const systemPrompt = `You are Kishan Bhai, an AI farming assistant for small and marginal Indian farmers.
Respond in ${language === "hi" ? "Hindi (Devanagari script)" : "English"}.
Keep responses practical, concise, and farmer-friendly. Use simple language.
You help with: crop advice, fertilizer information, irrigation, harvest planning, weather interpretation, market information, farm records, and platform help.

${context ? `Farmer context: ${context}` : ""}

--- REAL-TIME WEATHER DATA (for farmer's location) ---
${weatherData}

--- CURRENT MARKET PRICES ---
${marketData}

When answering questions about weather, irrigation timing, or market prices, USE the real-time data above to give specific, actionable advice. Reference actual temperatures, rainfall forecasts, and market prices. Do not give generic advice when you have specific data.
Always remind that AI advice is advisory and should be verified with local agricultural experts for serious issues.`;

    // Build conversation
    const history: ChatMessage[] = Array.isArray(messages) && messages.length > 0
      ? messages
      : message
        ? [{ role: "user", content: message }]
        : [];

    if (history.length === 0) {
      return new Response(
        JSON.stringify({ reply: "Please ask a question.", configured: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let reply = "";

    // Try OpenAI first, fall back to Gemini
    if (openaiKey) {
      try {
        const openaiMessages = [
          { role: "system", content: systemPrompt },
          ...history.map((m: ChatMessage) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })),
        ];
        reply = await callOpenAI(openaiMessages, 0.7, 1024);
      } catch (e) {
        console.error("OpenAI failed, trying Gemini:", e.message);
        if (geminiKey) {
          try {
            reply = await callGemini(systemPrompt, history, 0.7, 1024);
          } catch (e2) {
            console.error("Gemini also failed:", e2.message);
          }
        }
      }
    } else if (geminiKey) {
      try {
        reply = await callGemini(systemPrompt, history, 0.7, 1024);
      } catch (e) {
        console.error("Gemini failed:", e.message);
      }
    }

    if (!reply) {
      reply = "AI service error. Please try again.";
    }

    return new Response(
      JSON.stringify({ reply, configured: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error.message);
    return new Response(
      JSON.stringify({ reply: "Something went wrong. Please try again.", configured: true, error: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
