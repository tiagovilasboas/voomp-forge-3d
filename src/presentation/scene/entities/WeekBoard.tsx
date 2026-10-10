import type { Delivery } from '@application/queries/deliveries';
import type { Vec2 } from '../../world/worldModel';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';

const INK = { blue: '#1F3A8A', green: '#15803D', orange: '#E45A00', grey: '#6B7280' };

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/**
 * Whiteboard by the production gate: what reached production this week, in
 * plain language — the first thing a PM looks at. Only confirmed deliveries.
 */
export function WeekBoard({ position, deliveries, vocabularyShort }: { position: Vec2; deliveries: Delivery[]; vocabularyShort: string }) {
  const first = deliveries[0];
  const { hovered, handlers } = useInteractive(first ? { kind: 'cr', id: first.cr.id } : { kind: 'gate' });
  const key = deliveries.map((d) => d.cr.id).join('|');

  const tex = useCanvasTexture(
    1024,
    640,
    (ctx, w, h) => {
      ctx.fillStyle = '#F4F4F0';
      ctx.fillRect(0, 0, w, h);
      // faint marker ghosting, like a real board
      ctx.fillStyle = 'rgba(31,58,138,0.04)';
      for (let i = 0; i < 6; i++) ctx.fillRect(80 + i * 140, 120 + (i % 3) * 140, 220, 26);

      ctx.save();
      ctx.translate(48, 78);
      ctx.rotate(-0.012);
      ctx.fillStyle = INK.blue;
      ctx.font = FONTS.display(54, 700);
      ctx.fillText('Entregue esta semana', 0, 0);
      ctx.strokeStyle = INK.orange;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(0, 18);
      ctx.quadraticCurveTo(300, 30, 560, 14);
      ctx.stroke();
      ctx.restore();

      if (!deliveries.length) {
        ctx.fillStyle = INK.grey;
        ctx.font = FONTS.display(38, 500);
        ctx.fillText('Nada chegou à produção nos últimos 7 dias… ainda.', 56, 220);
        return;
      }
      deliveries.slice(0, 5).forEach((d, i) => {
        const y = 170 + i * 92;
        ctx.save();
        ctx.translate(56, y);
        ctx.rotate(((i % 2) - 0.5) * 0.008);
        // check mark
        ctx.strokeStyle = INK.green;
        ctx.lineWidth = 7;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.lineTo(12, 4);
        ctx.lineTo(34, -26);
        ctx.stroke();
        ctx.fillStyle = INK.blue;
        ctx.font = FONTS.display(36, 600);
        ctx.fillText(truncate(d.cr.productSummary ?? d.cr.title, 46), 56, -2);
        ctx.fillStyle = INK.grey;
        ctx.font = FONTS.mono(22, 500);
        const task = d.cr.workItems[0]?.key;
        ctx.fillText(`${vocabularyShort} #${d.cr.number} · ${d.repo.name}${task ? ` · ${task}` : ''}`, 56, 30);
        ctx.restore();
      });
      if (deliveries.length > 5) {
        ctx.fillStyle = INK.orange;
        ctx.font = FONTS.display(30, 600);
        ctx.fillText(`+ ${deliveries.length - 5} no Delivery Explorer`, 56, h - 36);
      }
    },
    [key, vocabularyShort],
  );

  const [x, z] = position;
  return (
    <group position={[x, 0, z]} rotation={[0, 0.62, 0]} {...handlers}>
      {/* easel legs + frame */}
      <Box position={[-1.55, 0.95, -0.12]} size={[0.06, 1.9, 0.06]} material={mat.steel()} />
      <Box position={[1.55, 0.95, -0.12]} size={[0.06, 1.9, 0.06]} material={mat.steel()} />
      <Box position={[0, 1.75, -0.04]} size={[3.3, 2.1, 0.06]} material={hovered ? mat.matte('#FF8C32') : mat.matte('#B9BEC6')} />
      <Decal texture={tex} position={[0, 1.75, 0.0]} size={[3.18, 1.99]} />
      {/* marker tray */}
      <Box position={[0, 0.66, 0.08]} size={[2.4, 0.04, 0.14]} material={mat.matte('#9AA1AB')} />
      <Box position={[-0.3, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#1F3A8A')} />
      <Box position={[0.0, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#E45A00')} />
      <Box position={[0.3, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#15803D')} />
    </group>
  );
}
