# Export Instructions for VSend

To move VSend from Replit to a multi-service stack (Vercel, Render, Supabase, Cloudinary), follow these steps:

## 1. Prerequisites
- Accounts on: [Vercel](https://vercel.com), [Render](https://render.com), [Supabase](https://supabase.com), [Cloudinary](https://cloudinary.com)

## 2. Supabase (Database)
1. Create a new project on Supabase.
2. Go to **Project Settings > Database** and copy the **Connection string (URI)**.
3. Replace the `DATABASE_URL` in your environment variables with this string.
4. Run migrations from your local machine (if using local dev) or use the Supabase SQL editor to create the `sessions` and `files` tables.

## 3. Cloudinary (File Storage)
1. Sign up for Cloudinary and get your **Cloud Name**, **API Key**, and **API Secret**.
2. You will need to update `server/routes.ts` to use the Cloudinary SDK instead of local `multer` storage.

## 4. Render (Backend)
1. Connect your GitHub repository (containing the exported files) to Render.
2. Create a new **Web Service**.
3. Set the following Environment Variables in Render:
   - `DATABASE_URL`: Your Supabase URI.
   - `CLOUDINARY_URL`: Your Cloudinary connection string.
   - `NODE_ENV`: `production`
4. Set the build command: `npm install && npm run build`
5. Set the start command: `node dist/index.js` (ensure your build script compiles the server).

## 5. Vercel (Frontend)
1. Connect the same GitHub repository to Vercel.
2. Create a new project and select the `client` directory as the root (or configure Vercel to build from the root).
3. Set the Environment Variable:
   - `VITE_API_URL`: Your Render service URL (e.g., `https://vsend-api.onrender.com`).
4. Update `client/src/lib/queryClient.ts` and WebSocket connections to use this URL.

## 6. How to Export from Replit
1. Click the **Project Name** at the top left.
2. Select **Download as ZIP**.
3. Unzip and initialize a git repository: `git init`.
4. Push to GitHub: `git add . && git commit -m "Export" && git push origin main`.
