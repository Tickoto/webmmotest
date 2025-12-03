// three-loader.js
// Centralized loader for three.js with CDN + local fallback. This prevents a
// blank screen when the CDN cannot be reached and makes it easy to drop in a
// local copy at ./lib/three.module.js for offline use.

let cachedPromise = null;

// Accept several common local filenames so users on case-sensitive systems
// do not end up with a "file is present" but "module not found" situation.
const LOCAL_MODULE_CANDIDATES = [
  './lib/three.module.js',
  './lib/Three.module.js',
  './lib/three.module.mjs',
];

// Some downloads provide the non-module UMD build (three.js / Three.js). If
// we find one of these, we fall back to loading it as a classic script and
// return the global THREE object so the rest of the code keeps working.
const LOCAL_SCRIPT_CANDIDATES = [
  './lib/three.js',
  './lib/Three.js',
  './lib/three.core.js',
  './lib/Three.core.js',
  './lib/three.min.js',
  './lib/Three.min.js',
];

// Try multiple sources so the engine can start even if one CDN is blocked.
const CDN_SOURCES = [
  'https://unpkg.com/three@0.165.0/build/three.module.js',
  'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.165.0/three.module.js',
];

// Some browsers/environments report a RangeError ("Maximum call stack size
// exceeded") when a cross-origin module import fails and the loader keeps
// retrying fallbacks. As a last resort, try the classic UMD bundle over CDN so
// we at least get a working global THREE instead of blowing the stack during
// startup.
const CDN_SCRIPT_SOURCES = [
  'https://unpkg.com/three@0.165.0/build/three.min.js',
  'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/three.js/0.165.0/three.min.js',
];

async function tryLocalModule(paths, errors) {
  for (const path of paths) {
    try {
      return await import(path);
    } catch (err) {
      errors.push({ source: `local ${path}`, error: err });
    }
  }
  return null;
}

async function tryLocalScript(paths, errors) {
  // If a global THREE is already present, honor it immediately.
  if (typeof window !== 'undefined' && window.THREE) {
    return window.THREE;
  }

  for (const path of paths) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = path;
        script.async = true;
        script.onload = () => resolve();
        script.onerror = (err) => reject(err);
        document.head.appendChild(script);
      });

      if (window.THREE) {
        return window.THREE;
      }

      errors.push({ source: `local ${path}`, error: new Error('THREE global not found after script load') });
    } catch (err) {
      errors.push({ source: `local ${path}`, error: err });
    }
  }

  return null;
}

export async function loadThree() {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const errors = [];

      // 1) Prefer a locally shipped ES module copy so offline users work
      // immediately. Try a few common case variants to avoid case-sensitivity
      // headaches.
      const localModule = await tryLocalModule(LOCAL_MODULE_CANDIDATES, errors);
      if (localModule) return localModule;

      // 2) Fall back to a bundled UMD script if that's what's available.
      const localScript = await tryLocalScript(LOCAL_SCRIPT_CANDIDATES, errors);
      if (localScript) return localScript;

      // 3) Fall back to the public CDNs.
      for (const url of CDN_SOURCES) {
        try {
          return await import(url);
        } catch (err) {
          errors.push({ source: url, error: err });
          console.warn(`Failed to load three.js from ${url}`, err);
        }
      }

      // 4) If module imports failed (for example due to CORS/mixed-content
      // issues), try the UMD CDN build via <script> to avoid RangeError loops
      // that leave the page unusable.
      const cdnScript = await tryLocalScript(CDN_SCRIPT_SOURCES, errors);
      if (cdnScript) return cdnScript;

      const error = new Error(
        'Failed to load three.js from local copies or any CDN source. Ensure a three.module.js exists in ./lib or that you have network access.'
      );
      error.causes = errors;
      throw error;
    })();
  }
  return cachedPromise;
}
