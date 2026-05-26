// Pre-round goals are free text — the player writes one intention per category.

export type GoalCategoryKey = 'execution' | 'strategic' | 'mental';

export type GoalCategory = {
  key: GoalCategoryKey;
  /** Short label used as the block header and in the menu / summary rows. */
  label: string;
  /** One-line explanation of what this category means. */
  helper: string;
  /** Example intention, shown as the input placeholder. */
  placeholder: string;
};

export const GOAL_CATEGORIES: GoalCategory[] = [
  {
    key: 'execution',
    label: 'Execution',
    helper: 'How you swing, aim, and commit',
    placeholder: 'e.g. Commit to my routine',
  },
  {
    key: 'strategic',
    label: 'Strategic',
    helper: 'How you manage the course',
    placeholder: 'e.g. Aim for the center of greens',
  },
  {
    key: 'mental',
    label: 'Mental',
    helper: 'Your mindset and attitude',
    placeholder: 'e.g. Move on from bad shots',
  },
];
