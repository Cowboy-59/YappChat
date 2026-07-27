# Production Patterns

## Scene types for course video

| Scene type | When to use | Creator effort | Viewer experience |
|---|---|---|---|
| Talking head | Teaching concepts, stories, motivation, Q&A sections | Medium (requires camera presence) | High trust, high engagement when energy is good |
| Slides with voiceover | Frameworks, step-by-step processes, data, text-heavy content | Low (no camera needed) | Clear for complex material; can feel dry if overused |
| Screencast | Software tutorials, tool walkthroughs, anything the student must replicate on screen | Low (no camera needed) | Essential for tech courses; frustrating if the presenter moves too fast |
| Text on screen (motion) | Emphasis, key terms, transitions between sections | Lowest (editing-stage addition) | High impact in short bursts; exhausting if constant |
| B-roll cutaway | Illustrating abstract concepts, preventing talking-head fatigue, covering an edit | Medium (requires sourcing or generating footage) | Adds production quality; reinforces concepts visually |
| Mixed (talking head + slide overlay) | Complex frameworks where both explanation and a visual are needed simultaneously | High | Best of both: personal presence plus visual clarity |

---

## Batch-recording strategy

Recording in batches by scene type dramatically reduces setup time and mental switching.

**Recommended batch order:**
1. Record all talking-head segments for the entire course in one session (or one session per day). Change shirts between modules if recording over multiple days.
2. Record all screencasts in a separate session after finalizing the software walkthrough order.
3. Record all slide voiceovers with slides final (re-recording voiceover after changing slides wastes time).
4. Source or generate all b-roll last, after editing reveals where cuts are needed.

**Day-of-recording checklist before pressing record:**
- [ ] Phone on Do Not Disturb
- [ ] Email and messaging apps closed or minimized
- [ ] Recording software (OBS, Loom, Descript, ScreenFlow, or similar) test-recorded for 10 seconds and played back
- [ ] Audio level check: peaks between -12dB and -6dB, no clipping
- [ ] Background tidy and consistent with previous modules
- [ ] Glass of water within reach, off camera
- [ ] Teleprompter or bullet-point notes visible (not full scripts; natural delivery beats read-aloud)

---

## Setup checklists by environment

### Home office (dedicated desk setup)

**Light:**
- Key light: ring light or softbox at 45 degrees to face, slightly above eye level, pointing down toward the face. Distance: 2-3 feet.
- Fill: use a white foam board or white wall on the opposite side to bounce light and reduce harsh shadow.
- Background: 1-2 feet behind the subject, blurred in post or kept tidy. Avoid windows behind the subject (backlight blows out the face).
- Household alternative to ring light: position desk beside a window, face the window. Overcast daylight is ideal. Use a white sheet to diffuse direct sunlight.

**Audio:**
- USB condenser mic (Blue Yeti, Audio-Technica AT2020): 6-8 inches from mouth, slightly off-axis to avoid plosives.
- Dynamic mic (Shure SM7B, MV7): 4-6 inches from mouth, directly on-axis.
- Laptop microphone: acceptable for early recordings; place the laptop 18-24 inches from your mouth, add a folded towel under it to reduce desk vibration.
- Test: record 30 seconds of silence to check for hum, fan noise, or HVAC. If present, find and eliminate the source before recording content.

**Background:**
- Clean, uncluttered, consistent across modules. Students notice if the background changes dramatically between lessons.
- Shelf with a few relevant books or props adds personality without distraction.
- Virtual backgrounds: use only with a good webcam and consistent lighting; poor lighting causes edge artifacts that look unprofessional.

---

### Outdoor or natural-light setting

**Light:**
- Ideal: overcast day, which acts as a giant softbox.
- Avoid: direct midday sun (creates harsh shadows under eyes and nose). If necessary, position so the sun is behind the camera at a low angle (early morning or late afternoon "golden hour").
- Use a reflector (or white foam board) below and in front of the face to fill in under-eye shadows.

