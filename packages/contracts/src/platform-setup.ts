import { z } from 'zod';
import { WireTimestampSchema } from './http';
import {
  uuid,
  name,
  slug,
  version,
  studio,
  brand,
  workspace,
  identity,
  expected,
  page,
  single,
  list,
  BrandRecordSchema,
  PlatformActionSchema,
  StudioRecordSchema,
  StudioMemberRecordSchema,
} from './platform-models';

const website = z
  .string()
  .max(2048)
  .refine((value) => {
    if (value === '') return true;
    try {
      const url = new URL(value);
      return (
        ['http:', 'https:'].includes(url.protocol) &&
        !url.username &&
        !url.password &&
        value === value.trim() &&
        !/\s/u.test(value)
      );
    } catch {
      return false;
    }
  });
const draftFields = {
  website_url: website,
  description: z.string().max(2000),
  audience: z.string().max(2000),
  goals: z.string().max(2000),
  current_step: z.enum(['identity', 'details', 'review']),
};
export const BrandDraftRecordSchema = z
  .object({
    id: uuid,
    ...brand,
    origin_studio_id: uuid,
    ...draftFields,
    version,
    created_by: uuid,
    updated_by: uuid,
    created_at: WireTimestampSchema,
    updated_at: WireTimestampSchema,
  })
  .strict();
export const StudioInvitationRecordSchema = z
  .object({
    id: uuid,
    ...studio,
    owner_membership_id: uuid,
    created_by: uuid,
    recipient_email: z.email().max(254),
    role: z.enum(['editor', 'viewer']),
    status: z.enum(['pending', 'accepted', 'revoked']),
    version,
    expires_at: WireTimestampSchema,
    created_at: WireTimestampSchema,
    accepted_by: uuid.nullable(),
    accepted_at: WireTimestampSchema.nullable(),
    accepted_membership_version: version.nullable(),
    revoked_at: WireTimestampSchema.nullable(),
  })
  .strict();
export const WorkspaceSettingsSchema = z
  .object({
    id: uuid,
    name,
    slug,
    status: z.enum(['active', 'suspended', 'deletion_pending']),
    updated_at: WireTimestampSchema,
  })
  .strict();
const invitation = { invitation_id: uuid };
const rpc = 'platform_setup' as const;

