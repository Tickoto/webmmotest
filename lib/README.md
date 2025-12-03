Drop a local copy of **three.module.js** (matching three@0.165.0) into this
folder to run the game without the CDN. The loader will also accept a few
common case variations like `Three.module.js` and, as a last resort, will load
classic UMD bundles such as `Three.js`/`three.js` and return the global
`THREE` object. The search order is:

1. Local ES module variants (`three.module.js`, `Three.module.js`, `three.module.mjs`)
2. Local UMD variants (`three.js`, `Three.js`, `three.core.js`, `three.min.js`)
3. CDNs (unpkg, jsDelivr, cdnjs)

If you have internet access, you can fetch the ES module file with any of the
following commands and save it as `./lib/three.module.js`:

```
curl -L https://unpkg.com/three@0.165.0/build/three.module.js -o three.module.js
curl -L https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js -o three.module.js
curl -L https://cdnjs.cloudflare.com/ajax/libs/three.js/0.165.0/three.module.js -o three.module.js
```
