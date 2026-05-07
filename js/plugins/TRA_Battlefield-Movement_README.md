# BattlefieldMovement.js

A plugin for **RPG Maker MV** that places every combatant — party members and
enemies — on a coordinate grid during battle.  Only **explicitly declared
zones** are reachable; players choose their destination from an in-battle
menu.  A Z axis tracks close-quarters engagement between combatants that share
the same cell.

---

## Table of Contents

1. [Concepts](#concepts)
2. [Battler Keys](#battler-keys)
3. [Plugin Commands Reference](#plugin-commands-reference)
   - [ZONE_MAP / ZONE](#zone_map--zone)
   - [MOVE](#move)
   - [PROMPT_MOVE](#prompt_move)
   - [ENGAGE](#engage)
   - [DISENGAGE](#disengage)
   - [LABEL_MAP / LABEL](#label_map--label)
   - [DESC_MAP / DESC](#desc_map--desc)
   - [QUERY](#query)
   - [SAME_ZONE](#same_zone)
4. [The Engagement System in Detail](#the-engagement-system-in-detail)
5. [Reading Position Data in Scripts / Conditional Branches](#reading-position-data-in-scripts--conditional-branches)
6. [Typical Battle Setup Flow](#typical-battle-setup-flow)
7. [Complete Examples](#complete-examples)
8. [Save / Load Compatibility](#save--load-compatibility)
9. [FAQ](#faq)

---

## Concepts

### Declared Zones Only

The battlefield is **not** an open, unbounded grid.  Every reachable location
must be declared in advance with `BATTLEFIELD ZONE_MAP` (per-map) or
`BATTLEFIELD ZONE` (global).  A location that has not been declared does not
exist as far as movement is concerned.

When a player character uses a move action (via `BATTLEFIELD PROMPT_MOVE`),
the plugin looks at their current X/Y coordinate and builds a list of every
declared zone that is exactly **one step away** in any of the eight cardinal
or diagonal directions.  That list — sorted alphabetically — is presented as
an in-battle selection window.

### The X / Y Grid

Each combatant has an **integer X** and **integer Y** coordinate.  Movement
is allowed in all eight directions, but only to zones that have been
explicitly declared for the current map.  At the start of every battle every
combatant is reset to `(0, 0)`.  Your battle-start event then uses
`BATTLEFIELD MOVE` to place them at their actual starting locations.

### Adjacency Rule

A zone is considered reachable from `(x, y)` if it satisfies
**Chebyshev distance 1**:

```
|dest_x − x| ≤ 1  AND  |dest_y − y| ≤ 1  AND  (dest_x, dest_y) ≠ (x, y)
```

This means all eight surrounding cells are candidates, but only the declared
ones actually appear in the menu.

### The Z Layer — Engagement

When two or more combatants occupy the exact same `(x, y)` cell they may
**engage** one another.  An engaged combatant:

* Is placed in the same **Z group** (Z = 1, 2, 3, …).  Z = 0 means free.
* **Cannot move** on the X/Y axis until they disengage.
* Can still use skills, items, and other battle actions normally.

---

## Battler Keys

All plugin commands that refer to a specific combatant use a **battler key**
string:

| Format | Refers to |
|--------|-----------|
| `a1`   | The actor whose **database ID** is 1 |
| `a2`   | The actor whose **database ID** is 2 |
| `e0`   | The enemy at **troop index 0** (the first enemy in the troop) |
| `e1`   | The enemy at **troop index 1** (the second enemy) |

> **Tip:** Actor IDs are shown in the Actors tab of the RPG Maker database.
> Enemy troop indices are zero-based.

---

## Plugin Commands Reference

All commands start with the word **`BATTLEFIELD`** (case-insensitive).

---

### ZONE_MAP / ZONE

```
BATTLEFIELD ZONE_MAP <mapId> <x> <y> <name> [description...]
BATTLEFIELD ZONE     <x> <y> <name> [description...]
```

**Declares a location as a valid zone.**  This is the primary setup command.

* `ZONE_MAP` declares a zone for a specific map ID.  Per-map declarations
  take priority over global ones.
* `ZONE` declares a global zone, used on any map that doesn't override it.
* The first token after the coordinates is the **display name** (shown in the
  movement menu).
* Everything after the name is treated as an optional **description**.

A coordinate that has *never* been declared cannot appear in the movement
menu and cannot be moved to via `PROMPT_MOVE`.

**Examples:**
```
BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll Open ground beside the oak trees.
BATTLEFIELD ZONE_MAP 5 0 1 Book Depository A six-floor red-brick building.
BATTLEFIELD ZONE_MAP 5 1 0 Public Road A busy cobblestone street.
BATTLEFIELD ZONE 0 0 The Courtyard
```

---

### MOVE

```
BATTLEFIELD MOVE <battlerKey> <x> <y>
```

**Force-places** a battler at the given coordinates without showing any
player menu.  Use this for:

* Placing battlers at their starting positions at the beginning of a fight.
* Scripted / enemy-AI movement.

The battler must not be currently engaged (Z > 0).

> There is no zone validation on `MOVE`.  This lets you position battlers
> even before zones are fully declared, and allows enemies to be placed
> programmatically on any coordinate.

**Examples:**
```
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE e0 1 0
```

---

### PROMPT_MOVE

```
BATTLEFIELD PROMPT_MOVE <battlerKey>
```

**Shows the player an in-battle selection window** listing every declared zone
adjacent to the battler's current position (sorted A–Z).  The event pauses
until the player makes a choice.

* If the player selects a zone, the battler is moved there.
* If the player presses Cancel, the battler stays in place.
* If there are no reachable declared zones (e.g. the battler is surrounded by
  undeclared coordinates), the window is skipped and the event continues
  immediately.
* The command is silently skipped if the battler is currently engaged (Z > 0).

Typically called from the effect Common Event of a "Move" skill or manoeuvre.

**Example:**
```
BATTLEFIELD PROMPT_MOVE a1
```

---

### ENGAGE

```
BATTLEFIELD ENGAGE <attackerKey> <targetKey>
```

The attacker engages the target.

**Conditions:**
* The attacker must be free (Z = 0).
* Both battlers must be at the same X/Y coordinate.

**What happens:**
1. If the target is already in a Z group, the attacker joins it.
2. If the target is free, a new Z group is created and both are placed into it.
3. The attacker's `engagedWith` pointer is set to the target.

**Examples:**
```
BATTLEFIELD ENGAGE a1 e0
BATTLEFIELD ENGAGE e1 a2
```

---

### DISENGAGE

```
BATTLEFIELD DISENGAGE <battlerKey>
```

Removes the battler from its Z group and returns it to Z = 0, freeing it to
move again.

After the battler leaves, the plugin runs a **cascade cleanup** on the
remaining group members (see [The Engagement System in Detail](#the-engagement-system-in-detail)).

**Example:**
```
BATTLEFIELD DISENGAGE a1
```

---

### LABEL_MAP / LABEL

```
BATTLEFIELD LABEL_MAP <mapId> <x> <y> <label text...>
BATTLEFIELD LABEL     <x> <y> <label text...>
```

Updates only the **display name** of an already-declared zone.  Does not
change the description.  Use `ZONE_MAP`/`ZONE` to set name and description
together when first declaring a zone.

**Examples:**
```
BATTLEFIELD LABEL_MAP 5 0 0 The Knoll
BATTLEFIELD LABEL 0 0 Central Square
```

---

### DESC_MAP / DESC

```
BATTLEFIELD DESC_MAP <mapId> <x> <y> <description text...>
BATTLEFIELD DESC     <x> <y> <description text...>
```

Updates only the **description** of an already-declared zone.

**Examples:**
```
BATTLEFIELD DESC_MAP 5 0 1 The six-floor building where the shot was fired.
BATTLEFIELD DESC 0 0 Open ground in the middle of the town.
```

---

### QUERY

```
BATTLEFIELD QUERY <battlerKey> <varIdX> <varIdY> <varIdZ>
```

Writes the battler's current X, Y, Z into three game variables.

**Example — store actor 1's position in variables 10, 11, 12:**
```
BATTLEFIELD QUERY a1 10 11 12
```

---

### SAME_ZONE

```
BATTLEFIELD SAME_ZONE <battlerKeyA> <battlerKeyB> <switchId>
```

Sets the switch ON if both battlers share the same X/Y coordinate (regardless
of Z).  Useful before deciding whether to ENGAGE.

**Example:**
```
BATTLEFIELD SAME_ZONE a1 e0 5
◆ Conditional Branch: Switch #5 is ON
    ◆ Plugin Command: BATTLEFIELD ENGAGE a1 e0
```

---

## The Engagement System in Detail

### Entering a Z Group

Z = 0 means free.  A positive Z value (1, 2, 3, …) identifies an engagement
group at a specific cell.

When **A engages B**:

1. If B is already in group Z = 1, A joins that group.
2. If B is free, a new group number is allocated and both A and B enter it.
3. A's `engagedWith` is set to B's key.  B's `engagedWith` is unchanged.

### Leaving a Z Group — Cascade Cleanup

When a battler **disengages**:

1. They leave the group (Z → 0, `engagedWith` → null).
2. Any remaining member whose `engagedWith` pointed at the departed battler
   has that reference cleared.
3. Each remaining member is checked for a **reason to stay**:
   - They are actively engaging someone else in the group, **or**
   - Someone else in the group is actively engaging them.
4. Any member with no reason to stay is ejected.  This can cascade.

### Worked Examples

**Two-way: A disengages**

| State | A | B |
|-------|---|---|
| A engages B | Z=1, engWith=B | Z=1 |
| A disengages | Z=0 | B has no anchor → Z=0 |

Both free. ✓

---

**Three-way: C joins, then A disengages**

| State | A | B | C |
|-------|---|---|---|
| A engages B | Z=1, engWith=B | Z=1 | Z=0 |
| C engages A | Z=1 | Z=1 | Z=1, engWith=A |
| A disengages | Z=0 | — | C.engWith cleared |
| Cleanup: B no anchor → ejects | — | Z=0 | — |
| Cleanup: C no anchor → ejects | — | — | Z=0 |

All free. ✓

---

**Three-way: C joins B, then A disengages**

| State | A | B | C |
|-------|---|---|---|
| A engages B | Z=1, engWith=B | Z=1 | Z=0 |
| C engages B | Z=1 | Z=1 | Z=1, engWith=B |
| A disengages | Z=0 | — | — |
| B: C still engages B → stays | — | Z=1 | Z=1 |
| C: engWith=B (still present) → stays | — | Z=1 | Z=1 |

B and C remain engaged. ✓

---

## Reading Position Data in Scripts / Conditional Branches

```javascript
// Actor 1's coordinates
$gameActors.actor(1)._bfX        // X
$gameActors.actor(1)._bfY        // Y
$gameActors.actor(1)._bfZ        // 0 = free, >0 = engaged group
$gameActors.actor(1).bfIsEngaged()  // boolean

// Enemy at troop index 0
$gameTroop.members()[0]._bfX

// Zone data for a cell
$gameBattlefield.getZoneLabel(0, 0)   // "Grassy Knoll" or null
$gameBattlefield.getZoneDesc(0, 0)    // description or null
$gameBattlefield.isValidZone(0, 0)    // true/false

// Adjacent reachable zones (as used by PROMPT_MOVE)
$gameBattlefield.adjacentValidZones(0, 0)
// returns: [{x, y, label}, ...] sorted A-Z
```

---

## Typical Battle Setup Flow

A battle that takes place on map ID 5:

```
────  In a pre-battle Common Event or battle-start parallel event  ────

◆ Plugin Command: BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll Open ground.
◆ Plugin Command: BATTLEFIELD ZONE_MAP 5 0 1 Book Depository The shooter's nest.
◆ Plugin Command: BATTLEFIELD ZONE_MAP 5 1 0 Public Road Bystanders everywhere.
◆ Plugin Command: BATTLEFIELD ZONE_MAP 5 1 1 Overpass A concrete bridge.

◆ Plugin Command: BATTLEFIELD MOVE a1 0 0      ← actor 1 starts at Grassy Knoll
◆ Plugin Command: BATTLEFIELD MOVE a2 0 0      ← actor 2 starts at Grassy Knoll
◆ Plugin Command: BATTLEFIELD MOVE e0 1 1      ← enemy 0 starts at Overpass
```

When actor 1 uses a "Move" manoeuvre (via its Common Event):

```
◆ Plugin Command: BATTLEFIELD PROMPT_MOVE a1
  → Player sees: "Book Depository, Public Road" (A-Z, adjacent to 0,0)
  → Player picks "Public Road"
  → Actor 1 moves to (1,0)
```

Then actor 1 uses a "Charge" action to engage enemy 0 (must move to same cell first):

```
◆ Plugin Command: BATTLEFIELD SAME_ZONE a1 e0 10
◆ Conditional Branch: Switch #10 is ON
    ◆ Plugin Command: BATTLEFIELD ENGAGE a1 e0
```

Later, actor 1 uses "Break Away":

```
◆ Plugin Command: BATTLEFIELD DISENGAGE a1
```

---

## Complete Examples

### Example 1 — Basic Encounter on Map 5

```
# ── Setup ────────────────────────────────────────────────
BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll      Open ground near the oak tree.
BATTLEFIELD ZONE_MAP 5 0 1 Book Depository   Six-floor building, sixth floor.
BATTLEFIELD ZONE_MAP 5 1 0 Public Road       A busy street. Civilians scatter.
BATTLEFIELD ZONE_MAP 5 1 1 Overpass          A concrete bridge above the road.

# Place battlers
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE a2 0 0
BATTLEFIELD MOVE e0 1 1
BATTLEFIELD MOVE e1 1 0

# ── During a turn ────────────────────────────────────────
# Actor 1 moves (player chooses from adjacent declared zones):
BATTLEFIELD PROMPT_MOVE a1
#  → Shows:  Book Depository | Public Road | Overpass (sorted A–Z, Chebyshev ≤1)

# Actor 1 ends up at 1,0 (Public Road) — same cell as e1
BATTLEFIELD SAME_ZONE a1 e1 1
# Conditional Branch: Switch 1 ON → engage
BATTLEFIELD ENGAGE a1 e1

# Store actor 1's position for Show Text use
BATTLEFIELD QUERY a1 20 21 22
#  Variable 20 = 1, Variable 21 = 0, Variable 22 = 1 (engaged)

# Later: actor 1 breaks away
BATTLEFIELD DISENGAGE a1
```

---

### Example 2 — Three-Way Engagement

```
# All three in the same cell
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE a2 0 0
BATTLEFIELD MOVE e0 0 0

# a1 engages e0 → group Z=1 at (0,0): a1(engWith=e0), e0
BATTLEFIELD ENGAGE a1 e0

# a2 also engages e0 → joins Z=1: a1, e0, a2(engWith=e0)
BATTLEFIELD ENGAGE a2 e0

# a1 disengages.
# e0: a2 still engages it → stays.
# a2: engWith=e0 (still present) → stays.
# Result: e0 and a2 remain at Z=1.
BATTLEFIELD DISENGAGE a1
```

---

## Save / Load Compatibility

`$gameBattlefield` is written to the save file.  The object prototype is
re-attached automatically on load, so all methods work after restoring a save.
Battler field data (`_bfX`, `_bfY`, `_bfZ`, `_bfEngagedWith`) is stored as
part of the normal actor/enemy save payload.

---

## FAQ

**Q: What happens at the very start of a battle?**  
A: All battlers are reset to `(0, 0)` when `Scene_Battle` starts.  Your
battle-start Common Event should immediately call `BATTLEFIELD MOVE` to place
everyone at their declared starting locations.

**Q: Can `MOVE` place a battler at an undeclared coordinate?**  
A: Yes.  `MOVE` is a designer/scripting tool with no validation.  `PROMPT_MOVE`
is what enforces declared-zones-only movement for player characters.

**Q: What if a player character has no adjacent declared zones?**  
A: `PROMPT_MOVE` detects this, skips the window, and lets the event continue
immediately.  No movement occurs.

**Q: Can an engaged battler use PROMPT_MOVE?**  
A: No.  The command is skipped with a console warning if the battler is
engaged.

**Q: Do dead battlers retain their positions?**  
A: Yes.  The plugin does not watch for defeat.  If you want dead battlers
removed from engagement, call `BATTLEFIELD DISENGAGE` in the on-defeat
Common Event.

**Q: Does the plugin display anything visually?**  
A: Only the destination-selection window (shown during `PROMPT_MOVE`).  Grid
display, position indicators, and zone descriptions are your responsibility —
use `QUERY` to read positions into variables and display them with Show Text.

**Q: Do declared zone data persist between battles?**  
A: Yes.  Zone declarations (labels, descriptions) are stored in the save file
and survive battle transitions.  Battler *positions* are reset at the start of
each battle.  You only need to declare zones once per map (e.g. in the map's
pre-battle setup event).

**Q: Can I use this plugin alongside `NewCombat.js`?**  
A: Yes.  `BattlefieldMovement.js` does not touch the turn economy or skill
menus.  Attach `PROMPT_MOVE` to a "Move" manoeuvre skill's Common Event effect.

