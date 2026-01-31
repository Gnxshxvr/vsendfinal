import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary with provided credentials
cloudinary.config({
  cloud_name: "dxy0ypkrr",
  api_key: "139762346665925",
  api_secret: "yQHZCkS8JKtruzeHmdyuY73F_BM",
});

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
  mimeType: string
): Promise<CloudinaryUploadResult> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "vsend_files",
        resource_type: "auto",
        public_id: `file_${Date.now()}_${filename}`,
      },
      (error, result) => {
        if (error) {
          reject(error);
        } else if (result) {
          resolve(result as CloudinaryUploadResult);
        } else {
          reject(new Error("No result from Cloudinary"));
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
  await cloudinary.uploader.destroy(publicId, {
    resource_type: resourceType,
  });
}

export function getCloudinaryUrl(publicId: string, resourceType: string = "raw"): string {
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    secure: true,
  });
}

export default cloudinary;
