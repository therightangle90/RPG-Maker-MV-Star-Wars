# RPG-Maker-MV-Star-Wars

## TRA_Battlefield-Movement setup

`TRA_Battlefield-Movement` only shows the movement prompt **during an active battle**.  
The safest place to initialise it is a **Troop Event** that runs at the start of battle.

### Exact initialisation steps

1. In the RPG Maker plugin manager, enable `TRA_Battlefield-Movement`.
2. Optional but recommended while testing: set the plugin's **Debug** parameter to `true`.
3. Create a **Troop Event** for the troop you are testing.
4. Set the page condition so it runs at battle start (for example: **Turn 0**, **Span: Battle**).
5. In that troop event, declare the battlefield zones with plugin commands.
6. In the same troop event, place the battlers with `BATTLEFIELD MOVE`.
7. After the battlers have been placed, call `BATTLEFIELD PROMPT_MOVE a1` (or another battler key) to show the move window.

### Working example

Use these plugin commands in a troop event:

```text
BATTLEFIELD ZONE_MAP 5 0 0 Start
BATTLEFIELD ZONE_MAP 5 1 0 Road
BATTLEFIELD ZONE_MAP 5 0 1 Cover
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE e0 1 0
BATTLEFIELD PROMPT_MOVE a1
```

### Important behavior notes

- `PROMPT_MOVE` must be called **during battle**. If it is run from a map event or common event outside `Scene_Battle`, no movement window will appear.
- `PROMPT_MOVE` only shows **adjacent declared zones**. If the battler is at `(0,0)` and there are no declared zones next to `(0,0)`, the prompt will close immediately.
- `MOVE` and `PROMPT_MOVE` should be run **after battle starts**, because battler battlefield positions are reset at battle start.
- `ZONE_MAP` is map-specific and should use the **map ID of the map where the battle started**.
- `ZONE` creates a global zone that can be used on any map.
- In `ZONE_MAP` / `ZONE`, the first token after the coordinates becomes the zone label. If you want a multi-word visible name, declare the zone first and then rename it with `LABEL_MAP` / `LABEL`.

Example:

```text
BATTLEFIELD ZONE_MAP 5 0 0 Start
BATTLEFIELD LABEL_MAP 5 0 0 Grassy Knoll
```

### What Debug mode logs

When **Debug** is enabled, the plugin logs:

- battle-start map ID and declared zone count
- every zone declaration
- battler movement via `BATTLEFIELD MOVE`
- when `PROMPT_MOVE` is requested
- when there are **no declared zones**
- when there are declared zones but **no adjacent zones** for the selected battler
- the current zone snapshot and which participants are inside each zone

If you do not see the move prompt, turn **Debug** on and check the browser console first.

## TRA_Star-Wars-Dice debug option

`TRA_Star-Wars-Dice` also has a **Debug** parameter.

When enabled, every dice pool rolled through `DiceSystem.rollPool(...)` or `DiceSystem.rollPoolDetailed(...)` logs:

- the dice pool composition
- each die rolled
- the final totals after cancellations
