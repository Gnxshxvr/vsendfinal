import { createClient } from "@supabase/supabase-js";
import { v2 as cloudinary } from "cloudinary";

// Supabase client for serverless
const supabaseUrl = process.env.SUPABASE_URL || "https://ndbercohymnqzwcdrllg.supabase.co";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_secret_hU1qN082CKRfFJpUXRwAcg_xWK3k1S4";

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dxy0ypkrr",
  api_key: process.env.CLOUDINARY_API_KEY || "139762346665925",
  api_secret: process.env.CLOUDINARY_API_SECRET || "yQHZCkS8JKtruzeHmdyuY73F_BM",
});

// GET /api/files/[code] - List files
export async function GET(request: Request, { params }: { params: { code: string } }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  
  try {
    // Get session
    const { data: session } = await supabase
      .from("sessions")
      .select("id")
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return new Response(JSON.stringify({ message: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get files
    const { data: files, error } = await supabase
      .from("files")
      .select("*")
      .eq("session_id", session.id)
      .order("uploaded_at", { ascending: false });

    if (error) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(files || []), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error listing files:", error);
    return new Response(JSON.stringify({ message: "Failed to list files" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

// POST /api/files/[code] - Upload file
export async function POST(request: Request, { params }: { params: { code: string } }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  
  try {
    // Get session
    const { data: session } = await supabase
      .from("sessions")
      .select("id, code")
      .eq("code", code)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (!session) {
      return new Response(JSON.stringify({ message: "Invalid session" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return new Response(JSON.stringify({ message: "No file provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Convert File to Buffer and upload to Cloudinary
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const cloudinaryResult = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "vsend_files",
          resource_type: "auto",
          public_id: `file_${Date.now()}_${file.name}`,
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });

    // Save to Supabase
    const { data: savedFile, error } = await supabase
      .from("files")
      .insert({
        session_id: session.id,
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        cloudinary_url: cloudinaryResult.secure_url,
        cloudinary_public_id: cloudinaryResult.public_id,
        resource_type: cloudinaryResult.resource_type,
      })
      .select()
      .single();

    if (error) {
      return new Response(JSON.stringify({ message: error.message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Broadcast via Supabase Realtime
    await supabase.channel(`session:${session.code}`).send({
      type: "broadcast",
      event: "file_uploaded",
      payload: { file: { id: savedFile.id, original_name: savedFile.original_name } },
    });

    return new Response(JSON.stringify(savedFile), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return new Response(JSON.stringify({ message: "Failed to upload file" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
