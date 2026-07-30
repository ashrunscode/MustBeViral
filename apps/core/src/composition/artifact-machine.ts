import {
  ARTIFACT_LINEAGE_RELATIONSHIPS,
  type ArtifactLineageRelationship,
} from '../../../../packages/artifacts/src/index';
import {
  usdMicros,
  usdMicrosToSafeInteger,
  type UsdMicros,
} from '../../../../packages/billing/src/index';

import type { CoreBindings } from '../bindings';

export type FalAttemptTerminalStatus = 'succeeded' | 'failed' | 'canceled';

export interface MachineReservation {
  readonly id: string;
  readonly amountMicros: UsdMicros;
  readonly capturedMicros: UsdMicros;
  readonly releasedMicros: UsdMicros;
}

export interface FalArtifactContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly runId: string;
  readonly canvasRevisionId: string;
  readonly runNodeId: string;
  readonly attemptId: string;
  readonly attemptStatus: string;
  readonly providerJobStatus: string;
  readonly assetRole: string;
  /**
   * `request` is the copy route's unit. It is in this union because the ingest context is shared:
   * the SQL side also carried a fal-only `unit in ('image','video_second')` filter, shaped like
   * validation, which meant relaxing only the obvious provider_key check still returned NOT_FOUND
   * for every copy job.
   */
  readonly priceUnit: 'image' | 'video_second' | 'request';
  readonly unitPriceMicros: UsdMicros;
  readonly quotedTotalMicros: UsdMicros;
  readonly reservation: MachineReservation;
}

export interface RegisteredMachineArtifact {
  readonly id: string;
  readonly workspaceId: string;
  readonly projectId: string;
  readonly runId: string;
  readonly runNodeId: string | null;
  readonly canvasRevisionId: string;
  readonly artifactKind: 'provider_output' | 'approved_output' | 'export' | 'input';
  readonly status: 'available' | 'quarantined';
  readonly objectKey: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly byteSize: number;
}

export interface FalAttemptAdvance {
  readonly effectiveAttemptStatus: string;
  readonly runStatus: string;
  readonly runTerminal: boolean;
  readonly reservation: MachineReservation;
  readonly outcomes: readonly (
    | Readonly<{ attemptId: string; status: 'succeeded'; captureMicros: UsdMicros }>
    | Readonly<{ attemptId: string; status: 'failed' | 'canceled' }>
    | Readonly<{ attemptId: string; status: string }>
  )[];
}

export interface ExportContextArtifact {
  readonly id: string;
  readonly artifactKind: string;
  readonly objectKey: string;
  readonly contentHash: string;
  readonly mimeType: string;
  readonly byteSize: number;
}

export interface ExportMachineContext {
  readonly workspaceId: string;
  readonly projectId: string;
  readonly runId: string;
  readonly canvasRevisionId: string;
  readonly canvasRevisionHash: string;
  readonly quoteId: string;
  readonly runStatus: string;
  readonly reservation: Omit<MachineReservation, 'id'>;
  readonly artifacts: readonly ExportContextArtifact[];
  readonly lineage: readonly Readonly<{
    parentArtifactId: string;
    childArtifactId: string;
    relationship: ArtifactLineageRelationship;
  }>[];
  readonly providerJobs: readonly Readonly<{
    attemptId: string;
    provider: string;
    providerModelId: string;
    routeId: string;
    status: string;
    captureMicros: number;
  }>[];
}

export class ArtifactMachineError extends Error {
  override readonly name = 'ArtifactMachineError';

  constructor(
    readonly reason:
      'artifact_machine_unavailable' | 'artifact_machine_forbidden' | 'artifact_machine_invariant',
    readonly retryable: boolean,
    options?: ErrorOptions,
    readonly detail?: string,
  ) {
    super(
      reason === 'artifact_machine_forbidden'
        ? 'Artifact persistence rejected the privileged credential'
        : reason === 'artifact_machine_invariant'
          ? `Artifact persistence returned an impossible result: ${detail ?? 'unspecified'}`
          : 'Artifact persistence is unavailable',
      options,
    );
  }
}

