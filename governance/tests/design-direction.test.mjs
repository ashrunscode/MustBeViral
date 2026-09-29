import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';

import YAML from 'yaml';

const sourceRoot = process.cwd();
const validatorScript = path.join(
  sourceRoot,
  'governance',
  'scripts',
  'validate-design-direction.mjs',
);
const fixtureRoot = path.join(sourceRoot, 'governance', 'tests', 'design-direction', 'fixtures');
const validFixturePath = path.join(fixtureRoot, 'valid.yaml');
const validEvidence = YAML.parse(readFileSync(validFixturePath, 'utf8'));
const validHighFidelityFixturePath = path.join(fixtureRoot, 'valid-high-fidelity.yaml');
const validHighFidelityEvidence = YAML.parse(readFileSync(validHighFidelityFixturePath, 'utf8'));

function runValidator(evidencePath) {
  return spawnSync(process.execPath, [validatorScript, '--file', evidencePath], {
    cwd: sourceRoot,
    encoding: 'utf8',
  });
}

function runDefaultValidator(options = {}) {
  return spawnSync(process.execPath, [validatorScript], {
    cwd: sourceRoot,
    encoding: 'utf8',
    ...options,
  });
}

function output(result) {
  return `${result.stdout}\n${result.stderr}`;
}

function mutatedFixture(t, mutate, sourceEvidence = validEvidence) {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-design-direction-'));
  const evidence = JSON.parse(JSON.stringify(sourceEvidence));
  mutate(evidence);
  const evidencePath = path.join(root, 'design-direction.yaml');
  writeFileSync(evidencePath, YAML.stringify(evidence, { lineWidth: 100 }), 'utf8');
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });
  return evidencePath;
}

test('valid design-direction evidence passes', () => {
  const result = runValidator(validFixturePath);

  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Design-direction evidence valid:/);
});

test('default validation checks every packet design-direction evidence file', () => {
  const result = runDefaultValidator();

  assert.equal(result.status, 0, output(result));
  assert.match(
    result.stdout,
    /Design-direction evidence valid: governance\/evidence\/WP-D0-001\/design-direction\.yaml/,
  );
  assert.match(
    result.stdout,
    /Design-direction evidence valid: governance\/evidence\/WP-D0-002\/design-direction\.yaml/,
  );
});

test('default validation fails closed when no packet evidence files exist', (t) => {
  const root = mkdtempSync(path.join(tmpdir(), 'mustbeviral-design-direction-empty-'));
  t.after(() => {
    const resolved = path.resolve(root);
    assert.ok(resolved.startsWith(path.resolve(tmpdir())));
    rmSync(resolved, { recursive: true, force: true });
  });

  const result = runDefaultValidator({
    env: {
      ...process.env,
      MUSTBEVIRAL_TEST_REPO_ROOT: root,
      NODE_ENV: 'test',
    },
  });

  assert.notEqual(result.status, 0, output(result));
  assert.match(
    result.stderr,
    /no evidence files found: governance\/evidence\/WP-\*\/design-direction\.yaml/,
  );
});

test('missing evidence file fails closed', () => {
  const result = runValidator(path.join(fixtureRoot, 'missing.yaml'));

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /evidence file missing:/);
});

test('two branches fail schema validation', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.branches.pop();
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /must NOT have fewer than 3 items/);
});

test('duplicate branch focus fails semantic validation', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.branches[1].focus = evidence.branches[0].focus;
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /branch focus calm-density must appear exactly once/);
  assert.match(result.stderr, /branch focus canvas-legibility must appear exactly once/);
});

test('duplicate branch names fail semantic validation', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.branches[1].name = evidence.branches[0].name;
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /branch name must be unique: Calm Density/);
});

test('divergent shared content fails semantic validation', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.branches[2].shared_content_id = 'different-content';
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /shared_content_id must match initial_draft/);
});

