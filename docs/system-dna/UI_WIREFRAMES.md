# UI_WIREFRAMES.md

## Global Shell

Desktop:
- left sidebar
- top bar
- main content
- optional right agent activity drawer

Mobile:
- top brand switcher
- bottom nav
- full-screen drawers for approvals/media/post edit

## /signup

Purpose:
Create account and move directly to workspace/brand creation.

Components:
- AuthCard
- EmailPasswordForm
- OAuthButtons
- TrustCopy

Empty/loading/error:
- loading button state
- validation errors inline

## /app

Redirects to current brand command center or create-brand flow.

## /app/create-brand

Layout:
- left: short explanation and example
- right: form

Fields:
- brand name
- website URL
- social URLs
- competitors optional
- target customer optional
- logo upload optional

CTA:
Analyze My Brand

## /app/brands/:brandId/scan

Agentic scan timeline.

Components:
- ScanProgressTimeline
- EvidenceFeed
- FoundItemsPanel
- ScreenshotPreview
- ManualInterventionAlert

States:
- scanning
- blocked website fallback
- completed
- failed with retry

## /app/brands/:brandId/intelligence

Brand Intelligence Report.

Sections:
- score cards
- summary
- strengths
- weaknesses
- evidence
- target market preview
- opportunity cards
- calendar preview

CTA:
Review Calendar

## /app/brands/:brandId

Command Center.

Cards:
- Marketing Score
- Pending Approvals
- Scheduled This Week
- Agent Status
- Next 7 Days
- Top Recommendation
- Latest Report
- Growth Opportunity

No empty dashboard:
Show onboarding/start actions.

## /app/brands/:brandId/profile

Editable brand memory center.

Components:
- BrandIdentityEditor
- ServicesOffersEditor
- BrandVoiceEditor
- VisualStyleEditor
- ClaimsRulesEditor
- AiAutonomySlider
- FieldLockButton
- RegenerateFieldButton

## /app/brands/:brandId/target-market

Research report.

Components:
- AudienceSegmentCard
- PainPointMatrix
- BuyingTriggerCards
- LocalHooksList
- CompetitorPositioning
- CrossSellOpportunityCards

## /app/brands/:brandId/calendar

Views:
- Month
- Week
- Platform
- Campaign

Components:
- CalendarToolbar
- PostCard
- PostDetailDrawer
- StatusFilter
- PlatformFilter

## /app/brands/:brandId/approvals

Fast approval queue.

Components:
- ApprovalPostPreview
- ApprovalActions
- BatchApprovalToolbar
- KeyboardShortcutHelp
- MobileSwipeApproval

## /app/brands/:brandId/media

Canva-lite library.

Components:
- AssetGrid
- UploadDropzone
- AssetDetailDrawer
- VariantGenerator
- TagFilter
- ApprovalStatusFilter

## /app/brands/:brandId/creative

Creative Studio.

Modes:
- post
- campaign
- image
- carousel
- reel script
- offer
- DM reply
- report

## /app/brands/:brandId/dm

DM automation rules.

Components:
- DMRuleList
- DMRuleEditor
- FAQReplyGenerator
- LeadCaptureFields
- HumanHandoffSettings

## /app/brands/:brandId/analytics

Simple performance.

Components:
- MetricsSummary
- TopPostCard
- WorstPostCard
- AgentInterpretation
- NextWeekAdjustment

## /app/brands/:brandId/reports

Reports list + report detail.

Components:
- WeeklyReportCard
- ReportViewer
- ExportButtons
- ShareLinkButton

## /app/brands/:brandId/growth

Opportunity cards.

Components:
- OpportunityCard
- EvidencePanel
- ImpactDifficultyBadge
- CreateCampaignButton

## /app/admin

Admin command center.

Components:
- AdminMetrics
- FailedJobsTable
- AgentRunsTable
- WorkflowRunsTable
- UsageCostChart
- BillingStatusTable
- ManualInterventionQueue
