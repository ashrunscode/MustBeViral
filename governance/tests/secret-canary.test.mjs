import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const sourceRoot = process.cwd();
const scannerScript = path.join(sourceRoot, 'governance', 'scripts', 'scan-cleanroom.mjs');
const policyPath = path.join(sourceRoot, 'governance', 'legacy-fingerprints.yaml');

function fixture(t, content) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-secret-canary-'));
  cpSync(policyPath, path.join(root, 'governance', 'legacy-fingerprints.yaml'), {
    recursive: true,
  });
  writeFileSync(path.join(root, 'canary.txt'), `${content}\n`, 'utf8');
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return root;
}

function runScanner(root = sourceRoot) {
  return spawnSync(process.execPath, [scannerScript], {
    cwd: sourceRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      ...(root === sourceRoot ? {} : { NODE_ENV: 'test', MUSTBEVIRAL_TEST_REPO_ROOT: root }),
    },
  });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function encodeJwtPart(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function serviceRoleCanary(padding) {
  return [
    encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
    encodeJwtPart({ padding, role: 'service_role' }),
    'FAKE_SIGNATURE',
  ].join('.');
}

const authenticatedJwtNearMiss = [
  encodeJwtPart({ alg: 'HS256', typ: 'JWT' }),
  encodeJwtPart({ marker: 'FAKE_CANARY', role: 'authenticated' }),
  'FAKE_SIGNATURE',
].join('.');

const patternFamilies = [
  {
    id: 'aws-access-key',
    positive: 'AKIAFAKE000000000000',
    nearMiss: 'AKIA_FAKE_DOCUMENTATION_ONLY',
  },
  {
    id: 'stripe-live-secret',
    positive: 'sk_live_FAKECANARY000000000000',
    nearMiss: 'Stripe live keys begin with sk_live_ but no value is present.',
  },
  {
    id: 'stripe-test-secret',
    positive: 'sk_test_FAKECANARY000000000000',
    nearMiss: 'Stripe test keys begin with sk_test_ but no value is present.',
  },
  {
    id: 'stripe-live-restricted',
    positive: 'rk_live_FAKECANARY000000000000',
    nearMiss: 'Stripe restricted keys begin with rk_live_ but no value is present.',
  },
  {
    id: 'stripe-webhook-secret',
    positive: 'whsec_FAKECANARY000000000000',
    nearMiss: 'Stripe webhook secrets begin with whsec_ but no value is present.',
  },
  {
    id: 'github-token',
    positive: 'ghp_FAKECANARY0000000000000000',
    nearMiss: 'GitHub classic tokens begin with ghp_ but no value is present.',
  },
  {
    id: 'generic-private-key',
    positive: 'FAKE CANARY ONLY\n-----BEGIN PRIVATE KEY-----',
    nearMiss: '-----BEGIN PUBLIC KEY-----',
  },
  {
    id: 'fal-uuid-key',
    positive:
      'FAKE CANARY: 00000000-0000-4000-8000-00000000fade:11111111-1111-4111-8111-11111111fade',
    nearMiss: 'FAKE CANARY: 00000000-0000-4000-8000-00000000fade',
  },
  {
    id: 'fal-prefixed-key',
    positive: 'fal_FAKE_CANARY_000000000000',
    nearMiss: 'The fal_ prefix is documented without a key value.',
  },
  {
    id: 'fal-prefixed-key',
    positive: 'key_FAKE_CANARY_00000000000-',
    nearMiss: 'The key_ prefix is documented without a key value.',
  },
  {
    id: 'resend-api-key',
    positive: 're_FAKE_CANARY_00000000000-',
    nearMiss: 'Resend keys begin with re_ but no value is present.',
  },
  {
    id: 'supabase-service-key',
    positive: 'SUPABASE_SERVICE_ROLE_KEY=FAKE_CANARY_VALUE_0000',
    nearMiss: 'SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}',
  },
  {
    id: 'supabase-secret-key',
    positive: 'sb_secret_FAKE_CANARY_00000000000-',
    nearMiss: 'Supabase secret keys begin with sb_secret_ but no value is present.',
  },
  {
    id: 'supabase-service-role-jwt',
    positive: serviceRoleCanary('FAKE_CANARY'),
    nearMiss: authenticatedJwtNearMiss,
  },
  {
    id: 'supabase-service-role-jwt',
    positive: serviceRoleCanary('FAKE_CANARYX'),
    nearMiss: authenticatedJwtNearMiss,
  },
  {
    id: 'supabase-service-role-jwt',
    positive: serviceRoleCanary('FAKE_CANARYXX'),
    nearMiss: authenticatedJwtNearMiss,
  },
  {
    id: 'postgres-connection-credentials',
    positive: 'postgresql://fake_user:FAKE_PASSWORD_123@db.invalid/example',
    nearMiss: 'postgres://postgres:postgres@127.0.0.1:54322/postgres',
  },
  {
    id: 'postgres-connection-credentials',
    positive: 'postgres://fake_user:FAKE_PASSWORD_123@db.invalid/example',
    nearMiss: 'postgres://USER:PASSWORD@127.0.0.1:54322/postgres',
  },
  {
    id: 'postgres-connection-credentials',
    positive: 'postgresql://fake_user:FAKE_PASSWORD_456@db.invalid/example',
    nearMiss: 'postgresql://fake_user:@db.invalid/example',
  },
  {
    id: 'high-entropy-secret-assignment',
    positive: 'FAKE_ROTATION_TOKEN="Ab9Cd8Ef7Gh6Ij5Kl4Mn3Op2Qr1St0Uv9Wx8Yz7Ab6Cd5Ef4"',
    nearMiss: 'FAKE_ROTATION_TOKEN="FAKE_CANARY_NOT_HIGH_ENTROPY"',
  },
  {
    id: 'high-entropy-secret-assignment',
    positive: 'FAKE_HEX_SECRET="deadbeefcafebabefeedface0123456789abcdef01234567"',
    nearMiss: 'Unassigned fixture hash: deadbeefcafebabefeedface0123456789abcdef01234567',
  },
];

test('every configured secret pattern has positive and near-miss canaries', () => {
  const policy = YAML.parse(readFileSync(policyPath, 'utf8'));
  const configuredIds = [...new Set(policy.secret_patterns.map(({ id }) => id))].sort();
  const coveredIds = [...new Set(patternFamilies.map(({ id }) => id))].sort();

  assert.deepEqual(coveredIds, configuredIds);
  for (const family of patternFamilies) {
    assert.ok(family.positive);
    assert.ok(family.nearMiss);
  }
});

for (const [index, family] of patternFamilies.entries()) {
  test(`${family.id} detects its synthetic canary ${index + 1}`, (t) => {
    const result = runScanner(fixture(t, family.positive));

    assert.notEqual(result.status, 0, output(result));
    assert.match(result.stderr, new RegExp(`secret fingerprint ${family.id} in canary\\.txt`));
  });

  test(`${family.id} accepts its near miss ${index + 1}`, (t) => {
    const result = runScanner(fixture(t, family.nearMiss));

    assert.equal(result.status, 0, output(result));
  });
}

test('current repository tree passes the cleanroom scanner', () => {
  const result = runScanner();

  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Cleanroom scan valid:/);
});
