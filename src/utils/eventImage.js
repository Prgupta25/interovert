/**
 * Prefer a sharper Cloudinary delivery URL (quality + max width) without double-applying transforms.
 */
export function getDisplayEventPhotoUrl(url, maxWidth = 1600) {
  if (!url || typeof url !== 'string') return url;
  if (!url.includes('res.cloudinary.com') || !url.includes('/image/upload/')) return url;
  if (/\/upload\/[^/]+,/.test(url) || /\/upload\/(f_|q_|w_|c_)/.test(url)) return url;
  return url.replace('/upload/', `/upload/f_auto,q_auto:best,w_${maxWidth},c_limit/`);
}
