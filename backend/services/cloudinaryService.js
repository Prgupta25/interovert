import { v2 as cloudinary } from 'cloudinary';
import env from '../config/env.js';

let configured = false;

function ensureConfigured() {
  if (configured) return;
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    return;
  }
  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
  });
  configured = true;
}

export function isCloudinaryConfigured() {
  ensureConfigured();
  return configured;
}

/**
 * Upload a base64 data URI to Cloudinary.
 * Returns the secure URL on success, or null on failure.
 */
export async function uploadImage(base64DataUri, folder = 'interovert') {
  ensureConfigured();
  if (!configured) return null;

  try {
    const result = await cloudinary.uploader.upload(base64DataUri, {
      folder,
      resource_type: 'image',
      transformation: [{ quality: 'auto', fetch_format: 'auto' }],
    });
    return result.secure_url;
  } catch (err) {
    console.error('[cloudinary] upload failed:', err.message);
    return null;
  }
}

/**
 * Extract the public_id from a Cloudinary URL.
 * e.g. "https://res.cloudinary.com/xxx/image/upload/v123/interovert/events/abc.jpg"
 * returns "interovert/events/abc"
 */
function extractPublicId(url) {
  if (!url || !url.includes('cloudinary.com')) return null;
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z]+)?$/i);
  return match ? match[1] : null;
}

/**
 * Delete an image from Cloudinary by its URL.
 * Silently ignores failures.
 */
export async function deleteImage(url) {
  ensureConfigured();
  if (!configured) return;

  const publicId = extractPublicId(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error('[cloudinary] delete failed:', err.message);
  }
}

/**
 * If the value is a base64 data URI, upload it and return the URL.
 * If it's already a URL or empty, return it as-is.
 */
export async function uploadIfBase64(value, folder = 'interovert') {
  if (!value || !value.startsWith('data:')) return value || '';
  const url = await uploadImage(value, folder);
  return url || value;
}
