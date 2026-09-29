import { describe, expect, it, vi } from 'vitest';

import { sha256Hex } from '../../../../packages/artifacts/src/index';
import { createPrivateRunExport } from '../../src/composition/export';

function png(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0);
  bytes.set([0, 0, 0, 13, 73, 72, 68, 82], 8);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
}

function mp4(durationMilliseconds: number): Uint8Array {
  const bytes = new Uint8Array(36);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, 36);
  bytes.set([109, 111, 111, 118], 4); // moov
  view.setUint32(8, 28);
  bytes.set([109, 118, 104, 100], 12); // mvhd, version 0
  view.setUint32(28, 1_000);
  view.setUint32(32, durationMilliseconds);
  return bytes;
}

interface LaunchPackArtifactFixture {
  readonly id: string;
  readonly nodeKey: string;
  readonly runNodeId: string;
  readonly objectKey: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
  readonly contentHash: string;
}

async function launchPackArtifacts(): Promise<readonly LaunchPackArtifactFixture[]> {
  const inputs: Readonly<
    Omit<LaunchPackArtifactFixture, 'runNodeId' | 'objectKey' | 'contentHash'>
  >[] = [];
  for (const concept of [1, 2, 3] as const) {
    inputs.push(
      {
        id: `artifact-copy-${String(concept)}`,
        nodeKey: `copy-${String(concept)}`,
        mimeType: 'application/json',
        bytes: new TextEncoder().encode(
          JSON.stringify({
            primary_text: `Meet launch concept ${String(concept)}.`,
            headline: `A clear launch headline ${String(concept)}`,
            description: `A concise description ${String(concept)}.`,
          }),
        ),
      },
      {
        id: `artifact-master-${String(concept)}`,
        nodeKey: `master-${String(concept)}`,
        mimeType: 'image/png',
        bytes: png(1080, 1350),
      },
      {
        id: `artifact-feed-${String(concept)}`,
        nodeKey: `adaptation-${String(concept)}-1`,
        mimeType: 'image/png',
        bytes: png(1080, 1350),
      },
      {
        id: `artifact-square-${String(concept)}`,
        nodeKey: `adaptation-${String(concept)}-2`,
        mimeType: 'image/png',
        bytes: png(1080, 1080),
      },
      {
        id: `artifact-stories-${String(concept)}`,
        nodeKey: `adaptation-${String(concept)}-3`,
        mimeType: 'image/png',
        bytes: png(1080, 1920),
      },
    );
  }
  inputs.push({
    id: 'artifact-motion-1',
    nodeKey: 'motion-1',
    mimeType: 'video/mp4',
    bytes: mp4(8_000),
  });
  return await Promise.all(
    inputs.map(async (input) => ({
      ...input,
      runNodeId: `run-node-${input.nodeKey}`,
      objectKey: `workspaces/workspace-1/runs/run-1/${input.nodeKey}`,
      contentHash: await sha256Hex(input.bytes),
    })),
  );
}

