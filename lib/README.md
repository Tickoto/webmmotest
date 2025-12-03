Drop a local copy of three.module.js (matching three@0.165.0) into this
folder to run the game without the CDN. The loader now tries the local copy
first, then several CDNs (unpkg, jsDelivr, cdnjs), so placing the file here
lets the game start even when the network is blocked.

If you have internet access, you can fetch the file with any of the following
commands and save it as ./lib/three.module.js:

```
curl -L https://unpkg.com/three@0.165.0/build/three.module.js -o three.module.js
curl -L https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js -o three.module.js
curl -L https://cdnjs.cloudflare.com/ajax/libs/three.js/0.165.0/three.module.js -o three.module.js
```
