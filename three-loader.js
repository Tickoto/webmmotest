// three-loader.js
// Centralized loader for three.js with CDN + local fallback. This prevents a
// blank screen when the CDN cannot be reached and makes it easy to drop in a
// local copy at ./lib/three.module.js for offline use.

let cachedPromise = null;

export async function loadThree() {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const cdnUrl = 'https://unpkg.com/three@0.165.0/build/three.module.js';
      try {
        return await import(cdnUrl);
      } catch (cdnErr) {
        console.warn('CDN load failed, trying local fallback', cdnErr);
        try {
          return await import('./lib/three.module.js');
        } catch (localErr) {
          const error = new Error(
            'Failed to load three.js from CDN and no local fallback was found.'
          );
          error.cause = { cdnErr, localErr };
          throw error;
        }
      }
    })();
  }
  return cachedPromise;
}
