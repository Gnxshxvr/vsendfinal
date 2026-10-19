import assert from "assert";
import { WebSocket } from "ws";

const BASE_URL = "http://127.0.0.1:5000";
const WS_URL = "ws://127.0.0.1:5000/ws";

async function runTests() {
  console.log("=== STARTING VSEND END-TO-END VERIFICATION SUITE ===\n");

  let passed = 0;
  let failed = 0;

  function report(name, success, error) {
    if (success) {
      console.log(`[PASS] ${name}`);
      passed++;
    } else {
      console.error(`[FAIL] ${name}:`, error);
      failed++;
    }
  }

  // --- Test 1: Frontend Serving ---
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("<!DOCTYPE html>") || html.includes("<html"));
    report("Scenario G: Web frontend homepage served correctly", true);
  } catch (err) {
    report("Scenario G: Web frontend homepage served correctly", false, err);
  }

  // --- Test 2: SPA Route Rewrite ---
  try {
    const res = await fetch(`${BASE_URL}/session/123456`);
    assert.strictEqual(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes("<!DOCTYPE html>") || html.includes("<html"));
    report("Scenario G: SPA client-side route rewrite (/session/:code)", true);
  } catch (err) {
    report("Scenario G: SPA client-side route rewrite (/session/:code)", false, err);
  }

  // --- Test 3: Session Creation (Scenario A) ---
  let sessionA;
  try {
    const res = await fetch(`${BASE_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    assert.strictEqual(res.status, 201);
    sessionA = await res.json();
    assert.ok(sessionA.code, "Session code should be present");
    assert.strictEqual(sessionA.code.length, 6, "Session code must be 6 digits");
    assert.ok(/^\d{6}$/.test(sessionA.code), "Session code must be numeric digits");
    assert.ok(sessionA.id, "Session ID should be present");
    report("Scenario A: Session creation with 6-digit high-entropy code", true);
  } catch (err) {
    report("Scenario A: Session creation with 6-digit high-entropy code", false, err);
  }

  // --- Test 4: Session Joining (Scenario B) ---
  try {
    const res = await fetch(`${BASE_URL}/api/sessions/${sessionA.code}`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.code, sessionA.code);
    assert.strictEqual(data.id, sessionA.id);
    report("Scenario B: Session joining and validation via code", true);
  } catch (err) {
    report("Scenario B: Session joining and validation via code", false, err);
  }

  // --- Test 5: Invalid Session Code Handling (Scenario F) ---
  try {
    const res = await fetch(`${BASE_URL}/api/sessions/000000`);
    assert.strictEqual(res.status, 404);
    const errData = await res.json();
    assert.ok(errData.message);
    report("Scenario F: Invalid session code returns 404", true);
  } catch (err) {
    report("Scenario F: Invalid session code returns 404", false, err);
  }

  // --- Test 6: WebSocket Clipboard Sync & Presence (Scenario C) ---
  try {
    const ws1 = new WebSocket(WS_URL);
    const ws2 = new WebSocket(WS_URL);

    await Promise.all([
      new Promise((res) => ws1.on("open", res)),
      new Promise((res) => ws2.on("open", res)),
    ]);

    // Track messages for client 2
    const client2Messages = [];
    ws2.on("message", (msg) => {
      client2Messages.push(JSON.parse(msg.toString()));
    });

    // Client 1 joins
    ws1.send(JSON.stringify({ type: "join", code: sessionA.code }));
    await new Promise((res) => setTimeout(res, 100));

    // Client 2 joins
    ws2.send(JSON.stringify({ type: "join", code: sessionA.code }));
    await new Promise((res) => setTimeout(res, 200));

    // Client 1 sends clipboard
    const testContent = "Hello from device 1! Snippet: const x = 42;";
    ws1.send(
      JSON.stringify({
        type: "clipboard_update",
        content: testContent,
      })
    );
    await new Promise((res) => setTimeout(res, 200));

    const clipboardMsg = client2Messages.find(
      (m) => m.type === "clipboard_update"
    );
    assert.ok(clipboardMsg, "Client 2 should have received clipboard_update");
    assert.strictEqual(clipboardMsg.content, testContent);

    // Verify presence message received
    const presenceMsg = client2Messages.find((m) => m.type === "presence");
    assert.ok(presenceMsg, "Presence message should be received");

    ws1.close();
    ws2.close();
    report("Scenario C: Real-time bi-directional clipboard sync and presence over WebSocket", true);
  } catch (err) {
    report("Scenario C: Real-time bi-directional clipboard sync and presence over WebSocket", false, err);
  }

  // --- Test 7: File Upload & Download (Scenario D) ---
  let uploadedFileId;
  const fileContent = "This is a test document created for VSend file transfer.\nLine 2.\nLine 3.";
  try {
    const boundary = "----WebKitFormBoundary7MA4YWxkTrZu0gW";
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="test-doc.txt"\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${fileContent}\r\n` +
      `--${boundary}--\r\n`;

    const uploadRes = await fetch(`${BASE_URL}/api/files/${sessionA.code}`, {
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
      },
      body,
    });

    assert.strictEqual(uploadRes.status, 201);
    const uploadedFile = await uploadRes.json();
    assert.strictEqual(uploadedFile.originalName, "test-doc.txt");
    uploadedFileId = uploadedFile.id;

    // List files
    const listRes = await fetch(`${BASE_URL}/api/files/${sessionA.code}`);
    assert.strictEqual(listRes.status, 200);
    const fileList = await listRes.json();
    assert.ok(fileList.length >= 1);
    assert.strictEqual(fileList[0].id, uploadedFileId);

    // Download file
    const downloadRes = await fetch(`${BASE_URL}/api/download/${uploadedFileId}`);
    assert.strictEqual(downloadRes.status, 200);
    const downloadedText = await downloadRes.text();
    assert.strictEqual(downloadedText, fileContent, "Downloaded content must match uploaded content exactly");

    // Preview file
    const previewRes = await fetch(`${BASE_URL}/api/preview/${uploadedFileId}`);
    assert.strictEqual(previewRes.status, 200);
    const previewText = await previewRes.text();
    assert.strictEqual(previewText, fileContent);

    report("Scenario D: File upload, listing, download integrity, and inline preview", true);
  } catch (err) {
    report("Scenario D: File upload, listing, download integrity, and inline preview", false, err);
  }

  // --- Test 8: Session Isolation (Scenario E) ---
  try {
    // Create second session
    const resB = await fetch(`${BASE_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const sessionB = await resB.json();

    // Verify session B files list is empty
    const listBRes = await fetch(`${BASE_URL}/api/files/${sessionB.code}`);
    const filesB = await listBRes.json();
    assert.strictEqual(filesB.length, 0, "Session B should have 0 files");

    // Verify WebSocket isolation
    const wsA = new WebSocket(WS_URL);
    const wsB = new WebSocket(WS_URL);
    await Promise.all([
      new Promise((res) => wsA.on("open", res)),
      new Promise((res) => wsB.on("open", res)),
    ]);

    const messagesInB = [];
    wsB.on("message", (msg) => {
      messagesInB.push(JSON.parse(msg.toString()));
    });

    wsA.send(JSON.stringify({ type: "join", code: sessionA.code }));
    wsB.send(JSON.stringify({ type: "join", code: sessionB.code }));
    await new Promise((res) => setTimeout(res, 200));

    // Send secret message in session A
    wsA.send(
      JSON.stringify({
        type: "clipboard_update",
        content: "SECRET_SESSION_A_DATA_DO_NOT_LEAK",
      })
    );
    await new Promise((res) => setTimeout(res, 200));

    const leakedMsg = messagesInB.find((m) =>
      m.content?.includes("SECRET_SESSION_A_DATA_DO_NOT_LEAK")
    );
    assert.strictEqual(leakedMsg, undefined, "Session B must NEVER receive Session A data");

    wsA.close();
    wsB.close();
    report("Scenario E: Strict session isolation (files and clipboard data do not leak)", true);
  } catch (err) {
    report("Scenario E: Strict session isolation (files and clipboard data do not leak)", false, err);
  }

  // --- Test 9: Leave Session and Cleanup (Scenario F) ---
  try {
    const leaveRes = await fetch(`${BASE_URL}/api/sessions/${sessionA.code}/leave`, {
      method: "POST",
    });
    assert.strictEqual(leaveRes.status, 200);

    // Verify session A is now 404
    const getAgain = await fetch(`${BASE_URL}/api/sessions/${sessionA.code}`);
    assert.strictEqual(getAgain.status, 404, "Session should be terminated and return 404");

    report("Scenario F: Explicit Leave Session closes room and cleans up resources", true);
  } catch (err) {
    report("Scenario F: Explicit Leave Session closes room and cleans up resources", false, err);
  }

  // --- Test 10: WebRTC Configuration Discovery (Scenario H) ---
  try {
    const configRes = await fetch(`${BASE_URL}/api/webrtc-config`);
    assert.strictEqual(configRes.status, 200);
    const configData = await configRes.json();
    assert.ok(Array.isArray(configData.iceServers), "iceServers must be an array");
    assert.ok(configData.iceServers.length > 0, "At least one ICE server should be configured");
    const hasStun = configData.iceServers.some((srv) => {
      const urls = Array.isArray(srv.urls) ? srv.urls.join(" ") : srv.urls;
      return urls && urls.includes("stun:");
    });
    assert.ok(hasStun, "Configuration must include STUN server URLs");
    report("Scenario H: WebRTC ICE server configuration discovery (/api/webrtc-config)", true);
  } catch (err) {
    report("Scenario H: WebRTC ICE server configuration discovery (/api/webrtc-config)", false, err);
  }

  // --- Test 11: WebRTC Signaling Relay via WebSocket (Scenario I) ---
  try {
    // Create new session for WebRTC test
    const rtcSessionRes = await fetch(`${BASE_URL}/api/sessions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    });
    const rtcSession = await rtcSessionRes.json();

    const clientA = new WebSocket(WS_URL);
    const clientB = new WebSocket(WS_URL);

    await Promise.all([
      new Promise((res) => clientA.on("open", res)),
      new Promise((res) => clientB.on("open", res)),
    ]);

    const clientAMessages = [];
    const clientBMessages = [];

    clientA.on("message", (msg) => clientAMessages.push(JSON.parse(msg.toString())));
    clientB.on("message", (msg) => clientBMessages.push(JSON.parse(msg.toString())));

    // Client A joins first
    clientA.send(JSON.stringify({ type: "join", code: rtcSession.code }));
    await new Promise((res) => setTimeout(res, 100));

    // Client B joins - this should trigger peer_joined to Client A
    clientB.send(JSON.stringify({ type: "join", code: rtcSession.code }));
    await new Promise((res) => setTimeout(res, 200));

    const peerJoinedMsg = clientAMessages.find((m) => m.type === "peer_joined");
    assert.ok(peerJoinedMsg, "Client A should receive peer_joined when Client B connects");

    // Client A sends WebRTC Offer
    const mockOfferSdp = { type: "offer", sdp: "v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" };
    clientA.send(
      JSON.stringify({
        type: "webrtc_offer",
        offer: mockOfferSdp,
      })
    );
    await new Promise((res) => setTimeout(res, 200));

    const receivedOffer = clientBMessages.find((m) => m.type === "webrtc_offer");
    assert.ok(receivedOffer, "Client B should receive webrtc_offer");
    assert.strictEqual(receivedOffer.offer.sdp, mockOfferSdp.sdp);

    // Client B sends WebRTC Answer
    const mockAnswerSdp = { type: "answer", sdp: "v=0\r\no=- 67890 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n" };
    clientB.send(
      JSON.stringify({
        type: "webrtc_answer",
        answer: mockAnswerSdp,
      })
    );
    await new Promise((res) => setTimeout(res, 200));

    const receivedAnswer = clientAMessages.find((m) => m.type === "webrtc_answer");
    assert.ok(receivedAnswer, "Client A should receive webrtc_answer");
    assert.strictEqual(receivedAnswer.answer.sdp, mockAnswerSdp.sdp);

    // Client A sends ICE Candidate
    const mockCandidate = { candidate: "candidate:1 1 UDP 2122260223 192.168.1.5 54321 typ host", sdpMid: "0", sdpMLineIndex: 0 };
    clientA.send(
      JSON.stringify({
        type: "webrtc_ice_candidate",
        candidate: mockCandidate,
      })
    );
    await new Promise((res) => setTimeout(res, 200));

    const receivedCandidate = clientBMessages.find((m) => m.type === "webrtc_ice_candidate");
    assert.ok(receivedCandidate, "Client B should receive webrtc_ice_candidate");
    assert.strictEqual(receivedCandidate.candidate.candidate, mockCandidate.candidate);

    clientA.close();
    clientB.close();
    report("Scenario I: WebRTC signaling relay (peer_joined, offer, answer, ice_candidate)", true);
  } catch (err) {
    report("Scenario I: WebRTC signaling relay (peer_joined, offer, answer, ice_candidate)", false, err);
  }

  console.log(`\n=== RESULTS: ${passed} PASSED, ${failed} FAILED ===\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
