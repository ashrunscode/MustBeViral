import {
  createDeterministicExport,
  exportArtifactObjectKey,
  sha256Hex,
  type ArtifactLineageRelationship,
} from '../../../../packages/artifacts/src/index';
import { usdMicrosToSafeInteger } from '../../../../packages/billing/src/index';
import type { P0HandlerResult } from '../../../../packages/contracts/src/rest';

import type { CoreBindings } from '../bindings';
import { PrivilegedArtifactMachinePort } from './artifact-machine';
import { putPrivateCanonicalBytes, readVerifiedPrivateArtifact } from './artifact-storage';

export async function createPrivateRunExport(
  bindings: CoreBindings,
  input: Readonly<{
    runId: string;
    artifactIds: readonly string[];
    format: 'json' | 'zip';
  }>,
  fetchImplementation?: typeof fetch,
): Promise<P0HandlerResult & Readonly<Record<string, unknown>>> {
  const machine = new PrivilegedArtifactMachinePort(bindings, fetchImplementation);
  const context = await machine.getExportContext(input.runId, input.artifactIds);
  const members = await Promise.all(
    context.artifacts.map(async (artifact) => {
      const bytes = await readVerifiedPrivateArtifact(bindings.MEDIA_BUCKET, {
        objectKey: artifact.objectKey,
        contentHash: artifact.contentHash,
      });
      if (bytes.byteLength !== artifact.byteSize) {
        throw new RangeError('Private R2 export member size does not match artifact metadata');
      }
      return {
        artifactId: artifact.id,
        artifactKind: artifact.artifactKind,
        contentHash: artifact.contentHash,
        mimeType: artifact.mimeType,
        bytes,
      };
    }),
  );
  const output = createDeterministicExport({
    format: input.format,
    members,
    receipt: {
      runId: context.runId,
      canvasRevisionId: context.canvasRevisionId,
      canvasRevisionHash: context.canvasRevisionHash,
      quoteId: context.quoteId,
      runStatus: context.runStatus,
      reservation: {
        amountMicros: usdMicrosToSafeInteger(context.reservation.amountMicros),
        capturedMicros: usdMicrosToSafeInteger(context.reservation.capturedMicros),
        releasedMicros: usdMicrosToSafeInteger(context.reservation.releasedMicros),
      },
      providerJobs: context.providerJobs,
      lineage: context.lineage,
    },
  });
  const objectKey = await exportArtifactObjectKey({
    workspaceId: context.workspaceId,
    runId: context.runId,
    format: output.fileExtension,
    bytes: output.bytes,
  });
  const contentHash = await sha256Hex(output.bytes);
  await putPrivateCanonicalBytes(bindings.MEDIA_BUCKET, {
    objectKey,
    bytes: output.bytes,
    mimeType: output.mimeType,
    workspaceId: context.workspaceId,
    runId: context.runId,
  });
  const registration = await machine.registerArtifact({
    runId: context.runId,
    runNodeId: null,
    artifactKind: 'export',
    status: 'available',
    objectKey,
    contentHash,
    mimeType: output.mimeType,
    byteSize: output.bytes.byteLength,
    parentArtifactIds: context.artifacts.map((artifact) => artifact.id),
    relationship: 'export_member' satisfies ArtifactLineageRelationship,
  });
  return {
    status: 'ok',
    artifact: {
      artifact_id: registration.artifact.id,
      project_id: registration.artifact.projectId,
      run_id: registration.artifact.runId,
      canvas_revision_id: registration.artifact.canvasRevisionId,
      artifact_kind: registration.artifact.artifactKind,
      status: registration.artifact.status,
      object_key: registration.artifact.objectKey,
      content_hash: registration.artifact.contentHash,
      mime_type: registration.artifact.mimeType,
      byte_size: registration.artifact.byteSize,
    },
    replayed: registration.replayed,
  };
}
