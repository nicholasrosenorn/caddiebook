# How Strokes Gained Works

Strokes Gained is the most honest way to measure a golf shot. Instead of asking
*"did I hit the fairway?"* it asks *"how much closer to holing out did this shot
actually get me, compared to a benchmark golfer?"* A 40-foot putt that finishes
two feet away was a great putt even though it missed; a wedge from 90 yards that
finishes 30 feet away was a poor one even though it hit the green. Strokes Gained
captures that — traditional stats don't.

The method was developed by Columbia professor **Mark Broadie** and popularized in
his book *Every Shot Counts*; the PGA Tour adopted it in 2011.

---

## The one idea behind everything: "expected strokes"

Every spot on a golf course has an **expected strokes to hole out** — the average
number of shots it takes to finish from there. It depends on two things:

- **how far you are** from the hole, and
- **your lie** (tee, fairway, rough, sand, or on the green).

For example, on the PGA Tour benchmark:

| Position | Expected strokes to hole out |
| --- | --- |
| 150 yards, fairway | ~2.8 |
| 150 yards, rough | ~3.2 |
| 10 feet, on the green | ~1.6 |
| 3 feet, on the green | ~1.0 |

These numbers come from millions of real shots.

## The formula

The strokes gained on a single shot is:

```
Strokes Gained = (expected strokes BEFORE the shot)
               − (expected strokes AFTER the shot)
               − 1     ← the shot you just hit
```

**Worked example.** You're 150 yards out in the fairway (expected: 2.80). You hit
your approach to 10 feet (expected: 1.61). Your strokes gained on that shot:

```
2.80 − 1.61 − 1 = +0.19
```

Wait — only +0.19? A more typical good wedge to ~8 feet would gain a bit more. The
point is the math is unforgiving and exact: you turned a 2.80-stroke situation
into a 1.61-stroke situation while spending one stroke, so you came out **0.19
strokes ahead** of the benchmark. Stuff it to 4 feet (expected 1.13) and you'd
gain `2.80 − 1.13 − 1 = +0.67`.

A **positive** number means you gained ground on the benchmark; **negative** means
you lost ground.

## It all adds up

Here's the elegant part. If you add up the strokes gained on *every* shot of a
hole, the in-between numbers cancel out and you're left with:

```
Total strokes gained on a hole = (expected strokes from the tee) − (your score)
```

So your four category numbers always sum to your total. Golf splits naturally into
four:

- **Off the tee** — your tee shots on par 4s and 5s.
- **Approach** — shots aiming at the green.
- **Short game** — chips, pitches, and bunker shots around the green.
- **Putting** — once you're on the green.

This is why Strokes Gained is so useful: it tells you *where* your strokes are won
and lost, not just your total score.

---

## How each category is calculated

Every shot falls into one category, and each is scored with the same `expected
before − expected after − 1` rule. Here's how Caddie Book builds each one from the
data you log.

### Putting · measured

Once you're on the green, all that matters is your first-putt distance and how many
putts you take — the in-between putts cancel, so the whole hole's putting reduces
to:

```
Putting SG = (expected putts from your first-putt distance) − (putts taken)
```

Your first-putt distance is the longest putt you log on the hole (your lag).
*Example:* a 20-footer (expected 1.87 putts) that you two-putt → `1.87 − 2 = −0.13`.
Hole it → `1.87 − 1 = +0.87`.

### Approach · measured

Your approach is the shot into the green. Its **start** is your logged approach
distance and lie — fairway if you hit the fairway off the tee, rough if you missed.
Its **end** is where the ball stopped. Whether you **hit the green** is your explicit
On green / Missed green call on the approach target — not guessed from how close you
tapped — so a shot that finished, say, 20 feet from the pin but short of the putting
surface is correctly counted as a *miss* (and handed off to your short game), while a
ball safely on the front of a deep green still counts as a green hit. If you hit the
green, the end value is the expected putts from your proximity to the pin (read from
where you tapped); if you missed, a fixed "just off the green" value.

```
Approach SG = (expected from approach distance + lie) − (expected at the result) − 1
```

*Example:* 150 yards from the fairway (2.80) to 10 feet (1.61) → `2.80 − 1.61 − 1 =
+0.19`. On a par 3 the tee shot *is* the approach, scored the same way from the tee.

### Off the tee · estimated

This covers your tee shot on par 4s and 5s. The **start** is the expected score
from the tee for the hole's length; the **end** is where your drive left you — your
approach distance, in the fairway or rough.

```
Off-the-tee SG = (expected from the tee) − (expected from your approach distance + lie) − 1
```

