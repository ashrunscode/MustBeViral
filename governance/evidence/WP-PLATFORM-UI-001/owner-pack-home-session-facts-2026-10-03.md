# Owner input: home-page session-cookie facts

Run: codex-finish-20261002

D3's candidate implementation keeps cookie-free sales and legal requests free of Supabase session work and Set-Cookie. An existing Supabase Auth cookie on either home page invokes getClaims in the proxy to preserve the prior verified redirect to Studio. That response is private and may forward a refreshed or cleared existing Auth cookie. Other sales and legal routes do not refresh the session. Missing configuration, failed claims and invalid subjects never establish identity. This is source and synthetic-regression evidence until the D3 release record proves the deployed behavior.

The current privacy copy makes the broader assertion that the sales and legal pages set no cookies. It also describes essential Supabase Auth cookies for signed-in visitors. A8 freezes all other legal wording, so D3 changes only the source-reference comments in legal-copy.ts and leaves every visitor-facing legal sentence and date intact. This pack supplies technical facts for owner and legal review; it does not draft a legal paragraph or give legal advice.

The exact clearing sentence is: Authorize an accurate facts-only clarification in /privacy that guest sales and legal pages set no cookies, while the home pages may refresh an existing Supabase Auth session for the verified Studio redirect; keep all other legal wording unchanged.

Verification sources are apps/web/src/lib/supabase/proxy.ts and its proxy.test.ts regressions for guest paths, valid and invalid claims, repeated cookie bridging and overlapping requests. No remote sign-in, Auth query, database write or customer identity is needed to review this input.
