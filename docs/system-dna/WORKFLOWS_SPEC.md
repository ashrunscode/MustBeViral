# WORKFLOWS_SPEC.md

## Common Workflow Rules

All workflows must:
- log start/end/error to workflow_runs
- report progress to MarketingAgent
- use idempotent steps
- retry external calls
- store intermediate results when expensive
- expose admin rerun
- create manual intervention tasks on hard failure

## BrandOnboardingWorkflow

Inputs:
```ts
type BrandOnboardingInput = {
  brandId: string;
  workspaceId: string;
  websiteUrl?: string;
  socialUrls: Record<string, string>;
  competitorUrls?: string[];
  targetCustomerHint?: string;
};
```

Steps:
1. validate-inputs
2. load-brand
3. create-agent-state
4. fetch-website
5. browser-render-scan
6. screenshot-key-pages
7. extract-services-offers
8. extract-brand-voice
9. extract-visual-style
10. scan-socials
11. scan-competitors
12. target-market-research
13. create-brand-profile
14. create-marketing-scores
15. create-content-pillars
16. generate-calendar
17. generate-post-drafts
18. generate-image-prompts
19. generate-first-images
20. create-approval-items
21. create-intelligence-report
22. update-brand-status
23. report-complete

Retry:
- fetch: 3
- browser: 2
- model: AI Gateway fallback
- image: 2

Failure:
- continue if social scan fails
- continue if Browser Run blocked using fetch fallback
- create manual intervention if critical website unavailable

## ContentCalendarWorkflow

Inputs:
- brandId
- startDate
- endDate
- platforms
- objective
- constraints

Outputs:
- content_calendar row
- content_posts rows
- post_variants rows
- generated_creatives placeholders if images pending

## ImageGenerationWorkflow

Inputs:
- brandId
- postIds
- modelPreference
- styleGuide
- referenceAssetIds

Steps:
1. load posts
2. load brand assets
3. choose model
4. generate images
5. store original in R2
6. create variants
7. attach creatives
8. update post status

## ApprovalSchedulingWorkflow

Inputs:
- brandId
- postIds
- provider

Steps:
1. validate approvals
2. validate provider
3. schedule each post
4. store external IDs
5. retry failures
6. manual export fallback

## WeeklyReportWorkflow

Steps:
1. collect weekly posts
2. collect analytics
3. collect DM events
4. identify best/worst posts
5. interpret performance
6. generate next-week plan
7. write weekly_reports row
8. create PDF/export
9. update agent memory

## GrowthOpportunityWorkflow

Steps:
1. load brand profile
2. load market report
3. load analytics
4. load competitor scans
5. generate opportunities
6. dedupe existing
7. store opportunities
8. notify user

## DMAutomationSetupWorkflow

Steps:
1. load FAQs/offers/hours
2. generate triggers
3. draft replies
4. compliance review
5. approval wait if sensitive
6. push to provider or store manual
7. log setup status
