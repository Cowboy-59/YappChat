---
name: video-production-kit
description: Produces a complete recording plan and visual kit for a course module video, including shot list, lighting setup, b-roll and visual prompts, and faceless or voiceover options. Use when someone says "help me record my module", "I need a shot list", "what should I film", "faceless course video", "voiceover slides option", "b-roll ideas", "how to set up my recording", "I don't want to be on camera", "visual ideas for my lesson", or "production plan for my course". Reach for this skill before any recording session for any module in the course.
---

# Video Production Kit

Recording a course video without a plan wastes time and produces footage you will not use. This skill builds the exact production kit you need for each module: a recording plan that maps the lesson structure to the camera, a lighting and audio setup checklist, scene-by-scene shot notes, b-roll and visual prompts, and a faceless or voiceover option for creators who prefer to stay off-camera.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.niche`, `brand.audience`, `course.topic`, `course.format`, `course.level`, `voice.tone_words`, `tools.ai_media`, `preferences.save_outputs_to`.

## Inputs

Ask only for what is missing: the module name and number, a brief description of what this module teaches (2-4 sentences), the lesson structure if available (key talking points or steps), the creator's preferred recording style (talking head, slides with voiceover, screencast, or faceless), the recording environment (home office, professional studio, outdoors, or unknown), and any specific concerns (lighting, audio, showing face or not).

## Workflow

1. **Map the lesson to camera moments.** Take the module content and identify which parts are best shown on-screen (demonstrations, slides, frameworks) vs. spoken directly to camera (story, motivation, context). Produce a scene-by-scene map with a label for each scene type: talking-head, slide overlay, screen capture, text-on-screen, b-roll cutaway.

2. **Write the shot list.** For each scene in the map, write a one-line shot description: what is in frame, the approximate duration, and any on-screen text needed. Keep it brief enough to read at a glance during recording. Group shots so the creator can batch-record all talking-head segments together rather than starting and stopping constantly.

3. **Write the lighting and audio setup checklist.** Tailor this to the stated environment. Cover: key light position, fill or background light if useful, diffusion options with household alternatives (white sheet, window with overcast sky), microphone distance and placement, background appearance (clean wall vs. branded shelf), and one-sentence audio test instruction. Do not assume expensive gear; always give a low-cost alternative.

4. **Generate b-roll and visual prompts.** For each teaching concept in the module, write one visual prompt that could be shown as a cutaway, slide graphic, or text animation. Prompts should reinforce the concept, not just decorate it. Phrase each prompt so it could be used as an image generation prompt or a slide design brief.

5. **Build the faceless or voiceover option.** If the creator prefers no on-camera presence, adapt the shot list to a slides-and-voiceover or screencast format. Specify: what goes on each slide, when the voiceover speaks vs. when it pauses for a visual, and any animated element suggestions.

## Output format

A single production kit document per module with labeled sections: Scene Map, Shot List, Setup Checklist, B-Roll and Visual Prompts, and (if requested) Faceless Option. Format for easy reading during recording, not for presentation.

## Power Tools

If `tools.ai_media` is Higgsfield (or Higgsfield is connected), use `generate_image` to produce visual concept images for the b-roll prompts directly. For any module intro or transition animation, use `generate_video` with the scene description as the prompt. Use `upscale_video` on any generated clip that will appear in the final course. Use `reframe` to adapt landscape source clips to vertical format if the creator also distributes course previews on Instagram or TikTok. Confirm before generating any content that uses credits.

If Higgsfield is not connected, output the visual prompts as text the creator can paste into their image or video tool of choice, and point them to `connectors/POWER-TOOLS-SETUP.html` to connect Higgsfield.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/production-patterns.md`: scene-type definitions, batch-recording strategies, setup checklists for four common recording environments, audio troubleshooting, and post-production notes for common course platforms.
- `references/visual-prompt-recipes.md`: a prompt library organized by concept type (frameworks, comparisons, steps, statistics, metaphors) with 4-6 example prompts per category, style guidance for educational visuals, and Higgsfield-specific formatting notes.

## Worked example

See `examples/video-production-kit-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The scene map correctly identifies where visual demonstration adds value vs. where talking to camera is sufficient; it does not force the creator to film every moment on-camera.
- The shot list is specific enough to follow during recording but short enough to glance at; no shot description exceeds two lines.
- The setup checklist gives a low-cost alternative for every piece of gear it recommends.
- B-roll and visual prompts are concept-reinforcing, not purely decorative; each one connects to a teaching point.
- The faceless option (if requested) fully replaces the on-camera requirement without feeling like a downgrade.
- Output is organized so the creator can pick it up and start recording without re-reading the full document.
