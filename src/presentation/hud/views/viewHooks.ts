import { useMemo } from 'react';
import { useReadyData } from '../../state/dataStore';

/** Provider-native words ("PR"/"MR", "Pipeline"…) from the loaded snapshot. */
export function useVocabulary() {
  const { snapshot } = useReadyData();
  return snapshot.source.provider.vocabulary;
}

/** "Now" is the snapshot generation time, so relative dates are reproducible. */
export function useSnapshotNow(): Date {
  const { snapshot } = useReadyData();
  return useMemo(() => new Date(snapshot.source.generatedAt), [snapshot]);
}

export function useIsDemo(): boolean {
  const { snapshot } = useReadyData();
  return snapshot.source.kind === 'demo';
}
