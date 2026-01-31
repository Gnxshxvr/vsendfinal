import { getSessionByCode, saveFile, getFiles } from "../../server/supabase";
import { uploadToCloudinary } from "../../server/cloudinary";
import { supabase } from "../../server/supabase";

// GET /api/files/[code] - List files for a session
export async function GET(request: Request, { params }: { params: { code: string } }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  
  try {
    const session = await getSessionByCode(code);
    
    if (!session) {
      return new Response(JSON.stringify({ message: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    const files = await getFiles(session.id);
    return new Response(JSON.stringify(files), {
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

// POST /api/files/[code] - Upload a file
export async function POST(request: Request, { params }: { params: { code: string } }) {
  const code = Array.isArray(params.code) ? params.code[0] : params.code;
  
  try {
    const session = await getSessionByCode(code);
    
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

    // Convert File to Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    
    // Upload to Cloudinary
    const cloudinaryResult = await uploadToCloudinary(
      buffer,
      file.name,
      file.type
    );

    // Save file metadata to Supabase
    const savedFile = await saveFile({
      sessionId: session.id,
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      cloudinaryUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      resourceType: cloudinaryResult.resource_type,
    });

    // Broadcast to all clients in this session via Supabase Realtime
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
