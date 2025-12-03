// bootstrap.js
// Small wrapper to start the game module and show a helpful message if the
// dependencies (like three.js) fail to load.

function showStartupError(err) {
  console.error('Failed to start War Cities prototype', err);

  const canvas = document.getElementById('gameCanvas');
  if (canvas) {
    canvas.style.display = 'none';
  }

  const overlay = document.createElement('div');
  overlay.id = 'startupError';
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.background = 'linear-gradient(135deg, #0a0c14, #0f172a)';
  overlay.style.color = '#e3e8f5';
  overlay.style.display = 'flex';
  overlay.style.flexDirection = 'column';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.textAlign = 'center';
  overlay.style.padding = '32px';
  overlay.style.fontFamily = '"Segoe UI", system-ui, sans-serif';
  overlay.style.gap = '12px';

  const title = document.createElement('div');
  title.style.fontSize = '20px';
  title.style.fontWeight = '700';
  title.textContent = 'Could not start the game';

  const body = document.createElement('div');
  body.style.maxWidth = '520px';
  body.style.lineHeight = '1.6';
  body.style.color = '#cbd5f5';
  body.innerHTML =
    'The 3D engine (three.js) could not be loaded. ' +
    'If you are offline or the CDN is blocked, place three.module.js into <code>./lib/</code> ' +
    'and reload the page.';

  const details = document.createElement('div');
  details.style.fontSize = '12px';
  details.style.color = '#9aa4c3';
  details.textContent = err?.message || String(err);

  overlay.appendChild(title);
  overlay.appendChild(body);
  overlay.appendChild(details);
  document.body.appendChild(overlay);
}

(async () => {
  try {
    await import('./main.js');
  } catch (err) {
    showStartupError(err);
  }
})();
