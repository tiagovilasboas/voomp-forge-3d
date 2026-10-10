import * as THREE from 'three';
import type { Expression } from '../../animation/expression';
import { makeCanvasTexture } from './canvasTexture';
import { ROBOT_STYLE } from './robotDesign';

/**
 * LED face textures for the robot screens, drawn once and shared by every
 * robot (6 small textures in total). The screen is black; only the LEDs glow.
 */
const SIZE = 256;
const cache = new Map<Expression, THREE.CanvasTexture>();

type Draw = (ctx: CanvasRenderingContext2D) => void;

const eye = (x: number, y: number, draw: (ctx: CanvasRenderingContext2D) => void): Draw => (ctx) => {
  ctx.save();
  ctx.translate(x, y);
  draw(ctx);
  ctx.restore();
};

const smileArc = (ctx: CanvasRenderingContext2D, r: number) => {
  ctx.beginPath();
  ctx.arc(0, 8, r, Math.PI * 1.1, Math.PI * 1.9);
  ctx.stroke();
};

const DRAW: Record<Expression, Draw[]> = {
  neutral: [
    eye(84, 112, (c) => c.fillRect(-18, -22, 36, 44)),
    eye(172, 112, (c) => c.fillRect(-18, -22, 36, 44)),
    (c) => c.fillRect(112, 172, 32, 8),
  ],
  blink: [eye(84, 118, (c) => c.fillRect(-20, -4, 40, 8)), eye(172, 118, (c) => c.fillRect(-20, -4, 40, 8)), (c) => c.fillRect(112, 172, 32, 8)],
  happy: [
    eye(84, 120, (c) => smileArc(c, 24)),
    eye(172, 120, (c) => smileArc(c, 24)),
    (c) => {
      c.beginPath();
      c.arc(128, 160, 22, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    },
  ],
  focused: [
    eye(84, 116, (c) => c.fillRect(-20, -10, 40, 20)),
    eye(172, 116, (c) => c.fillRect(-20, -10, 40, 20)),
    (c) => c.fillRect(116, 174, 24, 6),
  ],
  sad: [
    eye(84, 124, (c) => c.fillRect(-18, -8, 36, 16)),
    eye(172, 124, (c) => c.fillRect(-18, -8, 36, 16)),
    (c) => {
      c.beginPath();
      c.arc(128, 196, 22, 1.2 * Math.PI, 1.8 * Math.PI);
      c.stroke();
    },
  ],
  glitch: [
    eye(84, 112, (c) => {
      c.fillRect(-18, -22, 36, 18);
      c.fillRect(-10, 2, 36, 18);
    }),
    eye(172, 116, (c) => c.fillRect(-20, -4, 40, 8)),
    (c) => {
      c.globalAlpha = 0.5;
      c.fillRect(40, 150, 176, 4);
      c.globalAlpha = 1;
    },
  ],
};

export function faceTexture(expression: Expression): THREE.CanvasTexture {
  let tex = cache.get(expression);
  if (!tex) {
    tex = makeCanvasTexture(SIZE, SIZE, (ctx) => {
      ctx.fillStyle = ROBOT_STYLE.faceScreen;
      ctx.fillRect(0, 0, SIZE, SIZE);
      ctx.fillStyle = ROBOT_STYLE.eyeColor;
      ctx.strokeStyle = ROBOT_STYLE.eyeColor;
      ctx.lineWidth = 11;
      ctx.lineCap = 'round';
      ctx.shadowColor = ROBOT_STYLE.eyeColor;
      ctx.shadowBlur = 16;
      for (const draw of DRAW[expression]) draw(ctx);
    });
    cache.set(expression, tex);
  }
  return tex;
}
