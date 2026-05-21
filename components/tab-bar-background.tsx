import { GlassSurface } from '@/components/glass-surface';

type TabBarBackgroundProps = {
  /** Corner radius of the floating bar; the glass/blur clip to it. */
  borderRadius?: number;
};

/**
 * Frosted "liquid glass" backdrop for the floating tab bar. Thin wrapper over
 * the shared {@link GlassSurface} so the glass/blur logic lives in one place.
 */
export function TabBarBackground({ borderRadius = 0 }: TabBarBackgroundProps) {
  return <GlassSurface borderRadius={borderRadius} />;
}
