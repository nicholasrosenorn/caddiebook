import { serve } from '@hono/node-server';

import { createApp } from './app';
import { env } from './env';

const app = createApp();

serve({ fetch: app.fetch, port: env.port }, (info) => {
  // eslint-disable-next-line no-console
  console.log(`caddiebook-server listening on :${info.port}`);
});
