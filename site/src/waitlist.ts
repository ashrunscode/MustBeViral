// The waitlist form: parse, validate, store. No IP address, user agent or
// cookie is stored with a sign-up. The rate limiter keys on the IP address
// in memory at Cloudflare and keeps nothing in D1.

export const BUSINESS_TYPES = ["food", "beauty", "fitness", "retail", "services", "laundromat", "other"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface SignUp {
  email: string;
  emailNorm: string;
  businessName: string | null;
  businessType: BusinessType;
  city: string | null;
  note: string | null;
  utmSource: string | null;
  utmCampaign: string | null;
}

export type FieldErrors = Partial<
  Record<"email" | "business_type" | "business_name" | "city" | "note", string>
>;

export type Parsed =
  | { kind: "ok"; signUp: SignUp }
  | { kind: "bot" }
  | { kind: "invalid"; errors: FieldErrors };

export const LIMITS = {
  body: 8 * 1024,
  email: 254,
  businessName: 120,
  city: 80,
  note: 1000,
  utm: 100,
} as const;

// Deliberately plain: one @, no spaces, a dot in the domain part.
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UTM = /^[A-Za-z0-9._-]+$/;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL, "").trim();
}

function optional(value: unknown, max: number): string | null | undefined {
  const v = clean(value);
  if (v === "") return null;
  if (v.length > max) return undefined;
  return v;
}

function utm(value: unknown): string | null {
  const v = clean(value);
  if (v === "" || v.length > LIMITS.utm || !UTM.test(v)) return null;
  return v;
}

/** Validate a submitted form. `fields` is a plain record of form values. */
export function parseSignUp(fields: Record<string, unknown>): Parsed {
  // Honeypot: a field people never see. Anything typed into it is a bot.
  if (clean(fields["company_site"]) !== "") return { kind: "bot" };

  const errors: FieldErrors = {};

  const email = clean(fields["email"]);
  if (email === "") errors.email = "Enter your email address.";
  else if (email.length > LIMITS.email || !EMAIL.test(email))
    errors.email = "That email address doesn't look right.";

  const typeRaw = clean(fields["business_type"]);
  const businessType = (BUSINESS_TYPES as readonly string[]).includes(typeRaw)
    ? (typeRaw as BusinessType)
    : null;
  if (!businessType) errors.business_type = "Pick the kind of business.";

  const businessName = optional(fields["business_name"], LIMITS.businessName);
  if (businessName === undefined)
    errors.business_name = `Keep the business name under ${LIMITS.businessName} characters.`;

  const city = optional(fields["city"], LIMITS.city);
  if (city === undefined)
    errors.city = `Keep the city under ${LIMITS.city} characters.`;

  const note = optional(fields["note"], LIMITS.note);
  if (note === undefined)
    errors.note = `Keep the note under ${LIMITS.note} characters.`;

  if (Object.keys(errors).length > 0 || !businessType)
    return { kind: "invalid", errors };

  return {
    kind: "ok",
    signUp: {
      email,
      emailNorm: email.toLowerCase(),
      businessName: businessName ?? null,
      businessType,
      city: city ?? null,
      note: note ?? null,
      utmSource: utm(fields["utm_source"]),
      utmCampaign: utm(fields["utm_campaign"]),
    },
  };
}

/**
 * Insert or refresh a sign-up. A second sign-up with the same email updates
 * the row and keeps the first created_at. The caller answers the same way in
 * both cases, so the form never reveals whether an address is already listed.
 */
export async function storeSignUp(
  db: D1Database,
  s: SignUp,
  host: string,
  now: Date,
  id: string,
): Promise<void> {
  const ts = now.toISOString();
  await db
    .prepare(
      `INSERT INTO waitlist
         (id, email, email_norm, business_name, business_type, city, note, utm_source, utm_campaign, host, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)
       ON CONFLICT (email_norm) DO UPDATE SET
         email         = excluded.email,
         business_name = COALESCE(excluded.business_name, waitlist.business_name),
         business_type = excluded.business_type,
         city          = COALESCE(excluded.city, waitlist.city),
         note          = COALESCE(excluded.note, waitlist.note),
         utm_source    = COALESCE(waitlist.utm_source, excluded.utm_source),
         utm_campaign  = COALESCE(waitlist.utm_campaign, excluded.utm_campaign),
         updated_at    = excluded.updated_at`,
    )
    .bind(
      id,
      s.email,
      s.emailNorm,
      s.businessName,
      s.businessType,
      s.city,
      s.note,
      s.utmSource,
      s.utmCampaign,
      host,
      ts,
    )
    .run();
}
