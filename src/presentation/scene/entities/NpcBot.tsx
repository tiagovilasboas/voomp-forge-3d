import { useMemo } from 'react';
import type { WorldModel } from '../../world/worldModel';
import { compile } from '../../animation/script';
import { automationStand, planNpcPatrol } from '../../animation/npc';
import { useInteractive } from '../../interaction/useInteractive';
import type { RobotDesign } from '../kit/robotDesign';
import { RobotBody, type RoleStyle } from './FigureEntity';

/** Distinctive neutral finish: graphite with cyan accents, so it never reads as a person. */
const BOT_DESIGN: RobotDesign = {
  ear: 'pod',
  finish: { shell: '#23272E', metalness: 0.6, roughness: 0.35 },
  crest: true,
  signature: [true, false, true, false, true],
};
const BOT_STYLE: RoleStyle = { accent: '#38E1FF', device: 'tablet' };

/** "Forge Bot": an NPC (not a contributor) that patrols the hub and inspects the n8n desk. */
export function NpcBot({ world, reducedMotion }: { world: WorldModel; reducedMotion: boolean }) {
  const { hovered, selected, handlers } = useInteractive({ kind: 'automation' });
  const hub = world.aiHub;
  const script = useMemo(() => {
    const s = planNpcPatrol(hub);
    return { ...compile(s), offset: s.offset };
  }, [hub]);
  const stand = useMemo(() => automationStand(hub), [hub]);
  const heading = Math.atan2(hub.automation[0] - stand[0], hub.automation[1] - stand[1]);
  return (
    <RobotBody
      id="forge-bot"
      design={BOT_DESIGN}
      style={BOT_STYLE}
      script={script}
      home={stand}
      restHeading={heading}
      dimmed={false}
      reducedMotion={reducedMotion}
      tagName="FORGE BOT"
      tagRole="NPC"
      hovered={hovered}
      selected={selected}
      handlers={handlers}
    />
  );
}
