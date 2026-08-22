import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const LANGUAGE_INSTRUCTIONS: Record<string, string> = {
  en: "Respond entirely in English.",
  hi: "Respond entirely in Hindi (हिन्दी). Use Devanagari script.",
  bn: "Respond entirely in Bengali (বাংলা). Use Bengali script.",
  mr: "Respond entirely in Marathi (मराठी). Use Devanagari script.",
  ta: "Respond entirely in Tamil (தமிழ்). Use Tamil script.",
};

function buildPrompt(language: string) {
  const langInstruction = LANGUAGE_INSTRUCTIONS[language] || LANGUAGE_INSTRUCTIONS.en;
  return `You are an expert agricultural plant pathologist and crop disease diagnostician with deep knowledge of fertilizers and nutrient management. Analyze this crop image carefully and provide a comprehensive diagnostic report.

You MUST identify ALL problems visible in the image, not just the primary one. List every disease, pest, deficiency, or environmental stress you can observe.

${langInstruction} All text fields in the JSON response (crop, issue, allProblems, symptoms, affectedParts, suggestedActions, organicTreatment, chemicalTreatment, fertilizerName, fertilizerType, fertilizerQuantity, fertilizerFrequency, fertilizerApplication, prevention, treatmentTimeline, estimatedImpact) must be written in ${language === 'en' ? 'English' : language === 'hi' ? 'Hindi' : language === 'bn' ? 'Bengali' : language === 'mr' ? 'Marathi' : language === 'ta' ? 'Tamil' : 'English'}. However, keep the JSON keys and the enum values for diseaseType (Fungal, Bacterial, Viral, Pest, Nutrient Deficiency, Environmental, Healthy, Other) and severity (Low, Moderate, High, Critical, None) in English exactly as specified.

Respond in JSON format ONLY with this exact structure:
{
  "crop": "string - identified crop name and variety if possible",
  "issue": "string - the primary disease or problem identified (most severe)",
  "allProblems": "string - a numbered list of ALL problems found in the image (e.g., '1. Leaf blight (fungal) - yellowing on lower leaves\\n2. Nitrogen deficiency - pale green overall color\\n3. Aphid infestation - small insects on stems'). Include every issue you can see, even minor ones.",
  "diseaseType": "string - one of: Fungal, Bacterial, Viral, Pest, Nutrient Deficiency, Environmental, Healthy, Other",
  "severity": "string - one of: Low, Moderate, High, Critical, None",
  "confidence": number - 0 to 100,
  "symptoms": "string - detailed description of ALL visible symptoms observed across every problem",
  "affectedParts": "string - which parts of the plant are affected (leaves, stem, roots, fruit, etc.)",
  "suggestedActions": "string - immediate steps the farmer should take right now for each problem",
  "organicTreatment": "string - organic/natural treatment options for each problem",
  "chemicalTreatment": "string - chemical treatment options with specific product names and active ingredients for each problem",
  "fertilizerName": "string - specific fertilizer recommendation (e.g., 'Urea', 'DAP (Di-Ammonium Phosphate)', 'NPK 19-19-19', 'Zinc Sulphate'). If no fertilizer needed, say 'Not required'",
  "fertilizerType": "string - category of fertilizer (e.g., 'Nitrogen fertilizer', 'Phosphatic fertilizer', 'Micronutrient', 'Organic manure', 'Compound fertilizer', 'Not required')",
  "fertilizerQuantity": "string - exact quantity to use per acre or per plant (e.g., '25 kg per acre', '5 g per plant', '10 kg per acre basal + 10 kg top dressing')",
  "fertilizerFrequency": "string - how often to apply and for how many days total (e.g., 'Apply once at basal and again 30 days after sowing. Repeat every 15 days for 2 months', 'Single application at flowering. Total duration: 1 day', 'Apply every 7 days for 3 weeks starting from symptom appearance')",
  "fertilizerApplication": "string - step-by-step method of application (e.g., '1. Dissolve 5g in 1 litre water\\n2. Spray on leaves in early morning or evening\\n3. Avoid spraying during rain or strong sunlight\\n4. Ensure uniform coverage on both leaf surfaces')",
  "prevention": "string - long-term prevention strategies",
  "treatmentTimeline": "string - expected timeline for recovery (e.g., '7-14 days with treatment')",
  "estimatedImpact": "string - estimated impact on yield if untreated (e.g., '20-40% yield loss possible')"
}

Be precise, practical, and specific. Use real fertilizer names and dosages appropriate for Indian agriculture. If the crop appears healthy, set diseaseType to "Healthy", severity to "None", fertilizerName to 'Balanced NPK maintenance dose', and describe any minor concerns. If you cannot identify the crop, say "Unknown crop".`;
}

