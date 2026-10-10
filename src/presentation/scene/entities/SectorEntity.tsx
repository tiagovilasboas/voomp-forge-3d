import { cloneElement, useMemo } from 'react';
import { Edges } from '@react-three/drei';
import { PALETTE } from '../../theme';
import type { FigureLayout, RackLayout, SectorLayout } from '../../world/worldModel';
import { toWorld, yawFor } from '../../world/frame';
import { useInteractive } from '../../interaction/useInteractive';
import { Box, Decal, useCanvasTexture } from '../kit/Part';
import { mat } from '../kit/materials';
import { FONTS, makeHatchTexture } from '../kit/canvasTexture';
import { Board, CableTray, Desk, FeatureProp } from './props';

export interface SectorBoards {
  open: number;
  awaitingReview: number;
  blocked: number;
  production: number;
  staging: number;
  integrated: number;
}

interface Props {
  layout: SectorLayout;
  racks: RackLayout[];
  figures: FigureLayout[];
  boards: SectorBoards;
  /** Outside the active squad filter. */
  dimmed: boolean;
  alert: boolean;
  reducedMotion: boolean;
}

const PLATFORM_H = 0.14;

/** Makes a wall board clickable and feeds hover/selected state to its frame glow. */
function BoardHit({ id, children }: { id: string; children: React.ReactElement<{ state?: 'idle' | 'hover' | 'selected' }> }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'board', id });
  return <group {...handlers}>{cloneElement(children, { state: selected ? 'selected' : hovered ? 'hover' : 'idle' })}</group>;
}

/** Sector = squad. A raised platform with its racks, desks, boards and a themed room. */
export function SectorEntity({ layout, racks, figures, boards, dimmed, alert, reducedMotion }: Props) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'squad', id: layout.squadId });
  const [cx, cz] = layout.center;
  const [w, d] = layout.size;
  const accent = layout.theme.accent;
  const yaw = yawFor(layout.facing);

  const floorSign = useCanvasTexture(
    1024,
    256,
    (ctx, cw, ch) => {
      ctx.clearRect(0, 0, cw, ch);
      ctx.fillStyle = accent;
      ctx.font = FONTS.display(190, 700);
      ctx.textBaseline = 'middle';
      ctx.globalAlpha = 0.9;
      ctx.fillText(layout.code, 20, ch / 2 + 8);
      const codeW = ctx.measureText(layout.code).width;
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#F5F5F5';
      ctx.font = FONTS.display(84, 700);
      ctx.fillText(layout.name.toUpperCase(), 60 + codeW, ch / 2 - 26);
      ctx.fillStyle = '#9DA3AE';
      ctx.font = FONTS.mono(34, 500);
      ctx.fillText(`SETOR ${layout.code} · ${layout.theme.tagline}`, 64 + codeW, ch / 2 + 52);
    },
    [layout.code, layout.name, accent],
  );
  const hatch = useMemo(() => {
    const t = makeHatchTexture(accent);
    t.repeat.set(w / 1.2, 1);
    return t;
  }, [accent, w]);

  const wallH = layout.facing < 0 ? 0.7 : 3.3;
  const trimColor = selected ? PALETTE.forgeBright : hovered ? PALETTE.snow : accent;

  return (
    <group>
      {/* platform: clicking empty floor selects the squad */}
      <group position={[cx, 0, cz]} rotation={[0, yaw, 0]} {...handlers}>
        <mesh position={[0, PLATFORM_H / 2, 0]} scale={[w, PLATFORM_H, d]} receiveShadow material={mat.platform()}>
          <boxGeometry />
          {(hovered || selected) && <Edges color={trimColor} lineWidth={selected ? 2 : 1} />}
        </mesh>
        {/* glowing edge trims */}
        <Box position={[0, PLATFORM_H + 0.005, d / 2 - 0.04]} size={[w, 0.012, 0.06]} material={mat.glow(trimColor, dimmed ? 0.25 : 0.9)} shadows={false} />
        <Box position={[-w / 2 + 0.04, PLATFORM_H + 0.005, 0]} size={[0.06, 0.012, d]} material={mat.glow(trimColor, dimmed ? 0.15 : 0.5)} shadows={false} />
        <Box position={[w / 2 - 0.04, PLATFORM_H + 0.005, 0]} size={[0.06, 0.012, d]} material={mat.glow(trimColor, dimmed ? 0.15 : 0.5)} shadows={false} />
        {/* hazard hatch along the front edge */}
        <Decal texture={hatch} position={[0, PLATFORM_H + 0.006, d / 2 - 0.35]} size={[w - 0.3, 0.4]} rotation={[-Math.PI / 2, 0, 0]} opacity={dimmed ? 0.15 : 0.35} />
        {/* painted sector sign */}
        {/* counter-rotated so the text reads upright from the default camera in either row */}
        <group position={[-w / 2 + 5.2, PLATFORM_H + 0.008, d / 2 - 1.55]} rotation={[0, yaw, 0]}>
          <Decal texture={floorSign} position={[0, 0, 0]} size={[9.6, 2.4]} rotation={[-Math.PI / 2, 0, 0]} opacity={dimmed ? 0.3 : 0.92} />
        </group>
        {/* back wall — low on the camera side (south row) so it never hides the room */}
        <Box position={[0, wallH / 2, -d / 2 + 0.12]} size={[w, wallH, 0.24]} material={mat.wall()} />
        <Box position={[0, wallH + 0.02, -d / 2 + 0.12]} size={[w, 0.05, 0.26]} material={mat.glow(accent, dimmed ? 0.2 : 0.7)} shadows={false} />
        {Array.from({ length: Math.floor(w / 2.4) }, (_, i) => (
          <Box key={i} position={[-w / 2 + 1.2 + i * 2.4, wallH / 2, -d / 2 + 0.26]} size={[0.1, wallH, 0.06]} material={mat.steel()} shadows={false} />
        ))}
      </group>

      <group position={[0, PLATFORM_H, 0]}>
        <BoardHit id={`${layout.squadId}:changes`}>
        <Board
          position={layout.boards.changes}
          yaw={yaw}
          title="Mudanças"
          rows={[
            { label: 'Abertas', value: boards.open, color: PALETTE.forgeBright },
            { label: 'Aguardando revisão', value: boards.awaitingReview, color: PALETTE.warn },
            { label: 'Bloqueadas', value: boards.blocked, color: boards.blocked ? PALETTE.fail : PALETTE.fog },
          ]}
        />
        </BoardHit>
        <BoardHit id={`${layout.squadId}:deliveries`}>
        <Board
          position={layout.boards.deliveries}
          yaw={yaw}
          title="Entregas"
          rows={[
            { label: 'Em produção', value: boards.production, color: PALETTE.ok },
            { label: 'Em staging', value: boards.staging, color: PALETTE.warn },
            { label: 'Integradas, sem deploy', value: boards.integrated, color: PALETTE.forgeBright },
          ]}
        />
        </BoardHit>
        {figures.map((f, i) => (
          <Desk key={f.personId} personId={f.personId} reducedMotion={reducedMotion} position={f.desk} yaw={yaw} seed={i * 97 + layout.code.charCodeAt(0)} />
        ))}
        <FeatureProp feature={layout.theme.feature} position={layout.feature} yaw={yaw} alert={alert} reducedMotion={reducedMotion} />
        {racks.map((r) => (
          <CableTray key={r.repoId} from={[r.position[0], r.position[1]]} to={[r.position[0], toWorld(layout.center, layout.facing, [0, -d / 2 + 0.3])[1]]} />
        ))}
      </group>
    </group>
  );
}
