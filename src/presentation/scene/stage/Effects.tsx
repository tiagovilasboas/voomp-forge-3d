import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing';

/** Subtle bloom: only unlit glow materials (toneMapped=false) cross the threshold. */
export function Effects() {
  return (
    <EffectComposer multisampling={4}>
      <Bloom mipmapBlur luminanceThreshold={1} luminanceSmoothing={0.2} intensity={0.75} radius={0.6} />
      <Vignette eskil={false} offset={0.25} darkness={0.55} />
    </EffectComposer>
  );
}
