import {
  createDeterministicExportPlan,
  exportArtifactObjectKeyFromHash,
  measureProviderArtifactBytes,
  streamDeterministicExport,
  type ArtifactLineageRelationship,
  type DeterministicExportMemberDescriptor,
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
import {
  ArtifactStorageError,
  openPinnedPrivateArtifactStream,
  putPrivateCanonicalStream,
  readVerifiedPrivateArtifactSnapshot,
  sha256HexOfChunks,
} from './artifact-storage';

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
  const snapshotsByArtifactId = new Map<
    string,
    Readonly<{ objectKey: string; etag: string; byteSize: number }>
  >();
  const members: DeterministicExportMemberDescriptor[] = [];
  // Deliberately sequential: an approved source may be large, while the exact GB-04 set contains
  // sixteen members. Keeping only one source buffer live prevents aggregate source retention.
  for (const artifact of context.artifacts) {
    const descriptor = descriptorsByArtifactId.get(artifact.id);
    if (descriptor === undefined) {
      throw new TypeError('Approved export member has no immutable run-node descriptor');
    }
    const snapshot = await readVerifiedPrivateArtifactSnapshot(bindings.MEDIA_BUCKET, {
      objectKey: artifact.objectKey,
      contentHash: artifact.contentHash,
      byteSize: artifact.byteSize,
    });
    snapshotsByArtifactId.set(artifact.id, {
      objectKey: artifact.objectKey,
      etag: snapshot.etag,
      byteSize: snapshot.byteSize,
    });
    const common = {
      artifactId: artifact.id,
      artifactKind: artifact.artifactKind,
      nodeKey: descriptor.nodeKey,
      contentHash: artifact.contentHash,
      mimeType: artifact.mimeType,
      byteSize: snapshot.byteSize,
      crc32: snapshot.crc32,
      accessibilityDescription: descriptor.accessibilityDescription,
    };
    if (artifact.mimeType === 'application/json') {
      const copy = parseLaunchPackCopy(new TextDecoder().decode(snapshot.bytes));
      if (copy === null) {
        throw new TypeError(`Approved copy artifact ${artifact.id} is not buyer-ready copy`);
      }
      members.push({
        ...common,
        copy: {
          primaryText: copy.primary_text,
          headline: copy.headline,
          description: copy.description,
        },
        copyQaFindings: evaluateLaunchPackCopy(copy),
      });
      continue;
    }
    const verified = measureProviderArtifactBytes(snapshot.bytes, artifact.mimeType);
    if (verified.mimeType !== artifact.mimeType) {
      throw new TypeError('Approved export member verification disagrees with artifact metadata');
    }
    members.push({ ...common, measurement: verified.measurement });
  }
  const plan = await createDeterministicExportPlan({
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
  const openArtifact = async (artifactId: string): Promise<ReadableStream> => {
    const snapshot = snapshotsByArtifactId.get(artifactId);
    if (snapshot === undefined) {
      throw new TypeError('Deterministic export requested an unknown private source');
    }
    return await openPinnedPrivateArtifactStream(bindings.MEDIA_BUCKET, snapshot);
  };
  // R2 needs the expected SHA-256 before PUT. The first pass hashes a lazy archive stream without
  // retaining it; the second byte-identical, ETag-pinned pass is the actual checksummed upload.
  let digest: Readonly<{ contentHash: string; byteSize: number }>;
  try {
    digest = await sha256HexOfChunks(streamDeterministicExport(plan, openArtifact));
  } catch (cause) {
    if (cause instanceof ArtifactStorageError) throw cause;
    throw new ArtifactStorageError(
      'artifact_verification_failed',
      false,
      'Private R2 export source changed during deterministic digest',
      { cause },
    );
  }
  if (digest.byteSize !== plan.byteSize) {
    throw new TypeError('Deterministic export digest length disagrees with its immutable plan');
  }
  const objectKey = exportArtifactObjectKeyFromHash({
    workspaceId: context.workspaceId,
    runId: context.runId,
    format: plan.fileExtension,
    contentHash: digest.contentHash,
  });
  await putPrivateCanonicalStream(bindings.MEDIA_BUCKET, {
    objectKey,
    chunks: streamDeterministicExport(plan, openArtifact),
    byteSize: plan.byteSize,
    mimeType: plan.mimeType,
    workspaceId: context.workspaceId,
    runId: context.runId,
    contentHash: digest.contentHash,
  });
  const registration = await machine.registerArtifact({
    runId: context.runId,
    runNodeId: null,
    artifactKind: 'export',
    status: 'available',
    objectKey,
    contentHash: digest.contentHash,
    mimeType: plan.mimeType,
    byteSize: plan.byteSize,
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
