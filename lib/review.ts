import type { CommonMiss, MostCostly, RangeFocus } from '@/lib/data/models';

export type Option<T extends string> = { value: T; label: string };

export const MOST_COSTLY_OPTIONS: Option<MostCostly>[] = [
  { value: 'putting', label: 'Putting' },
  { value: 'driving', label: 'Driving' },
  { value: 'wedge_play', label: 'Wedge play' },
  { value: 'mid_irons', label: 'Mid irons' },
  { value: 'long_irons', label: 'Long irons' },
];

export const COMMON_MISS_OPTIONS: Option<CommonMiss>[] = [
  { value: 'left', label: 'Left' },
  { value: 'right', label: 'Right' },
  { value: 'long', label: 'Long' },
  { value: 'short', label: 'Short' },
  { value: 'mixed', label: 'Mixed' },
];

export const RANGE_FOCUS_OPTIONS: Option<RangeFocus>[] = [
  { value: 'tempo', label: 'Tempo' },
  { value: 'technique', label: 'Technique' },
  { value: 'approach_game', label: 'Approach game' },
  { value: 'chipping', label: 'Chipping' },
  { value: 'putting', label: 'Putting' },
  { value: 'pre_shot_routine', label: 'Pre-shot routine' },
  { value: 'short_game', label: 'Short game' },
  { value: 'driving', label: 'Driving' },
];

export const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function labelForMostCostly(value: MostCostly): string {
  return MOST_COSTLY_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelForCommonMiss(value: CommonMiss): string {
  return COMMON_MISS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function labelForRangeFocus(value: RangeFocus): string {
  return RANGE_FOCUS_OPTIONS.find((o) => o.value === value)?.label ?? value;
}
