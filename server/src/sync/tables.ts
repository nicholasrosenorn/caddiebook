// The single source of truth for which tables sync and which columns a client
// is allowed to write. Push strips anything not listed here, so a client can
// never set user_id / server_seq (server-owned) or smuggle unknown columns.
//
// Column names are snake_case to match the Postgres schema (migrations/0000).
// `dirty` is intentionally absent — it's a client-local flag with no server
// column. Each spec's `columns` includes the identity column(s), updated_at,
// deleted_at, and (where present) created_at.

export type TableSpec = {
  /** Identity column(s) within a user — the conflict target alongside user_id. */
  idColumns: string[];
  /** Every client-writable column (server adds user_id; trigger adds server_seq). */
  columns: string[];
};

export const TABLE_SPECS = {
  rounds: {
    idColumns: ['id'],
    columns: [
      'id', 'course_name', 'date_played', 'hole_count', 'completed_at', 'tee_name',
      'course_rating', 'slope_rating', 'include_in_handicap', 'exclude_from_sharing',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  courses: {
    idColumns: ['id'],
    columns: ['id', 'name', 'created_at', 'updated_at', 'deleted_at'],
  },
  tees: {
    idColumns: ['id'],
    columns: [
      'id', 'course_id', 'name', 'course_rating', 'slope_rating', 'par',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  holes: {
    idColumns: ['id'],
    columns: [
      'id', 'round_id', 'hole_number', 'par', 'fir', 'gir', 'up_and_down',
      'approach_distance_yds', 'approach_club', 'drive_club', 'score', 'putts',
      'chip_shots', 'sand_shots', 'penalties', 'green_blocked', 'notes',
      'updated_at', 'deleted_at',
    ],
  },
  shots: {
    idColumns: ['id'],
    columns: [
      'id', 'round_id', 'hole_number', 'shot_type', 'x_norm', 'y_norm',
      'intended_x_norm', 'intended_y_norm', 'notes', 'updated_at', 'deleted_at',
    ],
  },
  putts: {
    idColumns: ['id'],
    columns: [
      'id', 'round_id', 'hole_number', 'distance_ft', 'made', 'created_at',
      'updated_at', 'deleted_at',
    ],
  },
  post_round_reviews: {
    idColumns: ['id'],
    columns: [
      'id', 'round_id', 'most_costly', 'decision_making_rating', 'common_miss',
      'range_focus', 'overall_rating', 'created_at', 'updated_at', 'deleted_at',
    ],
  },
  pre_round_goals: {
    idColumns: ['id'],
    columns: [
      'id', 'round_id', 'execution_goal', 'strategic_goal', 'mental_goal',
      'created_at', 'updated_at', 'deleted_at',
    ],
  },
  journal_entries: {
    idColumns: ['id'],
    columns: ['id', 'tag', 'body', 'created_at', 'updated_at', 'deleted_at'],
  },
  app_settings: {
    idColumns: ['key'],
    columns: ['key', 'value', 'updated_at', 'deleted_at'],
  },
} satisfies Record<string, TableSpec>;

export type SyncableTable = keyof typeof TABLE_SPECS;

export const SYNCABLE_TABLES = Object.keys(TABLE_SPECS) as SyncableTable[];

export function isSyncableTable(t: string): t is SyncableTable {
  return Object.prototype.hasOwnProperty.call(TABLE_SPECS, t);
}
