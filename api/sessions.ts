import { createClient } from "@supabase/supabase-js";

// Supabase client for serverless
const supabaseUrl = process.env.SUPABASE_URL || "https://ndbercohymnqzwcdrllg.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_hU1qN082CKRfFJpUXRwAcg_xWK3k1S4";

const supabase = createClient(supabaseUrl, supabaseKey);

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(request: Request) {
  try {
    const code = generateCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("sessions")
      .insert({ code, expires_at: expiresAt })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error creating session:", error);
    return new Response(JSON.stringify({ message: "Failed to create session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function GET(request: Request, { params }: { params: { code: string } }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("*")
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ message: "Session not found or expired" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error joining session:", error);
    return new Response(JSON.stringify({ message: "Failed to join session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
