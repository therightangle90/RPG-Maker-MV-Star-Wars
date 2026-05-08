# RPG-Maker-MV-Star-Wars

## TRA_Battlefield-Movement setup

`TRA_Battlefield-Movement` only shows the movement prompt **during an active battle**.
Zones can now be declared in **map notes** and auto-loaded at battle start.

### Exact initialisation steps

1. In the RPG Maker plugin manager, enable `TRA_Battlefield-Movement`.
2. Optional but recommended while testing: set the plugin's **Debug** parameter to `true`.
3. Put battlefield zone declarations in the map note using a `BATTLEFIELD_ZONES` block.
4. Create a **Troop Event** for the troop you are testing.
5. Set the page condition so it runs at battle start (for example: **Turn 0**, **Span: Battle**).
6. In the troop event, place the battlers with `BATTLEFIELD MOVE`.
7. After battlers are placed, call `BATTLEFIELD PROMPT_MOVE a1` (or another battler key) to show the move window.

### Working example

Put this in the map note:

```text
<BATTLEFIELD_ZONES>
0,0,Grassy Knoll | Open ground near the trees. | Low Light | Soft Cover
1,0,Public Road | A busy street.
0,1,Book Depository | A six-floor building. | Elevated Position
</BATTLEFIELD_ZONES>
```

Zone lines follow the format:  `x,y,Label | Description | Property One | Property Two | …`
All segments after the description are **zone properties** (arbitrary text, no fixed list).

Then use these plugin commands in a troop event:

```text
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE e0 1 0
BATTLEFIELD PROMPT_MOVE a1
```

### Cancel detection on PROMPT_MOVE

If you want to know whether the player cancelled instead of confirming a move
(so you can refund the manoeuvre action), pass an optional **switch ID**:

```text
BATTLEFIELD PROMPT_MOVE a1 5
```

After the command returns:
- **Switch 5 = OFF** – the player chose a zone and moved.
- **Switch 5 = ON**  – the player pressed cancel; the battler did not move.

Use a Conditional Branch on switch 5 immediately after to decide whether to
refund or void the movement skill.

### Dynamic battler keys (variable substitution)

When one common event handles movement for different actors, you can build the
battler key from a game variable instead of hard-coding it:

| Syntax   | Meaning |
|----------|---------|
| `a$v3`   | Actor with database ID = value of variable 3 |
| `e$v3`   | Enemy at troop index = value of variable 3 |
| `$v3`    | Variable 3 holds the full key string, e.g. `"a2"` or `"e0"` |

Examples:
```text
# Put actor ID 2 in variable 1, then:
BATTLEFIELD PROMPT_MOVE a$v1

# Put the full key in variable 2, then:
BATTLEFIELD PROMPT_MOVE $v2
```

Variable substitution works for all commands that accept a battler key
(MOVE, PROMPT_MOVE, ENGAGE, DISENGAGE, QUERY, SAME_ZONE, ZONE_HAS_PROP).

### Zone properties

Zones can have any number of arbitrary text properties:

```text
# In map notes:
<BATTLEFIELD_ZONES>
0,0,Grassy Knoll | Open ground. | Low Light | Dense Undergrowth
0,1,Rooftop | High vantage point. | Elevated Position | Exposed
</BATTLEFIELD_ZONES>

# Via plugin command (global zone):
BATTLEFIELD ZONE_PROP 0 0 Heavy Rain

# Via plugin command (per-map zone):
BATTLEFIELD ZONE_PROP_MAP 5 0 1 Reinforced Barricade
```

To check whether a battler's current zone has a property:
```text
BATTLEFIELD ZONE_HAS_PROP a1 10 Low Light
```
This sets **switch 10** ON if actor 1's zone has the property "Low Light" (case-insensitive), OFF otherwise.

To check a specific coordinate:
```text
BATTLEFIELD ZONE_HAS_PROP_XY 0 1 11 Elevated Position
```

### Optional battlefield relation states

You can configure three plugin parameters to apply states automatically:

- **Engaged State Id** – applied while a battler is in an engagement (Z > 0)
- **Disengaged State Id** – applied while not engaged and not near an enemy
- **Proximity State Id** – applied while not engaged but within 1 zone of an enemy

Set any to `0` to disable that state assignment.

### Debug logging

When **Debug** is enabled all events are written to:
```
battlefield-debug.log   (created in the game root folder, cleared on launch)
```
Events are also printed to the browser/NW.js console.

Open the log file in a text editor or a tail-capable viewer (e.g. VSCode,
Notepad++) to follow events live with no in-game overlay to manage.

What is logged:
- battle-start map ID and declared zone count
- every zone declaration (including properties)
- battler movement via `BATTLEFIELD MOVE`
- when `PROMPT_MOVE` is requested, confirmed, or cancelled
- the current zone snapshot (participants per zone, zone properties)
- warnings when no zones or no adjacent zones are available

If you do not see the move prompt, turn **Debug** on and check the log file.

## TRA_Star-Wars-Dice debug option

`TRA_Star-Wars-Dice` also has a **Debug** parameter.

When enabled, every dice pool rolled through `DiceSystem.rollPool(...)` or
`DiceSystem.rollPoolDetailed(...)` writes to:
```
dice-debug.log   (created in the game root folder, cleared on launch)
```
And also to the browser/NW.js console.

Each entry includes:
- the dice pool composition
- each die rolled and its face result
- the final totals after cancellations

