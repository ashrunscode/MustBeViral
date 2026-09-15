---
doc_id: generated-openapi
---

# DO NOT EDIT — Generated OpenAPI reference

Source: `packages/contracts/openapi/core.v1.json` (OpenAPI 3.1.0, contract 2026-07-12).

| Method | Path | Operation | Contract |
|---|---|---|---|
| `GET` | `/health` | `get_health` | Get service health |
| `POST` | `/v1/workspaces` | `create_workspace` | Create workspace |
| `GET` | `/v1/workspaces/{id}` | `get_workspace` | Get workspace |
| `POST` | `/v1/workspaces/{id}/projects` | `create_project` | Create project |
| `GET` | `/v1/projects/{id}` | `get_project` | Get project |
| `POST` | `/v1/projects/{id}/canvases` | `create_canvas` | Create canvas |
| `GET` | `/v1/canvases/{id}` | `get_canvas_context` | Get canvas context |
| `POST` | `/v1/canvases/{id}/patches` | `apply_canvas_patch` | Apply canvas patch |
| `POST` | `/v1/canvases/{id}/validate` | `validate_graph` | Validate graph |
| `POST` | `/v1/canvases/{id}/quotes` | `quote_run` | Quote run |
| `POST` | `/v1/quotes/{id}/runs` | `start_run` | Start run |
| `GET` | `/v1/runs/{id}` | `get_run` | Get run |
| `POST` | `/v1/runs/{id}/cancel` | `cancel_run` | Cancel run |
| `POST` | `/v1/artifacts/uploads` | `create_artifact_upload` | Create artifact upload |
| `GET` | `/v1/artifacts/{id}` | `get_artifact` | Get artifact |
| `POST` | `/v1/runs/{id}/approvals` | `approve_artifacts` | Approve artifacts |
| `POST` | `/v1/runs/{id}/exports` | `create_export` | Create export |
| `GET` | `/v1/models/{id}` | `explain_model` | Explain model |
| `GET` | `/v1/runs/{id}/receipt` | `get_receipt` | Get receipt |
| `POST` | `/v1/webhooks/fal` | `ingest_fal_webhook` | Ingest fal webhook |
| `POST` | `/v1/oauth/token` | `issue_oauth_token` | Issue oauth token |
| `POST` | `/v1/workspaces/{id}/api-keys` | `create_api_key` | Create api key |
| `GET` | `/v1/workspaces/{id}/api-keys` | `list_api_keys` | List api keys |
| `POST` | `/v1/api-keys/{id}/revoke` | `revoke_api_key` | Revoke api key |
| `POST` | `/v1/workspaces/{id}/oauth-clients` | `create_oauth_client` | Create oauth client |
| `GET` | `/v1/workspaces/{id}/oauth-clients` | `list_oauth_clients` | List oauth clients |
| `POST` | `/v1/oauth-clients/{id}/revoke` | `revoke_oauth_client` | Revoke oauth client |
| `POST` | `/v1/workspaces/{id}/skills/publish` | `publish_skill` | Publish skill |
| `GET` | `/v1/workspaces/{id}/skills` | `list_skills` | List skills |
| `GET` | `/v1/workspaces/:workspaceId/skills/:skillId/versions` | `list_skill_versions` | List skill versions |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/studios` | `list_brand_studios` | List brand studios |
| `GET` | `/v1/studios/{studio_id}/team` | `list_studio_team` | List studio team |
| `GET` | `/v1/studios/{studio_id}/access` | `get_studio_access` | Get studio access |
| `POST` | `/v1/studios/{studio_id}/workspaces/{workspace_id}/brands/{brand_id}/onboarding` | `initialize_brand_draft` | Initialize brand draft |
| `POST` | `/v1/studios/{studio_id}/brand-drafts` | `start_brand_draft` | Start brand draft |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/onboarding` | `get_brand_draft` | Get brand draft |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/onboarding` | `save_brand_draft` | Save brand draft |
| `GET` | `/v1/studios/{studio_id}/brands` | `list_studio_brands` | List studio brands |
| `GET` | `/v1/studios/{studio_id}/workspaces/{workspace_id}/brands/{brand_id}/access` | `get_brand_access` | Get brand access |
| `GET` | `/v1/workspaces/{workspace_id}/projects/{project_id}/brand` | `resolve_project_brand` | Resolve project brand |
| `POST` | `/v1/studios/{studio_id}/invitations` | `create_studio_invitation` | Create studio invitation |
| `GET` | `/v1/studios/{studio_id}/invitations` | `list_studio_invitations` | List studio invitations |
| `GET` | `/v1/studio-invitations` | `list_my_invitations` | List my invitations |
| `POST` | `/v1/studio-invitations/{invitation_id}/accept` | `accept_studio_invitation` | Accept studio invitation |
| `POST` | `/v1/studios/{studio_id}/invitations/{invitation_id}/revoke` | `revoke_studio_invitation` | Revoke studio invitation |
| `GET` | `/v1/workspaces/{workspace_id}/settings` | `get_workspace_settings` | Get workspace settings |
| `PATCH` | `/v1/workspaces/{workspace_id}/settings` | `update_workspace_settings` | Update workspace settings |
| `GET` | `/v1/workspaces/{workspace_id}/billing` | `get_workspace_billing` | Get workspace billing |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/website` | `start_website_capture` | Start website capture |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/documents` | `start_document_capture` | Start document capture |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}/upload-claim` | `claim_document_upload` | Claim document upload |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-drafts/manual` | `start_manual_knowledge_draft` | Start manual knowledge draft |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/latest` | `list_latest_source_job` | List latest source job |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}` | `get_source_job` | Get source job |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/sources` | `list_brand_sources` | List brand sources |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/sources/{source_id}` | `get_brand_source` | Get brand source |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-draft` | `get_knowledge_draft` | Get knowledge draft |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-candidates/{candidate_id}` | `correct_knowledge_candidate` | Correct knowledge candidate |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-extract` | `extract_brand_knowledge` | Extract brand knowledge |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-proposals` | `propose_brand_knowledge` | Propose brand knowledge |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/assertions/{assertion_id}` | `correct_brand_assertion` | Correct brand assertion |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-questions` | `ask_brand_knowledge_questions` | Ask brand knowledge questions |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-questions/{question_id}` | `answer_brand_knowledge_question` | Answer brand knowledge question |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/brand-versions/approve` | `approve_brand_version` | Approve brand version |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/brand-version-pins` | `pin_brand_version` | Pin brand version |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/knowledge-review` | `get_knowledge_review` | Get knowledge review |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/brand-versions` | `list_brand_versions` | List brand versions |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/brand-versions/{brand_version_id}` | `get_brand_version` | Get brand version |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/brand-version-pins/{pin_key}` | `get_brand_version_pin` | Get brand version pin |
| `POST` | `/v1/studios` | `create_studio` | Create studio |
| `GET` | `/v1/studios` | `list_studios` | List studios |
| `GET` | `/v1/studios/{studio_id}` | `get_studio` | Get studio |
| `PATCH` | `/v1/studios/{studio_id}` | `update_studio` | Update studio |
| `POST` | `/v1/studios/{studio_id}/archive` | `archive_studio` | Archive studio |
| `POST` | `/v1/studios/{studio_id}/members` | `set_studio_member` | Set studio member |
| `GET` | `/v1/studios/{studio_id}/members` | `list_studio_members` | List studio members |
| `POST` | `/v1/studios/{studio_id}/members/{user_id}/revoke` | `revoke_studio_member` | Revoke studio member |
| `POST` | `/v1/workspaces/{workspace_id}/studio-grants` | `grant_workspace_access` | Grant workspace access |
| `POST` | `/v1/workspaces/{workspace_id}/studio-grants/{grant_id}/revoke` | `revoke_workspace_access` | Revoke workspace access |
| `GET` | `/v1/studios/{studio_id}/workspace-grants` | `list_workspace_access_grants` | List workspace access grants |
| `POST` | `/v1/workspaces/{workspace_id}/brands` | `create_brand` | Create brand |
| `GET` | `/v1/workspaces/{workspace_id}/brands` | `list_brands` | List brands |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}` | `get_brand` | Get brand |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}` | `update_brand` | Update brand |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/archive` | `archive_brand` | Archive brand |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/locations` | `create_brand_location` | Create brand location |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/locations` | `list_brand_locations` | List brand locations |
| `GET` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}` | `get_brand_location` | Get brand location |
| `PATCH` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}` | `update_brand_location` | Update brand location |
| `POST` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/locations/{location_id}/archive` | `archive_brand_location` | Archive brand location |
| `PUT` | `/v1/workspaces/{workspace_id}/brands/{brand_id}/source-jobs/{job_id}/content` | `put_source_job_content` | Put source job document bytes |