function unavailable(cause?: unknown): ArtifactMachineError {
  return new ArtifactMachineError(
    'artifact_machine_unavailable',
    true,
    cause === undefined ? undefined : { cause },
  );
}

/**
 * A structurally impossible result, not a transient one.
 *
 * Retrying cannot fix a malformed money envelope, and the caller is a provider webhook that
 * redelivers indefinitely — so classifying this as retryable produced an unbounded 503 loop *after*
 * money had already been captured. A succeeded attempt with no `capture_micros` is the specific case
 * that bit: `advance_fal_provider_attempt` stripped nulls from its outcomes array, so a succeeded
 * OpenRouter copy attempt in the same run left the field absent and every later fal webhook in that
 * run failed here forever.
 */
function invariantViolated(detail: string): ArtifactMachineError {
  return new ArtifactMachineError('artifact_machine_invariant', false, undefined, detail);
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw unavailable();
  return value as Readonly<Record<string, unknown>>;
}

function string(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) throw unavailable();
  return value;
}

function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw unavailable();
  return value;
}

function integer(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw unavailable();
  return parsed;
}

function micros(value: unknown): UsdMicros {
  return usdMicros(BigInt(integer(value)));
}

function reservation(value: unknown, idRequired = true): MachineReservation {
  const raw = record(value);
  return {
    id: idRequired ? string(raw.id) : '',
    amountMicros: micros(raw.amount_micros),
    capturedMicros: micros(raw.captured_micros),
    releasedMicros: micros(raw.released_micros),
  };
}

function lineageRelationship(value: unknown): ArtifactLineageRelationship {
  const candidate = string(value);
  if (!ARTIFACT_LINEAGE_RELATIONSHIPS.includes(candidate as ArtifactLineageRelationship)) {
    throw unavailable();
  }
  return candidate as ArtifactLineageRelationship;
}

export class PrivilegedArtifactMachinePort {
  readonly #baseUrl: string | undefined;
  readonly #privilegedKey: string | undefined;
  readonly #fetch: typeof fetch;

  constructor(bindings: CoreBindings, fetchImplementation?: typeof fetch) {
    this.#baseUrl = bindings.SUPABASE_URL?.replace(/\/$/u, '');
    this.#privilegedKey = bindings.SUPABASE_SECRET_KEY ?? bindings.SUPABASE_SERVICE_ROLE_KEY;
    this.#fetch = fetchImplementation ?? ((input, init) => fetch(input, init));
  }

  async #rpc(functionName: string, body: Readonly<Record<string, unknown>>): Promise<unknown> {
    if (!this.#baseUrl || !this.#privilegedKey) throw unavailable();
    let response: Response;
    try {
      response = await this.#fetch(`${this.#baseUrl}/rest/v1/rpc/${functionName}`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          apikey: this.#privilegedKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw unavailable(cause);
    }
    if (response.status === 401 || response.status === 403) {
      throw new ArtifactMachineError('artifact_machine_forbidden', false);
    }
    if (!response.ok) throw unavailable();
    try {
      return (await response.json()) as unknown;
    } catch (cause) {
      throw unavailable(cause);
    }
  }

  async getFalContext(providerRequestId: string): Promise<FalArtifactContext> {
    return await this.#getProviderContext(providerRequestId, 'fal', ['image', 'video_second']);
  }

  /** Copy's unit is `request`; nothing else is billable on this route. */
  async getCopyContext(providerRequestId: string): Promise<FalArtifactContext> {
    return await this.#getProviderContext(providerRequestId, 'openrouter', ['request']);
  }

