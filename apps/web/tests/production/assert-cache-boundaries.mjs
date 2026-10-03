import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const directory = path.resolve(process.cwd(), process.env.MBV_PLAYWRIGHT_DIST_DIR ?? '.next');
const manifest = JSON.parse(readFileSync(path.join(directory, 'prerender-manifest.json'), 'utf8'));
assert.equal(manifest.version, 4, 'The production prerender manifest must use the verified format');
assert.ok(
  manifest.routes && typeof manifest.routes === 'object',
  'Prerendered routes must be present',
);

const marketing = [
  '/',
  '/es',
  '/pricing',
  '/software',
  '/software/pricing',
  '/privacy',
  '/terms',
  '/advertising',
];
for (const route of marketing) {
  assert.ok(
    Object.hasOwn(manifest.routes, route),
    `Marketing document ${route} must be prerendered`,
  );
  assert.notEqual(
    manifest.routes[route].initialRevalidateSeconds,
    0,
    `Marketing document ${route} must be static`,
  );
}
const privatePrerenders = Object.keys(manifest.routes).filter(
  (route) => route === '/studio' || route.startsWith('/studio/'),
);
assert.deepEqual(
  privatePrerenders,
  [],
  'Studio requests, including missing-configuration recovery, must never be prerendered',
);
console.log(
  'Cache boundaries passed: eight static marketing documents; no prerendered Studio route.',
);
