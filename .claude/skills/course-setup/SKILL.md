---
name: course-setup
description: Onboarding skill that interviews the course creator once and saves a complete config.json profile covering brand, course topic, audience, voice, outcomes, tools, and preferences. Every other skill in the pack reads this file automatically. Use when someone says "set up my course profile", "run setup", "start here", "I'm new to this pack", "configure the course creator", or "let's get started". This is always the first skill to run in the Course Creator pack.
---

# Course Setup

This is the front door to the Course Creator pack. It interviews you once, builds your complete course profile, and saves it to `config.json` in your working folder. Every other skill reads that file, so you never repeat yourself about your brand, your audience, your course topic, or your voice. Run this first; run everything else after.

## First-run check

Check for `config.json` in your working folder.

- If it exists and the `brand` fields are filled in: summarize the current profile in a short table and ask which sections the user wants to update. Update only those fields; leave the rest as-is.
- If it is missing or the `brand.brand_name` field is empty: run the full interview below.

## Interview structure

Ask questions in small batches (3-4 at a time), not all at once. Wait for answers before continuing. Use a conversational tone: friendly, clear, one question at a time within each batch.

### Batch 1: Brand and context

1. What is your brand or business name?
2. What is your website or main landing page? (Skip if not relevant yet.)
3. In one sentence: what do you do, and who do you do it for?

### Batch 2: The course

4. What is this course about? Give me the topic and the rough scope.
5. Who is it for, specifically? Describe your ideal student: their situation, what they are struggling with, and what they are hoping to achieve.
6. What is the one clearest outcome a student has by the end of the course?

### Batch 3: Format, level, and price

7. How will this course be delivered? (Self-paced video, live cohort, text-based, hybrid, etc.)
8. What level is it? Beginner, intermediate, advanced, or a mix?
9. What price point are you targeting? Approximate is fine.

### Batch 4: Voice and style

10. Describe your teaching style in 2-3 words. (Direct, warm, technical, story-driven, etc.)
11. How does your teaching voice sound? One or two sentences. Example: "Like a patient expert who skips the fluff and gives you the exact steps."
12. Any words, phrases, or claims you want to avoid in your course materials?

### Batch 5: Curriculum shape

13. Roughly how many modules are you planning, and how many lessons per module? (Approximate is fine.)
14. Are there any Power Tools you already use or plan to connect? (Notion, Canva, Higgsfield, Klaviyo. Say "none" if unsure.)

### Batch 6: Preferences

15. Where should completed outputs be saved? (Default: your working folder.)

## After the interview

Summarize the answers back to the user in a clean, readable table, and ask: "Does this look right? Say yes to save, or tell me what to change."

On confirmation, write `config.json` to the working folder using the structure below. Use empty strings for anything the user skipped.

## config.json structure to write

```json
{
  "brand": {
    "brand_name": "",
    "website": "",
    "niche": "",
    "audience": "",
    "transformation": ""
  },
  "course": {
    "topic": "",
    "format": "",
    "level": "",
    "price_point": ""
  },
  "voice": {
    "tone_words": [],
    "we_sound_like": "",
    "we_never_say": "",
    "reading_level": "simple"
  },
  "outcomes": {
    "primary_outcome": "",
    "modules_estimate": ""
  },
  "tools": {
    "design": "Canva",
    "ai_media": "Higgsfield",
    "planner": "Notion",
    "email": "Klaviyo"
  },
  "preferences": {
    "save_outputs_to": "your working folder, unless told otherwise"
  }
}
```

## After saving

Tell the user:
1. Their profile is saved to `config.json`. Every other skill will read it automatically.
2. The recommended next step: say `"Run the course-validator skill"` to stress-test the idea, or `"Run the audience-and-outcome-definer skill"` to sharpen the student profile, or `"Run the curriculum-architect skill"` to build the full module plan.
3. To update any field later: say "update my course profile" or edit `config.json` directly.

## File output
This skill writes `config.json` to your working folder. No document is produced.

## Reference library

Load these for depth when the task calls for it:
- `references/course-profile-guide.md`: field-by-field notes on what each config key means, how to fill it in well, and examples for common course topics and formats.

## Worked example

See `examples/course-setup-run.md` for a full interview and the resulting config.json. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- Questions come in small batches, never all at once.
- The profile summary is readable and complete before the user confirms.
- `config.json` is valid JSON with no trailing commas, smart quotes, or missing keys.
- Nothing is assumed: if the user skips a question, the field is empty rather than invented.
- The tone is warm and practical throughout. No bureaucratic phrasing.
- The next-step prompt is concrete and points to the right skill for what comes next.
- If a profile already exists, the skill updates only the fields the user asks to change.