describe('private launch-pack export composition', () => {
  it('carries immutable run-node semantics into a checksummed buyer ZIP', async () => {
    const members = await launchPackArtifacts();
    const membersByObjectKey = new Map(members.map((member) => [member.objectKey, member]));
    let storedExportBytes: Uint8Array | undefined;
    const put = vi.fn(async (key: string, body: ReadableStream, options: unknown) => {
      void key;
      storedExportBytes = new Uint8Array(await new Response(body).arrayBuffer());
      const supplied = (options as Readonly<{ sha256?: Uint8Array }>).sha256;
      const checksum = supplied?.buffer.slice(
        supplied.byteOffset,
        supplied.byteOffset + supplied.byteLength,
      );
      return {
        size: storedExportBytes.byteLength,
        checksums: { sha256: checksum },
      };
    });
    const get = vi.fn(async (key: string, options?: R2GetOptions) => {
      const member = membersByObjectKey.get(key);
      if (member === undefined) return null;
      const etag = `etag-${member.id}`;
      if (options?.onlyIf !== undefined && !(options.onlyIf instanceof Headers)) {
        if (options.onlyIf.etagMatches !== etag) return { size: member.bytes.byteLength, etag };
      }
      return {
        size: member.bytes.byteLength,
        etag,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(member.bytes);
            controller.close();
          },
        }),
        arrayBuffer: async () => member.bytes.slice().buffer,
      };
    });
    const fetchImplementation = vi.fn(
      async (request: string | URL | Request, init?: RequestInit) => {
        const url = String(request);
        if (url.endsWith('/rest/v1/rpc/get_export_context')) {
          return Response.json({
            workspace_id: 'workspace-1',
            project_id: 'project-1',
            run_id: 'run-1',
            canvas_revision_id: 'revision-1',
            canvas_revision_hash: 'a'.repeat(64),
            quote_id: 'quote-1',
            run_status: 'succeeded',
            reservation: {
              amount_micros: 4_550_000,
              captured_micros: 4_550_000,
              released_micros: 0,
            },
            artifacts: members.map((member) => ({
              id: member.id,
              artifact_kind: 'approved_output',
              object_key: member.objectKey,
              content_hash: member.contentHash,
              mime_type: member.mimeType,
              byte_size: member.bytes.byteLength,
            })),
            lineage: [],
            provider_jobs: [
              {
                attempt_id: 'attempt-pack',
                provider: 'fal',
                provider_model_id: 'fal-ai/flux-pro/kontext',
                route_id: 'fal/flux-kontext-pro',
                status: 'succeeded',
                capture_micros: 4_550_000,
              },
            ],
          });
        }
        if (url.endsWith('/rest/v1/rpc/register_artifact')) {
          const body = JSON.parse(String(init?.body)) as Readonly<Record<string, unknown>>;
          return Response.json({
            replayed: false,
            artifact: {
              id: 'artifact-export',
              workspace_id: 'workspace-1',
              project_id: 'project-1',
              run_id: 'run-1',
              run_node_id: null,
              canvas_revision_id: 'revision-1',
              artifact_kind: 'export',
              status: 'available',
              object_key: body.p_object_key,
              content_hash: body.p_content_hash,
              mime_type: body.p_mime_type,
              byte_size: body.p_byte_size,
            },
          });
        }
        return Response.json({ message: 'unexpected fixture request' }, { status: 500 });
      },
    );

    const result = await createPrivateRunExport(
      {
        SUPABASE_URL: 'https://staging.example.test',
        SUPABASE_SECRET_KEY: 'service-role-key',
        MEDIA_BUCKET: { get, put },
      } as never,
      { runId: 'run-1', artifactIds: members.map((member) => member.id), format: 'zip' },
      {
        reservation: {
          id: 'reservation-1',
          workspace_id: 'workspace-1',
          run_id: 'run-1',
          amount_micros: 4_550_000,
          captured_micros: 4_550_000,
          released_micros: 0,
          refunded_micros: 125_000,
          status: 'refunded',
        } as never,
        artifacts: members.map((member) => ({
          id: member.id,
          workspace_id: 'workspace-1',
          artifact_kind: 'approved_output',
          status: 'available',
          run_id: 'run-1',
          run_node_id: member.runNodeId,
          accessibility_description: `Approved buyer description for ${member.nodeKey}.`,
        })) as never,
        runNodes: members.map((member) => ({
          id: member.runNodeId,
          run_id: 'run-1',
          node_key: member.nodeKey,
          workspace_id: 'workspace-1',
        })) as never,
      },
      fetchImplementation as unknown as typeof fetch,
    );

    expect(result).toMatchObject({
      status: 'ok',
      artifact: {
        artifact_id: 'artifact-export',
        artifact_kind: 'export',
        mime_type: 'application/zip',
      },
    });
    expect(put).toHaveBeenCalledOnce();
    const putCall = put.mock.calls[0];
    if (putCall === undefined) throw new TypeError('Expected one R2 export PUT');
    expect(putCall[1]).toBeInstanceOf(ReadableStream);
    const exportBytes = storedExportBytes;
    if (exportBytes === undefined) throw new TypeError('Expected streamed R2 export bytes');
    const options = putCall[2] as Readonly<{ sha256?: Uint8Array }>;
    expect(exportBytes.subarray(0, 2)).toEqual(Uint8Array.of(0x50, 0x4b));
    const exportText = new TextDecoder().decode(exportBytes);
    expect(exportText).toContain('assets/concept-01/feed-4x5.png');
    expect(exportText).toContain('copy/concept-03.json');
    expect(exportText).toContain('"amount_micros":"4550000"');
    expect(exportText).toContain('"captured_micros":"4550000"');
    expect(exportText).toContain('"released_micros":"0"');
    expect(exportText).toContain('"refunded_micros":"125000"');
    expect(exportText).toContain('"net_micros":"4425000"');
    expect(exportText).toContain('"settlement_status":"refunded"');
    expect(
      fetchImplementation.mock.calls.some(([request]) =>
        ['/rest/v1/cost_reservations?', '/rest/v1/artifacts?', '/rest/v1/run_nodes?'].some((path) =>
          String(request).includes(path),
        ),
      ),
    ).toBe(false);
    expect(exportText).toContain('assets/concept-01/reels-motion-9x16.mp4');
    expect(exportText).toContain('captured_micros');
    expect(exportText).not.toContain('"capture_micros"');
    const exportHash = await sha256Hex(exportBytes);
    expect(Buffer.from(options.sha256 ?? new Uint8Array()).toString('hex')).toBe(exportHash);
    expect(result.artifact).toMatchObject({ content_hash: exportHash });
    expect(get.mock.calls.filter(([, options]) => options?.onlyIf !== undefined)).toHaveLength(26);
    expect(
      get.mock.calls
        .filter(([, options]) => options?.onlyIf !== undefined)
        .every(([, options]) => {
          const onlyIf = options?.onlyIf;
          return (
            onlyIf !== undefined && !(onlyIf instanceof Headers) && onlyIf.etagMatches !== undefined
          );
        }),
    ).toBe(true);
  });
});
