import { v2 as cloudinary } from "cloudinary";

// Determine if Cloudinary is configured via environment variables
export const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
);

if (isCloudinaryConfigured) {
  if (process.env.CLOUDINARY_URL) {
    cloudinary.config();
  } else {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
  }
}

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  original_filename: string;
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  filename: string,
  _mimeType: string
): Promise<CloudinaryUploadResult> {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary is not configured");
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "vsend_files",
        resource_type: "auto",
        public_id: `file_${Date.now()}_${filename.replace(/[^a-zA-Z0-9_.-]/g, "_")}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result as CloudinaryUploadResult);
        } else {
          reject(new Error("No response from Cloudinary"));
        }
      }
    );

    uploadStream.end(fileBuffer);
  });
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: string = "raw"
): Promise<void> {
  if (!isCloudinaryConfigured) return;
  try {
    await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (err) {
    console.error("Failed to delete file from Cloudinary:", err);
  }
}

export function getCloudinaryUrl(publicId: string, resourceType: string = "raw"): string {
  if (!isCloudinaryConfigured) return "";
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
  });
}

export default cloudinary;
