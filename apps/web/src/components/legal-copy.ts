/**
 * The three legal pages, written only from facts in brand/context.md and from what the code does
 * today (owner directive, 2026-10-02). Every section names its source in a comment. Nothing here
 * is legal advice, and nothing states a practice the repository does not show: no street address,
 * no hours, no cookie or tag the public pages do not set, no data sale, no training practice, no
 * right the code does not implement, no promise about future maintenance. Each page is dated.
 */

import { phoneDisplay, siteFooter, studioEmail } from './public-copy';

export interface LegalSection {
  readonly heading: string;
  readonly paragraphs: readonly string[];
  readonly items?: readonly string[];
}

export interface LegalPageCopy {
  readonly slug: 'privacy' | 'terms' | 'advertising';
  readonly title: string;
  readonly description: string;
  readonly updated: string;
  readonly intro: string;
  readonly sections: readonly LegalSection[];
}

const UPDATED = '2026-10-02';

/** brand/context.md sections 1, 6 and 8a: the entity, Houston, the contact, no published street address. */
const whoWeAre: LegalSection = {
  heading: 'Who we are',
  paragraphs: [
    `${siteFooter.entity}, in Houston, Texas. The street address is not yet published. Write to ${studioEmail} or call ${phoneDisplay}.`,
  ],
};

