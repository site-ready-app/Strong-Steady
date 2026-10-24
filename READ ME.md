# Strong & Steady

A gamified exercise app for over-70s. It's an Android app first, and is built so an iPhone version can follow later. The exercises come from the NHS strength, balance, flexibility and sitting exercise guides, with gentle seated versions for chair-only users.

## What's in it (version 1.0)
- **Three daily stars:**
  - **Move:** reach the step goal, or log 15 minutes of activity.
  - **Strength:** do a Strength or Chair session.
  - **Steady:** do a Balance or Stretch session.

  All three earn the person's chosen treat ("You've earned a G&T tonight!").
- **Streaks.** One rest day a week doesn't break a streak, and unwell days are protected. Milestones at 3, 7, 14, 30, 60, 100, 150, 200 and 365 days, with the big treat from 7 days.
- **Points and ranks:** Starter → Stepper → Walker → Rambler → Hiker → Trailblazer → Pathfinder → Fell walker → Mountaineer → Legend.
- **Journey along Hadrian's Wall (84 miles).** About 2,400 steps count as a mile, plus half a mile for each session. There are 11 postcards with facts at the landmarks.
- **22 badges**, including Steady Eddie, Comeback and All-rounder.
- **A monthly check-up** with three tests: 30-second chair stands, 30-second arm curls, and a four-stage balance test. Personal bests are celebrated.
- **Messages from family** (written or recorded) that pop up at big moments.
- **Guided sessions:**
  - Spoken instructions, counting and hold timers.
  - The screen stays on during a session.
  - An "I feel unwell" button on every screen.
  - Levels 1–3: after "Too easy" twice in a row, the app offers more repetitions.
- **"I'm unwell" mode** (today only, or until better). It pauses reminders and protects the streak, and gives a gentle GP/111 note after 7 days.
- **The person's own day:**
  - They choose their get-up time, exercise time and reminder cut-off.
  - Reminders come at the exercise time and about 2.5 hours later (at most two a day), and only if they haven't exercised yet.
  - The second reminder mentions a quiet step count.
  - If 5 of their last 7 sessions were at least an hour away from the set time, and within an hour of each other, the app suggests moving the reminder. If they say no, it doesn't ask again for 4 weeks.
- **Look:** large, clear text (Atkinson Hyperlegible) with an extra-large option. Three colour themes, plus light and dark modes.
- **Reward games (v1.1).** Any exercise session unlocks the games until midnight. On an unwell day they're unlocked anyway. Play is unlimited, and new games open as the player's rank rises:
  - **Starter:** Connect the dots. Grids go from 5×5 to 8×8 as more puzzles are solved, opening at 5, 15 and 30 puzzles.
  - **Walker:** Solitaire (Klondike, turn one card). Tap a card to move it; unlimited undo, hints, and "Finish for me".
  - **Rambler:** Word of the day, plus unlimited practice words.
  - **Hiker:** Sudoku, in easy, medium and hard. Every puzzle has a single solution. Mistakes can be shown, and hints are available.
  - **Trailblazer:** Picture puzzle. Swap the pieces to rebuild the picture, in 3×3, 4×4 or 5×5. It uses four built-in scenes or one of their own photos.
- **Privacy:** everything stays on the phone. There's a backup and restore option in More.

## Folders
| Item | What it is |
|---|---|
| `app/` | The app's screens and logic (index.html, app.js, data.js, style.css, fonts, icons). Edit these. |
| `docs/` | Built from `app/` by `tools/build_web.py`. The Android app is packaged from here, and GitHub Pages can serve it as a web version. |
| `native/` | The Android-only parts: step counting, reminders, speech, sharing, icons and splash screen. |
| `tools/` | `build_web.py`, `make_icons.py`, and `patch_android.js` (run by the GitHub build). |
| `.github/workflows/android.yml` | GitHub builds the Android app each time a change is pushed, and puts the APK on the Releases page. |
| `signing/` | **The app's signing key. Keep it safe and never upload it to GitHub** (`.gitignore` excludes it). Without it, the app can't be updated. |

## How steps are counted
They come from the phone's own step sensor, so no other app is needed. The phone is sampled when the app opens and about every 15 minutes in the background. Counting starts from the day the app is installed.

On Oppo phones (ColorOS), allow the app to run in the background: Settings → Battery → More settings → Optimise battery use → Strong & Steady → Don't optimise. Or go to App info → Battery usage → Allow background activity. The app shows these steps after setup, and from More → "Let reminders through the battery saver".

## Sources
- NHS, Strength and flexibility exercises: sitting, strength, balance and flexibility exercises.
- NHS, Physical activity guidelines for older adults: 150 minutes a week, plus strength and balance on 2 days.
- Bradford Teaching Hospitals NHS Foundation Trust, home exercise guidance (when to stop).
- National Trails, Hadrian's Wall Path (84 miles, six stages).
- The check-up tests are the standard 30-second chair stand, 30-second arm curl and 4-stage balance tests used with older adults.

## Version history
- **v1.0**, 24 Oct 2026: first build.
- **v1.1**, 24 Oct 2026: added the five reward games and a Games tab. Settings moved to the ⚙️ button at the top. Tested with a win in each game and no errors.
