# API_CONTRACTS.md

## Conventions

- All responses are JSON.
- All authenticated routes require session/JWT.
- All write routes validate with Zod.
- All brand routes check workspace membership.
- Admin routes require `admin`.

## Response Shapes

Success:
```json
{ "success": true, "data": {} }
```

Error:
```json
{
  "success": false,
  "error": {
    "code": "string",
    "message": "string",
    "details": {}
  }
}
```

## Key Routes

### POST /api/auth/signup
Body:
```json
{ "email": "user@example.com", "password": "secret", "name": "Ernie" }
```

### POST /api/workspaces
Body:
```json
{ "name": "Ernie Workspace" }
```

### POST /api/brands
Body:
```json
{
  "workspaceId": "id",
  "name": "Wash Bodega",
  "websiteUrl": "https://example.com",
  "industry": "laundromat",
  "socialUrls": {
    "instagram": "https://instagram.com/example",
    "x": "https://x.com/example",
    "facebook": "https://facebook.com/example",
    "google_business": "https://maps.google.com/..."
  }
}
```

### POST /api/brands/:brandId/onboarding/start
Starts BrandOnboardingWorkflow.

### GET /api/brands/:brandId/brand-intelligence
Returns:
- scores
- summary
- findings
- evidence
- opportunities
- calendar preview

### GET /api/brands/:brandId/profile
Returns latest brand profile.

### PATCH /api/brands/:brandId/profile
Updates editable brand profile fields.

### POST /api/brands/:brandId/calendar/generate
Starts ContentCalendarWorkflow.

### GET /api/brands/:brandId/posts
Query:
- status
- platform
- calendarId
- startDate
- endDate

### POST /api/posts/:postId/approve
Body:
```json
{ "note": "Looks good" }
```

### POST /api/posts/:postId/reject
Body:
```json
{ "reason": "Too generic" }
```

### POST /api/posts/:postId/regenerate
Body:
```json
{ "instructions": "Make it more local and practical" }
```

### POST /api/posts/:postId/schedule
Body:
```json
{ "provider": "manual", "scheduledAt": "2026-05-10T14:00:00Z" }
```

### POST /api/brands/:brandId/assets/upload
Multipart upload.

### POST /api/brands/:brandId/assets/generate-image
Body:
```json
{ "prompt": "string", "postId": "optional", "modelPreference": "fast|default|premium" }
```

### POST /api/brands/:brandId/dm-rules
Body:
```json
{
  "platform": "instagram",
  "triggerType": "keyword",
  "triggerValue": "price",
  "responseTemplate": "Here are our current options...",
  "requiresApproval": true
}
```

### POST /api/brands/:brandId/reports/generate
Starts WeeklyReportWorkflow.

### POST /api/growth-opportunities/:id/create-campaign
Creates campaign and associated content plan.

### GET /api/admin/overview
Admin overview.

### /mcp
Read-only MCP endpoint.
