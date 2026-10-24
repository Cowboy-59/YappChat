---
name: course-sales-page-writer
description: Writes a complete sales page for a course, from the headline through the call to action, including all sections, copy, and objection handling. Use when someone says "write my sales page", "I need course sales copy", "sales page for my course", "write the checkout page", "long-form sales copy", "convert visitors into students", "what goes on a course sales page", "my page isn't converting", or "I need copy for my course landing page". This is the skill to run once the course name, promise, and positioning are locked.
---

# Course Sales Page Writer

A course sales page has one job: help the right person say yes with confidence. This skill writes a complete, conversion-structured sales page from opening headline through checkout, covering every section a buyer needs to move from "curious" to "enrolled." The output is ready to paste into any course platform or landing page builder.

## First-run check

Read `config.json` at the pack root. If missing or the `brand` fields are empty, run the `course-setup` skill first. Pull: `brand.brand_name`, `brand.website`, `brand.niche`, `brand.audience`, `brand.transformation`, `course.topic`, `course.format`, `course.level`, `course.price_point`, `outcomes.primary_outcome`, `outcomes.modules_estimate`, `voice.tone_words`, `voice.we_never_say`, `voice.reading_level`.

## Inputs

Ask only for what is missing: the final course name, the one-sentence course promise (from `course-positioning-and-naming` if run), the number of modules and a brief description of what each module covers, any bonuses included, any testimonials or social proof available (even a beta student story), the price and any payment plan options, and the primary objections the target student is likely to have before buying.

## Workflow

1. **Open with the hook and hero section.** Write the headline, sub-headline, and the first 3-4 sentences of body copy. The headline must speak to the reader's current frustration or desired outcome, not to the course itself. Sub-headline adds specificity: who it is for and what they leave with. The opening sentences confirm that this is for exactly the right person and create enough interest to keep reading.

2. **Write the "you might be here" section.** Three to five bullet points describing the frustrating situations the target student is experiencing right now. These must be specific and accurate; generic frustrations create no connection. This section makes the reader feel seen.

3. **Introduce the course.** State the course name, the one-sentence promise, and the format (self-paced, live cohort, hybrid). One short paragraph. No module list yet.

4. **Write the "what's inside" section.** For each module, write the module name, a one-sentence description of what the student learns, and the key "aha moment" or takeaway. Highlight any particularly strong module as a featured deep-dive. Follow the module list with a summary of any bonuses, with a brief description of why each bonus is worth something.

5. **Write the creator credibility section.** State who the creator is, their relevant experience, and why they are the right person to teach this specific thing. Two short paragraphs. Factual and specific; no biography padding.

6. **Write the testimonial or social proof section.** If testimonials are provided, write the full formatted testimonials with attribution (name and relevant detail, e.g., "freelance designer, 18 months in"). If no testimonials are available yet, write a "what beta students said" placeholder or a "here is what you will be able to say after the course" social proof bridge.

7. **Handle the objections.** Write a dedicated FAQ or objection-handling section covering the top 3-5 barriers. Common objections: "I don't have time," "I'm not sure this will work for me," "I've tried things like this before," "Is this right for my situation?" Each answer should be honest, direct, and confident, not defensive.

8. **Write the price and value stack.** State the price clearly. If there is a payment plan, present it alongside. Build the value stack: list the course, any bonuses, and a fair individual value for each. Total the value and contrast it with the price. Keep this honest; do not inflate values beyond what the market would actually charge for the individual item.

9. **Write the call to action and guarantee section.** Primary CTA button copy (not "buy now" or "enroll"; something specific like "Start Module 1 Today" or "Join [Course Name]"). If there is a guarantee (satisfaction, results-based, or refund window), state it plainly and specifically. A 30-day refund policy stated clearly converts better than vague "risk-free" language.

10. **Close with a final decision paragraph.** Two to three sentences that speak to the reader who has read to the bottom but hasn't clicked yet. Acknowledge the decision, restate the promise, and give a clear next step. No pressure; honesty converts better than urgency theater.

## Output format

A fully written sales page in sequence, with each section labeled for easy placement in a page builder. Copy is ready to paste; no `[FILL IN]` blanks beyond items the creator must supply (such as actual testimonial names). Total length: 800-1,500 words depending on course complexity.

## File output
Deliver this as a formatted Word document (.docx), not raw markdown. Draft the content and show a short preview in chat, then build the file with the docx skill and save it to your working folder with a clear, descriptive name. Markdown is only for passing work to another skill in this pack.

## Reference library

Load these for depth when the task calls for it:
- `references/course-sales-page-structure.md`: the full section-by-section blueprint for a course sales page, with guidance on section order, length, and the conversion role of each section, plus example copy blocks for each type.

## Worked example

See `examples/sales-page-run.md` for a full run to match. Treat it as the quality target, not a script to copy verbatim.

## Quality bar

- The headline speaks to the reader's situation, not the course's features.
- The "you might be here" bullets are specific enough that the target student nods; generic enough that they do not accidentally exclude a valid buyer.
- Every module description names a benefit or takeaway, not just a topic.
- The FAQ answers objections honestly; no deflection or empty reassurance.
- The value stack is plausible; nothing is inflated to the point of eye-rolling.
- The CTA is specific and action-oriented; no generic "buy now."
- Nothing in the copy appears in `voice.we_never_say`. No hype words.
- The full page reads in a consistent voice from top to bottom; no section feels like it was written by a different person.
