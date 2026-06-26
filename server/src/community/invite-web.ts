import { eq } from 'drizzle-orm';
import { Hono } from 'hono';

import { db } from '../db/client';
import { users } from '../db/schema';
import { env } from '../env';
import { INVITE_ICON_DATA_URI } from './invite-icon';

// Public, unauthenticated routes that make the HTTPS invite link work:
//  - the universal-link association files (so an installed app intercepts /i/*)
//  - a branded fallback landing page (shown when the app is NOT installed)
// Mounted at the app root in app.ts.
export const inviteWebRoutes = new Hono();

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Apple App Site Association — verifies the domain claim for iOS universal links.
// Served with no file extension and a JSON content-type. Advertises the app only
// when APPLE_APP_ID is configured; otherwise the file is valid but app-less.
inviteWebRoutes.get('/.well-known/apple-app-site-association', (c) => {
  const details = env.appleAppId ? [{ appID: env.appleAppId, paths: ['/i/*'] }] : [];
  c.header('Content-Type', 'application/json');
  return c.body(JSON.stringify({ applinks: { apps: [], details } }));
});

// Android Digital Asset Links — verifies the domain claim for Android app links.
inviteWebRoutes.get('/.well-known/assetlinks.json', (c) => {
  const statements = env.androidSha256
    ? [
        {
          relation: ['delegate_permission/common.handle_all_urls'],
          target: {
            namespace: 'android_app',
            package_name: 'com.caddiebook.app',
            sha256_cert_fingerprints: [env.androidSha256],
          },
        },
      ]
    : [];
  c.header('Content-Type', 'application/json');
  return c.body(JSON.stringify(statements));
});

// Fallback landing page. Installed apps intercept /i/* before this is hit; this
// only renders in a browser when the app isn't installed, pointing to the stores.
inviteWebRoutes.get('/i/:code', async (c) => {
  const code = c.req.param('code');
  const owner = (
    await db
      .select({ username: users.username, firstName: users.firstName })
      .from(users)
      .where(eq(users.inviteCode, code))
      .limit(1)
  )[0];

  const name = owner?.firstName || (owner?.username ? `@${owner.username}` : null);
  const heading = name ? `Connect with ${escapeHtml(name)} on Caddie Book` : 'Join me on Caddie Book';
  // The smart banner deep-links straight back to /i/<code> after install on iOS.
  const smartBanner = env.appStoreId
    ? `<meta name="apple-itunes-app" content="app-id=${escapeHtml(env.appStoreId)}, app-argument=${escapeHtml(
        `${env.publicBaseUrl}/i/${code}`,
      )}">`
    : '';

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Caddie Book — invite</title>
${smartBanner}
<style>
  :root { color-scheme: light; }
  body { margin:0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:#FAF9F5; color:#1A1A1A; display:flex; min-height:100vh; align-items:center; justify-content:center; padding:24px; }
  .card { max-width:380px; width:100%; text-align:center; }
  .icon { width:72px; height:72px; border-radius:16px; margin:0 auto 18px;
    display:block; box-shadow:0 1px 3px rgba(0,0,0,.12); }
  h1 { font-size:24px; line-height:1.25; margin:0 0 12px; }
  p { color:#5A5346; margin:0 0 28px; }
  .btns { display:flex; flex-direction:column; gap:12px; }
  a.btn { display:block; padding:14px 18px; border-radius:12px; text-decoration:none; font-weight:600;
    background:#00563B; color:#FAF9F5; }
  .mark { font-size:13px; letter-spacing:.12em; text-transform:uppercase; color:#8C8676; margin-bottom:12px; }
</style>
</head>
<body>
  <div class="card">
    <img class="icon" src="${INVITE_ICON_DATA_URI}" alt="Caddie Book" width="72" height="72">
    <div class="mark">Caddie Book</div>
    <h1>${heading}</h1>
    <p>Open this invite in the Caddie Book app to connect. Don't have it yet? Install it, then tap your invite link again.</p>
    <div class="btns">
      <a class="btn" href="${escapeHtml(env.appStoreUrl)}">Download on the App Store</a>
    </div>
  </div>
</body>
</html>`;
  return c.html(html);
});
