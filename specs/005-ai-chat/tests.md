# Test Plan: AI Chat

**Spec Number**: 005
**Date Generated**: 2026-05-24
**Spec**: [spec.md](spec.md) | **Tasks**: [tasks.md](tasks.md)

---

## Test Strategy

| Layer | Framework | Coverage Target |
|-------|-----------|-----------------|
| Unit | Vitest | Core logic, services, utilities |
| Integration | Vitest + Supertest | API endpoints, DB operations |
| E2E | Playwright | User workflows, critical paths |

---

## Unit Tests

### UT-001 — AIChatPanel root layout: slide-in animation + entry-point subscription + state preservation across open/close

**Linked Task**: T001
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | AIChatPanel root layout: slide-in animation + entry-point subscription + state preservation across open/close — happy path | Success response | pending |
| 2 | AIChatPanel root layout: slide-in animation + entry-point subscription + state preservation across open/close — validation error | Error with details | pending |
| 3 | AIChatPanel root layout: slide-in animation + entry-point subscription + state preservation across open/close — edge case | Graceful handling | pending |

### UT-002 — Session management: sidebar with new/rename/delete/search/switch wired to spec 002 APIs

**Linked Task**: T002
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Session management: sidebar with new/rename/delete/search/switch wired to spec 002 APIs — happy path | Success response | pending |
| 2 | Session management: sidebar with new/rename/delete/search/switch wired to spec 002 APIs — validation error | Error with details | pending |
| 3 | Session management: sidebar with new/rename/delete/search/switch wired to spec 002 APIs — edge case | Graceful handling | pending |

### UT-003 — Streaming SSE message rendering: token-by-token bubble growth + StreamingCursor + auto-scroll + interruption recovery

**Linked Task**: T003
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Streaming SSE message rendering: token-by-token bubble growth + StreamingCursor + auto-scroll + interruption recovery — happy path | Success response | pending |
| 2 | Streaming SSE message rendering: token-by-token bubble growth + StreamingCursor + auto-scroll + interruption recovery — validation error | Error with details | pending |
| 3 | Streaming SSE message rendering: token-by-token bubble growth + StreamingCursor + auto-scroll + interruption recovery — edge case | Graceful handling | pending |

### UT-004 — Rich content rendering: markdown + code blocks + ToolCallCard + SubagentCard + SkillResultCard + DashboardCard + ScheduleCard + FileAttachmentChip + SuggestedReplyChip

**Linked Task**: T004
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Rich content rendering: markdown + code blocks + ToolCallCard + SubagentCard + SkillResultCard + DashboardCard + ScheduleCard + FileAttachmentChip + SuggestedReplyChip — happy path | Success response | pending |
| 2 | Rich content rendering: markdown + code blocks + ToolCallCard + SubagentCard + SkillResultCard + DashboardCard + ScheduleCard + FileAttachmentChip + SuggestedReplyChip — validation error | Error with details | pending |
| 3 | Rich content rendering: markdown + code blocks + ToolCallCard + SubagentCard + SkillResultCard + DashboardCard + ScheduleCard + FileAttachmentChip + SuggestedReplyChip — edge case | Graceful handling | pending |

### UT-005 — Message input area: ChatTextInput + VoiceInputButton + AttachmentButton + SendButton + Stop-generating + character limit

**Linked Task**: T005
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Message input area: ChatTextInput + VoiceInputButton + AttachmentButton + SendButton + Stop-generating + character limit — happy path | Success response | pending |
| 2 | Message input area: ChatTextInput + VoiceInputButton + AttachmentButton + SendButton + Stop-generating + character limit — validation error | Error with details | pending |
| 3 | Message input area: ChatTextInput + VoiceInputButton + AttachmentButton + SendButton + Stop-generating + character limit — edge case | Graceful handling | pending |

### UT-006 — Keyboard shortcuts + command palette + KeyboardShortcutsOverlay

**Linked Task**: T006
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Keyboard shortcuts + command palette + KeyboardShortcutsOverlay — happy path | Success response | pending |
| 2 | Keyboard shortcuts + command palette + KeyboardShortcutsOverlay — validation error | Error with details | pending |
| 3 | Keyboard shortcuts + command palette + KeyboardShortcutsOverlay — edge case | Graceful handling | pending |

### UT-007 — Backend data model + APIs: chatattachments + userchatpreferences + attachment upload/download + preferences endpoints

**Linked Task**: T007
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Backend data model + APIs: chatattachments + userchatpreferences + attachment upload/download + preferences endpoints — happy path | Success response | pending |
| 2 | Backend data model + APIs: chatattachments + userchatpreferences + attachment upload/download + preferences endpoints — validation error | Error with details | pending |
| 3 | Backend data model + APIs: chatattachments + userchatpreferences + attachment upload/download + preferences endpoints — edge case | Graceful handling | pending |

### UT-008 — Studio handoff: detect creation intent + StudioHandoffCard + full-screen expansion + Archie pre-fill + back-to-chat collapse

**Linked Task**: T008
**Status**: pending

| # | Test Case | Expected | Status |
|---|-----------|----------|--------|
| 1 | Studio handoff: detect creation intent + StudioHandoffCard + full-screen expansion + Archie pre-fill + back-to-chat collapse — happy path | Success response | pending |
| 2 | Studio handoff: detect creation intent + StudioHandoffCard + full-screen expansion + Archie pre-fill + back-to-chat collapse — validation error | Error with details | pending |
| 3 | Studio handoff: detect creation intent + StudioHandoffCard + full-screen expansion + Archie pre-fill + back-to-chat collapse — edge case | Graceful handling | pending |

## Integration Tests

| # | Scenario | Endpoint/Flow | Expected | Status |
|---|----------|--------------|----------|--------|
| 1 | Full AI Chat workflow | End-to-end | All steps succeed | pending |
| 2 | Error handling | Error paths | Proper error responses | pending |
| 3 | Auth/permissions | Protected routes | 401/403 as expected | pending |

## E2E Tests

| # | User Story | Steps | Expected | Status |
|---|-----------|-------|----------|--------|
| 1 | Primary flow | User completes AI Chat | Success | pending |
| 2 | Error recovery | User encounters and recovers from error | Guided recovery | pending |

## Test Automation

```bash
# Run unit tests
npm run test

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

## Coverage Requirements

- Unit test coverage: >= 80%
- All acceptance criteria from spec must have at least one test
- All API endpoints must have integration tests
- Critical user flows must have E2E tests
