import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { lat, lon } = await req.json();

    const latitude = lat ?? 28.6139;
    const longitude = lon ?? 77.209;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=auto&forecast_days=7`;

    const response = await fetch(url);
    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "Weather service unavailable" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const current = {
      temp: Math.round(data.current?.temperature_2m ?? 0),
      humidity: data.current?.relative_humidity_2m ?? 0,
      wind: Math.round(data.current?.wind_speed_10m ?? 0),
      rain: data.current?.precipitation ?? 0,
      weatherCode: data.current?.weather_code ?? 0,
      description: weatherCodeToDescription(data.current?.weather_code ?? 0),
    };

    const forecast = (data.daily?.time ?? []).map((date: string, i: number) => ({
      date,
      temp_max: Math.round(data.daily?.temperature_2m_max?.[i] ?? 0),
      temp_min: Math.round(data.daily?.temperature_2m_min?.[i] ?? 0),
      rain: data.daily?.precipitation_sum?.[i] ?? 0,
      weatherCode: data.daily?.weather_code?.[i] ?? 0,
      description: weatherCodeToDescription(data.daily?.weather_code?.[i] ?? 0),
    }));

    return new Response(
      JSON.stringify({ current, forecast }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Weather function error:", error.message);
    return new Response(
      JSON.stringify({ error: "Failed to fetch weather data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
