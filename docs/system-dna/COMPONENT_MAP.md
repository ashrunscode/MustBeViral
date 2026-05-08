# COMPONENT_MAP.md

## Layout

AppShell
Props: user, workspace, brand, children

SidebarNav
Props: items, activePath, collapsed

TopBar
Props: brand, score, agentStatus, pendingApprovalsCount

BrandSwitcher
Props: brands, currentBrandId, onSwitch, onCreate

WorkspaceSwitcher
Props: workspaces, currentWorkspaceId, onSwitch

CommandBar
Props: commands, onExecute

## Onboarding

CreateBrandForm
Props: workspaceId, onSubmit

ScanProgressTimeline
Props: steps, currentStep, progress

EvidenceFeed
Props: evidenceItems

BrandIntelligenceReport
Props: report, scores, opportunities

ScoreCard
Props: label, value, evidence, priority

## Brand Profile

BrandProfileEditor
Props: profile, lockedFields, onSave

EditableBrandField
Props: path, label, value, locked, onEdit, onRegenerate, onLock

AiAutonomySlider
Props: value, onChange

## Calendar

ContentCalendar
Props: posts, view, filters

PostCard
Props: post, onOpen

PostDetailDrawer
Props: post, open, onApprove, onReject, onRegenerate, onSchedule

CalendarToolbar
Props: view, filters, onChange

## Approvals

ApprovalQueue
Props: posts, onApprove, onReject, onEdit, onRegenerate

ApprovalPostPreview
Props: post

BatchApprovalToolbar
Props: selectedIds, onBatchApprove, onBatchRegenerate

## Media

MediaLibrary
Props: assets, filters

AssetGrid
Props: assets, onSelect

AssetDetailDrawer
Props: asset, onUpdate, onArchive, onGenerateVariants

UploadDropzone
Props: brandId, onUploaded

## Creative

CreativeStudio
Props: brandId, mode

ImageGenerationPanel
Props: brand, assets, onGenerate

GeneratedImageGrid
Props: images, onApprove, onReject

## DM

DMRuleList
Props: rules, onEdit

DMRuleEditor
Props: rule, onSave

## Analytics

MetricsSummary
Props: metrics

AgentInterpretation
Props: interpretation

WeeklyReportViewer
Props: report

## Growth

OpportunityCard
Props: opportunity, onCreateCampaign

## Admin

AdminDashboard
Props: metrics

FailedJobsTable
Props: jobs, onRetry

AgentRunsTable
Props: runs

UsageCostTable
Props: usageEvents
