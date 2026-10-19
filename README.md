# VSend — Real-Time Device-to-Device Sharing (WebRTC & Server Relay)

VSend is a zero-login, browser-based file and clipboard sharing web application designed for instant transfer between laptops, smartphones, and desktop computers.

---

## Key Features

- **Zero Accounts / Zero Setup**: No email, passwords, or app installations required.
- **6-Digit Session Rooms**: Quick pairing between devices using short, high-entropy room codes or QR codes.
- **Direct P2P WebRTC DataChannels**:
  - Direct peer-to-peer file and clipboard transmission between devices without passing data payloads through the server when connected.
  - End-to-end encrypted in transit via DTLS/SCTP.
  - Chunked binary transfer (16 KB chunks) with backpressure control (`bufferedAmountLowThreshold`) supporting up to 25 MB files.
- **Resilient Fallback**: If WebRTC cannot establish a direct P2P link (e.g. due to strict symmetric NAT or firewall restrictions), VSend automatically and seamlessly falls back to the server WebSocket and local Express relay.
- **Zero Third-Party Dependency Requirement**: Runs completely self-contained with Node.js and local disk storage, with optional support for Cloudinary or Supabase if desired.

---

## Architecture Overview

```
+-------------------------------------------------------------+
|                     VSend Architecture                      |
+-------------------------------------------------------------+

  Device A (Laptop)                            Device B (Phone)
         |                                            |
         | <======== 1. WebSocket Signaling ========> |
         |            (Room join, SDP Offer,          |
         |             SDP Answer, ICE Candidates)    |
         |                      |                     |
         |                      v                     |
         |            [Express WebSocket Server]      |
         |                                            |
         | <========================================> |
         |          2. WebRTC DataChannel (Direct P2P) |
         |           - Instant Clipboard Sync         |
         |           - 16 KB Chunked File Streaming   |
         |           - Zero Server Bandwidth Cost     |
         |                                            |
         |  (If P2P blocked by Symmetric NAT/Firewall)  |
         |                      |                     |
         v                      v                     v
    [Local Uploads] <--- Fallback Server Relay ---> [Downloads]
```

---

## Quick Start (College Demo / Local Network)

### 1. Install Dependencies
```bash
npm install
```

### 2. Build the Application
```bash
npm run build
```

### 3. Start the Server
```bash
npm start
```
The server binds to `0.0.0.0:5000` and displays your laptop's local Wi-Fi IP address (e.g., `http://192.168.1.X:5000`).

### 4. Connect Devices
1. On your **Laptop**, open `http://localhost:5000` (or the local network IP).
2. Click **Create Room** to generate a 6-digit session code.
3. On your **Phone** (connected to the same Wi-Fi):
   - Open `http://<LAPTOP-IP>:5000` in Safari or Chrome.
   - Enter the 6-digit room code and tap **Join Room**.
4. Both devices will connect over WebSockets and automatically initiate a WebRTC handshake:
   - When established, the connection badge indicates **`⚡ P2P Direct`**.
   - Text pasted into the universal clipboard syncs instantly.
   - Files dropped into the transfer panel stream directly between devices peer-to-peer with a live progress bar.

---

## Cross-Network & NAT Traversal Guide

### How Cross-Network Sharing Works
When devices are on different networks (for example, laptop on home Wi-Fi and phone on mobile 4G/5G data):

1. **Signaling Server**: Must be accessible on the public internet over HTTPS and WSS (WebSocket Secure).
2. **STUN (Session Traversal Utilities for NAT)**:
   - VSend includes Google (`stun:stun.l.google.com:19302`) and Cloudflare (`stun:stun.cloudflare.com:3478`) STUN servers by default.
   - STUN discovers the public IP and port of each peer, allowing direct UDP hole punching across Full-Cone, Restricted-Cone, and Port-Restricted NATs.
