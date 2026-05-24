# Spec 006: Document and Media Generation Engine

## Overview

The Document & Media Generation Engine produces files on demand — PDFs, Excel spreadsheets, PowerPoint presentations, and AI-generated images — from content provided by the Personal Assistant, a YappChat user, or an automated workflow.

It is a backend service with a simple REST API. Callers post content and a format; the engine renders the file and returns a download link. Small files are returned synchronously; larger documents run as background jobs with status polling.

**Output formats**: PDF (`.pdf` via `@react-pdf/renderer`, MIT) for reports/proposals/invoices/summaries; Excel (`.xlsx` via `exceljs`, MIT) for data exports/dashboards/financial models; PowerPoint (`.pptx` via `pptxgenjs`, MIT) for presentations/slide decks/pitches; Image (PNG/JPG via OpenAI DALL-E 3 or any registered image provider) for AI-generated visuals/diagrams/cover art.

The engine also manages **document templates** — reusable layouts and styles that callers reference by template key. Templates can be system-bundled (e.g., `report-standard`, `invoice-basic`, `pitch-deck`) or user-defined.

Callers in YappChat that use this engine: **Spec 002 (PA)** generates presentations and reports from AI-assembled content with `callbackurl` for async delivery. **Spec 004 Studio** exports skill/agent definitions as PDF reports. **Spec 005 AI Chat** exports session transcripts as PDF. **Spec 007 (Avatar)** uses `POST /api/gen/image-edit` for photo-to-avatar style conversion; the caller's `userid` is forwarded for `genlog` and daily-limit attribution. **Skills (spec 004)** can call this engine directly and return `fileurl` to the PA.

**Scope Boundary** — IN SCOPE: PDF, Excel, PPTX, and AI image generation (text-to-image AND image-to-image); document template management (system + user-defined); async job queue with status polling + callbacks; file storage with signed-URL downloads and TTL expiry; download links delivered via spec 001 chat or direct API response; generation log with 90-day retention. OUT OF SCOPE: real-time collaborative editing; version control of generated files; document parsing / OCR; video generation; music generation; uploaded-document parsing (that is spec 005 attachment handling).

## Phase

**Current Phase**: design
**Priority**: high

## Status

- **Date**: 2026-05-24
- **Phase**: design
