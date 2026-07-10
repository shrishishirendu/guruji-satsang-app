// ============================================================
// CLOUDINARY IMAGE UPLOAD (free tier, no credit card needed)
//
// One-time setup:
//   1. Create a free account at https://cloudinary.com
//   2. Dashboard → copy your "Cloud name" into CLOUD_NAME below
//   3. Settings (gear) → Upload → Add upload preset
//        - Signing Mode: Unsigned
//        - (optional) Folder: satsang-images
//        - Save, then copy the preset name into UPLOAD_PRESET below
// ============================================================

import { validateImageFile } from '../utils/validateImageFile';

const CLOUD_NAME    = 'dwh0lam6j';      // e.g. "dxy123abc"
const UPLOAD_PRESET = 'Satsang-upload-preset';   // e.g. "satsang_unsigned"

/**
 * Uploads an image File to Cloudinary and returns its public HTTPS URL.
 * @param {File} file - the image file from an <input type="file">
 * @returns {Promise<string>} secure_url of the uploaded image
 */
export async function uploadImage(file) {
  // Final safety gate: never send anything to Cloudinary that isn't a
  // verified, genuine image. The UI validates on selection too, but this
  // guards every caller regardless of where the file came from.
  await validateImageFile(file);

  const data = new FormData();
  data.append('file', file);
  data.append('upload_preset', UPLOAD_PRESET);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: 'POST', body: data }
  );

  if (!res.ok) {
    throw new Error(`Cloudinary upload failed (${res.status})`);
  }

  const json = await res.json();
  return json.secure_url;
}
