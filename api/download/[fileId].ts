import { getFile } from "../../server/supabase";

// GET /api/download/[fileId] - Redirect to Cloudinary URL
export async function GET(request: Request, { params }: { params: { fileId: string } }) {
  const fileId = Array.isArray(params.fileId) ? parseInt(params.fileId[0]) : parseInt(params.fileId);
  
  try {
    const file = await getFile(fileId);
    
    if (!file) {
      return new Response(JSON.stringify({ message: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Redirect to Cloudinary URL for download
    return new Response(null, {
      status: 302,
      headers: {
        "Location": file.cloudinary_url,
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
