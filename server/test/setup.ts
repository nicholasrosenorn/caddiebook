// Env defaults for the integration tests. Runs before any test module imports
// src/env.ts. Point DATABASE_URL at the docker-compose Postgres by default.
process.env.DATABASE_URL ||= 'postgres://postgres:postgres@localhost:5433/caddiebook';
process.env.JWT_SECRET ||= 'test-secret';
process.env.APPLE_BUNDLE_ID ||= 'com.caddiebook.app';
process.env.DEV_AUTH ||= '1';
// A fixed admin id so the moderation test can create a user with this id and
// exercise the /admin endpoints.
process.env.ADMIN_USER_IDS ||= '00000000-0000-0000-0000-0000000000ad';
