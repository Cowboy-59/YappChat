---
name: course-to-notion
description: Organizes the full course outline and production tracker into a Notion database with pages, views, and status tracking; falls back to a ready-to-import CSV if Notion is not connected. Use when someone says "put my course in Notion", "course tracker in Notion", "production tracker", "organize my course outline", "Notion database for my course", "track my modules in Notion", "course project management", "I need a way to track course production", or "export my course to a spreadsheet". Reach for this skill once the course outline exists and the creator needs a system to manage production through to launch.
---

# Course to Notion

A course outline in your head or a doc is a plan. A course outline in a structured database is a production system. This skill takes the course content, modules, and lessons and builds a production tracker in Notion that shows what has been planned, what is being recorded, what is in editing, and what is ready to publish. For creators without Notion, it outputs a clean CSV that imports into any spreadsheet tool in two clicks.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.brand_name`, `course.topic`, `course.format`, `outcomes.modules_estimate`, `tools.planner`, `preferences.save_outputs_to`.

## Inputs

Ask only for what is missing: the full course outline (module names and lesson titles, or a description of the modules if the outline is not finalized), the estimated number of videos or lessons per module, the planned production timeline or launch date if known, and whether the creator also wants a quiz tracker or an assets tracker alongside the main module database.

## Workflow

1. **Structure the course data.** Take the course outline and organize it into a clean hierarchy: course, modules, lessons. If some lessons are not yet named, use placeholder names based on the module topic ("Module 3, Lesson 2: TBD") so the database structure is complete even if the content is not.

2. **Design the database schema.** Define the properties for the Notion database (or the CSV columns) based on what a solo course creator actually needs to track through production. Core properties: Module Number, Module Name, Lesson Number, Lesson Title, Status (To Plan, Scripting, Recording, Editing, Ready to Publish, Live), Video Length (estimated), Notes, and Due Date. Optional: Quiz Status, Assets Status, Thumbnail Status.

3. **Create the Notion database and pages.** If Notion is connected, create the course production database, add one page per lesson with all properties populated, and create three views: (a) a full table view sorted by module and lesson number, (b) a status board view grouped by Status, and (c) a by-module filtered gallery or table for the creator to focus on one module at a time. Confirm the database name and location with the creator before creating.

4. **Populate the pages.** For each lesson page, populate all available properties. Leave Notes blank or with a placeholder for the creator to fill. If quiz or asset tracking was requested, add those properties to the schema and create a corresponding view.

5. **Create the CSV fallback.** Whether or not Notion is connected, produce a clean CSV output of the full database in the same schema. This serves as a backup, an import option for other tools, and a standalone deliverable for creators who do not use Notion.

6. **Provide a setup summary.** Confirm what was created: database name, number of pages, views created, and any properties the creator should update immediately (such as the Due Date column). Include one sentence on how to use the Status board view to manage daily production.

## Output format

If Notion is connected: confirmation of the database created, views created, and page count, plus the CSV as a fallback. If Notion is not connected: the CSV as the primary output, with a structured description of the database schema so the creator can set it up in Notion manually or import the CSV into Airtable, Google Sheets, or their tool of choice.

## Power Tools

If `tools.planner` is Notion (or Notion is connected), use the Notion connector to: create the database with the defined schema using `notion-create-database`, create one page per lesson using `notion-create-pages`, and create the three views (table, status board, by-module filter) using `notion-create-view`. Fetch the created database to confirm it is correct before reporting success. Confirm the workspace location and database name with the creator before creating anything.

If Notion is not connected, produce the CSV output described in Step 5 and the schema description, and point the creator to `connectors/POWER-TOOLS-SETUP.html` to connect Notion for future use.

## File output
This output is structured data, so deliver it as a spreadsheet (.csv for a simple table, .xlsx when formulas or multiple tabs help), not markdown. Save it to your working folder with a clear name. If a connected tool is set up, file it there too and offer the spreadsheet as a fallback.

## Reference library

Load these for depth when the task calls for it:
- `references/notion-course-db-schema.md`: the full database schema specification for the course production tracker, including all property types, status options, view configurations, and notes on how to extend the schema for more complex productions (multiple creators, asset libraries, quiz databases).

## Worked example

See `examples/course-to-notion-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The database schema includes all core production tracking fields; nothing critical is missing and nothing superfluous is added.
- Every lesson in the course outline is represented as a page; no lessons are dropped or collapsed.
- Three views are created: table, status board, and by-module; the creator can use any of the three to manage a different aspect of production.
- The CSV fallback is complete, importable, and uses the same schema as the Notion database.
- The setup summary gives the creator one clear next action (e.g., "update the Due Date column" or "change the first lesson to 'Recording' status when you start recording today").
- No Notion changes are made without creator confirmation of the database name and location.