Since Caddie Book doesn't ask for each hole's yardage, it estimates the hole length
as **your drive distance + the approach distance you logged** (par 5s add a typical
layup). Your drive distance is taken **per hole from the distance you log on the
drive page** when you record it; on holes where you don't, it falls back to your bag's
driver yardage, or a default for your handicap. Because each hole can carry its own
drive distance, Off-the-tee now reflects how far you actually hit it that hole rather
than one flat number for the round — a long bomb lengthens the hole estimate and earns
more for the same approach position, a short one less.
*Example:* a ~410-yard par 4 (4.05 from the tee), drive to 150 in the fairway
(2.80) → `4.05 − 2.80 − 1 = +0.25`.

On a **par 5**, getting to your approach normally takes *two* long shots — the drive
and a layup — so Off-the-tee covers both of them (the `− 1` above becomes `− 2`). When
your approach finds the green, Caddie Book knows exactly how many long shots that was
(your score minus your putts, minus the approach), so a par 5 you **reach in two**
correctly earns the extra credit off the tee rather than being charged for a layup you
never hit.

The Stats tab also breaks Off-the-tee down by drive-distance band (25-yard buckets),
using these logged distances, so you can see which lengths of tee shot are gaining or
losing you strokes.

### Short game · the balancing figure

Short game is everything between a missed green and your first putt — chips,
pitches, bunker shots — plus any penalty strokes. Rather than ask you to log those
distances, Caddie Book computes it as whatever the other three categories don't
account for:

```
Short game SG = Total − Off the tee − Approach − Putting
```

Because the four always sum to the total, this captures exactly the leftover
strokes. And there's a happy accident in the math: the hole-length *estimate*
appears in both Total and Off-the-tee with opposite signs, so it **cancels out of
short game entirely** — your short-game number stays trustworthy even though it's
derived last. *Example:* miss the green and get up-and-down in two tidy shots and
it's about even; chunk the chip and leave a long putt and it turns negative.

Because the layup is counted off the tee (not here), a green hit **in regulation**
leaves short game at ≈ 0 on *every* par — including par 5s, which used to be charged
about a stroke too much here. The short-game number now moves only when you actually
play a shot around the green.

---

## Comparing against handicap levels

The PGA Tour benchmark answers "how do I compare to a tour pro?" — which, for most
of us, is a wall of negative numbers. So Caddie Book lets you compare against
golfers at **your** level instead: scratch, 5, 10, 15, or 20 handicap.

This works because of a simple shortcut. Broadie's research measured how each
handicap level performs *relative to the Tour*, per round:

| Handicap | Off tee | Approach | Short game | Putting | Total |
| --- | --- | --- | --- | --- | --- |
| Scratch | −0.8 | −1.5 | −0.5 | −0.4 | **−3.2** |
| 5 | −1.4 | −3.0 | −1.0 | −0.8 | **−6.2** |
| 10 | −2.0 | −4.5 | −1.5 | −1.2 | **−9.2** |
| 15 | −2.7 | −6.0 | −2.0 | −1.5 | **−12.2** |
| 20 | −3.4 | −7.5 | −2.5 | −1.8 | **−15.2** |

(All figures are strokes per round, versus a tour pro at 0.0.)

Because everything is measured against the same Tour baseline:

```
Your SG vs a 10-handicap = (Your SG vs Tour) − (a 10-handicap's SG vs Tour)
```

So when you toggle to "10 handicap," every bar shifts by that golfer's expected
performance. A **positive** bar now means you'd beat a 10-handicap in that part of
the game; a **negative** bar means they'd beat you. Toggle through the levels to
see where your game stacks up.

---

## What's measured vs. estimated

Textbook Strokes Gained needs the exact distance and lie of *every* shot — only
laser/GPS tracking captures that. Caddie Book derives it from the few things you tap
in, so:

- **Putting and Approach are measured** — as accurate as the distances you log and
  your On green / Missed green calls (the green call also decides which holes fall to
  your short game).
- **Off the tee and Short game are estimated** — they lean on the hole-length
  estimate described above, so the app labels them as such. Logging your drive
  distance sharpens the Off-the-tee estimate hole-by-hole; without it, the estimate
  uses your bag/handicap driver number. Either way the estimate cancels out of short
  game, so that figure stays trustworthy.

The baseline expected-strokes values used throughout are a faithful reproduction of
the PGA Tour benchmark published in Mark Broadie's *Every Shot Counts*.

---

*Want to go deeper? Mark Broadie's *Every Shot Counts* is the definitive read on
Strokes Gained.*
