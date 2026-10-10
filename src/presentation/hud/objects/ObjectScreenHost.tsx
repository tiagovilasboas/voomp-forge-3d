import { useUiStore } from '../../state/uiStore';
import { BoardScreen } from './BoardScreen';
import { DeskScreen } from './DeskScreen';
import { isObjectRef } from './objectRefs';
import { WhiteboardScreen } from './WhiteboardScreen';

/** Renders the Object Screen for the current selection, if it is an interactive 3D object. */
export function ObjectScreenHost() {
  const selection = useUiStore((s) => s.selection);
  if (!isObjectRef(selection)) return null;
  switch (selection.kind) {
    case 'whiteboard':
      return <WhiteboardScreen />;
    case 'board':
      return <BoardScreen key={selection.id} id={selection.id} />;
    case 'desk':
      return <DeskScreen key={selection.id} id={selection.id} />;
  }
}