Schemas: `AcceptStudioInvitationPlatformRequest`, `AcceptStudioInvitationPlatformResponse`, `AnswerBrandKnowledgeQuestionPlatformRequest`, `AnswerBrandKnowledgeQuestionPlatformResponse`, `ApiErrorEnvelope`, `ApplyCanvasPatchRequest`, `ApplyCanvasPatchSuccess`, `ApproveArtifactsRequest`, `ApproveArtifactsSuccess`, `ApproveBrandVersionPlatformRequest`, `ApproveBrandVersionPlatformResponse`, `ArchiveBrandLocationPlatformRequest`, `ArchiveBrandLocationPlatformResponse`, `ArchiveBrandPlatformRequest`, `ArchiveBrandPlatformResponse`, `ArchiveStudioPlatformRequest`, `ArchiveStudioPlatformResponse`, `AskBrandKnowledgeQuestionsPlatformRequest`, `AskBrandKnowledgeQuestionsPlatformResponse`, `CancelRunRequest`, `CancelRunSuccess`, `ClaimDocumentUploadPlatformRequest`, `ClaimDocumentUploadPlatformResponse`, `CorrectBrandAssertionPlatformRequest`, `CorrectBrandAssertionPlatformResponse`, `CorrectKnowledgeCandidatePlatformRequest`, `CorrectKnowledgeCandidatePlatformResponse`, `CreateApiKeyRequest`, `CreateApiKeySuccess`, `CreateArtifactUploadRequest`, `CreateArtifactUploadSuccess`, `CreateBrandLocationPlatformRequest`, `CreateBrandLocationPlatformResponse`, `CreateBrandPlatformRequest`, `CreateBrandPlatformResponse`, `CreateCanvasRequest`, `CreateCanvasSuccess`, `CreateExportRequest`, `CreateExportSuccess`, `CreateOauthClientRequest`, `CreateOauthClientSuccess`, `CreateProjectRequest`, `CreateProjectSuccess`, `CreateStudioInvitationPlatformRequest`, `CreateStudioInvitationPlatformResponse`, `CreateStudioPlatformRequest`, `CreateStudioPlatformResponse`, `CreateWorkspaceRequest`, `CreateWorkspaceSuccess`, `ExplainModelSuccess`, `ExtractBrandKnowledgePlatformRequest`, `ExtractBrandKnowledgePlatformResponse`, `GetArtifactSuccess`, `GetBrandAccessPlatformRequest`, `GetBrandAccessPlatformResponse`, `GetBrandDraftPlatformRequest`, `GetBrandDraftPlatformResponse`, `GetBrandLocationPlatformRequest`, `GetBrandLocationPlatformResponse`, `GetBrandPlatformRequest`, `GetBrandPlatformResponse`, `GetBrandSourcePlatformRequest`, `GetBrandSourcePlatformResponse`, `GetBrandVersionPinPlatformRequest`, `GetBrandVersionPinPlatformResponse`, `GetBrandVersionPlatformRequest`, `GetBrandVersionPlatformResponse`, `GetCanvasContextSuccess`, `GetKnowledgeDraftPlatformRequest`, `GetKnowledgeDraftPlatformResponse`, `GetKnowledgeReviewPlatformRequest`, `GetKnowledgeReviewPlatformResponse`, `GetProjectSuccess`, `GetReceiptSuccess`, `GetRunSuccess`, `GetSourceJobPlatformRequest`, `GetSourceJobPlatformResponse`, `GetStudioAccessPlatformRequest`, `GetStudioAccessPlatformResponse`, `GetStudioPlatformRequest`, `GetStudioPlatformResponse`, `GetWorkspaceBillingPlatformRequest`, `GetWorkspaceBillingPlatformResponse`, `GetWorkspaceSettingsPlatformRequest`, `GetWorkspaceSettingsPlatformResponse`, `GetWorkspaceSuccess`, `GrantWorkspaceAccessPlatformRequest`, `GrantWorkspaceAccessPlatformResponse`, `HealthResponse`, `IngestFalWebhookRequest`, `IngestFalWebhookSuccess`, `InitializeBrandDraftPlatformRequest`, `InitializeBrandDraftPlatformResponse`, `IssueOauthTokenRequest`, `IssueOauthTokenSuccess`, `ListApiKeysSuccess`, `ListBrandLocationsPlatformRequest`, `ListBrandLocationsPlatformResponse`, `ListBrandSourcesPlatformRequest`, `ListBrandSourcesPlatformResponse`, `ListBrandStudiosPlatformRequest`, `ListBrandStudiosPlatformResponse`, `ListBrandVersionsPlatformRequest`, `ListBrandVersionsPlatformResponse`, `ListBrandsPlatformRequest`, `ListBrandsPlatformResponse`, `ListLatestSourceJobPlatformRequest`, `ListLatestSourceJobPlatformResponse`, `ListMyInvitationsPlatformRequest`, `ListMyInvitationsPlatformResponse`, `ListOauthClientsSuccess`, `ListSkillVersionsSuccess`, `ListSkillsSuccess`, `ListStudioBrandsPlatformRequest`, `ListStudioBrandsPlatformResponse`, `ListStudioInvitationsPlatformRequest`, `ListStudioInvitationsPlatformResponse`, `ListStudioMembersPlatformRequest`, `ListStudioMembersPlatformResponse`, `ListStudioTeamPlatformRequest`, `ListStudioTeamPlatformResponse`, `ListStudiosPlatformRequest`, `ListStudiosPlatformResponse`, `ListWorkspaceAccessGrantsPlatformRequest`, `ListWorkspaceAccessGrantsPlatformResponse`, `PinBrandVersionPlatformRequest`, `PinBrandVersionPlatformResponse`, `ProposeBrandKnowledgePlatformRequest`, `ProposeBrandKnowledgePlatformResponse`, `PublishSkillRequest`, `PublishSkillSuccess`, `PutSourceJobContentPlatformResponse`, `QuoteRunRequest`, `QuoteRunSuccess`, `ResolveProjectBrandPlatformRequest`, `ResolveProjectBrandPlatformResponse`, `RevokeApiKeySuccess`, `RevokeOauthClientSuccess`, `RevokeStudioInvitationPlatformRequest`, `RevokeStudioInvitationPlatformResponse`, `RevokeStudioMemberPlatformRequest`, `RevokeStudioMemberPlatformResponse`, `RevokeWorkspaceAccessPlatformRequest`, `RevokeWorkspaceAccessPlatformResponse`, `SaveBrandDraftPlatformRequest`, `SaveBrandDraftPlatformResponse`, `SetStudioMemberPlatformRequest`, `SetStudioMemberPlatformResponse`, `StartBrandDraftPlatformRequest`, `StartBrandDraftPlatformResponse`, `StartDocumentCapturePlatformRequest`, `StartDocumentCapturePlatformResponse`, `StartManualKnowledgeDraftPlatformRequest`, `StartManualKnowledgeDraftPlatformResponse`, `StartRunRequest`, `StartRunSuccess`, `StartWebsiteCapturePlatformRequest`, `StartWebsiteCapturePlatformResponse`, `UpdateBrandLocationPlatformRequest`, `UpdateBrandLocationPlatformResponse`, `UpdateBrandPlatformRequest`, `UpdateBrandPlatformResponse`, `UpdateStudioPlatformRequest`, `UpdateStudioPlatformResponse`, `UpdateWorkspaceSettingsPlatformRequest`, `UpdateWorkspaceSettingsPlatformResponse`, `ValidateGraphRequest`, `ValidateGraphSuccess`.
