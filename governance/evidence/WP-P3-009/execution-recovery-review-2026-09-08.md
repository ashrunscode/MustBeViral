# V2 execution recovery review

Source checkout: `C:/dev/MustBeViral`, branch `codex/viralgraph-cleanroom`,
HEAD `8578e9353d15d9539ab9c9010706ce3e7bce2a4e`. One worktree. Node 24.18.0,
pnpm 11.12.0. The user's current mandate is full V2 completion with engineering
and UI/UX judgment delegated to the agent. This receipt does not invent approval
of missing public-traffic, legal, financial or code-owner gates.

## Recovery findings

- Grok's first two owner-smoke steps are already complete; do not repeat provisioning.
- The original observation evidence has gaps described in the observation rollup.
- The external execution layer has 28 specs and 26 successor files. Its supplied
  mechanical checker passed. Passing that checker does not validate behavioral
  assumptions or prove the platform is complete.
- The WP-P3-010 successor is schema-valid and covers all four transition paths.
  Its five steps, acceptance and quality checks are pending. It is prepared as
  `successor-WP-P3-010.yaml` here, but is not activated.
- Current accepted authority still defers the agency/connected-publishing pivot.
  The owner-approved external plan has a governance amendment stage for that pivot.
  Applying runtime features before that stage would skip its required authority change.

## Sequence defects

1. **PR author and reviewer identity.** WP-P3-010 requires an approved code-owner
   review from `ashrunscode`. The configured GitHub CLI is authenticated as that
   same account, and `.github/CODEOWNERS` names it as sole owner. GitHub does not
   allow a PR author to approve their own PR. Establish a legitimate distinct
   author/reviewer path or explicitly amend the authorization procedure through
   the project's governance process. Do not impersonate a reviewer or weaken
   branch protection. Reference: <https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/approving-a-pull-request-with-required-reviews>.
2. **Database repair ordering.** The plan requires WP-P3-010 Quality green while
   deferring database repairs to WP-P3-011. The actual Quality workflow includes
   `database-pgtap`. At the recovered HEAD, Governance run 33921461621 passed and
   Quality run 33921461611 failed. Resolve the ordering or exact named-job wording
   without ignoring the database failure or weakening required checks.
   The run's `quality` job succeeded; `database-pgtap` failed. Its retained logs
   show `uuid = text` in settlement suite 00029 at line 140, denied access to
   `oauth_access_tokens` in suite 00032 at line 223, and `FORBIDDEN` in collaboration
   suite 00034 at line 119. These are verified inherited failures, not new tests.
3. **Finish precondition.** The bootstrap's “every step completed” wording is wrong
   for an `in_progress` predecessor: the actual transition validator requires its
   final step to remain current; finish closes it. Use the repository implementation.
4. **Observation probes.** The zero-row foundation cannot satisfy the external
   spec's successful empty-context/quote assumptions. Use supported authenticated
   denial checks and carry honest contract differences into a revised procedure.
5. **Plan graph drift.** The external dependency graph was rebuilt from the packet
   contracts: 902 nodes and 1,954 edges, including all 202 repository steps and all
   29 owner-lane items. Structural checks found no missing dependencies, cycles,
   or falsely ready nodes. The specs contain 568 decisions while the decision
   register has 565; WP-P4-008 D19–D21 are unregistered. No actual finish date or
   elapsed external review period is inferred from effort estimates.

## Release posture

No production deployment, migration, DNS change, provider execution, customer
admission or payment is authorized by this recovery receipt. Full V2 completion
still requires the implementation chain, required checks, supported provider
connections, customer/payment evidence, and the separate public release gates.

The corrected observation procedure and fresh baseline are recorded. The next
bounded action is to capture the replacement window's required daily checks,
starting September 9 around 03:18:11Z. Its earliest close is September 11 at
03:18:11Z; the original window remains unproven. The owner's separate traffic
ruling is pending on `traffic-decision-draft.md`. No additional owner approval is
needed for the already authorized replacement observation reads.