3. **TURN (Traversal Using Relays around NAT)**:
   - When one or both devices are behind **Symmetric NATs** (common on 4G/5G mobile carriers and enterprise/university Wi-Fi), UDP hole punching cannot succeed.
   - A TURN relay server is required to relay the encrypted WebRTC packets.

### Configuring TURN Relay in VSend

VSend includes built-in support for TURN servers via environment variables.

#### Option A: Quick Free TURN via Metered.ca / OpenRelay
1. Register for free at [Metered.ca](https://www.metered.ca/tools/openrelay/) or any TURN provider.
2. Add the following to your `.env` file:
```env
TURN_SERVER_URL=turn:openrelay.metered.ca:80
TURN_USERNAME=openrelayproject
TURN_CREDENTIAL=openrelayproject
```

#### Option B: Full ICE Servers Array
```env
ICE_SERVERS=[{"urls":"stun:stun.l.google.com:19302"},{"urls":"turn:your-turn-server.com:3478","username":"username","credential":"password"}]
```

When configured, the backend automatically serves these credentials to clients via `GET /api/webrtc-config`.

---

## Deploying to Public Cloud (HTTPS / WSS)

Modern browsers require secure contexts (`https://` and `wss://`) for certain WebRTC features and clipboard APIs when accessing non-localhost URLs.

### Deployment Options:
- **Render / Railway / Fly.io / Heroku**:
  1. Push code to your Git repository.
  2. Set build command: `npm run build`
  3. Set start command: `npm start`
  4. The platform provides an automatic SSL certificate (`https://your-app.up.railway.app`) which automatically handles HTTPS and WSS.
- **VPS (Ubuntu / Debian + Nginx + Let's Encrypt)**:
  - Run the built app via `pm2 start dist/index.cjs --name vsend`.
  - Configure Nginx reverse proxy with `proxy_pass http://127.0.0.1:5000;` and enable WebSocket headers (`Upgrade` and `Connection: upgrade`).

---

## Running the Automated Test Suite

VSend includes an automated end-to-end verification suite testing all core functionality and WebRTC signaling:

```bash
# 1. In one terminal, start the server:
npm start

# 2. In another terminal, run the test suite:
npm test
```

### Test Scenarios Verified:
- **Scenario G**: Web frontend homepage and SPA client-side route rewrites
- **Scenario A**: High-entropy 6-digit session room creation
- **Scenario B**: Session joining and room code validation
- **Scenario F**: Invalid room rejection (404) and session teardown
- **Scenario C**: Real-time bi-directional clipboard sync and presence over WebSockets
- **Scenario D**: File upload, listing, download integrity, and inline preview
- **Scenario E**: Strict session isolation across independent rooms
- **Scenario H**: WebRTC ICE server discovery (`/api/webrtc-config`)
- **Scenario I**: WebRTC signaling relay (`peer_joined`, `webrtc_offer`, `webrtc_answer`, `webrtc_ice_candidate`)

---

## Project Structure

```
├── client/                 # React 18 + TypeScript + Vite frontend
│   └── src/
│       ├── components/     # UI panels (ClipboardPanel, FileTransferPanel, QRDialog)
│       ├── hooks/          # use-webrtc.ts (P2P), use-websocket.ts (signaling), use-files.ts
│       └── pages/          # Home.tsx, Session.tsx, NotFound.tsx
├── server/                 # Express backend
│   ├── index.ts            # Entrypoint, network interface binding, static serving
│   ├── routes.ts           # REST API, WebRTC config, WebSocket signaling relay
│   ├── storage.ts          # Ephemeral in-memory session/file store (with Postgres option)
│   └── uploads/            # Local temporary file uploads directory
├── shared/                 # Shared schemas and route definitions
│   ├── schema.ts           # Zod schemas, DB models, WS_EVENTS
│   └── routes.ts           # Typed endpoint contracts
└── test/
    └── e2e-test.mjs        # 11-scenario automated verification suite
```
