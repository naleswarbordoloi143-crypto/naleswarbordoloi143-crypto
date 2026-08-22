import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const prompt = `You are an expert document verifier specializing in Indian agricultural and government certificates. Analyze this certificate image carefully and determine if it is a genuine, legitimate document or a fake/forged one.

Look for these indicators of authenticity:
1. Official letterhead, logos, or seals (e.g., KVK, Krishi Vigyan Kendra, Department of Agriculture, Panchayat, State Agriculture Department)
2. Government or institutional stamps and signatures
3. Proper formatting typical of Indian official documents
4. Names, dates, and details that are consistent and properly filled
5. Certificate type (e.g., agricultural training, extension officer appointment, KVK training, panchayat authorization, farmer facilitator)

Look for these indicators of forgery:
1. Missing or inconsistent official seals/stamps
2. Blurred or digitally manipulated text
3. Inconsistent fonts or formatting
4. Signs of digital editing (copy-paste artifacts, mismatched backgrounds)
5. Missing signatures or dates
6. Unofficial or non-standard document structure
7. A photo that is clearly NOT a certificate (e.g., a random photo, screenshot of text, or non-document image)

Respond in JSON format ONLY with this exact structure:
{
  "isGenuine": boolean - true if the certificate appears genuine, false if it appears fake or is not a certificate
  "certificateType": "string - the type of certificate identified (e.g., 'KVK Training Certificate', 'Panchayat Authorization', 'Agricultural Extension Officer', 'Farmer Facilitator Certificate'). If not a certificate, say 'Not a certificate'",
  "confidence": number - 0 to 100, how confident you are in the assessment
  "observations": "string - detailed observations about what you found (seals, signatures, formatting, etc.)",
  "redFlags": "string - any suspicious elements or red flags found (if none, say 'None detected')",
  "recommendation": "string - one of: 'verified', 'rejected', 'needs_manual_review'",
  "notes": "string - summary explanation of the decision in simple language"
}

Be thorough but fair. If the document appears to be a legitimate certificate with official markings, verify it. If it shows signs of forgery or is clearly not a certificate, reject it. If you are uncertain, recommend manual review.`;

function parseResult(text: string) {
  let parsed: any = {};
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {
    parsed = {};
  }
  return {
    isGenuine: parsed.isGenuine ?? false,
    certificateType: parsed.certificateType || "Unknown",
    confidence: parsed.confidence || 0,
    observations: parsed.observations || "",
    redFlags: parsed.redFlags || "",
    recommendation: parsed.recommendation || "needs_manual_review",
    notes: parsed.notes || "Unable to analyze certificate.",
  };
}

async function analyzeWithOpenAI(imageBase64: string, mimeType: string): Promise<any> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("NO_OPENAI_KEY");

  const dataUrl = `data:${mimeType || "image/jpeg"};base64,${imageBase64}`;

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
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      temperature: 0.3,
      max_tokens: 2048,
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

async function analyzeWithGemini(imageBase64: string, mimeType: string): Promise<any> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) throw new Error("NO_GEMINI_KEY");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { mimeType: mimeType || "image/jpeg", data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.3, maxOutputTokens: 2048 },
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
    const { imageBase64, mimeType, userId } = await req.json();

    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No certificate image provided." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY");
    const geminiKey = Deno.env.get("GEMINI_API_KEY");

    if (!openaiKey && !geminiKey) {
      return new Response(
        JSON.stringify({
          error: "AI verification is not available. Please configure an AI API key.",
          configured: false,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = null;

    if (openaiKey) {
      try {
        result = await analyzeWithOpenAI(imageBase64, mimeType);
      } catch (e) {
        console.error("OpenAI failed, trying Gemini:", e.message);
        if (geminiKey) {
          try {
            result = await analyzeWithGemini(imageBase64, mimeType);
          } catch (e2) {
            console.error("Gemini also failed:", e2.message);
          }
        }
      }
    } else if (geminiKey) {
      try {
        result = await analyzeWithGemini(imageBase64, mimeType);
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

    // Determine verification status
    let verified = false;
    let status = "pending";

    if (result.recommendation === "verified" && result.isGenuine && result.confidence >= 60) {
      verified = true;
      status = "verified";
    } else if (result.recommendation === "rejected" || (!result.isGenuine && result.confidence >= 70)) {
      status = "rejected";
    } else {
      status = "pending";
    }

    // Update the profile in the database if userId is provided
    if (userId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const notesText = [
          result.notes,
          result.observations ? `Observations: ${result.observations}` : "",
          result.redFlags && result.redFlags !== "None detected" ? `Red flags: ${result.redFlags}` : "",
        ].filter(Boolean).join("\n");

        await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${userId}`, {
          method: "PATCH",
          headers: {
            "apikey": serviceKey,
            "Authorization": `Bearer ${serviceKey}`,
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
          },
          body: JSON.stringify({
            champion_verified: verified,
            champion_verification_status: status,
            champion_verification_notes: notesText,
            champion_certificate_type: result.certificateType,
            champion_verified_at: new Date().toISOString(),
          }),
        });
      }
    }

    return new Response(
      JSON.stringify({
        ...result,
        verified,
        status,
        configured: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Champion verification error:", error.message);
    return new Response(
      JSON.stringify({ error: "Something went wrong during verification.", configured: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
