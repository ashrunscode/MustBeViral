import {
  createDeterministicExport,
  exportArtifactObjectKey,
  sha256Hex,
  verifyProviderArtifactBytes,
  type ArtifactLineageRelationship,
} from '../../../../packages/artifacts/src/index';
import { usdMicrosToSafeInteger } from '../../../../packages/billing/src/index';
import {
  evaluateLaunchPackCopy,
  parseLaunchPackCopy,
} from '../../../../packages/contracts/src/launch-pack-qa';
import type { P0HandlerResult } from '../../../../packages/contracts/src/rest';
import type { DatabaseRow } from '../../../../packages/db/src/index';

import type { CoreBindings } from '../bindings';
import { PrivilegedArtifactMachinePort } from './artifact-machine';
import { putPrivateCanonicalBytes, readVerifiedPrivateArtifact } from './artifact-storage';

export interface CallerScopedExportFacts {
  readonly reservation: Readonly<DatabaseRow<'cost_reservations'>> | null;
  readonly artifacts: readonly Readonly<DatabaseRow<'artifacts'>>[];
  readonly runNodes: readonly Readonly<DatabaseRow<'run_nodes'>>[];
}

export async function createPrivateRunExport(
  bindings: CoreBindings,
  input: Readonly<{
    runId: string;
    artifactIds: readonly string[];
    format: 'json' | 'zip';
  }>,
  callerScopedFacts: CallerScopedExportFacts,
  fetchImplementation?: typeof fetch,
): Promise<P0HandlerResult & Readonly<Record<string, unknown>>> {
  const machine = new PrivilegedArtifactMachinePort(bindings, fetchImplementation);
  const context = await machine.getExportContext(
    input.runId,
    input.artifactIds,
    callerScopedFacts.reservation,
  );
  const descriptors = await machine.getExportMemberDescriptors(
    context.workspaceId,
    context.runId,
    context.artifacts.map((artifact) => artifact.id),
    callerScopedFacts.artifacts,
    callerScopedFacts.runNodes,
  );
  const descriptorsByArtifactId = new Map(
    descriptors.map((descriptor) => [descriptor.artifactId, descriptor]),
  );
  const members = await Promise.all(
    context.artifacts.map(async (artifact) => {
      const descriptor = descriptorsByArtifactId.get(artifact.id);
      if (descriptor === undefined) {
        throw new TypeError('Approved export member has no immutable run-node descriptor');
      }
      const bytes = await readVerifiedPrivateArtifact(bindings.MEDIA_BUCKET, {
        objectKey: artifact.objectKey,
        contentHash: artifact.contentHash,
      });
      if (bytes.byteLength !== artifact.byteSize) {
        throw new RangeError('Private R2 export member size does not match artifact metadata');
      }
      const common = {
        artifactId: artifact.id,
        artifactKind: artifact.artifactKind,
        nodeKey: descriptor.nodeKey,
        contentHash: artifact.contentHash,
        mimeType: artifact.mimeType,
        bytes,
        accessibilityDescription: descriptor.accessibilityDescription,
      };
      if (artifact.mimeType === 'application/json') {
        const copy = parseLaunchPackCopy(new TextDecoder().decode(bytes));
        if (copy === null) {
          throw new TypeError(`Approved copy artifact ${artifact.id} is not buyer-ready copy`);
        }
        return {
          ...common,
          copy: {
            primaryText: copy.primary_text,
            headline: copy.headline,
            description: copy.description,
          },
          copyQaFindings: evaluateLaunchPackCopy(copy),
        };
      }
      const verified = await verifyProviderArtifactBytes(bytes, artifact.mimeType);
      if (
        verified.contentHash !== artifact.contentHash ||
        verified.byteSize !== artifact.byteSize ||
        verified.mimeType !== artifact.mimeType
      ) {
        throw new TypeError('Approved export member verification disagrees with artifact metadata');
      }
      return { ...common, measurement: verified.measurement };
    }),
  );
  const output = await createDeterministicExport({
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
        refundedMicros: usdMicrosToSafeInteger(context.reservation.refundedMicros),
        netMicros: usdMicrosToSafeInteger(context.reservation.netMicros),
        settlementStatus: context.reservation.settlementStatus,
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
    contentHash,
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
