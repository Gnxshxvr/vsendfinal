import { createSession, getSessionByCode } from "../server/supabase";

export async function POST(request: Request) {
  try {
    const session = await createSession();
    return new Response(JSON.stringify(session), {
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
    const session = await getSessionByCode(code);
    
    if (!session) {
      return new Response(JSON.stringify({ message: "Session not found or expired" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }
    
    return new Response(JSON.stringify(session), {
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
