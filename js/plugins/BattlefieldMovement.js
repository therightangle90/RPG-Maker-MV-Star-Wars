/*:
 * @target MV
 * @plugindesc Battlefield positioning and engagement system for combat.
 *             Valid coordinates are explicitly declared per map; players choose
 *             destinations via an in-battle menu.  A Z layer handles
 *             close-quarters engagement.
 *
 * ---------------------------------------------------------------------------
 * QUICK START
 * ---------------------------------------------------------------------------
 * 1.  Before (or at the start of) a battle on map 5, declare every reachable
 *     location with BATTLEFIELD LABEL_MAP or BATTLEFIELD ZONE_MAP:
 *
 *       BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll Open ground near the trees.
 *       BATTLEFIELD ZONE_MAP 5 0 1 Book Depository A six-floor building.
 *       BATTLEFIELD ZONE_MAP 5 1 0 Public Road A busy street.
 *
 * 2.  Place battlers at their starting location with BATTLEFIELD MOVE:
 *
 *       BATTLEFIELD MOVE a1 0 0
 *       BATTLEFIELD MOVE e0 1 0
 *
 * 3.  To let a player character move interactively during battle, use:
 *
 *       BATTLEFIELD PROMPT_MOVE a1
 *
 *     This pauses the event, shows a window listing every declared zone
 *     adjacent to actor 1's current position (sorted A-Z), waits for
 *     the player to pick one, then resumes.
 *
 * ---------------------------------------------------------------------------
 * BATTLER KEYS
 * ---------------------------------------------------------------------------
 *   a<N>   – actor whose database ID is N  (e.g. a1, a2, a3)
 *   e<N>   – enemy at troop index N, 0-based  (e.g. e0, e1, e2)
 *
 * ---------------------------------------------------------------------------
 * PLUGIN COMMANDS
 * ---------------------------------------------------------------------------
 *
 *  BATTLEFIELD ZONE_MAP mapId x y name [description...]
 *    Declare a valid zone for a specific map, giving it a name and an
 *    optional longer description.  This is the primary way to define the
 *    battlefield layout for a map.
 *    Example:  BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll Open ground.
 *
 *  BATTLEFIELD ZONE x y name [description...]
 *    Declare a zone globally (used when the current map has no override).
 *    Example:  BATTLEFIELD ZONE 0 0 Central Plaza
 *
 *  BATTLEFIELD MOVE battlerKey x y
 *    Force-place a battler at (x, y).  Blocked only if the battler is
 *    engaged (Z > 0).  Use this for scripted / enemy-AI movement; no
 *    player menu is shown.
 *    Example:  BATTLEFIELD MOVE a1 0 0
 *
 *  BATTLEFIELD PROMPT_MOVE battlerKey
 *    Show the player a menu of valid adjacent zones and wait for a choice.
 *    Movement is applied automatically after selection.  Cancelled input
 *    leaves the battler in place.  Blocked if the battler is engaged.
 *    Example:  BATTLEFIELD PROMPT_MOVE a1
 *
 *  BATTLEFIELD ENGAGE attackerKey targetKey
 *    The attacker (must be Z=0) engages the target at the same X/Y.
 *    Both are placed in the same Z group.  Engaged battlers cannot move.
 *    Example:  BATTLEFIELD ENGAGE a1 e0
 *
 *  BATTLEFIELD DISENGAGE battlerKey
 *    Remove a battler from its Z group; cascade-dissolves orphaned members.
 *    Example:  BATTLEFIELD DISENGAGE a1
 *
 *  BATTLEFIELD LABEL_MAP mapId x y label_text...
 *    Set (or update) the display name of a per-map zone.
 *    Example:  BATTLEFIELD LABEL_MAP 5 1 0 Public Road
 *
 *  BATTLEFIELD LABEL x y label_text...
 *    Set a global zone name (used when no per-map entry exists).
 *    Example:  BATTLEFIELD LABEL 0 0 Central Plaza
 *
 *  BATTLEFIELD DESC_MAP mapId x y description_text...
 *    Set (or update) the description of a per-map zone.
 *    Example:  BATTLEFIELD DESC_MAP 5 0 1 A six-floor building.
 *
 *  BATTLEFIELD DESC x y description_text...
 *    Set a global zone description.
 *    Example:  BATTLEFIELD DESC 0 0 The centre of the plaza.
 *
 *  BATTLEFIELD QUERY battlerKey varX varY varZ
 *    Write the battler's current X, Y, Z into three game variables.
 *    Example:  BATTLEFIELD QUERY a1 10 11 12
 *
 *  BATTLEFIELD SAME_ZONE battlerKeyA battlerKeyB switchId
 *    Set the switch ON if both battlers share the same X/Y coordinate.
 *    Example:  BATTLEFIELD SAME_ZONE a1 e0 5
 *
 * ---------------------------------------------------------------------------
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Game_Battlefield  –  central store, written to save data
    // -----------------------------------------------------------------------

    function Game_Battlefield() {
        this.initialize();
    }

    Game_Battlefield.prototype.initialize = function () {
        // The map that was active when the current combat started.
        this.currentMapId = null;

        // Zone metadata: "x,y" -> { label, desc }
        this.zoneData    = {};   // global (all maps)
        this.mapZoneData = {};   // mapId -> { "x,y" -> { label, desc } }
    };

    // --- internal key -------------------------------------------------------

    Game_Battlefield.prototype._key = function (x, y) {
        return x + ',' + y;
    };

    // --- zone data access ---------------------------------------------------

    // Returns the label for (x,y) using per-map data first, global second.
    // Returns null if the zone has not been declared at all.
    Game_Battlefield.prototype.getZoneLabel = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].label) return mapData[key].label;
        if (this.zoneData[key] && this.zoneData[key].label) return this.zoneData[key].label;
        return null;
    };

    // Returns the description for (x,y), or null if none was set.
    Game_Battlefield.prototype.getZoneDesc = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].desc) return mapData[key].desc;
        if (this.zoneData[key] && this.zoneData[key].desc) return this.zoneData[key].desc;
        return null;
    };

    // Returns true only if the zone has been explicitly declared.
    Game_Battlefield.prototype.isValidZone = function (x, y) {
        return this.getZoneLabel(x, y) !== null;
    };

    Game_Battlefield.prototype.setZoneLabel = function (x, y, label, mapId) {
        var key = this._key(x, y);
        if (mapId !== null && mapId !== undefined) {
            this.mapZoneData[mapId] = this.mapZoneData[mapId] || {};
            this.mapZoneData[mapId][key] = this.mapZoneData[mapId][key] || {};
            this.mapZoneData[mapId][key].label = label;
        } else {
            this.zoneData[key] = this.zoneData[key] || {};
            this.zoneData[key].label = label;
        }
    };

    Game_Battlefield.prototype.setZoneDesc = function (x, y, desc, mapId) {
        var key = this._key(x, y);
        if (mapId !== null && mapId !== undefined) {
            this.mapZoneData[mapId] = this.mapZoneData[mapId] || {};
            this.mapZoneData[mapId][key] = this.mapZoneData[mapId][key] || {};
            this.mapZoneData[mapId][key].desc = desc;
        } else {
            this.zoneData[key] = this.zoneData[key] || {};
            this.zoneData[key].desc = desc;
        }
    };

    // --- adjacency ----------------------------------------------------------

    // Returns all declared zones within Chebyshev distance 1 of (x, y),
    // excluding (x, y) itself, sorted alphabetically by label.
    Game_Battlefield.prototype.adjacentValidZones = function (x, y) {
        var self    = this;
        var mapId   = this.currentMapId;
        var mapData = mapId ? (this.mapZoneData[mapId] || {}) : {};
        var seen    = {};
        var result  = [];

        function addIfAdjacent(key, entry) {
            if (seen[key]) return;
            var parts = key.split(',');
            var zx    = parseInt(parts[0], 10);
            var zy    = parseInt(parts[1], 10);
            if (Math.abs(zx - x) <= 1 && Math.abs(zy - y) <= 1 && (zx !== x || zy !== y)) {
                var label = entry.label;
                if (label) {
                    seen[key] = true;
                    result.push({ x: zx, y: zy, label: label });
                }
            }
        }

        // Per-map zones for the current map take priority.
        Object.keys(mapData).forEach(function (key) { addIfAdjacent(key, mapData[key]); });

        // Global zones fill in anything not already covered.
        Object.keys(self.zoneData).forEach(function (key) { addIfAdjacent(key, self.zoneData[key]); });

        result.sort(function (a, b) {
            return a.label.toLowerCase().localeCompare(b.label.toLowerCase());
        });
        return result;
    };

    // --- battler helpers ----------------------------------------------------

    Game_Battlefield.prototype.allBattlers = function () {
        var list = [];
        if ($gameParty) list = list.concat($gameParty.members());
        if ($gameTroop) list = list.concat($gameTroop.members());
        return list;
    };

    Game_Battlefield.prototype.battlerKey = function (battler) {
        if (!battler) return null;
        if (battler.isActor()) return 'a' + battler.actorId();
        var members = $gameTroop ? $gameTroop.members() : [];
        for (var i = 0; i < members.length; i++) {
            if (members[i] === battler) return 'e' + i;
        }
        return null;
    };

    Game_Battlefield.prototype.battlerFromKey = function (key) {
        if (!key) return null;
        var m;
        m = key.match(/^a(\d+)$/i);
        if (m) return $gameActors.actor(parseInt(m[1], 10));
        m = key.match(/^e(\d+)$/i);
        if (m) {
            var idx = parseInt(m[1], 10);
            return ($gameTroop && $gameTroop.members()[idx]) || null;
        }
        return null;
    };

    // --- Z group helpers ----------------------------------------------------

    // Next unused positive Z integer at the given X/Y cell.
    Game_Battlefield.prototype._nextZ = function (x, y) {
        var used = {};
        this.allBattlers().forEach(function (b) {
            if (b._bfX === x && b._bfY === y && b._bfZ > 0) used[b._bfZ] = true;
        });
        for (var z = 1; z <= 9999; z++) {
            if (!used[z]) return z;
        }
        return 1;
    };

    // All battlers in a specific (x, y, z>0) engagement group.
    Game_Battlefield.prototype.groupAt = function (x, y, z) {
        return this.allBattlers().filter(function (b) {
            return b._bfX === x && b._bfY === y && b._bfZ === z;
        });
    };

    // --- ENGAGE -------------------------------------------------------------

    Game_Battlefield.prototype.engage = function (attacker, target) {
        if (!attacker || !target) return false;
        if (attacker === target)  return false;
        if (attacker._bfZ !== 0) {
            console.warn('BattlefieldMovement: Attacker is already engaged – disengage first.');
            return false;
        }
        if (attacker._bfX !== target._bfX || attacker._bfY !== target._bfY) {
            console.warn('BattlefieldMovement: Battlers must share the same X/Y to engage.');
            return false;
        }

        var z;
        if (target._bfZ > 0) {
            z = target._bfZ;
        } else {
            z           = this._nextZ(attacker._bfX, attacker._bfY);
            target._bfZ = z;
        }

        attacker._bfZ          = z;
        attacker._bfEngagedWith = this.battlerKey(target);
        return true;
    };

    // --- DISENGAGE ----------------------------------------------------------

    Game_Battlefield.prototype.disengage = function (battler) {
        if (!battler || battler._bfZ === 0) return;

        var x   = battler._bfX;
        var y   = battler._bfY;
        var z   = battler._bfZ;
        var key = this.battlerKey(battler);

        battler._bfZ           = 0;
        battler._bfEngagedWith = null;

        this.allBattlers().forEach(function (b) {
            if (b._bfEngagedWith === key) b._bfEngagedWith = null;
        });

        // Cascade: eject members with no remaining engagement reason.
        var changed = true;
        while (changed) {
            changed = false;
            var group = this.groupAt(x, y, z);
            for (var i = 0; i < group.length; i++) {
                var e        = group[i];
                var eKey     = this.battlerKey(e);
                var hasReason = false;

                if (e._bfEngagedWith) {
                    var tgt = this.battlerFromKey(e._bfEngagedWith);
                    if (tgt && tgt._bfX === x && tgt._bfY === y && tgt._bfZ === z) {
                        hasReason = true;
                    }
                }

                if (!hasReason) {
                    for (var j = 0; j < group.length; j++) {
                        if (j !== i && group[j]._bfEngagedWith === eKey) {
                            hasReason = true;
                            break;
                        }
                    }
                }

                if (!hasReason) {
                    e._bfZ           = 0;
                    e._bfEngagedWith = null;
                    changed = true;
                    break;
                }
            }
        }
    };

    // -----------------------------------------------------------------------
    // Extend Game_Battler with battlefield position fields
    // -----------------------------------------------------------------------

    var _Battler_initMembers = Game_Battler.prototype.initMembers;
    Game_Battler.prototype.initMembers = function () {
        _Battler_initMembers.call(this);
        this._bfX           = 0;
        this._bfY           = 0;
        this._bfZ           = 0;    // 0 = free; >0 = engaged group index
        this._bfEngagedWith = null; // battler key of the target this unit engaged
    };

    Game_Battler.prototype.bfIsEngaged = function () {
        return this._bfZ > 0;
    };

    // -----------------------------------------------------------------------
    // Auto-initialise at the start of every battle
    // -----------------------------------------------------------------------

    var _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function () {
        _Scene_Battle_start.call(this);
        this._bfMoveSelectWindow = null;
        $gameBattlefield.currentMapId = $gameMap.mapId();
        // Reset all battler positions; declared zone data is preserved.
        $gameBattlefield.allBattlers().forEach(function (b) {
            b._bfX           = 0;
            b._bfY           = 0;
            b._bfZ           = 0;
            b._bfEngagedWith = null;
        });
    };

    // -----------------------------------------------------------------------
    // Save / Load support
    // -----------------------------------------------------------------------

    var _makeSave = DataManager.makeSaveContents;
    DataManager.makeSaveContents = function () {
        var contents = _makeSave.call(this);
        contents.battlefield = $gameBattlefield;
        return contents;
    };

    var _extractSave = DataManager.extractSaveContents;
    DataManager.extractSaveContents = function (contents) {
        _extractSave.call(this, contents);
        if (contents.battlefield) {
            $gameBattlefield = contents.battlefield;
            Object.setPrototypeOf($gameBattlefield, Game_Battlefield.prototype);
        }
    };

    var _createGameObjects = DataManager.createGameObjects;
    DataManager.createGameObjects = function () {
        _createGameObjects.call(this);
        $gameBattlefield = new Game_Battlefield();
    };

    // -----------------------------------------------------------------------
    // Interactive move-selection window
    // -----------------------------------------------------------------------

    // Shared state between the interpreter wait-mode and the scene window.
    var _bfSelect = {
        pending:   false,   // set by PROMPT_MOVE; cleared when window closes
        battler:   null,    // the battler that is moving
        completed: false    // set to true when the player has made (or cancelled) a choice
    };

    // ---- Window_BfMoveSelect -----------------------------------------------

    function Window_BfMoveSelect() {
        this.initialize.apply(this, arguments);
    }

    Window_BfMoveSelect.prototype = Object.create(Window_Command.prototype);
    Window_BfMoveSelect.prototype.constructor = Window_BfMoveSelect;

    Window_BfMoveSelect.prototype.initialize = function (choices) {
        // Must be set before calling super (super calls makeCommandList).
        this._bfChoices = choices || [];
        var ww = this.windowWidth();
        var wx = Math.floor((Graphics.boxWidth  - ww) / 2);
        var wy = Math.floor((Graphics.boxHeight - this.windowHeight()) / 2);
        Window_Command.prototype.initialize.call(this, wx, wy);
    };

    Window_BfMoveSelect.prototype.windowWidth = function () {
        return 320;
    };

    Window_BfMoveSelect.prototype.numVisibleRows = function () {
        return Math.min(this._bfChoices ? this._bfChoices.length : 1, 8);
    };

    Window_BfMoveSelect.prototype.makeCommandList = function () {
        var self = this;
        (this._bfChoices || []).forEach(function (c) {
            // Store {x, y, label} in the ext slot so the OK handler can read it.
            self.addCommand(c.label, 'goto', true, c);
        });
    };

    // ---- Scene_Battle integration ------------------------------------------

    var _Scene_Battle_update = Scene_Battle.prototype.update;
    Scene_Battle.prototype.update = function () {
        _Scene_Battle_update.call(this);
        if (_bfSelect.pending && !this._bfMoveSelectWindow) {
            this._bfCreateMoveWindow();
        }
    };

    Scene_Battle.prototype._bfCreateMoveWindow = function () {
        var battler = _bfSelect.battler;
        var choices = $gameBattlefield.adjacentValidZones(battler._bfX, battler._bfY);

        if (choices.length === 0) {
            // No reachable declared zones — complete immediately with no move.
            _bfSelect.pending   = false;
            _bfSelect.completed = true;
            return;
        }

        var win = new Window_BfMoveSelect(choices);
        this._bfMoveSelectWindow = win;
        this.addWindow(win);
        win.setHandler('ok',     this._onBfMoveOk.bind(this));
        win.setHandler('cancel', this._onBfMoveCancel.bind(this));
        win.activate();
        win.select(0);
    };

    Scene_Battle.prototype._bfCloseMoveWindow = function () {
        if (this._bfMoveSelectWindow) {
            this._windowLayer.removeChild(this._bfMoveSelectWindow);
            this._bfMoveSelectWindow = null;
        }
        _bfSelect.pending   = false;
        _bfSelect.completed = true;
    };

    Scene_Battle.prototype._onBfMoveOk = function () {
        var data = this._bfMoveSelectWindow.currentExt();
        if (data) {
            _bfSelect.battler._bfX = data.x;
            _bfSelect.battler._bfY = data.y;
        }
        this._bfCloseMoveWindow();
    };

    Scene_Battle.prototype._onBfMoveCancel = function () {
        this._bfCloseMoveWindow();
    };

    // ---- Game_Interpreter wait-mode ----------------------------------------

    var _updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === 'bfMoveSelect') {
            if (_bfSelect.completed) {
                _bfSelect.completed = false;
                this._waitMode = '';
                return false; // done — let the interpreter continue
            }
            return true; // still waiting for player input
        }
        return _updateWaitMode.call(this);
    };

    // -----------------------------------------------------------------------
    // Plugin commands
    // -----------------------------------------------------------------------

    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command.toUpperCase() !== 'BATTLEFIELD') return;

        var sub = (args[0] || '').toUpperCase();

        switch (sub) {

            // ---- ZONE_MAP (per-map declaration: name + optional desc) ------
            // BATTLEFIELD ZONE_MAP mapId x y name [desc...]
            case 'ZONE_MAP': {
                var zmMapId = parseInt(args[1], 10);
                var zmx     = parseInt(args[2], 10);
                var zmy     = parseInt(args[3], 10);
                // First token after coords is the name; the rest is the description.
                var zmName  = args[4] || '';
                var zmDesc  = args.slice(5).join(' ');
                $gameBattlefield.setZoneLabel(zmx, zmy, zmName, zmMapId);
                if (zmDesc) $gameBattlefield.setZoneDesc(zmx, zmy, zmDesc, zmMapId);
                break;
            }

            // ---- ZONE (global declaration: name + optional desc) -----------
            // BATTLEFIELD ZONE x y name [desc...]
            case 'ZONE': {
                var zx    = parseInt(args[1], 10);
                var zy    = parseInt(args[2], 10);
                var zName = args[3] || '';
                var zDesc = args.slice(4).join(' ');
                $gameBattlefield.setZoneLabel(zx, zy, zName, null);
                if (zDesc) $gameBattlefield.setZoneDesc(zx, zy, zDesc, null);
                break;
            }

            // ---- MOVE (programmatic / force placement) ----------------------
            // BATTLEFIELD MOVE battlerKey x y
            case 'MOVE': {
                var moveBattler = $gameBattlefield.battlerFromKey(args[1]);
                if (!moveBattler) { console.warn('BattlefieldMovement MOVE: battler not found: ' + args[1]); break; }
                if (moveBattler._bfZ !== 0) { console.warn('BattlefieldMovement MOVE: battler is engaged and cannot move.'); break; }
                moveBattler._bfX = parseInt(args[2], 10);
                moveBattler._bfY = parseInt(args[3], 10);
                break;
            }

            // ---- PROMPT_MOVE (interactive player choice) -------------------
            // BATTLEFIELD PROMPT_MOVE battlerKey
            case 'PROMPT_MOVE': {
                var pmBattler = $gameBattlefield.battlerFromKey(args[1]);
                if (!pmBattler) { console.warn('BattlefieldMovement PROMPT_MOVE: battler not found: ' + args[1]); break; }
                if (pmBattler._bfZ !== 0) { console.warn('BattlefieldMovement PROMPT_MOVE: battler is engaged and cannot move.'); break; }
                _bfSelect.pending   = true;
                _bfSelect.battler   = pmBattler;
                _bfSelect.completed = false;
                this.setWaitMode('bfMoveSelect');
                break;
            }

            // ---- ENGAGE ----------------------------------------------------
            // BATTLEFIELD ENGAGE attackerKey targetKey
            case 'ENGAGE': {
                var attacker = $gameBattlefield.battlerFromKey(args[1]);
                var target   = $gameBattlefield.battlerFromKey(args[2]);
                if (!attacker) { console.warn('BattlefieldMovement ENGAGE: attacker not found: ' + args[1]); break; }
                if (!target)   { console.warn('BattlefieldMovement ENGAGE: target not found: '   + args[2]); break; }
                $gameBattlefield.engage(attacker, target);
                break;
            }

            // ---- DISENGAGE -------------------------------------------------
            // BATTLEFIELD DISENGAGE battlerKey
            case 'DISENGAGE': {
                var disengager = $gameBattlefield.battlerFromKey(args[1]);
                if (!disengager) { console.warn('BattlefieldMovement DISENGAGE: battler not found: ' + args[1]); break; }
                $gameBattlefield.disengage(disengager);
                break;
            }

            // ---- LABEL_MAP (update per-map zone name) ----------------------
            // BATTLEFIELD LABEL_MAP mapId x y label_text...
            case 'LABEL_MAP': {
                var lmMapId = parseInt(args[1], 10);
                var lmx     = parseInt(args[2], 10);
                var lmy     = parseInt(args[3], 10);
                $gameBattlefield.setZoneLabel(lmx, lmy, args.slice(4).join(' '), lmMapId);
                break;
            }

            // ---- LABEL (update global zone name) ---------------------------
            // BATTLEFIELD LABEL x y label_text...
            case 'LABEL': {
                var lx = parseInt(args[1], 10);
                var ly = parseInt(args[2], 10);
                $gameBattlefield.setZoneLabel(lx, ly, args.slice(3).join(' '), null);
                break;
            }

            // ---- DESC_MAP (update per-map zone description) ----------------
            // BATTLEFIELD DESC_MAP mapId x y description_text...
            case 'DESC_MAP': {
                var dmMapId = parseInt(args[1], 10);
                var dmx     = parseInt(args[2], 10);
                var dmy     = parseInt(args[3], 10);
                $gameBattlefield.setZoneDesc(dmx, dmy, args.slice(4).join(' '), dmMapId);
                break;
            }

            // ---- DESC (update global zone description) ---------------------
            // BATTLEFIELD DESC x y description_text...
            case 'DESC': {
                var dx = parseInt(args[1], 10);
                var dy = parseInt(args[2], 10);
                $gameBattlefield.setZoneDesc(dx, dy, args.slice(3).join(' '), null);
                break;
            }

            // ---- QUERY -----------------------------------------------------
            // BATTLEFIELD QUERY battlerKey varX varY varZ
            case 'QUERY': {
                var qb = $gameBattlefield.battlerFromKey(args[1]);
                if (!qb) { console.warn('BattlefieldMovement QUERY: battler not found: ' + args[1]); break; }
                var qvX = parseInt(args[2], 10);
                var qvY = parseInt(args[3], 10);
                var qvZ = parseInt(args[4], 10);
                if (qvX) $gameVariables.setValue(qvX, qb._bfX);
                if (qvY) $gameVariables.setValue(qvY, qb._bfY);
                if (qvZ) $gameVariables.setValue(qvZ, qb._bfZ);
                break;
            }

            // ---- SAME_ZONE -------------------------------------------------
            // BATTLEFIELD SAME_ZONE battlerKeyA battlerKeyB switchId
            case 'SAME_ZONE': {
                var szA  = $gameBattlefield.battlerFromKey(args[1]);
                var szB  = $gameBattlefield.battlerFromKey(args[2]);
                var szSw = parseInt(args[3], 10);
                if (!szA || !szB) { console.warn('BattlefieldMovement SAME_ZONE: battler not found.'); break; }
                $gameSwitches.setValue(szSw, szA._bfX === szB._bfX && szA._bfY === szB._bfY);
                break;
            }
        }
    };

    // -----------------------------------------------------------------------
    // Public global
    // This initial value is superseded by DataManager.createGameObjects on
    // every normal game start and by DataManager.extractSaveContents on load.
    // It exists only so that any code that references $gameBattlefield before
    // those hooks fire (e.g. during plugin loading) does not throw.
    // -----------------------------------------------------------------------
    /* global $gameBattlefield */
    var $gameBattlefield = new Game_Battlefield(); // jshint ignore:line

})();
