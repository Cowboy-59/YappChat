---
name: course-launch-planner
description: Builds the complete enrollment launch plan for a course, covering the pre-launch warm-up, cart open period, and urgency close, with specific timing, content beats, and email sequences. Use when someone says "plan my course launch", "launch strategy", "how do I launch my course", "enrollment sequence", "cart open plan", "launch emails", "pre-launch content", "how many emails do I send", "launch timeline", or "I'm opening enrollment soon". Reach for this skill once the course is built and the sales page exists; positioning and naming should already be locked.
---

# Course Launch Planner

A course launch is a planned, sequenced event, not a single "enrollment is open" post. This skill builds the full enrollment plan: what happens before the cart opens (the warm-up that creates intent), what happens during the open cart period (the conversion window), and how to close with honesty and urgency. The output is a day-by-day schedule with content beats, email subjects, and timing so nothing is improvised during the most important week of the course cycle.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.brand_name`, `brand.niche`, `brand.audience`, `brand.transformation`, `course.topic`, `course.price_point`, `course.format`, `outcomes.primary_outcome`, `voice.tone_words`, `voice.we_never_say`, `tools.email`, `tools.planner`, `preferences.save_outputs_to`.

## Inputs

Ask only for what is missing: the planned cart open date, the planned cart close date (or the length of the open window), the size of the email list and any segmentation available, whether there is a waitlist, any bonuses tied to the launch (early-bird pricing, founding student bonuses, or limited bonuses), and the primary promotional channel (email, social, or both).

## Workflow

1. **Set the launch window structure.** Define the three phases based on the cart open and close dates provided: pre-launch warm-up (ideally 7-14 days before cart open), open cart period (recommend 5-7 days for most course launches), and close window (the final 24-48 hours with urgency emphasis). If the creator has given dates that compress the launch, note the trade-off and adjust the content plan accordingly.

2. **Plan the pre-launch warm-up.** The warm-up builds intent before the sales conversation begins. It is not selling; it is educating, relating, and creating the right context for the offer. Write 3-5 pre-launch content beats (one per day or every 2 days): the topic for each beat, the format (email, social post, or both), and the one job each beat does (introduce the problem, reframe the solution, share a belief, tease the course). No hard selling until cart open.

3. **Plan the open cart email sequence.** Write the full day-by-day email plan for the open cart window. Minimum: cart open email, a value or objection email mid-window, and a closing sequence (last-day or last-48-hours). For each email, write: the send day and time, the subject line (2-3 options), the single job that email does, and 2-3 key points to cover. This plan feeds directly into the email drafts the creator writes or into the `student-success-engine` skill if email drafts are needed.

4. **Plan the urgency close.** The close is the 24-48 hours before cart shut. Write the specific urgency element (deadline, limited spots, bonus expiry, price increase), the close email sequence (at minimum: 24-hour warning and final-hours email), and the subject line options for each. Urgency must be real; fabricated scarcity creates distrust and refunds.

5. **Build the day-by-day launch schedule.** Produce a clean table or timeline showing: every day from pre-launch start through cart close, the action (email, social post, community message), the subject line or post title, and whether it requires the email platform, social platform, or both.

6. **Post-launch: the quick debrief.** Include a one-page debrief checklist to run within 48 hours of cart close: enrollment numbers vs. goal, which email had the highest click rate, any purchase objections heard in replies or DMs, and one change to make next launch. This becomes the input for the next iteration.

## Output format

A structured launch plan document with labeled sections: Launch Window Summary, Pre-Launch Warm-Up Plan, Open Cart Email Sequence, Urgency Close Plan, Day-by-Day Schedule, and Post-Launch Debrief Checklist.

## Power Tools

If `tools.email` is Klaviyo (or Klaviyo is connected), use the email connector to create DRAFT campaigns for each email in the open cart sequence. Create one flow for the open cart sequence and one for the urgency close. Never schedule or send; create drafts only. Confirm the flow structure with the creator before creating. If Klaviyo is not connected, output the email plan as a structured document the creator can paste into their email platform, and point them to `connectors/POWER-TOOLS-SETUP.html`.

If `tools.planner` is Notion (or Notion is connected), use Notion to create a launch calendar database with each day and action as a page, a status property (To Do, In Progress, Done), and a launch phase tag. Confirm before creating. If Notion is not connected, output the schedule as a clean markdown table.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/launch-runway-for-courses.md`: full frameworks for pre-launch, open cart, and close phases, with timing models for different list sizes, content-beat templates, and urgency strategies that do not feel manipulative.

## Worked example

See `examples/launch-planner-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The launch plan has all three phases: pre-launch warm-up, open cart, and urgency close. No single-email launches.
- Pre-launch content teaches or relates; it does not sell before the cart is open.
- Every email in the open cart sequence has a single job; no email tries to do three things at once.
- Urgency is real, stated plainly, and not manufactured. If there is no deadline, do not pretend there is one.
- The day-by-day schedule is specific enough to execute without interpretation; every day has a clear action.
- The post-launch debrief is included; the creator should not just move on without capturing learnings.
- Nothing in the plan uses `voice.we_never_say` or hype language.
