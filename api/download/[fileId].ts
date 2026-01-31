import { createClient } from "@supabase/supabase-js";

// Supabase client for serverless
const supabaseUrl = process.env.SUPABASE_URL || "https://ndbercohymnqzwcdrllg.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_hU1qN082CKRfFJpUXRwAcg_xWK3k1S4";

const supabase = createClient(supabaseUrl, supabaseKey);

// GET /api/download/[fileId] - Redirect to Cloudinary URL
export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  const fileId = Array.isArray(params.fileId) ? parseInt(params.fileId[0]) : parseInt(params.fileId);
  
  try {
    const { data, error } = await supabase
      .from("files")
      .select("cloudinary_url")
      .eq("id", fileId)
      .single();

    if (error || !data) {
      return new Response(JSON.stringify({ message: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Redirect to Cloudinary URL for download
    return new Response(null, {
      status: 302,
      headers: {
        "Location": data.cloudinary_url,
      },
    });
  } catch (error) {
    console.error("Error downloading file:", error);
    return new Response(JSON.stringify({ message: "Failed to download file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
