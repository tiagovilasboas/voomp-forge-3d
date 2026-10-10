import { PALETTE } from '../../theme';
import type { Vec2 } from '../../world/worldModel';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

/** Small brushed-metal credit plaque on a pedestal. */
export function CreditPlaque({ position }: { position: Vec2 }) {
  const tex = useCanvasTexture(
    768,
    256,
    (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#2B2F36');
      g.addColorStop(1, '#16191E');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = PALETTE.forge;
      ctx.lineWidth = 6;
      ctx.strokeRect(14, 14, w - 28, h - 28);
      ctx.fillStyle = PALETTE.fog;
      ctx.font = FONTS.mono(26, 600);
      ctx.fillText('VOOMP FORGE · PROTÓTIPO', 48, 74);
      ctx.fillStyle = PALETTE.snow;
      ctx.font = FONTS.display(58, 700);
      ctx.fillText('Feito com Claude Code', 48, 150);
      ctx.fillStyle = PALETTE.forgeBright;
      ctx.font = FONTS.mono(26, 600);
      ctx.fillText('From Code to Delivery', 48, 206);
    },
    [],
  );
  const [x, z] = position;
  return (
    <group position={[x, 0, z]} rotation={[0, 0.62, 0]}>
      <Box position={[0, 0.45, 0]} size={[0.5, 0.9, 0.4]} material={mat.rackMetal()} />
      <Box position={[0, 0.91, 0]} size={[0.56, 0.03, 0.46]} material={mat.glow(PALETTE.forge, 0.5)} shadows={false} />
      <group position={[0, 1.25, 0]} rotation={[-0.35, 0, 0]}>
        <Box position={[0, 0, -0.03]} size={[1.6, 0.56, 0.05]} material={mat.steel()} />
        <Decal texture={tex} position={[0, 0, 0.0]} size={[1.5, 0.5]} />
      </group>
    </group>
  );
}
