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
0,0,Grassy Knoll | Open ground near the trees.
1,0,Public Road | A busy street.
0,1,Book Depository | A six-floor building.
</BATTLEFIELD_ZONES>
```

Then use these plugin commands in a troop event:

```text
BATTLEFIELD MOVE a1 0 0
BATTLEFIELD MOVE e0 1 0
BATTLEFIELD PROMPT_MOVE a1
```

### Important behavior notes

- `PROMPT_MOVE` must be called **during battle**. If it is run from a map event or common event outside `Scene_Battle`, no movement window will appear.
- `PROMPT_MOVE` only shows **adjacent declared zones**. If the battler is at `(0,0)` and there are no declared zones next to `(0,0)`, the prompt will close immediately.
- `MOVE` and `PROMPT_MOVE` should be run **after battle starts**, because battler battlefield positions are reset at battle start.
- Map-note declarations are loaded for the **map where the battle started**.
- `ZONE` creates a global zone that can be used on any map.
- `ZONE_MAP` / `ZONE` now support multi-word labels directly. Use `|` only when you also want to set description in the same command.
  - Example: `BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll | Open ground near trees`

### What Debug mode logs

When **Debug** is enabled, the plugin logs:

- an on-screen debug window during combat with the latest battlefield debug lines
- battle-start map ID and declared zone count
- every zone declaration
- battler movement via `BATTLEFIELD MOVE`
- when `PROMPT_MOVE` is requested
- when there are **no declared zones**
- when there are declared zones but **no adjacent zones** for the selected battler
- the current zone snapshot and which participants are inside each zone
- map-note zone declarations loaded at battle start

### Debug shell controls (during battle)

- `PageDown`: expand debug shell
- `PageUp`: contract debug shell
- The shell uses a solid black background for readability.

If you do not see the move prompt, turn **Debug** on and watch the on-screen debug window first, then check the browser console.

## TRA_Star-Wars-Dice debug option

`TRA_Star-Wars-Dice` also has a **Debug** parameter.

When enabled, every dice pool rolled through `DiceSystem.rollPool(...)` or `DiceSystem.rollPoolDetailed(...)` logs:

- the dice pool composition
- each die rolled
- the final totals after cancellations
