// three-loader.js
// Centralized loader for three.js with CDN + local fallback. This prevents a
// blank screen when the CDN cannot be reached and makes it easy to drop in a
// local copy at ./lib/three.module.js for offline use.

let cachedPromise = null;

// Try multiple sources so the engine can start even if one CDN is blocked.
const CDN_SOURCES = [
  'https://unpkg.com/three@0.165.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.165.0/three.module.js',
];

export async function loadThree() {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const errors = [];

      // 1) Prefer a locally shipped copy so offline users work immediately.
      try {
        return await import('./lib/three.module.js');
      } catch (localErr) {
        errors.push({ source: 'local ./lib/three.module.js', error: localErr });
        console.warn('Local three.js not found, trying CDNs...', localErr);
      }

      // 2) Fall back to the public CDNs.
      for (const url of CDN_SOURCES) {
        try {
          return await import(url);
        } catch (err) {
          errors.push({ source: url, error: err });
          console.warn(`Failed to load three.js from ${url}`, err);
        }
      }

      const error = new Error(
        'Failed to load three.js from local copy or any CDN source.'
      );
      error.causes = errors;
      throw error;
    })();
  }
  return cachedPromise;
}