**Audio:**
- Wind is the primary enemy. A lavalier (lapel) mic hidden under a shirt collar reduces wind noise significantly vs. a boom or USB mic.
- Avoid recording in wind above about 10mph. Use a windscreen (deadcat) on any external mic.
- Record a 10-second ambient audio sample at the location; this allows clean audio editing to fill gaps.

**Background:**
- Natural greenery, open sky, or a clean exterior wall can all work. Avoid backgrounds with unpredictable movement (busy roads, people walking past).

---

### Slides-only (no on-camera presence)

**Software:** PowerPoint, Keynote, Google Slides, Canva, or any presentation tool that allows screen recording.

**Setup:**
- Record the screen at the highest available resolution (ideally 1920x1080 or higher).
- Use a standalone microphone rather than the laptop's built-in mic if available.
- Move through slides at a deliberate pace: 30-45 seconds per slide minimum; faster feels rushed.
- Keep slides simple: one idea per slide, large text, high-contrast colors.

**Narration style:**
- Speak as if explaining to a friend, not reading. Bullet points on screen + spoken elaboration in the audio.
- Pause after advancing each slide to give the viewer a moment to read before you speak.

---

### Screencast (software walkthrough)

**Software:** Loom, Descript, ScreenFlow (Mac), Camtasia, OBS.

**Setup:**
- Display resolution: 1920x1080. Higher resolutions reduce text legibility in the recorded output.
- Close unnecessary browser tabs, notification banners, and the dock (or taskbar). The viewer will see everything on screen.
- Increase system font size and browser zoom before recording if the interface is small. Accessibility tools or browser zoom to 125-150% can help.
- Record at a deliberate pace. Pause before every click and say what you are about to do: "Now I'll click the Settings tab at the top right." This narration is critical for learners who cannot see the cursor clearly.
- Use a cursor-highlighting tool (Mousepose on Mac, Cursor Highlight on Windows) if available.

**Audio:** same as home office above.

---

## Audio troubleshooting

| Problem | Likely cause | Fix |
|---|---|---|
| Hum or buzz | Electrical interference, ground loop | Move mic away from power strips and monitors; try a different USB port |
| HVAC / fan noise | Air conditioning, computer fan | Turn off HVAC for recording session; use noise suppression in editing (iZotope RX, Krisp, Adobe Enhance) |
| Room echo / reverb | Hard surfaces, bare walls | Add rugs, curtains, or a portable vocal booth; record in a closet full of clothes |
| Plosives (pop on P and B sounds) | Mic too close, on-axis | Move mic slightly off-axis; use a pop filter |
| Volume too low | Gain set too low | Increase mic gain in system settings; move mic closer |
| Volume too loud / clipping | Gain set too high | Reduce gain; aim for -12dB to -6dB peaks |
| Inconsistent room tone | Gaps between sentences edited together | Record a 30-second "room tone" sample; use it to fill gaps in editing |

---

## Post-production notes by platform

**Teachable, Thinkific, Kajabi:** Upload MP4 at 1080p or 720p. These platforms transcode on their end. No need to upload raw footage; compressed MP4 is fine.

**Udemy:** Udemy has strict audio requirements. Minimum 96kbps audio bitrate; no background noise; no echo. Test your audio with their audio checker tool before uploading a full course.

**YouTube (for course previews or free content):** 1080p minimum for most niches. Add chapters using timestamps in the description. Closed captions improve accessibility and SEO; Descript, Otter.ai, and YouTube's own auto-captions all produce editable transcripts.

**Vimeo (private hosting):** Supports up to 4K. Lock videos with a domain-level privacy restriction so only your course platform domain can embed them.

**Self-hosted (on a website):** Hosting raw video on your own server is expensive and slow. Use a CDN-backed video host (Vimeo, Wistia, Bunny.net) and embed the player.
