import http from "http";
import assert from "assert";
import handler from "../api/index";

async function runServerlessTest() {
  console.log("=== Testing Vercel Serverless Function Handler (api/index.ts) ===\n");

  const server = http.createServer(async (req, res) => {
    try {
      await handler(req as any, res as any);
    } catch (err: any) {
      res.statusCode = 500;
      res.end(err.message || "Serverless Error");
    }
  });

  await new Promise<void>((resolve) => server.listen(5001, "127.0.0.1", resolve));
  const baseUrl = "http://127.0.0.1:5001";

  try {
    // 1. Test GET /api/webrtc-config
    console.log("Testing GET /api/webrtc-config...");
    const configRes = await fetch(`${baseUrl}/api/webrtc-config`);
    assert.strictEqual(configRes.status, 200);
    const config = await configRes.json();
    assert.ok(Array.isArray(config.iceServers));
    console.log("[PASS] GET /api/webrtc-config responded with status 200 and ICE servers array");

    // 2. Test POST /api/sessions
    console.log("Testing POST /api/sessions...");
    const createRes = await fetch(`${baseUrl}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.strictEqual(createRes.status, 201);
    const session = await createRes.json();
    assert.ok(session.code);
    assert.strictEqual(session.code.length, 6);
    console.log(`[PASS] POST /api/sessions created room with code: ${session.code}`);

    // 3. Test GET /api/sessions/:code
    console.log(`Testing GET /api/sessions/${session.code}...`);
    const getRes = await fetch(`${baseUrl}/api/sessions/${session.code}`);
    assert.strictEqual(getRes.status, 200);
    const retrieved = await getRes.json();
    assert.strictEqual(retrieved.code, session.code);
    console.log("[PASS] GET /api/sessions/:code retrieved room successfully");

    // 4. Test URL normalization (simulating Vercel stripping /api prefix)
    console.log("Testing URL normalization (simulated /webrtc-config stripped prefix)...");
    const strippedRes = await fetch(`${baseUrl}/webrtc-config`);
    assert.strictEqual(strippedRes.status, 200);
    const strippedConfig = await strippedRes.json();
    assert.ok(Array.isArray(strippedConfig.iceServers));
    console.log("[PASS] URL normalization successfully handled stripped /api prefix");

    console.log("\n=== VERCEL SERVERLESS HANDLER VERIFICATION SUCCESSFUL ===");
    process.exit(0);
  } finally {
    server.close();
  }
}

runServerlessTest().catch((err) => {
  console.error("Serverless test failed:", err);
  process.exit(1);
});
