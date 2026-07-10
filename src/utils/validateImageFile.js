// ============================================================
// CLIENT-SIDE IMAGE UPLOAD SECURITY GATE
//
// Invite images go straight from the browser to Cloudinary, so this is
// our only chance to keep dangerous / non-image files out. We do NOT
// trust the file's name or its browser-reported MIME type — both are
// trivially spoofed. Instead we:
//   1. cap the file size,
//   2. sniff the real file signature (magic bytes) and only allow a
//      short allowlist of raster image formats. Because it's an
//      allowlist, anything else is rejected outright — SVGs (which can
//      carry <script>), HTML, PDFs, executables and "polyglot" files
//      that merely pretend to be images all fail here, and
//   3. actually decode the bytes as an image, so a corrupt or disguised
//      file that faked a valid-looking header still gets rejected.
// ============================================================

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MB

// Human-readable format list, reused in error messages.
export const ALLOWED_IMAGE_LABEL = 'JPG, PNG, GIF or WebP';

// Magic-byte signatures we accept. `offset` is where the bytes must
// appear; `bytes` are the exact values. WEBP needs an extra check
// because its RIFF container header is shared with other file types.
const SIGNATURES = [
  { name: 'JPEG', offset: 0, bytes: [0xff, 0xd8, 0xff] },
  { name: 'PNG',  offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { name: 'GIF',  offset: 0, bytes: [0x47, 0x49, 0x46, 0x38] },   // "GIF8" (87a/89a)
  { name: 'WEBP', offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },   // "RIFF" (+ WEBP check)
];

function matches(view, offset, bytes) {
  for (let i = 0; i < bytes.length; i++) {
    if (view[offset + i] !== bytes[i]) return false;
  }
  return true;
}

// Reads only the header bytes and returns the detected format name, or null.
async function sniffImageFormat(file) {
  const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  for (const sig of SIGNATURES) {
    if (!matches(header, sig.offset, sig.bytes)) continue;
    // RIFF is a generic container — confirm it's specifically a WebP.
    if (sig.name === 'WEBP' && !matches(header, 8, [0x57, 0x45, 0x42, 0x50])) {
      return null; // "WEBP"
    }
    return sig.name;
  }
  return null;
}

// Decodes the bytes as a real image. Resolves true only if the browser
// can actually render it. Prefers createImageBitmap, falls back to <img>.
function canDecodeAsImage(file) {
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(file).then(
      bmp => { if (bmp.close) bmp.close(); return true; },
      () => false
    );
  }
  return new Promise(resolve => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img.naturalWidth > 0); };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(false); };
    img.src = url;
  });
}

/**
 * Validates a user-selected image file. Resolves if the file is a safe,
 * genuine raster image; otherwise throws an Error whose message is safe
 * to show the user directly.
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function validateImageFile(file) {
  if (!file) {
    throw new Error('No file selected.');
  }
  if (file.size === 0) {
    throw new Error('That file is empty. Please choose a photo.');
  }
  if (file.size > MAX_IMAGE_BYTES) {
    const mb = Math.round(MAX_IMAGE_BYTES / (1024 * 1024));
    throw new Error(`Image is too large (max ${mb} MB). Please choose a smaller photo.`);
  }

  const format = await sniffImageFormat(file);
  if (!format) {
    throw new Error(`That file isn't a supported image. Please upload a ${ALLOWED_IMAGE_LABEL} photo.`);
  }

  const decodable = await canDecodeAsImage(file);
  if (!decodable) {
    throw new Error("That file looks corrupted or isn't a real image. Please choose a different photo.");
  }
}
