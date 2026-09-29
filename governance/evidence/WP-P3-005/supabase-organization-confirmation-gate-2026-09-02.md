# Supabase organization confirmation gate — WP-P3-005

Recorded: 2026-09-02

The authenticated inventory contains the candidate organization
`cwsipbaunvifcpgoygsc`, which owns `mustbeviral-staging`. The intended new
resource is `mustbeviral-prod` in `us-east-1`.

The Supabase project-creation connector requires the user to choose the exact
organization before the project cost may be fetched. After that choice, the
current cost must be shown to the user and separately confirmed before project
creation. Generic execution authorization does not replace those provider cost
gates.

No cost was guessed, no confirmation was fabricated, and no Supabase project
was created. Production Core, web deployment, DNS, and all customer access stay
blocked until the fresh project is created, migrated, hardened, and smoke-tested.