export const privacyCopy: LegalPageCopy = {
  slug: 'privacy',
  title: 'Privacy',
  description:
    'What mustbeviral.com does with information, as the site is built today: no cookie or tag on the sales and legal pages, a phone call to book, an email to request access, sign-in through Supabase Auth, and the records a signed-in studio keeps.',
  updated: UPDATED,
  intro: `This page says what mustbeviral.com does with information, as the site is built on ${UPDATED}.`,
  sections: [
    whoWeAre,
    {
      // apps/web/src/lib/document-lang.ts and src/lib/supabase/proxy.ts (the sales, legal and text
      // paths skip session work); no analytics or tag dependency in apps/web/package.json; the
      // production pages answer with no Set-Cookie; next/font self-hosts Geist (the build output
      // holds the font files); web-vitals has no reporter registered in production
      // (src/lib/telemetry/web-vitals.ts).
      heading: 'The sales and legal pages',
      paragraphs: [
        'The home page, the Spanish home page, the pricing page, the software page, the plans page and these pages set no cookie, run no analytics and load no advertising tag. The typefaces are served from this site.',
        `Booking a test shoot is a phone call: the button dials ${phoneDisplay}. Requesting access to the software is an email to ${studioEmail}. There is no contact or sign-up form on the sales and legal pages. The request-access page collects nothing and creates no account.`,
        'The browser measures three page-speed numbers for the page it is on (largest contentful paint, interaction to next paint, layout shift). In production nothing sends them anywhere.',
      ],
    },
    {
      // apps/web/app/login/actions.ts, forgot-password/actions.ts, verify-email/actions.ts,
      // reset-password/actions.ts and app/auth/callback (Supabase Auth calls); src/lib/supabase/
      // proxy.ts (session cookies set only through Supabase Auth); apps/web/app/signup/page.tsx
      // (enrollment closed); src/features/platform/platform-frame.tsx (studio sign-out with the
      // default global scope); brand/context.md section 9 and docs/architecture/SYSTEM_OVERVIEW.md
      // (Resend as the Supabase Auth mail relay).
      heading: 'Signing in',
      paragraphs: [
        'People sign in with an email and a password handled by Supabase Auth. Accounts are not created on this site; enrollment is closed.',
        'The sign-in, password-recovery and verification screens each take an email address and pass it to Supabase Auth, and nowhere else. Supabase Auth sends a recovery or verification message to that address when an account exists, and delivers it through Resend.',
        'Signing in, or opening a recovery or verification link, sets the session cookies that Supabase Auth uses. A visitor who does neither receives none. Signing out from the studio ends the session on every device where that account was signed in.',
      ],
    },
    {
      // packages/contracts/src/** and docs/architecture/SYSTEM_OVERVIEW.md (the record types,
      // audit and outbox events, private R2 behind short-lived signed operations);
      // supabase/migrations/20260910150000_platform_saved_setup.sql (invitations expire after seven
      // days and stay on the list); src/features/platform/studio-team.tsx (no email);
      // src/features/brief/brief-schema.ts and src/features/campaign/campaign-progress.ts (session
      // storage; src/features/brief/brief-bootstrap.ts sends the validated brief to Core);
      // src/features/platform/brand-settings.tsx and brand-workspace.tsx (archive on
      // write access; archive only changes a status); no delete operation exists in the contracts.
      heading: 'What a signed-in studio keeps',
      paragraphs: [
        'A signed-in studio’s records include its studios with their members and access grants, brands and brand knowledge, brand locations and onboarding drafts, campaign briefs, uploaded packshots, plans and their revisions, quotes, reservations and ledger entries, runs, receipts, exports, API keys, invitations, the comments and text drafts made on a plan, and an audit log of who did what.',
        'Media is private. It is kept in private object storage and opened through short-lived signed operations, never through a public bucket.',
        'An invitation can be accepted for seven days; after that it is shown as expired and the record stays on the studio’s list. No email is sent for an invitation.',
        'While someone works, the browser keeps the brief draft and the last campaign step, with the identifiers of the records it belonged to, in its session storage. Validating a brief sends its contents to the Core service, which creates the campaign project and its first plan revision from it; the saved step itself is never sent. The sales and legal pages use no browser storage.',
        `Nothing on this site deletes a record held in the database today. A person can delete their own comment, or clear their own text draft, on a plan; that removes it from the collaboration service. A brand or a location can be archived by anyone with write access to it, and its saved records remain available for reference; an invitation or an access grant can be revoked. Plan revisions are immutable records of each plan, and receipts are immutable records of what ran. Questions about the records a studio holds: write to ${studioEmail}.`,
      ],
    },
    {
      // docs/architecture/SYSTEM_OVERVIEW.md (Vercel, Supabase, Cloudflare Core and the
      // collaboration service, private R2, Resend, Sentry and OpenTelemetry); apps/core/wrangler.jsonc
      // (observability logs enabled; production provider runs off); apps/core/src/bindings.ts
      // (Sentry and OpenTelemetry disabled without their settings); packages/email/src/index.ts
      // (an adapter nothing calls); apps/core/src/composition/core-email.ts and
      // stripe-webhook-settlement.ts (the one Core mail, through Resend, only when configured);
      // brand/context.md section 6 (production
      // generation, provider, queue and charge behaviour off) and 4d (no run without a confirmed
      // quote); no social account or posting path and no Drive adapter exists in the code.
      heading: 'Who else handles it',
      paragraphs: [
        'Vercel serves the site. Supabase holds the database and runs sign-in. Cloudflare runs the Core service, the collaboration service that, when it runs, holds the comments and text drafts made on a plan, and the private media store; the Core service writes its request logs to Cloudflare Workers Logs. When configured, the Core service reports errors to Sentry and traces to an OpenTelemetry endpoint.',
        'No generation provider receives anything from this site today: on mustbeviral.com, generation, provider calls, queues and charging are switched off, and no run starts without a confirmed quote. Nothing on this site connects a social account or posts anywhere, and Google Drive is not connected to anything on this site today. The web app sends no mail. The Core service can send one message through Resend, a notice to the operator after a Stripe wallet credit, and only when a Resend key and from-address are configured on that service. A second mail adapter in the code is never called.',
      ],
    },
    {
      heading: 'The date',
      paragraphs: [
        `This page describes the site as built on ${UPDATED}. The date above is when it last changed.`,
      ],
    },
  ],
};

