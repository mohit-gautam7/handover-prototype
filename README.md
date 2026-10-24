# Handover: clickable prototype

**Live demo:** https://mohit-gautam7.github.io/handover-prototype/ (or download this repository and open `index.html`; it works offline).

**Open `index.html` in any modern browser** (Chrome, Edge, Firefox, Safari): double-click it, or drag it onto a browser window. There's no install, no account, no internet and no server. It is plain HTML, CSS and JavaScript (`index.html` plus the `assets` folder).

Handover finds the people whose carer vanished in the Snap. It asks "Did they look after anyone?" whenever someone reports a vanished person. It then prioritises the dependent by how soon they could come to harm, sends a verified local responder, and closes the case only when a named adult takes over care with a care card.

## Five views, one set of data
Use the dark bar at the top to switch. What you do in one view shows up in the others.

| View | What you can do |
|---|---|
| **Family** | The public site. Report someone in 3 steps with a live priority preview, verify your phone with a code, track progress, read the texts we sent, add a stand-in later, tell us **an adult is with them now**, and edit or **print the care card**. There's a **Larger text** switch, plus Safety and About pages. |
| **Report by SMS** | The same report as a text conversation, for basic phones and congested networks. Reply `STATUS` or `STANDIN` afterwards. |
| **Stand-in** | The stand-in's phone: the code text, a big code screen to show at the door, the care card, the 72-hour check-in reply, and **"I can't take this on"**. |
| **Responder** | A queue sorted by time left, with filters and a **map view**. You can **release** a case with a reason if you can't go. Children's cases need a partner and the safeguarding steps before accepting. The address appears only after accepting. Then the door check, the coded handover (a wrong code blocks it), hospital or other-adult options, and the not-found path. |
| **Coordinator** | A ward board with no-responder alerts, the case table or a **ward map**, a **live activity feed** and **Simulate a surge**. Case details offer priority changes with a required reason, asking a specific responder, address views that are logged, handling flags, and **starting a new handover** when a carer can't continue. Plus phone checks, the five metrics from the written case with an **hour-by-hour chart**, and the audit log with weekly audit calls. |

## A 3-minute walkthrough
Press **Demo guide** (yellow button) for thirteen one-click scenarios. To do it by hand:
1. **Family → Ask for a check on someone → Fill with example.** Meera reports her sister Kavita, who looked after 3-year-old Aarav. On step 2, change the age or the answers and watch the priority change. On step 3, press **Text me a code** and type the code shown.
2. **Responder → Aarav → pick a partner → Accept.** Then **I'm at the door → Yes → OK for now → Stand-in**. Type a wrong code first, then the right one.
3. **See what the family sees**, then **See the stand-in's phone → Preview the 72-hour check-in**.
4. **Coordinator → Kabir → Change the priority** with a reason. Then open **Phone checks** and **Metrics**.
5. Press **+1 hour** twice: Mr Khan has now had no contact for 12 hours, so his case moves up a level and his family is texted.

## Known limitations
- **All data is fictional and lives only in this browser** (localStorage). Nothing is sent anywhere: no real SMS, calls, maps or logins. **Reset demo data** restores the starting state, and the seeded cases refresh after 3 hours.
- One responder persona (Asha R.), one coordinator (Priya N.) and four fictional wards. Distances are fixed per ward, not GPS.
- The Hindi care note and its translation (Mrs Rao, HO-2372) are pre-written to show how translated notes are displayed. No machine translation runs here.
- Re-handover is included as a preview. The written case plans it for after day one.
- Not built: voice line and importing vulnerable-person registers. These are "Next" items in the written case.
- Map pins are placed at random inside the right ward on a schematic map. There's no GPS or real geography.
- The triage windows are pilot settings, not clinical guidance.
