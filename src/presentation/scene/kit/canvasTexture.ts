import * as THREE from 'three';

/**
 * Canvas-drawn textures for signage, plates and screens. No font files or
 * network requests: everything is drawn with the page's loaded web fonts.
 */

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

export function makeCanvasTexture(width: number, height: number, draw: Draw): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  draw(ctx, width, height);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const FONTS = {
  display: (px: number, weight = 700) => `${weight} ${px}px "Space Grotesk", "Inter", sans-serif`,
  mono: (px: number, weight = 600) => `${weight} ${px}px "JetBrains Mono", ui-monospace, monospace`,
};

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Repeating floor grid with fine industrial detailing. */
export function makeFloorTexture(): THREE.CanvasTexture {
  const tex = makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#0E1015';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo((i * w) / 4, 0);
      ctx.lineTo((i * w) / 4, h);
      ctx.moveTo(0, (i * h) / 4);
      ctx.lineTo(w, (i * h) / 4);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,140,50,0.12)';
    for (const [x, y] of [[4, 4], [w - 8, 4], [4, h - 8], [w - 8, h - 8]]) ctx.fillRect(x, y, 4, 4);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/**
 * Large non-repeating grid for the ground horizon. Thin cyan-leaning lines on a
 * transparent canvas, fading radially to zero toward the edges so the plane
 * dissolves into the fog instead of ending with a hard rim. One cell maps to
 * `cells` divisions across the whole plane, so the renderer sizes the plane to
 * keep cells aligned with the room grid rhythm.
 */
export function makeGroundGridTexture(cells = 48, line = 'rgba(125,149,201,0.55)'): THREE.CanvasTexture {
  const size = 1024;
  const tex = makeCanvasTexture(size, size, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const step = w / cells;

    // Grid lines drawn onto an offscreen pass is overkill; draw straight, then
    // multiply by a radial alpha gradient so lines vanish toward the edges.
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i <= cells; i++) {
      const p = Math.round(i * step) + 0.5;
      ctx.moveTo(p, 0);
      ctx.lineTo(p, h);
      ctx.moveTo(0, p);
      ctx.lineTo(w, p);
    }
    ctx.stroke();

    // Radial fade: keep the centre, erase the borders. `destination-in` keeps
    // existing pixels weighted by the gradient's alpha.
    const grad = ctx.createRadialGradient(w / 2, h / 2, w * 0.06, w / 2, h / 2, w * 0.5);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(0.55, 'rgba(0,0,0,0.6)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'destination-in';
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  });
  // Single large plane, no tiling — the fade is baked in, so clamp the edges.
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

/** Diagonal hazard hatch used on sector edges. */
export function makeHatchTexture(color: string): THREE.CanvasTexture {
  const tex = makeCanvasTexture(64, 64, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 10;
    for (let i = -h; i < w * 2; i += 28) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i - h, h);
      ctx.stroke();
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
