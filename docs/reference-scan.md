# Lala Luna Land — Reference Scan

What Lala sent, what each one actually is, and what we take from it.

---

## The headline finding

**All three games she sent are cozy life sims. None of them is an endless runner.**

Infinity Nikki, Moonlight Peaks, and Teddy's Haven share a spine:

- No fail state. You cannot lose.
- Collection and customization are the reward loop.
- Third-person, walk-around, free exploration.
- The pleasure is *dwelling* in a place, not beating it.
- Sessions are long and unhurried.

An endless runner is the opposite of all five. It has a fail state, its reward loop is score, it's on rails, the pleasure is reflex, and sessions are ninety seconds.

That doesn't mean the runner is wrong. But it means the hub island we built — walking around, reading notes, finding things — is closer to what she's pointing at than the running stage is. That is a real decision to put in front of her, not a detail.

---

## 1. Infinity Nikki

*Infold / Papergames, Dec 2024. Free-to-play, PS5 / PC / iOS / Android.*

### What it is
An open-world dress-up adventure. <cite index="3-1">Clothing sets called Ability Outfits grant unique abilities that help the player explore the world, overcome challenges, and gather materials, alongside platforming, puzzle-solving, life simulation, crafting, and minigames.</cite>

### The core mechanic worth stealing
Outfits *are* abilities. <cite index="10-1">Nikki's key abilities in the open world — floating, purifying, cleaning, bug catching — are linked to her outfits.</cite> You don't unlock a skill, you unlock a look, and the look does something.

This maps onto Lala Luna Land almost perfectly and she may not have realized it:

| Island | Outfit | Ability |
|---|---|---|
| Green / 4 Letters | Green dress, white hat, brown boots | **Hand fans** — glide, or push back rain |
| Good Riddance | Dinosaur-island gear | Climb / dig |
| Sanity | Ocean-front night look | Swim, or see in the dark |
| Town Square | Glitter princess cow print | Social / trade — opens doors NPCs won't |

Her four songs already have four outfits attached. Turning each outfit into a traversal ability is the single strongest structural idea available to this project, and it's already latent in her notes.

### Tone
<cite index="11-1">The gameplay is built around relaxed exploration, puzzle-solving, and outfit-granted abilities rather than combat, with an art style and emotional tone focused on warmth, healing, and self-expression.</cite> <cite index="9-1">It deliberately rejects the over-sexualization common to gacha games, offering non-sexualized fashion and a design sensibility built from a feminine perspective.</cite>

That last point matters for a high-school-and-early-college fanbase. It's the correct posture for this project and worth stating out loud as a design principle.

### Art and color
Unreal Engine 5, high-key pastel palette — sun-bleached greens, blush pink, mint, cream, gold. Soft global illumination, everything slightly overexposed and glowing. <cite index="7-1">Advanced shading and lighting won it the 2025 Apple Design Award for Visuals and Graphics.</cite> Enormous cloth simulation investment: <cite index="7-1">custom skeletal-chain and cloth solvers keep garments from clipping the body during dramatic movement while preserving the intended silhouette.</cite>

### The honest caution
This is a several-hundred-person team on UE5 with bespoke physics research. **We cannot match this and shouldn't try.** What we take is the *idea* (outfit = ability) and the *palette direction* (high-key, warm, glowing), not the fidelity.

---

## 2. Moonlight Peaks

*Little Chicken / XSEED, July 2026. PC, Switch, Google Play. $34.99.*

### What it is
<cite index="2-1">A supernatural life sim where you play a vampire in a magical town — raising mystical crops, learning spell-casting and potion-making, and befriending or romancing local werewolves, witches, and mermaids.</cite> You're Dracula's child who ran away from home, trying to prove to a skeptical father that the undead can live with compassion.

### Why this one matters most for branding
It is *already* the moon-and-night aesthetic Lala is building toward, executed well and commercially. The name alone — Moonlight Peaks vs. Lala Luna Land — tells you they're drawing from the same well.

**This is also the competitive-set warning.** If her game reads as "cozy moon game," this is what it gets compared to. Our differentiator has to be the thing they can't have: *it's her music, her voice, her islands.* Lean into the artist connection, not the genre.

### Art and color
<cite index="13-1">A cute, cartoonish chibi art style with a moody gothic color palette.</cite> <cite index="18-1">Stylized sculpting with hand-painted textures, built to run within the performance limits of platforms like the Nintendo Switch.</cite>

That last clause is the useful one for us. Hand-painted textures on stylized low-poly models is a *deliberately cheap* pipeline chosen for performance — and it's the closest of the three to what's achievable in Three.js in a browser.

Palette: desaturated plum and aubergine, deep teal night, cool grey-blue fog, with warm lamp-yellow and candle-orange as the only saturated accents. Almost exactly the palette we're already using.

