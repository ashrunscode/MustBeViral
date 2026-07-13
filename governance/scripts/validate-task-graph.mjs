import { spawnSync } from 'node:child_process';

import { fail, listRepositoryFiles, readJson, repoRoot } from './lib.mjs';

export const workspacePaths = {
  '@mustbeviral/web': 'apps/web',
  '@mustbeviral/core': 'apps/core',
  '@mustbeviral/contracts': 'packages/contracts',
  '@mustbeviral/domain': 'packages/domain',
  '@mustbeviral/graph': 'packages/graph',
  '@mustbeviral/db': 'packages/db',
  '@mustbeviral/providers': 'packages/providers',
  '@mustbeviral/billing': 'packages/billing',
  '@mustbeviral/artifacts': 'packages/artifacts',
  '@mustbeviral/ai': 'packages/ai',
  '@mustbeviral/ui': 'packages/ui',
  '@mustbeviral/config': 'packages/config',
  '@mustbeviral/telemetry': 'packages/telemetry',
};

export const requiredWorkspaceTasks = {
  '@mustbeviral/web': ['lint', 'typecheck', 'test', 'test:integration', 'build'],
  '@mustbeviral/core': ['lint', 'typecheck', 'test', 'test:integration', 'build'],
  '@mustbeviral/contracts': ['lint', 'typecheck', 'test', 'test:integration', 'build'],
  '@mustbeviral/domain': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/graph': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/db': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/providers': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/billing': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/artifacts': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/ai': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/ui': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/config': ['lint', 'typecheck', 'test', 'build'],
  '@mustbeviral/telemetry': ['lint', 'typecheck', 'test', 'build'],
};

export function collectTaskGraphErrors(plan, requirements = requiredWorkspaceTasks) {
  const errors = [];
  const packages = new Set(plan.packages ?? []);
  const taskIds = new Set(
    (plan.tasks ?? []).map((task) => task.taskId ?? `${task.package}#${task.task}`),
  );

  for (const [workspace, tasks] of Object.entries(requirements)) {
    if (!packages.has(workspace)) errors.push(`Turbo omitted required workspace ${workspace}`);
    for (const task of tasks) {
      const taskId = `${workspace}#${task}`;
      if (!taskIds.has(taskId)) errors.push(`Turbo omitted required task ${taskId}`);
    }
  }

  return errors;
}

export function collectWorkspaceScriptErrors(
  requirements = requiredWorkspaceTasks,
  paths = workspacePaths,
) {
  const errors = [];
  const forbiddenNoop = /(?:^|\s)(?:echo|true|exit\s+0)(?:\s|$)|--passWithNoTests/i;
  for (const [workspace, tasks] of Object.entries(requirements)) {
    const workspacePath = paths[workspace];
    if (!workspacePath) {
      errors.push(`No governed path is registered for ${workspace}`);
      continue;
    }
    const manifest = readJson(`${workspacePath}/package.json`);
    for (const task of tasks) {
      const command = manifest.scripts?.[task];
      if (typeof command !== 'string' || !command.trim()) {
        errors.push(`${workspace} has no executable ${task} script`);
      } else if (forbiddenNoop.test(command)) {
        errors.push(`${workspace}#${task} is fail-open: ${command}`);
      }
    }
    if (manifest.scripts?.build === manifest.scripts?.typecheck) {
      errors.push(`${workspace} aliases build to typecheck`);
    }
    if (tasks.includes('test')) {
      const tests = listRepositoryFiles([
        `${workspacePath}/**/*.test.ts`,
        `${workspacePath}/**/*.spec.ts`,
      ]);
      if (!tests.length) errors.push(`${workspace} has a test task but no test file`);
    }
  }
  return errors;
}

export function collectRootTestLaneErrors(manifest) {
  const errors = [];
  for (const task of ['test', 'test:integration']) {
    const command = manifest.scripts?.[task] ?? '';
    const sharedLane = `turbo run ${task}`;
    const excludedCore = '--filter=!@mustbeviral/core';
    const isolatedCore = '--filter=@mustbeviral/core';
    const separator = command.indexOf('&&');
    if (
      !command.startsWith(sharedLane) ||
      !command.includes(excludedCore) ||
      separator < 0 ||
      !command.slice(separator + 2).includes(sharedLane) ||
      !command.slice(separator + 2).includes(isolatedCore) ||
      !command.slice(separator + 2).includes('--concurrency=1')
    ) {
      errors.push(
        `root ${task} must run non-Core work first and isolate @mustbeviral/core at concurrency 1`,
      );
    }
  }
  return errors;
}

export function readTurboPlan() {
  const pnpmEntrypoint = process.env.npm_execpath;
  if (!pnpmEntrypoint) throw new Error('npm_execpath is unavailable; run this check through pnpm');
  const result = spawnSync(
    process.execPath,
    [
      pnpmEntrypoint,
      'exec',
      'turbo',
      'run',
      'lint',
      'typecheck',
      'test',
      'test:integration',
      'build',
      '--dry=json',
    ],
    { cwd: repoRoot, encoding: 'utf8', shell: false },
  );
  if (result.status !== 0) {
    throw new Error(`Turbo dry run failed: ${result.stderr || result.stdout}`.trim());
  }
  return JSON.parse(result.stdout);
}

export function validateTaskGraph() {
  let errors = [];
  try {
    errors = [
      ...collectTaskGraphErrors(readTurboPlan()),
      ...collectWorkspaceScriptErrors(),
      ...collectRootTestLaneErrors(readJson('package.json')),
    ];
  } catch (error) {
    errors = [error instanceof Error ? error.message : String(error)];
  }
  fail(errors, 'Task-graph validation failed');
  if (!errors.length) {
    const taskCount = Object.values(requiredWorkspaceTasks).flat().length;
    console.log(
      `Task graph valid: ${Object.keys(requiredWorkspaceTasks).length} workspaces and ${taskCount} required tasks scheduled.`,
    );
  }
  return errors;
}

if (process.argv[1]?.endsWith('validate-task-graph.mjs')) validateTaskGraph();