/** Setup operations use the same handler and transport generators as portfolio identity. */
export const PLATFORM_SETUP_OPERATIONS = {
  list_brand_studios: {
    rpc: 'platform_presentation',
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/studios',
    input: z.object({ ...brand, limit: page.limit, cursor: page.cursor }).strict(),
    output: list(StudioRecordSchema),
  },
  list_studio_team: {
    rpc: 'platform_presentation',
    method: 'GET',
    path: '/studios/{studio_id}/team',
    input: z.object({ ...studio, limit: page.limit, cursor: page.cursor }).strict(),
    output: list(StudioMemberRecordSchema.extend({ display_label: z.string().min(1).max(254) })),
  },
  get_studio_access: {
    rpc: 'platform_presentation',
    method: 'GET',
    path: '/studios/{studio_id}/access',
    input: z.object(studio).strict(),
    output: z
      .object({ studio: StudioRecordSchema, role: z.enum(['owner', 'editor', 'viewer']) })
      .strict(),
  },
  initialize_brand_draft: {
    rpc: 'platform_onboarding',
    method: 'POST',
    path: '/studios/{studio_id}/workspaces/{workspace_id}/brands/{brand_id}/onboarding',
    input: z.object({ ...studio, ...brand }).strict(),
    output: single(BrandDraftRecordSchema),
  },
  start_brand_draft: {
    rpc,
    method: 'POST',
    path: '/studios/{studio_id}/brand-drafts',
    input: z.object({ ...studio, ...identity, workspace_id: uuid.optional() }).strict(),
    output: z.object({ brand: BrandRecordSchema, draft: BrandDraftRecordSchema }).strict(),
  },
  get_brand_draft: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/onboarding',
    input: z.object(brand).strict(),
    output: single(BrandDraftRecordSchema.nullable()),
  },
  save_brand_draft: {
    rpc,
    method: 'PATCH',
    path: '/workspaces/{workspace_id}/brands/{brand_id}/onboarding',
    input: z.object({ ...brand, ...expected, ...draftFields }).strict(),
    output: single(BrandDraftRecordSchema),
  },
  list_studio_brands: {
    rpc,
    method: 'GET',
    path: '/studios/{studio_id}/brands',
    input: z.object({ ...studio, ...page, search: z.string().max(120).optional() }).strict(),
    output: list(BrandRecordSchema),
  },
  get_brand_access: {
    rpc,
    method: 'GET',
    path: '/studios/{studio_id}/workspaces/{workspace_id}/brands/{brand_id}/access',
    input: z.object({ ...studio, ...brand }).strict(),
    output: z
      .object({
        brand: BrandRecordSchema,
        actions: z.array(PlatformActionSchema),
        workspace_owner: z.boolean(),
      })
      .strict(),
  },
  resolve_project_brand: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/projects/{project_id}/brand',
    input: z.object({ ...workspace, project_id: uuid }).strict(),
    output: z
      .object({
        ...workspace,
        project_id: uuid,
        brand_id: uuid.nullable(),
        state: z.enum(['mapped', 'mapping_required']),
      })
      .strict(),
  },
  create_studio_invitation: {
    rpc,
    method: 'POST',
    path: '/studios/{studio_id}/invitations',
    input: z
      .object({
        ...studio,
        ...expected,
        recipient_email: z
          .email()
          .max(254)
          .refine((v) => v === v.trim().toLowerCase()),
        role: z.enum(['editor', 'viewer']),
      })
      .strict(),
    output: single(StudioInvitationRecordSchema),
  },
  list_studio_invitations: {
    rpc,
    method: 'GET',
    path: '/studios/{studio_id}/invitations',
    input: z.object({ ...studio, limit: page.limit, cursor: page.cursor }).strict(),
    output: list(StudioInvitationRecordSchema),
  },
  list_my_invitations: {
    rpc,
    method: 'GET',
    path: '/studio-invitations',
    input: z.object({ limit: page.limit, cursor: page.cursor }).strict(),
    output: list(
      z.object({ invitation: StudioInvitationRecordSchema, studio_name: name }).strict(),
    ),
  },
  accept_studio_invitation: {
    rpc,
    method: 'POST',
    path: '/studio-invitations/{invitation_id}/accept',
    input: z.object({ ...invitation, ...expected }).strict(),
    output: single(StudioInvitationRecordSchema),
  },
  revoke_studio_invitation: {
    rpc,
    method: 'POST',
    path: '/studios/{studio_id}/invitations/{invitation_id}/revoke',
    input: z.object({ ...studio, ...invitation, ...expected }).strict(),
    output: single(StudioInvitationRecordSchema),
  },
  get_workspace_settings: {
    rpc,
    method: 'GET',
    path: '/workspaces/{workspace_id}/settings',
    input: z.object(workspace).strict(),
    output: single(WorkspaceSettingsSchema),
  },
  update_workspace_settings: {
    rpc,
    method: 'PATCH',
    path: '/workspaces/{workspace_id}/settings',
    input: z
      .object({ ...workspace, ...identity, expected_updated_at: WireTimestampSchema })
      .strict(),
    output: single(WorkspaceSettingsSchema),
  },
  get_workspace_billing: {
    rpc: 'platform_billing',
    method: 'GET',
    path: '/workspaces/{workspace_id}/billing',
    input: z.object(workspace).strict(),
    output: z
      .object({
        workspace_id: uuid,
        profile_present: z.boolean(),
        charging_enabled: z.boolean(),
        subscription_status: z
          .enum(['none', 'trialing', 'active', 'past_due', 'canceled'])
          .nullable(),
        wallet_balance_micros: z.string().regex(/^\d+$/u).nullable(),
        ledger_wallet_available_micros: z.string().regex(/^\d+$/u),
        usage_expense_micros: z.string().regex(/^\d+$/u),
        balances_match: z.boolean().nullable(),
      })
      .strict(),
  },
} as const;