### The mechanic worth stealing
<cite index="13-1">Two selectable character portrait styles — a semi-realistic stylized look and an anime-influenced one — letting players pick the art direction they prefer.</cite> Shipping two art styles is expensive, but the underlying insight is cheap to apply: **let LUNA-tics customize how Lala looks.** Even three hat colors and four dress colors would generate enormous social sharing for near-zero engineering.

### Scale check
Eighty-plus hours of content, a full studio, a major publisher, an art book, a soundtrack DLC. Not our scope. But its *look* is within reach.

---

## 3. Teddy's Haven

*Teddy Bear Games LLC, May 2025. Early Access, $14.99.*

### What it is
<cite index="1-1">A cozy shop sim on the island of Ursa — sell over 400 items, decorate with 250+ decorations, meet mythical creatures, level up skills, and harvest the land.</cite>

### Why this is the most important reference of the three
**It's one person.** Solo developer, self-published, $14.99, <cite index="1-1">Overwhelmingly Positive with 95% of 2,532 reviews positive.</cite>

And the release model is exactly what I proposed for the island-per-single rollout. <cite index="1-1">The developer's stated reason for Early Access is creative freedom and community-driven development — building the game with players rather than for them, with new locations, minigames, and world events planned over an 18–24 month window.</cite>

Read that again with Lala's situation in mind. Ship island one. Let the LUNA-tics into the process. Add an island per single. That is a proven, working model at a scale one person can actually execute — and it's the closest analogue to what we're doing.

### Two design details worth taking directly

**Out-of-bounds secrets.** <cite index="1-1">The game explicitly rewards climbing too high, falling too far, and going under the map — secret items await players who wander off the intended path.</cite> This is *precisely* the hidden-letter, leaderboard-of-secrets idea Lala already described. It works, it's cheap, and it drives exactly the kind of "did you find it?" chatter a fanbase runs on.

**No pressure.** <cite index="1-1">In Ursa there is no conflict — only warmth and calm.</cite> Zero enemies. Compare that to the shadow wolf and alligators in her notes. Worth a conversation about whether the chase is really what she wants, or whether it crept in from Temple Run.

### Art and color
Chibi-proportioned characters, warm honey wood, soft sage and moss greens, cream stone. Simple shapes, gentle contrast, no sharp edges. Cheaper than both other references and still reviewing at 95%.

---

## 4. The art-style chart

Ten styles. The relevant ones for us:

**Cel Shaded (3D)** — what we've already built, and what the ThreeJS reel she liked uses. Flat toon ramp, ink outlines, low-poly geometry doing the work through shading. Cheapest way to look expensive. Runs in a phone browser.

**Low Poly (3D)** — the fallback if cel shading gets expensive. Reads as intentional, not budget.

**Stylized (3D)** — where Moonlight Peaks and Teddy's Haven both actually sit. Hand-painted textures on simplified forms. One notch more expensive than cel shading because it needs a texture artist.

**Hand Drawn (2D)** — beautiful, and the furthest from what we can produce without an illustrator on payroll.

Worth telling her plainly: **the reel she loved and the three games she sent are not the same style.** The reel is cel-shaded 3D anime. The games are stylized 3D with painted textures. They're cousins, not twins. We should pick one and commit, and cel shading is the one that's already working in the build.

---

## What this means for Lala Luna Land

### Confirmed by the references
- Third-person, walk-around exploration — all three do this
- Moon and night as core identity — Moonlight Peaks proves the market
- Hidden secrets rewarding off-path wandering — Teddy's Haven does it deliberately
- Island setting — Ursa and Miraland are both islands
- Ship in pieces, involve the community — Teddy's Haven's whole model
- Warm, non-sexualized, self-expression-forward tone — Infinity Nikki's explicit stance

### Contradicted by the references
- **Endless runner as the main verb.** Nothing she sent runs.
- **Chase and death.** Nothing she sent has a fail state, and Teddy's Haven brags about having no conflict at all.
- **One run per island to find the letter.** Every reference is generous and unhurried. This mechanic is the single most at-odds thing in the brief.

### The recommendation

Flip the ratio. Make the **islands walkable** like the hub, with the letter hidden in the world instead of on a track. Keep the runner as an *event on each island* — the moment the song peaks, the horses come through, and you sprint. Ninety seconds, once, then back to wandering.

That gives her:
- The cozy exploration all three references point to
- The runner energy she wanted, as a highlight instead of the whole meal
- Hidden letters that reward wandering, exactly like Teddy's Haven
- A place fans want to *stay*, which is what actually sells an artist app

### Outfit = ability

Take this from Infinity Nikki and it becomes the spine of the whole game. Four songs, four outfits, four abilities, four islands. The hand fans are already in her notes. Everything else follows.

---

## Questions for her

1. Is the wolf chasing you, or are you exploring? The references say exploring.
2. Should the four outfits give you powers? (Strong yes from me.)
3. Do fans get to customize how Lala looks?
4. Is one run per island really what she wants, or should it be generous?
5. Cel-shaded like the reel, or hand-painted stylized like the three games?
