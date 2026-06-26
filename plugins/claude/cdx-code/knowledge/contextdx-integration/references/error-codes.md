# Claude Code Plugin API Error Codes

## HTTP Status Codes

### 4xx Client Errors

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| 400 | Bad Request | Invalid request format or branch mismatch | Check JSON structure and field types |
| 401 | Unauthorized | Invalid or missing credentials | Verify bindingToken and apiSecret |
| 403 | Forbidden | Access denied to resource | Check binding permissions |
| 404 | Not Found | Binding not found | Verify bindingToken is correct |
| 409 | Conflict | Resource conflict | Check for duplicate node slugs |
| 422 | Unprocessable Entity | Invalid data format | Validate node/edge structure |
| 429 | Too Many Requests | Rate limit exceeded | Implement backoff, wait and retry |

### 5xx Server Errors

| Code | Name | Description | Resolution |
|------|------|-------------|------------|
| 500 | Internal Server Error | Server error | Retry after delay |
| 502 | Bad Gateway | Upstream error | Retry after delay |
| 503 | Service Unavailable | Service temporarily down | Retry with exponential backoff |
| 504 | Gateway Timeout | Request timeout | Reduce batch size, retry |

## Error Response Format

All API errors return JSON:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description",
    "details": {
      "field": "Additional context"
    }
  }
}
```

## Common Error Codes

### Authentication Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `INVALID_CREDENTIALS` | Credentials are invalid | Wrong or expired bindingToken/apiSecret | Regenerate credentials in portal |
| `MISSING_AUTH` | Auth headers missing | No X-CodePlugin-Token or X-CodePlugin-Secret | Add required auth headers |

### Validation Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `INVALID_SLUG` | Slug format invalid | Bad slug format | Use 1-200 chars, kebab-case |
| `MISSING_REQUIRED_FIELD` | Required field missing | Missing name or primitiveType | Provide required fields |
| `INVALID_ARCHETYPE` | Unknown archetype name | archetypeName not in server archetypes | Fetch archetypes first via GET /code-plugin/archetypes |
| `DUPLICATE_NODE` | Node already exists | Node slug conflict in replace mode | Use merge mode or unique slugs |
| `INVALID_EDGE_REFERENCE` | Edge references unknown node | Source or target slug not found | Sync nodes before edges |
| `BRANCH_MISMATCH` | Branch does not match binding | Payload branch differs from binding config | Use the branch configured in your binding |

### Rate Limit Errors

| Code | Message | Cause | Fix |
|------|---------|-------|-----|
| `RATE_LIMIT_EXCEEDED` | Too many requests | Hit rate limit | Wait for reset, implement backoff |
| `QUOTA_EXCEEDED` | Monthly quota exceeded | Subscription limit | Upgrade plan or wait for reset |

## Retry Strategy

### Exponential Backoff

For 429 and 5xx errors, use exponential backoff:

```
attempt 1: wait 1 second
attempt 2: wait 2 seconds
attempt 3: wait 4 seconds
attempt 4: wait 8 seconds
max retries: 4
```

### Non-Retryable Errors

Do not retry these errors:
- 400: Fix request format
- 401: Fix authentication
- 403: Fix permissions
- 404: Fix resource reference
- 422: Fix data validation

## Error Handling Best Practices

1. **Always check status code first**
2. **Parse error response for details**
3. **Log errors with context** (bindingToken, operation, timestamp)
4. **Implement retry for transient errors** (429, 5xx)
5. **Surface actionable messages to user**
6. **Store failed operations for retry** (retry on next sync)

## Debugging Tips

### Check Request

1. Verify `X-CodePlugin-Token: {bindingToken}` header
2. Verify `X-CodePlugin-Secret: {apiSecret}` header
3. Validate `Content-Type: application/json`
4. Test with minimal payload first

### Check Response

1. Read full error message
2. Check `details` field for specific issues
3. Look for `field` references in validation errors