export const termsCopy: LegalPageCopy = {
  slug: 'terms',
  title: 'Terms',
  description:
    'What Must Be Viral sells and how the site works, as built today: the two studio offers at their exact prices, the add-on ranges, the releases and permissions a client grants, and the software for the people a studio invites, with charging off.',
  updated: UPDATED,
  intro: `These terms say what Must Be Viral sells and how this site works, as of ${UPDATED}.`,
  sections: [
    whoWeAre,
    {
      // brand/context.md section 7a (the two offers and every included line, in order), 7b (no
      // other tier, no discounts, the add-on figure confirmed at booking), 7c (the one action),
      // 10b (the date, the location and the price are agreed at booking).
      heading: 'The Houston studio',
      paragraphs: [
        `Two offers are sold. Test Shoot: $700, one time. Full Package: $3,500 a month. No tier below the Full Package is sold, and the price is the price. Booking is a phone call to ${phoneDisplay}. The date, the location and any add-on figure are confirmed on that call; the deliverables are the ones listed here.`,
      ],
      items: [
        'Test Shoot, $700, one time: one shoot of up to 2 hours, 2 edited Reels, 15–25 edited photos, creative direction on set, formatted for Instagram and TikTok and ready to post.',
        'Full Package, $3,500 a month: 4–8 shoots per month of 2–3 hours each, 12–16+ edited Reels, 120–200 edited photos, lifestyle, branding, product and team photography, cinematic brand content, full creative direction, monthly content strategy and calendar, hook and caption assistance, trend research, Instagram and TikTok optimisation, behind-the-scenes and story content, a monthly strategy meeting, priority editing, and drone or aerial included where applicable.',
      ],
    },
    {
      // brand/context.md section 7a (add-ons), 7b (the range rule), 3d pair 7 (turnaround).
      heading: 'Add-ons',
      paragraphs: [
        '24-hour turnaround, +$200–$400 per shoot. Drone, +$300–$600 per shoot, included in the Full Package where applicable. The exact figure inside each range is confirmed at booking.',
        'Standard edits come back on the schedule we agree at booking; 24-hour turnaround is an add-on.',
      ],
    },
    {
      // brand/context.md section 8e (client-owned footage, licences, locations), 4c (releases,
      // minors, dated permission naming the client, the assets and the surfaces), 4b (a brief that
      // needs an unsubstantiated claim is refused).
      heading: 'Releases and permissions',
      paragraphs: [
        'Client-owned footage, music licences and location permissions are the client’s to grant; the studio does not assume rights it has not been given. Identifiable people on camera need a release. Identifiable minors are never used.',
        'A brief that requires a claim the client cannot substantiate is refused. The studio produces media; the client owns and substantiates every claim inside it.',
        'A client’s name, logo, quote or delivered work appears in Must Be Viral’s own marketing only with dated written permission on file that names the client, the assets and the surfaces.',
      ],
    },
    {
      // brand/context.md section 4b.
      heading: 'What we do not claim',
      paragraphs: [
        'We make no claim about reach, views, followers, engagement, leads, bookings, sales or results, and no claim about a client’s own product.',
      ],
    },
    {
      // apps/web/app/signup/page.tsx (enrollment closed, nothing collected); packages/contracts/src/
      // platform-setup.ts and platform.ts (invitation roles editor and viewer; workspace access grants);
      // public-copy.ts pricing copy (provisional catalog, charging not on, sign in starts no
      // subscription, the reviewer-seat rule of the catalog); brand/context.md section 4d (quote
      // before any run; an immutable receipt), 8d row 5 (model route, provider and cost inspectable
      // in the receipt); the quote screen's copy when generation is off ("No quote was created and
      // nothing was charged").
      heading: 'The software',
      paragraphs: [
        `A studio’s owner invites editors and viewers in the app; a brand is shared with a studio through an access grant that the brand’s owner can revoke. Accounts are not created on this site; access is requested by email to ${studioEmail}. Signing in does not start a subscription.`,
        'The plans on the plans page, Solo $49, Studio $149 and Portfolio $399 a month, are a provisional catalog. Charging is not on. The subscription does not include a production allowance. In the provisional catalog, a reviewer invited to one brand does not use an operator seat.',
        'No run starts without explicit confirmation of an unexpired quote. Every run has a receipt; once the run has finished, it does not change. For each provider job the run made, the receipt shows the model route, the provider and the cost. When generation is switched off, a run is refused with that reason and nothing stands in for it.',
      ],
    },
    {
      heading: 'The date',
      paragraphs: [
        `These terms describe the offer and the site as of ${UPDATED}. The date above is when they last changed.`,
      ],
    },
  ],
};

