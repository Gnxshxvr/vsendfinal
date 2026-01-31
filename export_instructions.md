# Detailed VSend Deployment Guide (Vercel + Railway + Supabase + Cloudinary)

Follow this guide exactly to replicate VSend's functionality on external services.

## 1. Supabase (Database)
1.  **Create Project**: Go to [Supabase](https://supabase.com) and create a new project.
2.  **Get Connection String**: Go to **Project Settings > Database**. Copy the **Connection string (URI)**.
3.  **Setup Tables**: Go to the **SQL Editor** in Supabase and run the following:
    ```sql
    CREATE TABLE IF NOT EXISTS sessions (
      id SERIAL PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL
    );

    CREATE TABLE IF NOT EXISTS files (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      uploaded_at TIMESTAMP DEFAULT NOW()
    );
    ```

## 2. Cloudinary (Media Storage)
1.  **Sign Up**: Go to [Cloudinary](https://cloudinary.com).
2.  **Get Credentials**: Copy your **Cloud Name**, **API Key**, and **API Secret** from the Dashboard.
3.  **Environment Variable**: You will need a `CLOUDINARY_URL` formatted like:
    `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`

## 3. Railway (Backend Server)
1.  **New Project**: Connect your GitHub repo to [Railway](https://railway.app).
2.  **Service Type**: Create a **Web Service**.
3.  **Environment Variables**: Add these in the **Variables** tab:
    - `DATABASE_URL`: (Paste from Supabase)
    - `CLOUDINARY_URL`: (Paste from Cloudinary)
    - `PORT`: `5000`
    - `NODE_ENV`: `production`
4.  **Networking**: Ensure "Public Networking" is enabled.

## 4. Vercel (Frontend)
1.  **New Project**: Connect your GitHub repo to [Vercel](https://vercel.com).
2.  **Settings**:
    - **Framework Preset**: Vite
    - **Root Directory**: `.` (or select your project root)
3.  **Environment Variables**:
    - `VITE_API_URL`: Your Railway App URL (e.g., `https://vsend-production.up.railway.app`)
    - `VITE_WS_URL`: Your Railway App URL but with `wss://` (e.g., `wss://vsend-production.up.railway.app`)

## 5. File Adjustments for Export
I have updated the code to use these environment variables. When you export:
- The server will automatically use Supabase via `DATABASE_URL`.
- The server will use Cloudinary for file uploads (see `server/storage.ts` comments).
- The frontend will point to your Railway backend via `VITE_API_URL`.
