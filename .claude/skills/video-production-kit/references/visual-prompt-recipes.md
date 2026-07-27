# Visual Prompt Recipes

This file contains ready-to-use or adapt image and video generation prompts organized by the type of concept they illustrate. Use these as b-roll cutaways, slide visuals, or transition animations in course videos.

## How to use these prompts

Each prompt is written to work with an image or video generation tool (including Higgsfield's `generate_image` and `generate_video`). Replace the bracketed tokens with your actual subject matter. Add a style suffix at the end to match your course aesthetic.

**Style suffixes to append:**
- Clean and professional: `clean white background, minimal, editorial style, soft shadows`
- Warm and approachable: `warm tones, soft natural lighting, lifestyle photography style`
- Tech and modern: `dark background, neon accent colors, digital aesthetic, clean grid`
- Hand-drawn or illustrated: `flat illustration style, simple shapes, limited color palette`
- Motion/video: `smooth cinematic motion, shallow depth of field, 4K quality`

---

## Category 1: Frameworks and step-by-step processes

Use when the lesson teaches a numbered or sequential process.

**Prompt 1:** "An overhead flat-lay showing five cards or sticky notes arranged in a numbered sequence from left to right, each card containing a single word or short phrase, clean desk surface, [style suffix]"

**Prompt 2:** "A simple flowchart diagram on a white board or screen, showing three to five steps connected by arrows, clean minimal design, labels clearly visible, [style suffix]"

**Prompt 3:** "Time-lapse style visual of a single page being filled in step by step, from blank to complete checklist, top-down view, [style suffix]"

**Prompt 4:** "A person's hands arranging building blocks or tiles into a structured row, each block labeled, progress from left to right, [style suffix]"

**Prompt 5:** "A ladder rising from floor to a bright window, each rung labeled with a single step, clean metaphorical illustration, [style suffix]"

---

## Category 2: Comparisons and contrasts

Use when the lesson shows two approaches, before and after, or the difference between a right and wrong method.

**Prompt 1:** "A split screen showing two desks: one cluttered and disorganized on the left, one clean and minimal on the right, overhead shot, [style suffix]"

**Prompt 2:** "Two paths diverging in a clean landscape, one path straight and well-lit, one winding and shadowed, aerial view, [style suffix]"

**Prompt 3:** "Side-by-side comparison of two screens or documents, one marked with a red X, one with a green checkmark, clean and simple, [style suffix]"

**Prompt 4:** "A simple balance scale, one side weighted down with blocks labeled [concept A], the other side lighter with a block labeled [concept B], [style suffix]"

**Prompt 5:** "A before-and-after sequence: first frame showing a blank or rough version, second frame showing the refined or complete version, same framing both shots, [style suffix]"

---

## Category 3: Statistics and data concepts

Use when the lesson references a number, percentage, or research finding.

**Prompt 1:** "A large, clean typographic display of the number [X%] centered on screen, minimal background, bold sans-serif font, [style suffix]"

**Prompt 2:** "A simple bar chart rising from left to right with the tallest bar highlighted or glowing, clean data visualization style, [style suffix]"

**Prompt 3:** "A single pie chart showing a large segment labeled [concept] taking up [X] percent of the circle, clean and minimal, [style suffix]"

**Prompt 4:** "A progress bar filling from 0 to [X percent], clean UI style, dark background with bright fill color, motion suitable for video, [style suffix]"

**Prompt 5:** "An overhead shot of a notebook showing a hand-drawn graph with a rising trend line, pen visible but paused, natural lighting, [style suffix]"

---

## Category 4: Metaphors and abstract concepts

Use when the lesson introduces an idea that benefits from a visual anchor (attention, momentum, habits, systems, growth).

**Attention/focus:**
"A single spotlight illuminating one object on an otherwise dark stage, everything else in shadow, clean and dramatic, [style suffix]"

**Momentum/progress:**
"A snowball rolling down a hill, growing larger as it descends, clean white snow, motion blur on the ball, [style suffix]"

**Habits/systems:**
"Interlocking gears in motion, clean mechanical illustration, each gear labeled with a single word representing a habit or system component, [style suffix]"

**Growth:**
"A small seedling pushing through cracked dry earth toward sunlight, close-up macro shot, natural lighting, [style suffix]"

**Clarity:**
"Fog lifting over a calm lake to reveal a clear mountain reflection, dawn light, cinematic, [style suffix]"

**Overwhelm:**
"A desk covered in overlapping papers, sticky notes, and open tabs on a screen, slightly blurred and chaotic, warm overexposed tone, [style suffix]"

**Simplification:**
"A complex tangled ball of string being slowly pulled into a single straight line, clean white background, [style suffix]"

---

## Category 5: People and action

Use when the lesson covers interpersonal skills, coaching, selling, or behavioral change.

**Conversation/coaching:**
"Two people at a simple table, one listening attentively, one speaking with engaged expression, natural warm light, faces partially visible but not identifiable, [style suffix]"

**Writing/creating:**
"A hand writing on a clean notepad, close-up of the pen and paper, a few visible words but not fully legible, natural side light, [style suffix]"

**Decision-making:**
"A person standing at a fork in a road or path, viewed from behind, looking at two clear options, [style suffix]"

**Teaching:**
"A person gesturing at a whiteboard covered in simple diagrams, small group visible from behind paying attention, warm classroom light, [style suffix]"

**Achievement:**
"A single person standing at the top of a clean staircase or hill, looking forward, sunlight ahead, viewed from behind, [style suffix]"

---

## Higgsfield-specific formatting notes

When using Higgsfield's `generate_image` tool:
- Keep prompts under 200 words for best results.
- Specify aspect ratio at the end: `16:9 landscape for course video insert` or `1:1 for thumbnail element`.
- Specify the mood in one word early in the prompt: "Calm, clean overhead shot of..."
- Avoid naming specific real-world brands, logos, or living persons in prompts.
- For educational visuals, "clean", "minimal", and "editorial" tend to produce the most versatile results.

When using `generate_video`:
- Start with a static description of the opening frame, then describe the motion: "A blank notebook on a desk. Slowly, a hand enters frame from the right and begins writing, word by word."
- Motion prompts work best when the motion is simple and singular; complex multi-object motion produces inconsistent results.
- Use `upscale_video` on any clip that will appear full-screen in the course player.
- Use `reframe` to convert a 16:9 course insert to 9:16 for use in short-form course preview content on Instagram or TikTok.

---

## Virality predictor note

Higgsfield's virality predictor can evaluate the attention potential of a generated thumbnail or preview image. Use it before finalizing the visual used in your course's preview clip or sales page hero image. A score below 50 is worth regenerating; a score above 70 is strong for educational content.