function parseResult(text: string) {
  let parsed: any = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = { crop: "Unknown", issue: text.substring(0, 500), confidence: 50 };
  }
  return {
    crop: parsed.crop || "Unknown",
    issue: parsed.issue || "Could not determine",
    allProblems: parsed.allProblems || "",
    diseaseType: parsed.diseaseType || "Other",
    severity: parsed.severity || "None",
    confidence: parsed.confidence || 0,
    symptoms: parsed.symptoms || "",
    affectedParts: parsed.affectedParts || "",
    suggestedActions: parsed.suggestedActions || "",
    organicTreatment: parsed.organicTreatment || "",
    chemicalTreatment: parsed.chemicalTreatment || "",
    fertilizerName: parsed.fertilizerName || "Not required",
    fertilizerType: parsed.fertilizerType || "Not required",
    fertilizerQuantity: parsed.fertilizerQuantity || "",
    fertilizerFrequency: parsed.fertilizerFrequency || "",
    fertilizerApplication: parsed.fertilizerApplication || "",
    prevention: parsed.prevention || "",
    treatmentTimeline: parsed.treatmentTimeline || "",
    estimatedImpact: parsed.estimatedImpact || "",
    advisoryNote: "AI analysis is advisory and should be verified by an agricultural expert for serious crop problems.",
    configured: true,
  };
}

async function analyzeWithOpenAI(imageBase64: string, mimeType: string, language: string): Promise<any> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("NO_OPENAI_KEY");

  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;
  const promptText = buildPrompt(language);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: promptText },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("OpenAI Vision API error:", errText);
    throw new Error("OPENAI_API_ERROR");
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content || "";
  return parseResult(text);
}

async function analyzeWithGemini(imageBase64: string, mimeType: string, language: string): Promise<any> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("NO_GEMINI_KEY");

  const promptText = buildPrompt(language);

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 4096 },
      }),
    }
  );

  if (!response.ok) {
    const errText = await response.text();
    console.error("Gemini Vision API error:", errText);
    throw new Error("GEMINI_API_ERROR");
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  return parseResult(text);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { imageBase64, mimeType, language } = await req.json();

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!openaiKey && !geminiKey) {
      return new Response(
        JSON.stringify({
          crop: "Unknown",
          issue: "AI analysis is not available. (Neither OPENAI_API_KEY nor GEMINI_API_KEY is configured)",
          confidence: 0,
          symptoms: "",
          suggestedActions: "Please configure an AI API key to enable crop disease detection.",
          prevention: "",
          configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = null;

    if (openaiKey) {
      try {
        result = await analyzeWithOpenAI(imageBase64, mimeType, language || "en");
      } catch (e) {
        console.error("OpenAI failed, trying Gemini:", e.message);
        if (geminiKey) {
          try {
            result = await analyzeWithGemini(imageBase64, mimeType, language || "en");
          } catch (e2) {
            console.error("Gemini also failed:", e2.message);
          }
        }
      }
    } else if (geminiKey) {
      try {
        result = await analyzeWithGemini(imageBase64, mimeType, language || "en");
      } catch (e) {
        console.error("Gemini failed:", e.message);
      }
    }

    if (!result) {
      return new Response(
        JSON.stringify({ error: "AI analysis failed. Please try again.", configured: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Crop analysis error:", error.message);
    return new Response(
      JSON.stringify({ error: "Something went wrong during analysis.", configured: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
