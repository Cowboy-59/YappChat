# Course Setup: Worked Example

Sample brand (for illustration only): Priya runs a ceramics studio and has been teaching in-person weekend workshops for three years. She wants to take her "Wheel Throwing for Beginners" content online.

---

## Batch 1: Brand and context

**Claude:** What is your brand or business name? What is your website or main landing page? And in one sentence: what do you do, and who do you do it for?

**Priya:**
- Brand: Turning Point Ceramics
- Website: turningpointceramics.com
- One liner: I teach people who have never touched clay how to make functional pottery on a wheel, mostly in weekend workshops in Portland.

---

## Batch 2: The course

**Claude:** What is this course about? Who is it for, specifically? And what is the one clearest outcome by the end?

**Priya:**
- Course: Wheel throwing from scratch. Starting at "what is a wheel" and ending with the student being able to center, pull, and trim a basic cylinder and a small bowl.
- Student: Adults who are curious about pottery but live outside of a city with good studios, or who want to practice at home. They might have taken one class somewhere and gotten hooked. They have no wheel yet but are thinking about buying one.
- Outcome: They can center clay and pull a cylinder without help, and they know enough to decide whether to invest in a home wheel setup.

---

## Batch 3: Format, level, price

**Claude:** How will this course be delivered? What level is it? What price point are you targeting?

**Priya:**
- Format: Self-paced video, filmed in my studio. Each lesson is 8-15 minutes. PDF reference sheets with each module.
- Level: Complete beginner.
- Price: Somewhere around $197. Maybe $247 with a workbook bundle.

---

## Batch 4: Voice and style

**Claude:** Describe your teaching style in 2-3 words. How does your teaching voice sound? And any phrases or claims to avoid?

**Priya:**
- Tone: Patient, hands-on, encouraging.
- Voice: Like a friend who has been doing this for years and genuinely wants you to get it. I explain things slowly, I show the same move from multiple angles, and I never make students feel dumb for struggling because this stuff is actually hard.
- Avoid: "Easy", "anyone can do this", "master potter" (I am not one and students aren't aiming to be one either).

---

## Batch 5: Curriculum shape

**Claude:** Roughly how many modules, how many lessons per module, and which Power Tools do you use?

**Priya:**
- About 6 modules. Maybe 4-6 lessons each. Module 1 is tools and setup, then centering, then pulling, then trimming and finishing, then glazing basics, then what to do next.
- Tools: I just connected Canva. I do not have the others yet.

---

## Batch 6: Preferences

**Claude:** Where should completed outputs be saved?

**Priya:** My desktop folder called "Course Files".

---

## Profile summary (shown to Priya before saving)

| Field | Value |
|-------|-------|
| Brand name | Turning Point Ceramics |
| Website | turningpointceramics.com |
| Niche | Beginner wheel throwing / pottery |
| Audience | Curious adults outside major cities, little or no clay experience, considering a home wheel |
| Transformation | From never touching a wheel to centering and pulling a basic cylinder and bowl independently |
| Course topic | Wheel Throwing for Beginners: center, pull, trim |
| Format | Self-paced video, 8-15 min per lesson, PDF reference sheets |
| Level | Complete beginner |
| Price point | $197-$247 |
| Tone words | Patient, hands-on, encouraging |
| Voice | A friend who has done this for years; explains slowly, shows from multiple angles, never condescending |
| Avoid | "Easy", "anyone can do this", "master potter" |
| Primary outcome | Can center clay and pull a cylinder independently; knows enough to decide on a home setup |
| Modules estimate | 6 modules, 4-6 lessons each |
| Design tool | Canva (connected) |
| Save outputs to | Desktop folder: Course Files |

---

## Saved config.json

```json
{
  "brand": {
    "brand_name": "Turning Point Ceramics",
    "website": "turningpointceramics.com",
    "niche": "beginner wheel throwing and pottery",
    "audience": "curious adults with little or no clay experience, often outside major cities, considering a home wheel setup",
    "transformation": "from never touching a wheel to centering and pulling a basic cylinder and bowl independently"
  },
  "course": {
    "topic": "Wheel Throwing for Beginners: center, pull, and trim on a pottery wheel",
    "format": "self-paced video, 8-15 min per lesson, PDF reference sheets with each module",
    "level": "complete beginner",
    "price_point": "$197-$247"
  },
  "voice": {
    "tone_words": ["patient", "hands-on", "encouraging"],
    "we_sound_like": "A friend who has done this for years and genuinely wants you to get it. Explains things slowly, shows moves from multiple angles, and never makes students feel dumb for struggling.",
    "we_never_say": "easy, anyone can do this, master potter",
    "reading_level": "simple"
  },
  "outcomes": {
    "primary_outcome": "Can center clay and pull a cylinder independently; knows enough to decide whether to invest in a home wheel setup",
    "modules_estimate": "6 modules, 4-6 lessons each"
  },
  "tools": {
    "design": "Canva",
    "ai_media": "Higgsfield",
    "planner": "Notion",
    "email": "Klaviyo"
  },
  "preferences": {
    "save_outputs_to": "Desktop folder: Course Files"
  }
}
```

---

## Next-step prompt shown after saving

"Your course profile is saved. Every other skill will read it automatically.

Your recommended next steps:
- Say **'Run the course-validator skill'** to stress-test the idea before you build.
- Or say **'Run the audience-and-outcome-definer skill'** to sharpen the student profile further.
- Or go straight to building: say **'Run the curriculum-architect skill'** and I'll build your full module plan.

To update any field later, just say 'update my course profile' and I'll walk you through it."
