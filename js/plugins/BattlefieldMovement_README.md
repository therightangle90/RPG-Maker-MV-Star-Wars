# BattlefieldMovement.js

A plugin for **RPG Maker MV** that gives every combatant — both party members
and enemies — a position on a two-dimensional grid during battle.  It also
provides a third, **Z axis** that tracks close-quarters engagement between
entities that share the same cell.

---

## Table of Contents

1. [Concepts](#concepts)
2. [Battler Keys](#battler-keys)
3. [Plugin Parameters](#plugin-parameters)
4. [Plugin Commands Reference](#plugin-commands-reference)
   - [MOVE](#move)
   - [ENGAGE](#engage)
   - [DISENGAGE](#disengage)
   - [BOUNDS](#bounds)
   - [LABEL / LABEL_MAP](#label--label_map)
   - [DESC / DESC_MAP](#desc--desc_map)
   - [DEFAULT_DESC / MAP_DESC](#default_desc--map_desc)
   - [QUERY](#query)
   - [SAME_ZONE](#same_zone)
5. [The Engagement System in Detail](#the-engagement-system-in-detail)
6. [Reading Position Data in Scripts / Conditional Branches](#reading-position-data-in-scripts--conditional-branches)
7. [Typical Battle Setup Flow](#typical-battle-setup-flow)
8. [Complete Examples](#complete-examples)
9. [Save / Load Compatibility](#save--load-compatibility)
10. [FAQ](#faq)

---

## Concepts

### The X / Y Grid

Each combatant has an **X** and **Y** integer coordinate.  Movement is free
in all eight directions (orthogonal and diagonal), subject to the configured
boundaries.  At the start of every battle every combatant is placed at
`(0, 0)`; your Common Events or Battle Events then move them to starting
positions.

### The Z Layer — Engagement

When two or more combatants occupy the exact same `(x, y)` cell they may
**engage** one another.  An engaged combatant:

* Is placed in the same **Z group** (Z = 1, 2, 3, …).  Z = 0 means free.
* **Cannot move** on the X/Y axis until they disengage.
* Can still use skills, items, and other battle actions normally.

Multiple entities can belong to the same Z group.  A third combatant can
move into the same cell and then engage any member of an existing group to
join it.

### Zone Labels and Descriptions

Every coordinate can have a human-readable **label** and a longer
**description**.  These can be set globally (applying to all maps) or
per-map (applied only when the battle started on that specific map).  Per-map
data takes priority over global data.

A **default description** is shown for any coordinate that has no specific
description.  There is both a global default and a per-map default.

---

## Battler Keys

All plugin commands that refer to a specific combatant use a short string
called a **battler key**.

| Format | Refers to |
|--------|-----------|
| `a1`   | The actor whose **database ID** is 1 |
| `a2`   | The actor whose **database ID** is 2 |
| `e0`   | The enemy at **troop index 0** (the first enemy in the troop) |
| `e1`   | The enemy at **troop index 1** (the second enemy) |

> **Tip:** Actor IDs are the numbers shown in the Actors tab of the database.
> Enemy troop indices are zero-based, so the first enemy in "Troop #3" is
> index 0, the second is index 1, and so on.

---

## Plugin Parameters

| Parameter | Default | Description |
|-----------|---------|-------------|
| **Global Default Zone Description** | `An open area.` | Fallback description for any coordinate that has no specific description and no per-map fallback. |
| **Default Min X** | `-3` | Left boundary applied at the start of every battle. |
| **Default Max X** | `3` | Right boundary. |
| **Default Min Y** | `-3` | Bottom (or "back") boundary. |
| **Default Max Y** | `3` | Top (or "front") boundary. |

All boundaries can also be overridden at runtime with the `BOUNDS` command.

---

## Plugin Commands Reference

All commands start with the word **`BATTLEFIELD`** (case-insensitive).

---

### MOVE

```
BATTLEFIELD MOVE <battlerKey> <x> <y>
```

Moves a battler to the specified coordinates.

**Conditions checked:**
* The battler must be **free** (Z = 0).  Engaged battlers cannot move.
* The destination must be **within the current bounds**.

**Examples:**
```
BATTLEFIELD MOVE a1 2 -1
BATTLEFIELD MOVE e0 0 3
```

---

### ENGAGE

```
BATTLEFIELD ENGAGE <attackerKey> <targetKey>
```

The attacker engages the target.

**Conditions checked:**
* The attacker must currently be **free** (Z = 0).
* Both battlers must be at **exactly the same X/Y coordinates**.

**What happens:**
1. If the target is already in a Z group (Z > 0), the attacker joins that
   existing group.
2. If the target is free (Z = 0), a new Z group is created and both are
   placed into it.
3. The attacker's `engagedWith` is recorded as the target.  The target's
   `engagedWith` is not changed (they were pulled in, not the initiator).

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
move on the X/Y grid again.

After the battler leaves, the plugin runs a **cascade cleanup** on the
remaining group members (see [The Engagement System in Detail](#the-engagement-system-in-detail)).

**Example:**
```
BATTLEFIELD DISENGAGE a1
```

---

### BOUNDS

```
BATTLEFIELD BOUNDS <minX> <maxX> <minY> <maxY>
```

Overrides the movement boundaries for the rest of the current combat.
Call this at battle start (e.g. in a battle-start Common Event) to match
the area boundaries of the current map encounter.

**Example — restrict to a 7×7 grid centred on 0:**
```
BATTLEFIELD BOUNDS -3 3 -3 3
```

**Example — large open battle:**
```
BATTLEFIELD BOUNDS -10 10 -5 5
```

---

### LABEL / LABEL_MAP

```
BATTLEFIELD LABEL <x> <y> <label text...>
BATTLEFIELD LABEL_MAP <mapId> <x> <y> <label text...>
```

Sets a short label for a coordinate (e.g. a room name or landmark).

* **LABEL** sets a **global** label visible in all maps.
* **LABEL_MAP** sets a **per-map** label that overrides the global one when
  the battle started on that map.

All tokens after the coordinates are joined with spaces to form the label.

**Examples:**
```
BATTLEFIELD LABEL 0 0 The Throne Room
BATTLEFIELD LABEL -2 3 Hangar Bay
BATTLEFIELD LABEL_MAP 3 1 1 Hangar Bay Alpha
```

---

### DESC / DESC_MAP

```
BATTLEFIELD DESC <x> <y> <description text...>
BATTLEFIELD DESC_MAP <mapId> <x> <y> <description text...>
```

Sets a longer description for a coordinate.  Useful for flavour text
read aloud to players.

* **DESC** sets a **global** description.
* **DESC_MAP** sets a **per-map** description.

**Examples:**
```
BATTLEFIELD DESC 0 0 The centre of the vast throne chamber. Ancient pillars rise on all sides.
BATTLEFIELD DESC_MAP 7 -3 2 A narrow catwalk over the reactor core. One wrong step means death.
```

---

### DEFAULT_DESC / MAP_DESC

```
BATTLEFIELD DEFAULT_DESC <description text...>
BATTLEFIELD MAP_DESC <mapId> <description text...>
```

Sets fallback descriptions used when a coordinate has no specific
description.

* **DEFAULT_DESC** is the **global** fallback (used everywhere).
* **MAP_DESC** is a **per-map** fallback (used only when the battle started
  on the given map).

Per-map fallback takes priority over the global fallback.

**Examples:**
```
BATTLEFIELD DEFAULT_DESC An open area with no distinguishing features.
BATTLEFIELD MAP_DESC 3 The Death Star hangar bay. Rows of TIE fighters line the walls.
```

---

### QUERY

```
BATTLEFIELD QUERY <battlerKey> <varIdX> <varIdY> <varIdZ>
```

Writes the battler's current X, Y, and Z coordinates into three game
variables.  Use these variables in Conditional Branches or Show Text
commands.

**Example — store actor 1's position in variables 10, 11, 12:**
```
BATTLEFIELD QUERY a1 10 11 12
```

After this command:
* Variable 10 = actor 1's current X
* Variable 11 = actor 1's current Y
* Variable 12 = actor 1's current Z (0 = free, >0 = engaged group)

---

### SAME_ZONE

```
BATTLEFIELD SAME_ZONE <battlerKeyA> <battlerKeyB> <switchId>
```

Sets the specified game switch to **ON** if both battlers are at the same
X/Y coordinate (regardless of Z).  Use this before `ENGAGE` to verify that
engagement is legal.

**Example:**
```
BATTLEFIELD SAME_ZONE a1 e0 5
◆ Conditional Branch: Switch #5 is ON
    ◆ Plugin Command: BATTLEFIELD ENGAGE a1 e0
```

---

## The Engagement System in Detail

### Entering a Z Group

Z = 0 means the battler is free and unengaged.  A positive Z value (1, 2, 3, …)
identifies an engagement group at a given cell.  All members of a group share
the same `(x, y, z)` triple.

When **A engages B**:

1. If B is already in group Z = 1 at `(2, 3)`, A is added to that same group.
2. If B is free, a new group number is allocated (the lowest unused integer for
   that cell) and both A and B are placed in it.
3. A's `engagedWith` pointer is set to B.  B's pointer is unchanged.

### Leaving a Z Group — Cascade Cleanup

When a battler **disengages**:

1. The battler is removed from the group (Z → 0, `engagedWith` → null).
2. Any remaining group member whose `engagedWith` pointed at the departed
   battler has that reference cleared (the link is broken, but they may stay
   in the group if someone else still anchors them).
3. The engine then checks every remaining member for a **reason to stay**:
   - *Does this member actively engage someone still in the group?*
     (their `engagedWith` target is still present)  **OR**
   - *Is this member actively engaged by someone still in the group?*
     (another member's `engagedWith` points at them)
4. Any member with **no reason to stay** is ejected (Z → 0).  This can
   trigger further ejections, so step 3–4 repeats until the group is
   stable.

### Worked Examples

**Two-way engagement, A disengages:**

| State | A | B |
|-------|---|---|
| Start | (1,1) Z=0 | (1,1) Z=0 |
| A engages B | Z=1, engWith=B | Z=1, engWith=null |
| A disengages | Z=0 | B has no anchor → Z=0 |

Both are free. ✓

---

**Three-way engagement, initiator disengages:**

| State | A | B | C |
|-------|---|---|---|
| Start | (1,1) Z=0 | (1,1) Z=0 | (1,1) Z=0 |
| A engages B | Z=1, engWith=B | Z=1, engWith=null | Z=0 |
| C engages A | Z=1 | Z=1 | Z=1, engWith=A |
| A disengages | Z=0 | — | C.engWith cleared (A gone) |
| Cleanup: B has no anchor → ejects | — | Z=0 | — |
| Cleanup: C.engWith=null, nobody engages C → ejects | — | — | Z=0 |

Group fully dissolves. ✓

---

**Three-way, two still anchored:**

| State | A | B | C |
|-------|---|---|---|
| A engages B | Z=1, engWith=B | Z=1, engWith=null | Z=0 |
| C engages B | Z=1 | Z=1 | Z=1, engWith=B |
| A disengages | Z=0 | — | — |
| Cleanup: B — C still engages B → stays | — | Z=1 | Z=1 |
| Cleanup: C — engWith=B (still in group) → stays | — | Z=1 | Z=1 |

B and C remain engaged. ✓

---

**Pulled-in battler (B) disengages:**

If B (who was pulled in by A) chooses to disengage:

1. B leaves.
2. A.engWith was B, so A.engWith is cleared.
3. Cleanup: A now has no `engagedWith` and nobody is engaging A → A ejects.

Group dissolves even though A was the original initiator. ✓

---

## Reading Position Data in Scripts / Conditional Branches

Use the **Script** option in a Conditional Branch, or the `Script:` event
command, to read position data directly.

```javascript
// Actor 1's coordinates
$gameActors.actor(1)._bfX   // X position
$gameActors.actor(1)._bfY   // Y position
$gameActors.actor(1)._bfZ   // 0 = free, >0 = engaged

// Check if actor 1 is engaged
$gameActors.actor(1).bfIsEngaged()  // returns true/false

// Enemy at index 0 (first enemy in the troop)
$gameTroop.members()[0]._bfX

// Get zone label/description for a cell
$gameBattlefield.getZoneLabel(2, -1)
$gameBattlefield.getZoneDesc(2, -1)
```

---

## Typical Battle Setup Flow

A recommended pattern for a battle that starts on map ID 5:

```
◆ Battle Processing: ...
  ──── (In battle-start Common Event or parallel process) ────
  ◆ Plugin Command: BATTLEFIELD BOUNDS -3 3 -2 2
  ◆ Plugin Command: BATTLEFIELD MAP_DESC 5 The docking bay. Crates are piled everywhere.
  ◆ Plugin Command: BATTLEFIELD LABEL_MAP 5 -3 0 Entrance
  ◆ Plugin Command: BATTLEFIELD LABEL_MAP 5  3 0 Cargo Hold
  ◆ Plugin Command: BATTLEFIELD DESC_MAP 5 -3 0 The blast doors you entered through.
  ◆ Plugin Command: BATTLEFIELD MOVE a1 -2 0
  ◆ Plugin Command: BATTLEFIELD MOVE a2 -2 1
  ◆ Plugin Command: BATTLEFIELD MOVE e0  2 0
  ◆ Plugin Command: BATTLEFIELD MOVE e1  2 -1
```

Then during a turn, when actor 1 uses a "Charge" manoeuvre:

```
◆ Plugin Command: BATTLEFIELD MOVE a1 2 0
◆ Plugin Command: BATTLEFIELD SAME_ZONE a1 e0 10
◆ Conditional Branch: Switch #10 is ON
    ◆ Plugin Command: BATTLEFIELD ENGAGE a1 e0
```

At the end of the encounter, or when actor 1 uses a "Break Away" skill:

```
◆ Plugin Command: BATTLEFIELD DISENGAGE a1
```

---

## Complete Examples

### Example 1 — Basic Skirmish

Two allies vs. two enemies on a 7×7 grid.

```
BATTLEFIELD BOUNDS -3 3 -3 3
BATTLEFIELD DEFAULT_DESC An open courtyard.
BATTLEFIELD LABEL  0  0 Centre
BATTLEFIELD DESC   0  0 The centre of the courtyard. Exposed on all sides.
BATTLEFIELD LABEL  3  3 High Ground
BATTLEFIELD DESC   3  3 A raised platform giving a clear view of the field.
BATTLEFIELD MOVE a1 -2 0
BATTLEFIELD MOVE a2 -2 1
BATTLEFIELD MOVE e0  2 0
BATTLEFIELD MOVE e1  2 1
```

Actor 1 moves forward and engages enemy 0:

```
BATTLEFIELD MOVE a1 2 0
BATTLEFIELD SAME_ZONE a1 e0 1
◆ Conditional Branch: Switch #1 is ON
    ◆ Plugin Command: BATTLEFIELD ENGAGE a1 e0
```

Check actor 1's position (store in variables 20–22):

```
BATTLEFIELD QUERY a1 20 21 22
```

Actor 1 then breaks away:

```
BATTLEFIELD DISENGAGE a1
```

---

### Example 2 — Three-Way Engagement

```
# Place all three battlers in the same cell so engagement is possible
BATTLEFIELD MOVE a1  0  0
BATTLEFIELD MOVE a2  0  0
BATTLEFIELD MOVE e0  0  0

# a1 engages e0 — both enter group Z=1 at (0,0)
BATTLEFIELD ENGAGE a1 e0

# a2 moves to 0,0 (already there) and engages e0 — joins Z=1
BATTLEFIELD ENGAGE a2 e0

# Now (0,0,1): a1 (engWith=e0), e0 (engWith=null), a2 (engWith=e0)

# a1 disengages.
# e0: a2 still engages e0 → e0 stays.
# a2: engWith=e0 (still present) → a2 stays.
# Result: e0 and a2 remain engaged at (0,0,1).
BATTLEFIELD DISENGAGE a1
```

---

## Save / Load Compatibility

`$gameBattlefield` is written to the save file and restored on load.  The
object's prototype is re-attached automatically so all methods continue to
work after loading.  Battler field data (`_bfX`, `_bfY`, `_bfZ`,
`_bfEngagedWith`) is stored as part of the normal actor/enemy save data.

---

## FAQ

**Q: Can an engaged battler engage someone else?**  
A: No. An engaged battler (Z > 0) cannot initiate a new engagement. They must
disengage first.

**Q: Can an engaged battler be the *target* of a new engagement?**  
A: Yes. Another free battler can move to the same cell and engage them, joining
the existing Z group.

**Q: What if I call ENGAGE on battlers that are not in the same cell?**  
A: The command is rejected with a console warning. Use `SAME_ZONE` / `QUERY` to
confirm positions before engaging.

**Q: Do dead battlers retain their positions?**  
A: Yes; the plugin does not watch for death. If you want dead battlers to be
removed from engagement, call `BATTLEFIELD DISENGAGE` in the on-death event
or skill effect via a Common Event.

**Q: Does the plugin show anything on screen?**  
A: No. It is a data layer only. Displaying positions, describing zones, and
showing engagement state is left entirely to your own messages, variables, and
event logic.

**Q: Zone labels/descriptions persist between battles — is that intentional?**  
A: Yes. You set up zone labels for a map once (in a pre-battle Common Event or
even directly in the event's "before battle" commands) and they remain for the
lifetime of the save file. Battler *positions* are reset to `(0, 0)` at the
start of every battle.

**Q: Can I use this plugin alongside `NewCombat.js`?**  
A: Yes. `BattlefieldMovement.js` does not touch the turn economy or the battle
command menu. You can call movement and engagement commands from skills,
manoeuvre effects, or dedicated Common Events.
