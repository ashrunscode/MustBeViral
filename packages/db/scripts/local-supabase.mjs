import { execFileSync } from 'node:child_process';

export const LOCAL_SUPABASE_CONTAINER = 'supabase_db_mustbeviral';

/** Resolve only this repository's running local container, never global/cloud credentials. */
export function localSupabaseDatabase() {
  const containers = JSON.parse(
    execFileSync('docker', ['inspect', LOCAL_SUPABASE_CONTAINER], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );
  const container = containers[0];
  if (
    container?.Name !== `/${LOCAL_SUPABASE_CONTAINER}` ||
    !container.State?.Running ||
    !container.Mounts?.some(
      (mount) => mount.Type === 'volume' && mount.Name === 'supabase_db_mustbeviral',
    ) ||
    !container.NetworkSettings?.Ports?.['5432/tcp']?.some((port) => port.HostPort === '54322')
  ) {
    throw new Error('The verified MustBeViral local database is not running on port 54322.');
  }
  const value = container.Config.Env.find((entry) => entry.startsWith('POSTGRES_PASSWORD='));
  if (value === undefined || value.length <= 'POSTGRES_PASSWORD='.length)
    throw new Error('Local database credential is unavailable.');
  return {
    host: '127.0.0.1',
    port: 54322,
    username: 'postgres',
    database: 'postgres',
    password: value.slice('POSTGRES_PASSWORD='.length),
  };
}
