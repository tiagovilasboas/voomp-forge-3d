import type { Delivery } from '@application/queries/deliveries';
import type { Vec2 } from '../../world/worldModel';
import type { Note, NoteColor } from '../../state/notesStore';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS } from '../kit/canvasTexture';
import { SIGN_YAW } from '../kit/orientation';

const INK = { blue: '#1F3A8A', green: '#15803D', orange: '#E45A00', grey: '#6B7280' };
export const STICKY: Record<NoteColor, string> = { yellow: '#FDE68A', orange: '#FDBA74', green: '#BBF7D0', blue: '#BFDBFE' };

const W = 1536;
const H = 640;
const SPLIT = 960;

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Word-wraps `text` into at most `lines` lines that fit `width`. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, lines: number): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > width && line) {
      out.push(line);
      line = word;
      if (out.length === lines) break;
    } else line = next;
  }
  if (out.length < lines && line) out.push(line);
  if (out.length === lines && text.length > out.join(' ').length) out[lines - 1] = truncate(out[lines - 1], out[lines - 1].length);
  return out;
}

function drawDeliveries(ctx: CanvasRenderingContext2D, deliveries: Delivery[], vocabularyShort: string) {
  ctx.save();
  ctx.translate(48, 78);
  ctx.rotate(-0.012);
  ctx.fillStyle = INK.blue;
  ctx.font = FONTS.display(52, 700);
  ctx.fillText('Entregue esta semana', 0, 0);
  ctx.strokeStyle = INK.orange;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(0, 18);
  ctx.quadraticCurveTo(300, 30, 540, 14);
  ctx.stroke();
  ctx.restore();

  if (!deliveries.length) {
    ctx.fillStyle = INK.grey;
    ctx.font = FONTS.display(36, 500);
    ctx.fillText('Nada chegou à produção nos últimos 7 dias… ainda.', 56, 220);
    return;
  }
  deliveries.slice(0, 5).forEach((d, i) => {
    ctx.save();
    ctx.translate(56, 170 + i * 92);
    ctx.rotate(((i % 2) - 0.5) * 0.008);
    ctx.strokeStyle = INK.green;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(12, 4);
    ctx.lineTo(34, -26);
    ctx.stroke();
    ctx.fillStyle = INK.blue;
    ctx.font = FONTS.display(34, 600);
    ctx.fillText(truncate(d.cr.productSummary ?? d.cr.title, 44), 56, -2);
    ctx.fillStyle = INK.grey;
    ctx.font = FONTS.mono(21, 500);
    const task = d.cr.workItems[0]?.key;
    ctx.fillText(`${vocabularyShort} #${d.cr.number} · ${d.repo.name}${task ? ` · ${task}` : ''}`, 56, 30);
    ctx.restore();
  });
  if (deliveries.length > 5) {
    ctx.fillStyle = INK.orange;
    ctx.font = FONTS.display(28, 600);
    ctx.fillText(`+ ${deliveries.length - 5} no Delivery Explorer`, 56, H - 36);
  }
}

function drawNotes(ctx: CanvasRenderingContext2D, notes: Note[]) {
  ctx.fillStyle = INK.blue;
  ctx.font = FONTS.display(40, 700);
  ctx.fillText('Notas do time', SPLIT + 40, 70);
  if (!notes.length) {
    ctx.fillStyle = INK.grey;
    ctx.font = FONTS.display(28, 500);
    ctx.fillText('Clique no quadro para colar', SPLIT + 40, 140);
    ctx.fillText('o primeiro post-it.', SPLIT + 40, 178);
    return;
  }
  const size = 168;
  notes.slice(0, 6).forEach((n, i) => {
    const x = SPLIT + 40 + (i % 3) * (size + 18);
    const y = 110 + Math.floor(i / 3) * (size + 26);
    ctx.save();
    ctx.translate(x + size / 2, y + size / 2);
    ctx.rotate((((i * 37) % 7) - 3) * 0.012);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(-size / 2 + 5, -size / 2 + 7, size, size);
    ctx.fillStyle = STICKY[n.color];
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.fillStyle = '#1F2937';
    ctx.font = FONTS.display(22, 600);
    wrap(ctx, n.text, size - 24, 5).forEach((line, l) => ctx.fillText(line, -size / 2 + 12, -size / 2 + 32 + l * 26));
    if (n.ref) {
      ctx.fillStyle = INK.orange;
      ctx.beginPath();
      ctx.arc(size / 2 - 16, -size / 2 + 16, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  });
  if (notes.length > 6) {
    ctx.fillStyle = INK.orange;
    ctx.font = FONTS.display(26, 600);
    ctx.fillText(`+ ${notes.length - 6} notas`, SPLIT + 40, H - 30);
  }
}

/**
 * Team whiteboard by the production gate. Left: what reached production this
 * week (data, read-only). Right: the team's sticky notes (editable).
 */
export function WeekBoard({
  position,
  deliveries,
  notes,
  vocabularyShort,
}: {
  position: Vec2;
  deliveries: Delivery[];
  notes: Note[];
  vocabularyShort: string;
}) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'whiteboard' });
  const key = `${deliveries.map((d) => d.cr.id).join('|')}#${notes.map((n) => `${n.id}${n.text}${n.color}${n.ref ? 1 : 0}`).join('|')}`;

  const tex = useCanvasTexture(
    W,
    H,
    (ctx) => {
      ctx.fillStyle = '#F4F4F0';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(31,58,138,0.035)';
      for (let i = 0; i < 8; i++) ctx.fillRect(70 + i * 170, 130 + (i % 3) * 140, 230, 24);
      ctx.strokeStyle = 'rgba(31,58,138,0.25)';
      ctx.setLineDash([14, 12]);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(SPLIT, 40);
      ctx.lineTo(SPLIT, H - 40);
      ctx.stroke();
      ctx.setLineDash([]);
      drawDeliveries(ctx, deliveries, vocabularyShort);
      drawNotes(ctx, notes);
    },
    [key, vocabularyShort],
  );

  const [x, z] = position;
  const frame = selected ? mat.matte('#FF6A00') : hovered ? mat.matte('#FF8C32') : mat.matte('#B9BEC6');
  return (
    <group position={[x, 0, z]} rotation={[0, SIGN_YAW, 0]} {...handlers}>
      <Box position={[-2.25, 0.95, -0.12]} size={[0.06, 1.9, 0.06]} material={mat.steel()} />
      <Box position={[2.25, 0.95, -0.12]} size={[0.06, 1.9, 0.06]} material={mat.steel()} />
      <Box position={[0, 1.75, -0.04]} size={[4.7, 2.1, 0.06]} material={frame} />
      <Decal texture={tex} position={[0, 1.75, 0.0]} size={[4.58, 1.99]} />
      <Box position={[0, 0.66, 0.08]} size={[3.2, 0.04, 0.14]} material={mat.matte('#9AA1AB')} />
      <Box position={[-0.3, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#1F3A8A')} />
      <Box position={[0.0, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#E45A00')} />
      <Box position={[0.3, 0.7, 0.08]} size={[0.22, 0.035, 0.035]} material={mat.matte('#15803D')} />
    </group>
  );
}
