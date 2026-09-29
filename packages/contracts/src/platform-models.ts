import { z } from 'zod';
import { WireTimestampSchema } from './http';

export const uuid = z.uuid();
export const name = z
  .string()
  .min(1)
  .max(120)
  .refine((value) => value === value.trim());
export const slug = z
  .string()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/u);
export const version = z.number().int().min(1).max(2_147_483_647);
export const page = {
  limit: z.number().int().min(1).max(100).optional(),
  cursor: z
    .string()
    .min(1)
    .max(2048)
    .regex(/^[A-Za-z0-9_-]+$/u)
    .optional(),
  include_archived: z.boolean().optional(),
};
export const identity = { name, slug };
export const workspace = { workspace_id: uuid };
export const brand = { ...workspace, brand_id: uuid };
export const location = { ...brand, location_id: uuid };
export const studio = { studio_id: uuid };
export const expected = { expected_version: version };
export const timeZone = z
  .string()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en', { timeZone: value });
      return true;
    } catch {
      return false;
    }
  });
export const PlatformActionSchema = z.enum([
  'brand:read',
  'brand:write',
  'location:read',
  'location:write',
]);
export const actions = z
  .array(PlatformActionSchema)
  .min(1)
  .max(4)
  .refine(
    (values) =>
      new Set(values).size === values.length &&
      values.includes('brand:read') &&
      (!values.includes('location:write') || values.includes('location:read')),
  );
export const record = {
  id: uuid,
  name,
  slug,
  status: z.enum(['active', 'archived']),
  version,
  created_by: uuid,
  created_at: WireTimestampSchema,
  updated_at: WireTimestampSchema,
};
export const StudioRecordSchema = z.object(record).strict();
export const BrandRecordSchema = z.object({ ...record, ...workspace }).strict();
export const BrandLocationRecordSchema = z
  .object({ ...record, ...brand, time_zone: z.string().min(1).max(100) })
  .strict();
export const StudioMemberRecordSchema = z
  .object({
    id: uuid,
    ...studio,
    user_id: uuid,
    role: z.enum(['owner', 'editor', 'viewer']),
    status: z.enum(['active', 'revoked']),
    version,
    created_at: WireTimestampSchema,
    revoked_at: WireTimestampSchema.nullable(),
  })
  .strict();
export const WorkspaceGrantRecordSchema = z
  .object({
    id: uuid,
    ...workspace,
    ...studio,
    brand_id: uuid.nullable(),
    owner_membership_id: uuid,
    granted_by: uuid,
    actions,
    status: z.enum(['active', 'revoked']),
    version,
    created_at: WireTimestampSchema,
    revoked_at: WireTimestampSchema.nullable(),
  })
  .strict();
export const single = <T extends z.ZodType>(schema: T) => z.object({ record: schema }).strict();
export const list = <T extends z.ZodType>(schema: T) =>
  z.object({ items: z.array(schema), next_cursor: z.string().nullable() }).strict();
