export function initRipple() {
  const canvas = document.getElementById('ripple-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let W, H, ripples = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  function addRipple(x, y) {
    ripples.push({
      x, y,
      r: 0,
      alpha: 0.6,
      speed: 1.2 + Math.random() * 0.4,
      thickness: 1.2,
      hueShift: Math.random() * 20,
    });
  }

  function spawnBurst(x, y, count = 3) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => addRipple(x, y), i * 120);
    }
  }

  document.addEventListener('click', e => {
    spawnBurst(e.clientX, e.clientY, 3);
  });

  document.addEventListener('page-change', e => {
    const x = e.detail?.x || window.innerWidth / 2;
    const y = e.detail?.y || window.innerHeight / 2;
    spawnBurst(x, y, 4);
  });

  function draw() {
    ctx.clearRect(0, 0, W, H);

    ripples = ripples.filter(r => r.alpha > 0.004);

    for (const r of ripples) {
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${59 + r.hueShift}, ${130 + r.hueShift}, 246, ${r.alpha})`;
      ctx.lineWidth = r.thickness;
      ctx.stroke();

      r.r += r.speed;
      r.alpha *= 0.94;  
    }

    requestAnimationFrame(draw);
  }

  draw();
}