import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Server misconfigured: OPENAI_API_KEY not set" }, 500);
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const formData = await req.formData();
    const audioFile = formData.get("file");
    if (!(audioFile instanceof File)) {
      return jsonResponse({ error: "No audio file provided" }, 400);
    }

    const language = formData.get("language");
    const prompt = formData.get("prompt");

    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile);
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", typeof language === "string" && language ? language : "ko");
    whisperFormData.append("temperature", "0");
    whisperFormData.append("response_format", "verbose_json");
    if (typeof prompt === "string" && prompt) {
      whisperFormData.append("prompt", prompt);
    }

    const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: whisperFormData,
    });

    if (!whisperResponse.ok) {
      const errorText = await whisperResponse.text();
      const status = whisperResponse.status === 429 ? 429 : 502;
      console.error("Whisper API error:", whisperResponse.status, errorText);
      return jsonResponse({ error: "Whisper API error", detail: errorText }, status);
    }

    const result = await whisperResponse.json();
    return jsonResponse(result);
  } catch (error) {
    console.error("Transcription error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return jsonResponse({ error: message }, 500);
  }
});