test('review must include every required dimension exactly once', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.review.findings[0].dimension = 'density';
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /must contain at least 1 and no more than 1 valid item/);
});

test('approval cannot be absent or defaulted by a tool', async (t) => {
  await t.test('absent approval fails', (subtest) => {
    const result = runValidator(
      mutatedFixture(subtest, (evidence) => {
        delete evidence.approval;
      }),
    );

    assert.notEqual(result.status, 0, output(result));
    assert.match(result.stderr, /must have required property 'approval'/);
  });

  await t.test('tool-defaulted approval fails', (subtest) => {
    const result = runValidator(
      mutatedFixture(subtest, (evidence) => {
        evidence.approval.selection_source = 'tool_default';
      }),
    );

    assert.notEqual(result.status, 0, output(result));
    assert.match(result.stderr, /selection_source must be equal to constant/);
  });
});

test('user-selected approval must name an evidence branch', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.approval.selected_branch = 'Nonexistent Branch';
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /selected_branch does not name an evidence branch/);
});

test('user-selected approval requires every desktop capture file', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.branches[1].desktop_capture =
        'governance/tests/design-direction/fixtures/files/missing-desktop.fixture';
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /desktop_capture does not exist:.*missing-desktop\.fixture/);
});

test('user-selected approval requires every repository artifact file', (t) => {
  const result = runValidator(
    mutatedFixture(t, (evidence) => {
      evidence.initial_draft.rendered_artifact =
        'governance/tests/design-direction/fixtures/files/missing-render.fixture';
    }),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /rendered_artifact does not exist:.*missing-render\.fixture/);
});

test('valid pending high-fidelity evidence passes', () => {
  const result = runValidator(validHighFidelityFixturePath);

  assert.equal(result.status, 0, output(result));
  assert.match(result.stdout, /Design-direction evidence valid:/);
});

test('high-fidelity evidence with a missing flow fails', (t) => {
  const result = runValidator(
    mutatedFixture(
      t,
      (evidence) => {
        evidence.flows.pop();
      },
      validHighFidelityEvidence,
    ),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /flow mobile-review must appear exactly once \(found 0\)/);
});

test('high-fidelity evidence with a duplicate flow fails', (t) => {
  const result = runValidator(
    mutatedFixture(
      t,
      (evidence) => {
        evidence.flows[1].name = evidence.flows[0].name;
      },
      validHighFidelityEvidence,
    ),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /flow name must be unique: canvas-desktop/);
  assert.match(result.stderr, /flow campaign-brief must appear exactly once \(found 0\)/);
});

test('high-fidelity evidence with a nonexistent artifact path fails', (t) => {
  const result = runValidator(
    mutatedFixture(
      t,
      (evidence) => {
        evidence.flows[0].artifact = '.superdesign/hifi/missing.html';
      },
      validHighFidelityEvidence,
    ),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(
    result.stderr,
    /flow canvas-desktop artifact does not exist: \.superdesign\/hifi\/missing\.html/,
  );
});

test('high-fidelity evidence with a missing watch-item resolution fails', (t) => {
  const result = runValidator(
    mutatedFixture(
      t,
      (evidence) => {
        evidence.watch_item_resolutions.pop();
      },
      validHighFidelityEvidence,
    ),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(
    result.stderr,
    /watch item quiet retry styling must have exactly one resolution \(found 0\)/,
  );
});

test('user-selected high-fidelity approval without approved_set fails', (t) => {
  const result = runValidator(
    mutatedFixture(
      t,
      (evidence) => {
        evidence.approval = {
          state: 'user_selected',
          selected_by: 'fixture-user',
          selected_at: '2026-07-19T12:00:00Z',
          selection_source: 'explicit_user_statement',
        };
      },
      validHighFidelityEvidence,
    ),
  );

  assert.notEqual(result.status, 0, output(result));
  assert.match(result.stderr, /approval approved_set must equal high-fidelity-golden-set/);
});
