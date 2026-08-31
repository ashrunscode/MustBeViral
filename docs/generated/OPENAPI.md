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

Schemas: `ApiErrorEnvelope`, `ApplyCanvasPatchRequest`, `ApplyCanvasPatchSuccess`, `ApproveArtifactsRequest`, `ApproveArtifactsSuccess`, `CancelRunRequest`, `CancelRunSuccess`, `CreateApiKeyRequest`, `CreateApiKeySuccess`, `CreateArtifactUploadRequest`, `CreateArtifactUploadSuccess`, `CreateCanvasRequest`, `CreateCanvasSuccess`, `CreateExportRequest`, `CreateExportSuccess`, `CreateOauthClientRequest`, `CreateOauthClientSuccess`, `CreateProjectRequest`, `CreateProjectSuccess`, `CreateWorkspaceRequest`, `CreateWorkspaceSuccess`, `ExplainModelSuccess`, `GetArtifactSuccess`, `GetCanvasContextSuccess`, `GetProjectSuccess`, `GetReceiptSuccess`, `GetRunSuccess`, `GetWorkspaceSuccess`, `HealthResponse`, `IngestFalWebhookRequest`, `IngestFalWebhookSuccess`, `IssueOauthTokenRequest`, `IssueOauthTokenSuccess`, `ListApiKeysSuccess`, `ListOauthClientsSuccess`, `ListSkillsSuccess`, `PublishSkillRequest`, `PublishSkillSuccess`, `QuoteRunRequest`, `QuoteRunSuccess`, `RevokeApiKeySuccess`, `RevokeOauthClientSuccess`, `StartRunRequest`, `StartRunSuccess`, `ValidateGraphRequest`, `ValidateGraphSuccess`.
