import { describe, expect, it, vi } from 'vitest';

import { PrivilegedArtifactMachinePort } from '../../src/composition/artifact-machine';

describe('export member descriptors', () => {
  it('maps an approved artifact to its immutable launch-pack node without widening the export RPC', async () => {
    const fetchImplementation = vi.fn(() => {
      throw new Error('Descriptor composition must not make a privileged table request');
    });
    const machine = new PrivilegedArtifactMachinePort(
      {
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      fetchImplementation as unknown as typeof fetch,
    );

    await expect(
      machine.getExportMemberDescriptors(
        'workspace-1',
        'run-1',
        ['artifact-copy'],
        [
          {
            id: 'artifact-copy',
            workspace_id: 'workspace-1',
            artifact_kind: 'approved_output',
            status: 'available',
            run_id: 'run-1',
            run_node_id: 'run-node-copy',
            accessibility_description: 'Approved copy for concept one.',
          },
        ] as never,
        [
          {
            id: 'run-node-copy',
            run_id: 'run-1',
            node_key: 'copy-1',
            workspace_id: 'workspace-1',
          },
        ] as never,
      ),
    ).resolves.toEqual([
      {
        artifactId: 'artifact-copy',
        runNodeId: 'run-node-copy',
        nodeKey: 'copy-1',
        accessibilityDescription: 'Approved copy for concept one.',
      },
    ]);
    expect(fetchImplementation).not.toHaveBeenCalled();
  });

  it('fails closed when an approved artifact has no durable run-node descriptor', async () => {
    const fetchImplementation = vi.fn(() => {
      throw new Error('Descriptor composition must not make a privileged table request');
    });
    const machine = new PrivilegedArtifactMachinePort(
      {
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
      } as never,
      fetchImplementation as unknown as typeof fetch,
    );

    await expect(
      machine.getExportMemberDescriptors(
        'workspace-1',
        'run-1',
        ['artifact-copy'],
        [
          {
            id: 'artifact-copy',
            workspace_id: 'workspace-1',
            artifact_kind: 'approved_output',
            status: 'available',
            run_id: 'run-1',
            run_node_id: 'missing-node',
            accessibility_description: 'Approved copy for concept one.',
          },
        ] as never,
        [] as never,
      ),
    ).rejects.toThrow('no run-node descriptor');
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
