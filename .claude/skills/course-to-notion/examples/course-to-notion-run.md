# Worked Example: Course to Notion

Sample brand (for illustration only): Ingrid Larsson is a UX researcher who is building a 4-module course, "Research Without a Budget," for junior designers at startups who need to run user research with zero allocated resources. She has Notion connected and wants a production tracker, a quiz tracker, and a status board. Launch is in 6 weeks.

---

## Inputs provided

- **Course outline:**
  - Module 1: Why Research Still Works Without a Budget (2 lessons)
  - Module 2: Five Methods You Can Run Today (3 lessons)
  - Module 3: Analyzing What You Find (2 lessons)
  - Module 4: Sharing Results That Get Acted On (3 lessons)
- **Lessons per module:** As above
- **Production timeline:** 6 weeks to launch
- **Additional trackers requested:** Quiz tracker

---

## Notion Database Creation

**Creating:** "Research Without a Budget" Production Tracker in Ingrid's Notion workspace.
**Confirmed location:** "[Course Name] HQ" parent page.

---

## Database Schema Applied

**Core properties added:**
- Lesson Title (Title), Module Number (Number), Module Name (Select), Lesson Number (Number), Status (Select with 8 options), Video Length Est. (Text), Script Status (Select), Recording Date (Date), Published Date (Date), Quiz Status (Select), Notes (Text)

**Status options configured with colors:** To Plan (gray), Scripting (yellow), Ready to Record (blue), Recording (orange), Editing (purple), Ready to Publish (green), Live (dark green), On Hold (red)

---

## Pages Created (10 lesson pages)

| Module | Lesson | Title | Status |
|---|---|---|---|
| 1 | 1 | Lesson 1.1: Why "No Budget" Is Not an Excuse | To Plan |
| 1 | 2 | Lesson 1.2: What You Can Learn Without Spending Anything | To Plan |
| 2 | 1 | Lesson 2.1: Guerrilla Usability Testing | To Plan |
| 2 | 2 | Lesson 2.2: Hallway Interviews That Actually Teach You Something | To Plan |
| 2 | 3 | Lesson 2.3: Mining Existing Feedback (Reviews, Tickets, Slack) | To Plan |
| 3 | 1 | Lesson 3.1: Affinity Mapping Without a Whiteboard | To Plan |
| 3 | 2 | Lesson 3.2: Finding the Pattern That Matters | To Plan |
| 4 | 1 | Lesson 4.1: The One-Page Research Summary | To Plan |
| 4 | 2 | Lesson 4.2: Presenting Findings to a Skeptical Team | To Plan |
| 4 | 3 | Lesson 4.3: Making Recommendations That Get Implemented | To Plan |

---

## Views Created

**View 1: Full Table** (all 10 lessons, sorted by Module Number then Lesson Number)
Properties visible: Lesson Title, Module Name, Status, Video Length Est., Recording Date, Notes

**View 2: Status Board** (grouped by Status, cards show Lesson Title and Module Name)
Current state: all 10 lessons in the "To Plan" column. As production progresses, lessons will be dragged to "Scripting," "Ready to Record," and so on.

**View 3: By Module (Module 1 and Module 2 pre-filtered)**
Two saved views created: "Module 1 Only" and "Module 2 Only." Ingrid can duplicate the filter for Modules 3 and 4.

---

## Quiz Tracker (secondary database)

**Database:** Research Without a Budget - Quiz Tracker (4 rows, one per module)

| Quiz | Module | Status | Question Count | Pass Threshold | Platform |
|---|---|---|---|---|---|
| Module 1 Quiz | Module 1 | To Build | TBD | 75% | Teachable |
| Module 2 Quiz | Module 2 | To Build | TBD | 75% | Teachable |
| Module 3 Quiz | Module 3 | To Build | TBD | 75% | Teachable |
| Module 4 Quiz | Module 4 | To Build | TBD | 75% | Teachable |

Linked to the main tracker via the Module Name property.

---

## CSV Fallback (Full Production Tracker)

```
Module Number,Module Name,Lesson Number,Lesson Title,Status,Video Length Est.,Script Status,Recording Date,Published Date,Notes
1,Why Research Still Works Without a Budget,1,Lesson 1.1: Why No Budget Is Not an Excuse,To Plan,8-12 min,Not Started,,,
1,Why Research Still Works Without a Budget,2,Lesson 1.2: What You Can Learn Without Spending Anything,To Plan,10-15 min,Not Started,,,
2,Five Methods You Can Run Today,1,Lesson 2.1: Guerrilla Usability Testing,To Plan,12-18 min,Not Started,,,
2,Five Methods You Can Run Today,2,Lesson 2.2: Hallway Interviews That Actually Teach You Something,To Plan,10-15 min,Not Started,,,
2,Five Methods You Can Run Today,3,Lesson 2.3: Mining Existing Feedback (Reviews Tickets Slack),To Plan,10-12 min,Not Started,,,
3,Analyzing What You Find,1,Lesson 3.1: Affinity Mapping Without a Whiteboard,To Plan,12-15 min,Not Started,,,
3,Analyzing What You Find,2,Lesson 3.2: Finding the Pattern That Matters,To Plan,10-12 min,Not Started,,,
4,Sharing Results That Get Acted On,1,Lesson 4.1: The One-Page Research Summary,To Plan,8-10 min,Not Started,,,
4,Sharing Results That Get Acted On,2,Lesson 4.2: Presenting Findings to a Skeptical Team,To Plan,12-15 min,Not Started,,,
4,Sharing Results That Get Acted On,3,Lesson 4.3: Making Recommendations That Get Implemented,To Plan,10-12 min,Not Started,,,
```

---

## Setup Summary

**Created:**
- 1 production tracker database, 10 lesson pages, 3 views (Full Table, Status Board, 2 By-Module filters)
- 1 quiz tracker database, 4 module entries
- CSV fallback (above)

**Your immediate next actions:**
1. In the Full Table view, add estimated video lengths for each lesson in the "Video Length Est." column. Even a rough range (8-12 min) helps you plan your recording schedule.
2. Set Recording Dates for the lessons you plan to record first. With 6 weeks to launch, recording Modules 1 and 2 in the first two weeks is a realistic pace.
3. When you start scripting a lesson, drag it from "To Plan" to "Scripting" in the Status Board. This gives you a live picture of where your production stands.
4. Use the `quiz-and-assessment-builder` skill to write quizzes for each module, then update the Quiz Status column as each is built.

**Using the Status Board for daily production:** Open the Status Board view at the start of each work session. Anything in "Ready to Record" is your recording queue. After filming, drag those lessons to "Editing." After editing, drag to "Ready to Publish." The board shows your bottleneck at a glance.
