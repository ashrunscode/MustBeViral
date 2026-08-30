import { describe, expect, it, vi } from 'vitest';

import { PrivilegedArtifactMachinePort } from '../../src/composition/artifact-machine';

describe('export member descriptors', () => {
  it('maps an approved artifact to its immutable launch-pack node without widening the export RPC', async () => {
    const fetchImplementation = vi.fn(async (request: string | URL | Request) => {
      const url = String(request);
      if (url.includes('/rest/v1/artifacts?')) {
        return Response.json([
          {
            id: 'artifact-copy',
            artifact_kind: 'approved_output',
            status: 'available',
            run_id: 'run-1',
            run_node_id: 'run-node-copy',
            accessibility_description: 'Approved copy for concept one.',
          },
        ]);
      }
      if (url.includes('/rest/v1/run_nodes?')) {
        return Response.json([
          {
            id: 'run-node-copy',
            run_id: 'run-1',
            node_key: 'copy-1',
            workspace_id: 'workspace-1',
          },
        ]);
      }
      return Response.json({ message: 'unexpected fixture request' }, { status: 500 });
    });
    const machine = new PrivilegedArtifactMachinePort(
      {
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      fetchImplementation as unknown as typeof fetch,
    );

    await expect(
      machine.getExportMemberDescriptors('workspace-1', 'run-1', ['artifact-copy']),
    ).resolves.toEqual([
      {
        artifactId: 'artifact-copy',
        runNodeId: 'run-node-copy',
        nodeKey: 'copy-1',
        accessibilityDescription: 'Approved copy for concept one.',
      },
    ]);
    expect(fetchImplementation).toHaveBeenCalledTimes(2);
  });

  it('fails closed when an approved artifact has no durable run-node descriptor', async () => {
    const fetchImplementation = vi.fn(async (request: string | URL | Request) =>
      Response.json(
        String(request).includes('/rest/v1/artifacts?')
          ? [
              {
                id: 'artifact-copy',
                artifact_kind: 'approved_output',
                status: 'available',
                run_id: 'run-1',
                run_node_id: 'missing-node',
                accessibility_description: 'Approved copy for concept one.',
              },
            ]
          : [],
      ),
    );
    const machine = new PrivilegedArtifactMachinePort(
      {
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      fetchImplementation as unknown as typeof fetch,
    );

    await expect(
      machine.getExportMemberDescriptors('workspace-1', 'run-1', ['artifact-copy']),
    ).rejects.toThrow('no run-node descriptor');
  });
});
