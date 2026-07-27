---
name: student-success-engine
description: Writes onboarding emails, completion nudge emails, and community prompts that keep students engaged and finishing the course. Use when someone says "onboarding email for my students", "welcome email", "completion rate is low", "students aren't finishing", "keep students engaged", "nudge emails", "community prompts", "re-engagement for students", "check-in emails", or "how do I get students to complete the course". Reach for this skill after enrollment is live, to build the student experience that turns buyers into completers.
---

# Student Success Engine

Enrollment is the beginning of the relationship, not the end of it. Most course completion rates are low not because the content is bad but because students get busy, lose momentum, or quietly fall behind without anyone noticing. This skill builds the email and community infrastructure that keeps students moving: a strong onboarding sequence, well-timed nudge emails at the most common drop-off points, and community prompts that create connection and accountability without requiring the creator to be always on.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.brand_name`, `brand.audience`, `brand.transformation`, `course.topic`, `course.format`, `outcomes.primary_outcome`, `outcomes.modules_estimate`, `voice.tone_words`, `voice.we_never_say`, `voice.reading_level`, `tools.email`, `preferences.save_outputs_to`.

## Inputs

Ask only for what is missing: the number of modules in the course, the estimated time to complete the course, the course platform (Teachable, Kajabi, Thinkific, or other), whether there is a community attached (Facebook group, Circle, Discord, Slack, or none), the primary drop-off point if known (e.g., most students quit after Module 2), and any specific milestones the creator wants to celebrate with students.

## Workflow

1. **Write the onboarding sequence (Day 0-7).** The first seven days after enrollment are the highest-engagement window. Write 3 onboarding emails: the welcome email (immediate, Day 0), the "how to get started" email (Day 2), and the commitment email (Day 5 or 7). Each email has a single job. Include the subject line, a brief content outline, and the key call to action.

2. **Map the completion journey and identify drop-off risks.** Based on the number of modules and the total course length, identify the two or three most likely drop-off points (typically: after the first module, at the halfway point, and in the final stretch before completion). For each, write a nudge email and a community prompt that acknowledges the reality of the moment without guilt-tripping.

3. **Write the nudge email sequence.** For each drop-off point, write a short, warm re-engagement email: subject line, 3-4 sentences of content, and one clear next action. These emails should feel like a check-in from a person who genuinely wants the student to succeed, not like an automated marketing message.

4. **Write the milestone celebration messages.** For each major milestone (completing Module 1, the halfway point, the final module), write a brief celebration message: either a platform notification, a reply-to email, or a community post from the creator. These are short (3-5 sentences) and specific to what the student just accomplished.

5. **Write the community prompts.** For courses with a community component, write 7-10 prompts for the creator to post weekly. Mix prompt types: progress check-ins, reflection questions, skill-application challenges, peer feedback requests, and celebration posts. Each prompt should invite a response that is easy to write (low friction, high connection).

6. **Write the completion and graduation message.** The final email a student receives when they complete the course. This email matters more than most creators realize: it is the moment to celebrate the transformation, invite a testimonial, and offer the logical next step (whether that is a related resource, a community, or an upsell to the next course).

## Output format

A structured document with labeled sections: Onboarding Sequence (3 emails with subject lines and outlines), Drop-Off Map with Nudge Emails, Milestone Celebration Messages, Community Prompts (7-10), and Completion Message. All copy is ready to paste or adapt; no generic placeholders beyond what requires the creator's specific content.

## Power Tools

If `tools.email` is Klaviyo (or Klaviyo is connected), use the email connector to create DRAFT flows for the onboarding sequence and the nudge sequence. Create each as a separate flow with appropriate time delays set as drafts (onboarding: Day 0, Day 2, Day 5; nudge: based on inactivity trigger). Never activate or send; create drafts only. Confirm the flow structure before creating. If Klaviyo is not connected, output the full email copy as a structured document the creator can import or paste into their platform, and point them to `connectors/POWER-TOOLS-SETUP.html`.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/completion-tactics.md`: the research and frameworks behind course completion, common drop-off patterns by course length, accountability mechanisms, community design principles, and the creator behaviors that most reliably improve completion rates.
- `references/student-email-map.md`: a full map of every student-facing email touchpoint from purchase through graduation, with purpose, timing, and example copy for each, plus trigger and segmentation notes for email platforms.

## Worked example

See `examples/student-success-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The onboarding sequence has 3 emails and each has a single, clear job; no email tries to do onboarding and upselling and community-building all at once.
- Nudge emails feel like a check-in from a real person, not an automated reminder. No guilt language, no "you've been missing in action."
- Community prompts vary by type; not every prompt is a progress check-in.
- The completion message celebrates specifically what the student accomplished, invites a testimonial, and offers a clear next step.
- All copy matches `voice.tone_words` and avoids `voice.we_never_say`.
- Timing is realistic for the course length; nudges are not sent before a student could reasonably have fallen behind.