export const advertisingCopy: LegalPageCopy = {
  slug: 'advertising',
  title: 'Advertising and AI disclosure',
  description:
    'What Must Be Viral commits to about AI tools and the labelling of paid and synthetic content: a person directs every shoot and approves every delivered asset, synthetic imagery will be disclosed, paid placements will be labelled, and the software’s outputs carry their model route, provider and cost on the receipt.',
  updated: UPDATED,
  intro:
    'This page says what Must Be Viral commits to about AI tools and the labelling of paid and synthetic content, and what it does not promise.',
  sections: [
    whoWeAre,
    {
      // brand/context.md section 8d, rows 1 and 2; section 13 records no published tool list.
      heading: 'In the studio’s work',
      paragraphs: [
        'AI tools may be used in editing and post-production. Which tools, and at which step, is not yet published. A person directs every shoot and approves every delivered asset.',
        'A delivered asset that contains synthetic or AI-generated imagery, voice or likeness will carry a visible disclosure on the asset or in its caption, plus the platform’s own AI-content label where the platform provides one.',
      ],
    },
    {
      // brand/context.md section 8d, row 3 (placements and client ad accounts); section 9 (paid
      // acquisition stays off until attribution is verified).
      heading: 'Paid placements',
      paragraphs: [
        'No paid placement runs today. When one does, in our account or in a client’s ad account, it will name the advertiser of record and carry the platform’s required ad label, and paid partnership and sponsored content will carry the platform’s paid-partnership tag.',
      ],
    },
    {
      // brand/context.md section 8d row 4 and section 4c (no permission on file today).
      heading: 'Testimonials and portfolio',
      paragraphs: [
        'A testimonial carries its attribution and date and appears only with permission on file. No result is implied as typical.',
        'Today no client name, logo, quote or delivered clip appears on this site, because no written permission is on file.',
      ],
    },
    {
      // apps/web/public/software/software-hero.mp4 is rendered from designed HTML keyframes
      // (governance/evidence/WP-PLATFORM-UI-001/films-program-2026-10-02.md); the studio pages carry
      // no image and no video (public-copy.ts, studioHeroMedia is null).
      heading: 'On this site',
      paragraphs: [
        'The film on the software page is an animation of designed interface frames. It shows no person, place or product. The studio pages carry no photograph and no film today.',
      ],
    },
    {
      // brand/context.md section 8d row 5 and 4d; docs/ux/EXPERIENCE_CONTRACT.md (generated images
      // require user-editable descriptive text); apps/core/wrangler.jsonc (production provider runs
      // off) and brand/context.md section 6.
      heading: 'In the software',
      paragraphs: [
        'Outputs produced by the software are agent-produced. The run’s model route, provider and cost are inspectable in its receipt. A generated image needs a user-editable description before it can be approved or exported.',
        'On mustbeviral.com today, no generation run can start.',
      ],
    },
    {
      // brand/context.md section 4b.
      heading: 'What we do not promise',
      paragraphs: [
        'No promise of reach, views, followers, engagement or results, for a client or for ourselves.',
      ],
    },
    {
      heading: 'The date',
      paragraphs: [
        `This page describes what Must Be Viral discloses as of ${UPDATED}. The date above is when it last changed.`,
      ],
    },
  ],
};

export const legalPages: readonly LegalPageCopy[] = [privacyCopy, termsCopy, advertisingCopy];
