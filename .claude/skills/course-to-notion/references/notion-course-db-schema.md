# Notion Course Production Database Schema

Complete schema specification for the Course Creator production tracker, including all property types, status options, view configurations, and extension guidance.

---

## Core Database: Course Module and Lesson Tracker

**Database name:** [Course Name] Production Tracker

**One row per lesson.** Modules are represented by a shared property (Module Number and Module Name), not as separate database entries. This keeps the tracker flat and easy to filter.

---

### Property Definitions

| Property name | Notion property type | Options / notes |
|---|---|---|
| Lesson Title | Title (required) | The main name field. Format: "Lesson [X.Y]: [Title]" e.g. "Lesson 2.3: The Financial Slide" |
| Module Number | Number | Integer. Used for sorting. |
| Module Name | Select | One option per module. Adding a new module = adding a new Select option. |
| Lesson Number | Number | Integer within the module. Module 2, Lesson 3 = Lesson Number: 3. Used with Module Number for full sort. |
| Status | Select (with color coding) | See Status Options below. |
| Video Length (Est.) | Text or Number | Estimated recording length in minutes. Can be a range ("8-12 min"). |
| Script Status | Select | Options: Not Started, In Progress, Done, N/A. |
| Recording Date | Date | The date the lesson is planned to be recorded. |
| Published Date | Date | The date the lesson went live on the course platform. |
| Quiz Status | Select | Options: Not Needed, To Build, Built, Published. Use if quiz tracking is requested. |
| Thumbnail Status | Select | Options: Not Needed, To Create, Done. Use if thumbnail tracking is requested. |
| Assets Needed | Multi-select | Options: Slides, Worksheet, Template, Cheat Sheet, Other. |
| Assets Status | Select | Options: Not Needed, To Create, Done. |
| Notes | Text (long) | Free-form notes: specific recording instructions, links to scripts, known issues. |
| Assigned To | Person | For teams. Leave empty for solo creators. |

---

### Status Options (the core tracking field)

| Status | Color | Meaning |
|---|---|---|
| To Plan | Gray | Lesson is in the outline but content has not been planned yet. |
| Scripting | Yellow | Script or talking points are being written. |
| Ready to Record | Blue | Script is done; lesson is queued for the next recording session. |
| Recording | Orange | Currently being filmed or in the recording session. |
| Editing | Purple | Footage exists; editing is in progress. |
| Ready to Publish | Green | Edited and approved; waiting to go live on the platform. |
| Live | Dark green | Published on the course platform. |
| On Hold | Red | Paused for any reason. Notes field should explain why. |

---

## Views

### View 1: Full Table (All Lessons)

**Type:** Table  
**Sort:** Module Number (ascending), then Lesson Number (ascending)  
**Filter:** None (shows all lessons)  
**Visible properties:** Lesson Title, Module Name, Status, Video Length (Est.), Recording Date, Notes  
**Purpose:** The creator's master list. Use this to see everything at once, sort by recording date, or update status after a recording session.

---

### View 2: Status Board

**Type:** Board  
**Group by:** Status  
**Sort within column:** Module Number (ascending)  
**Filter:** None  
**Visible card properties:** Lesson Title, Module Name, Recording Date  
**Purpose:** Production management. The creator drags a lesson card from "Ready to Record" to "Recording" to "Editing" as production progresses. Gives an instant visual of where everything stands.

---

### View 3: By Module

**Type:** Table  
**Sort:** Lesson Number (ascending)  
**Filter:** Module Name = [selected module]  
**Visible properties:** Lesson Title, Status, Script Status, Video Length (Est.), Notes  
**Purpose:** Focus view. When the creator is working on one module at a time, they filter to that module and see only those lessons. Create one saved view per module for the highest-traffic modules if needed.  
**Note:** Create this view for the first two modules by default. The creator can duplicate and re-filter for additional modules.

---

## Optional Extended Schema

### Extension 1: Quiz Database (linked)

If the course has quizzes per module, create a separate linked database: Course Quiz Tracker.

| Property | Type | Notes |
|---|---|---|
| Quiz Title | Title | "Module [X] Quiz" |
| Module | Relation | Links to the module entry in the main tracker |
| Status | Select | To Build, In Review, Published |
| Question Count | Number | Number of questions in the quiz |
| Pass Threshold | Number | Percentage |
| Platform | Select | Teachable, Kajabi, Thinkific, Google Forms, Other |
| Last Updated | Date | |

---

### Extension 2: Asset Library (linked)

For courses with significant downloadable assets (worksheets, templates, cheat sheets).

| Property | Type | Notes |
|---|---|---|
| Asset Name | Title | Descriptive name |
| Asset Type | Select | Worksheet, Template, Slide Deck, Cheat Sheet, Checklist |
| Related Lesson | Relation | Links to the lesson in the main tracker |
| Status | Select | To Create, In Design, Done |
| File Link | URL | Link to the file in Drive, Dropbox, or Canva |
| Notes | Text | |

---

### Extension 3: Launch Tracker (standalone)

A separate database for the launch plan, not linked to the production tracker. Useful if the creator runs the `course-launch-planner` skill and wants to track the launch in the same Notion workspace.

| Property | Type | Notes |
|---|---|---|
| Action | Title | Name of the launch action (e.g., "Pre-launch email 1") |
| Phase | Select | Pre-launch, Open Cart, Urgency Close, Post-launch |
| Channel | Select | Email, LinkedIn, Instagram, Community |
| Planned Date | Date | |
| Status | Select | To Do, In Progress, Done |
| Subject or Title | Text | Email subject line or post title |
| Notes | Text | |

---

## CSV Format Specification

When the Notion connector is not available, output the production tracker as a CSV in this format:

```
Module Number,Module Name,Lesson Number,Lesson Title,Status,Video Length Est.,Script Status,Recording Date,Published Date,Notes
1,Getting Started,1,Welcome and Overview,To Plan,5-8 min,Not Started,,, 
1,Getting Started,2,How to Use This Course,To Plan,3-5 min,Not Started,,,
...
```

**Import notes:**
- Google Sheets: File > Import > Upload. Separator: comma. All columns import as text by default; change Recording Date and Published Date to date format after import.
- Airtable: Add new base > Import spreadsheet. Column types will need to be set manually after import (Status should be a Single Select).
- Notion CSV import: Notion's CSV import creates a basic table. Status options will not be pre-colored; the creator must set status options and colors manually after import. The full database creation via the Notion connector produces the fully formatted version.
- Excel: Data > From Text/CSV. Comma-separated.

---

## Recommended Notion workspace structure

For creators adding this database to an existing Notion workspace:

```
[Course Name] HQ
  ├── Production Tracker (this database)
  ├── Quiz Tracker (optional, linked)
  ├── Asset Library (optional, linked)
  ├── Launch Plan (optional, from course-launch-planner)
  └── Notes and References (free-form page for scripts, research, ideas)
```

Create a top-level page called "[Course Name] HQ" as the parent, then add the databases inside it. This keeps the course-specific work contained and separate from the rest of the creator's Notion workspace.