  async #getProviderContext(
    providerRequestId: string,
    providerKey: string,
    allowedUnits: readonly FalArtifactContext['priceUnit'][],
  ): Promise<FalArtifactContext> {
    const raw = record(
      await this.#rpc('get_provider_artifact_context', {
        p_provider_request_id: providerRequestId,
        p_provider_key: providerKey,
      }),
    );
    const rawPriceUnit = string(raw.price_unit);
    // Pin the unit per route rather than accepting the whole union. A copy context arriving with an
    // image price, or the reverse, means the plan line and the route disagree - which is a pricing
    // fault, not something to charge for.
    const priceUnit = allowedUnits.find(
      (unit): unit is FalArtifactContext['priceUnit'] => unit === rawPriceUnit,
    );
    if (priceUnit === undefined) throw unavailable();
    return {
      workspaceId: string(raw.workspace_id),
      projectId: string(raw.project_id),
      runId: string(raw.run_id),
      canvasRevisionId: string(raw.canvas_revision_id),
      runNodeId: string(raw.run_node_id),
      attemptId: string(raw.attempt_id),
      attemptStatus: string(raw.attempt_status),
      providerJobStatus: string(raw.provider_job_status),
      assetRole: string(raw.asset_role),
      priceUnit,
      unitPriceMicros: micros(raw.unit_price_micros),
      quotedTotalMicros: micros(raw.quoted_total_micros),
      reservation: reservation(raw.reservation),
    };
  }

  async registerArtifact(
    input: Readonly<{
      runId: string;
      runNodeId: string | null;
      artifactKind: 'provider_output' | 'export';
      status: 'available' | 'quarantined';
      objectKey: string;
      contentHash: string;
      mimeType: string;
      byteSize: number;
      parentArtifactIds?: readonly string[];
      relationship?: ArtifactLineageRelationship;
    }>,
  ): Promise<Readonly<{ artifact: RegisteredMachineArtifact; replayed: boolean }>> {
    const raw = record(
      await this.#rpc('register_artifact', {
        p_run_id: input.runId,
        p_run_node_id: input.runNodeId,
        p_artifact_kind: input.artifactKind,
        p_status: input.status,
        p_object_key: input.objectKey,
        p_content_hash: input.contentHash,
        p_mime_type: input.mimeType,
        p_byte_size: input.byteSize,
        p_parent_artifact_ids: input.parentArtifactIds ?? [],
        p_relationship: input.relationship ?? null,
      }),
    );
    const artifact = record(raw.artifact);
    const artifactKind = string(artifact.artifact_kind);
    const status = string(artifact.status);
    if (
      !['provider_output', 'approved_output', 'export', 'input'].includes(artifactKind) ||
      (status !== 'available' && status !== 'quarantined')
    ) {
      throw unavailable();
    }
    return {
      replayed: boolean(raw.replayed),
      artifact: {
        id: string(artifact.id),
        workspaceId: string(artifact.workspace_id),
        projectId: string(artifact.project_id),
        runId: string(artifact.run_id),
        runNodeId: artifact.run_node_id === null ? null : string(artifact.run_node_id),
        canvasRevisionId: string(artifact.canvas_revision_id),
        artifactKind: artifactKind as RegisteredMachineArtifact['artifactKind'],
        status,
        objectKey: string(artifact.object_key),
        contentHash: string(artifact.content_hash),
        mimeType: string(artifact.mime_type),
        byteSize: integer(artifact.byte_size),
      },
    };
  }

  /**
   * Sibling of advanceFalAttempt for the synchronous copy route. Both RPCs share
   * app_private.settle_attempt_transition, so copy settles through exactly the code the fal route
   * proved - including the wave promotion, which was previously reachable only through the fal-only
   * entry point and therefore never fired for a launch pack whose wave 1 is all copy.
   */
  async advanceCopyAttempt(
    input: Readonly<{
      providerRequestId: string;
      status: 'succeeded' | 'failed';
      eventId: string;
      artifactId?: string;
      captureMicros?: UsdMicros;
    }>,
  ): Promise<FalAttemptAdvance> {
    return await this.#advanceAttempt('advance_copy_provider_attempt', input);
  }

  async advanceFalAttempt(
    input: Readonly<{
      providerRequestId: string;
      status: 'running' | 'succeeded' | 'failed';
      eventId: string;
      artifactId?: string;
      captureMicros?: UsdMicros;
    }>,
  ): Promise<FalAttemptAdvance> {
    return await this.#advanceAttempt('advance_fal_provider_attempt', input);
  }

  async #advanceAttempt(
    functionName: 'advance_fal_provider_attempt' | 'advance_copy_provider_attempt',
    input: Readonly<{
      providerRequestId: string;
      status: 'running' | 'succeeded' | 'failed';
      eventId: string;
      artifactId?: string;
      captureMicros?: UsdMicros;
    }>,
  ): Promise<FalAttemptAdvance> {
    const raw = record(
      await this.#rpc(functionName, {
        p_provider_request_id: input.providerRequestId,
        p_status: input.status,
        p_event_id: input.eventId,
        p_artifact_id: input.artifactId ?? null,
        p_capture_micros:
          input.captureMicros === undefined ? null : usdMicrosToSafeInteger(input.captureMicros),
      }),
    );
    if (!Array.isArray(raw.outcomes)) throw unavailable();
    return {
      effectiveAttemptStatus: string(raw.effective_attempt_status),
      runStatus: string(raw.run_status),
      runTerminal: boolean(raw.run_terminal),
      reservation: reservation(raw.reservation),
      outcomes: raw.outcomes.map((value) => {
        const outcome = record(value);
        const status = string(outcome.status);
        const attemptId = string(outcome.attempt_id);
        if (status === 'succeeded') {
          // A succeeded attempt without a capture amount is an invariant violation, not a blip:
          // nothing may be marked succeeded without artifact-and-capture proof. Fail closed and
          // non-retryable so the webhook stops redelivering instead of looping on captured money.
          if (outcome.capture_micros === undefined || outcome.capture_micros === null) {
            throw invariantViolated(
              `attempt ${attemptId} reported succeeded with no capture_micros`,
            );
          }
          return { attemptId, status, captureMicros: micros(outcome.capture_micros) };
        }
        if (status === 'failed' || status === 'canceled') return { attemptId, status };
        return { attemptId, status };
      }),
    };
  }

  async getExportContext(
    runId: string,
    artifactIds: readonly string[],
  ): Promise<ExportMachineContext> {
    const raw = record(
      await this.#rpc('get_export_context', {
        p_run_id: runId,
        p_artifact_ids: artifactIds,
      }),
    );
    if (
      !Array.isArray(raw.artifacts) ||
      !Array.isArray(raw.lineage) ||
      !Array.isArray(raw.provider_jobs)
    ) {
      throw unavailable();
    }
    const rawReservation = reservation(raw.reservation, false);
    return {
      workspaceId: string(raw.workspace_id),
      projectId: string(raw.project_id),
      runId: string(raw.run_id),
      canvasRevisionId: string(raw.canvas_revision_id),
      canvasRevisionHash: string(raw.canvas_revision_hash),
      quoteId: string(raw.quote_id),
      runStatus: string(raw.run_status),
      reservation: {
        amountMicros: rawReservation.amountMicros,
        capturedMicros: rawReservation.capturedMicros,
        releasedMicros: rawReservation.releasedMicros,
      },
      artifacts: raw.artifacts.map((value) => {
        const artifact = record(value);
        return {
          id: string(artifact.id),
          artifactKind: string(artifact.artifact_kind),
          objectKey: string(artifact.object_key),
          contentHash: string(artifact.content_hash),
          mimeType: string(artifact.mime_type),
          byteSize: integer(artifact.byte_size),
        };
      }),
      lineage: raw.lineage.map((value) => {
        const entry = record(value);
        return {
          parentArtifactId: string(entry.parent_artifact_id),
          childArtifactId: string(entry.child_artifact_id),
          relationship: lineageRelationship(entry.relationship),
        };
      }),
      providerJobs: raw.provider_jobs.map((value) => {
        const job = record(value);
        return {
          attemptId: string(job.attempt_id),
          provider: string(job.provider),
          providerModelId: string(job.provider_model_id),
          routeId: string(job.route_id),
          status: string(job.status),
          captureMicros: integer(job.capture_micros),
        };
      }),
    };
  }
}
