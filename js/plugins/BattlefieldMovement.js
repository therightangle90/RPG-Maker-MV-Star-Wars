/*:
 * @target MV
 * @plugindesc Battlefield positioning and engagement system for combat.
 *             Gives every combatant (actors and enemies) an X/Y coordinate
 *             on a bounded grid.  A Z layer handles close-quarters engagement
 *             between entities that share the same X/Y position.
 *
 * ---------------------------------------------------------------------------
 * BATTLER KEYS
 * ---------------------------------------------------------------------------
 * Every plugin command that refers to a specific combatant uses a "battler
 * key" string:
 *
 *   a<N>   – actor whose database ID is N  (e.g. a1, a2, a3)
 *   e<N>   – enemy at troop index N (0-based) (e.g. e0, e1, e2)
 *
 * ---------------------------------------------------------------------------
 * PLUGIN COMMANDS
 * ---------------------------------------------------------------------------
 *
 *  BATTLEFIELD MOVE battlerKey x y
 *    Move a battler to (x, y).  Blocked if the battler is engaged (Z > 0) or
 *    if the destination is outside the current bounds.
 *    Example:  BATTLEFIELD MOVE a1 2 -1
 *
 *  BATTLEFIELD ENGAGE attackerKey targetKey
 *    The attacker (must be Z=0) engages the target (any Z) at the same X/Y.
 *    Both are placed in the same Z group (the target's existing group, or a
 *    new one).  Engaged battlers cannot move on the X/Y axis.
 *    Example:  BATTLEFIELD ENGAGE a1 e0
 *
 *  BATTLEFIELD DISENGAGE battlerKey
 *    Remove a battler from its Z group.  The cleanup graph then dissolves any
 *    remaining group members that have no surviving engagement reason
 *    (see README for full rules).
 *    Example:  BATTLEFIELD DISENGAGE a1
 *
 *  BATTLEFIELD BOUNDS minX maxX minY maxY
 *    Override the movement boundaries for the current combat.
 *    Example:  BATTLEFIELD BOUNDS -3 3 -3 3
 *
 *  BATTLEFIELD LABEL x y label_text
 *    Set a global (all-maps) label for a coordinate.  Spaces in label_text
 *    are preserved (all remaining tokens are joined).
 *    Example:  BATTLEFIELD LABEL 0 0 The_Throne_Room
 *
 *  BATTLEFIELD LABEL_MAP mapId x y label_text
 *    Set a per-map label that overrides the global one.
 *    Example:  BATTLEFIELD LABEL_MAP 3 1 1 Hangar_Bay_Alpha
 *
 *  BATTLEFIELD DESC x y description_text
 *    Set a global description for a coordinate.
 *    Example:  BATTLEFIELD DESC 0 0 The centre of the chamber.
 *
 *  BATTLEFIELD DESC_MAP mapId x y description_text
 *    Set a per-map description.
 *    Example:  BATTLEFIELD DESC_MAP 3 0 0 A vast hangar.
 *
 *  BATTLEFIELD DEFAULT_DESC description_text
 *    Set the global fallback description used when a coordinate has no
 *    specific description.
 *    Example:  BATTLEFIELD DEFAULT_DESC An open area.
 *
 *  BATTLEFIELD MAP_DESC mapId description_text
 *    Set a per-map fallback description.
 *    Example:  BATTLEFIELD MAP_DESC 3 The Death Star hangar.
 *
 *  BATTLEFIELD QUERY battlerKey varX varY varZ
 *    Write the battler's current X, Y, Z into the three given variable IDs.
 *    Example:  BATTLEFIELD QUERY a1 10 11 12
 *              (sets variable 10 = X, variable 11 = Y, variable 12 = Z)
 *
 *  BATTLEFIELD SAME_ZONE battlerKey otherKey switchId
 *    Set the switch to ON if both battlers share the same X/Y (Z=0 counts
 *    too; it just means they're in the same cell but not engaged).
 *    Example:  BATTLEFIELD SAME_ZONE a1 e0 5
 *
 * ---------------------------------------------------------------------------
 *
 * @param globalDefaultDesc
 * @text Global Default Zone Description
 * @desc Shown for any coordinate with no specific description.
 * @type string
 * @default An open area.
 *
 * @param defaultMinX
 * @text Default Min X
 * @desc Minimum X boundary applied at the start of every battle.
 * @type number
 * @min -9999
 * @default -3
 *
 * @param defaultMaxX
 * @text Default Max X
 * @type number
 * @max 9999
 * @default 3
 *
 * @param defaultMinY
 * @text Default Min Y
 * @type number
 * @min -9999
 * @default -3
 *
 * @param defaultMaxY
 * @text Default Max Y
 * @type number
 * @max 9999
 * @default 3
 */

(function () {
    'use strict';

    var params          = PluginManager.parameters('BattlefieldMovement');
    var P_DEFAULT_DESC  = String(params.globalDefaultDesc  || 'An open area.');
    var P_DEFAULT_MIN_X = parseInt(params.defaultMinX,  10) || -3;
    var P_DEFAULT_MAX_X = parseInt(params.defaultMaxX,  10) ||  3;
    var P_DEFAULT_MIN_Y = parseInt(params.defaultMinY,  10) || -3;
    var P_DEFAULT_MAX_Y = parseInt(params.defaultMaxY,  10) ||  3;

    // -----------------------------------------------------------------------
    // Game_Battlefield  –  central store, added to save data
    // -----------------------------------------------------------------------

    function Game_Battlefield() {
        this.initialize();
    }

    Game_Battlefield.prototype.initialize = function () {
        // Movement boundaries (may be overridden per-combat via plugin cmd)
        this.bounds = {
            minX: P_DEFAULT_MIN_X,
            maxX: P_DEFAULT_MAX_X,
            minY: P_DEFAULT_MIN_Y,
            maxY: P_DEFAULT_MAX_Y
        };

        // The map that was active when the current combat started.
        this.currentMapId = null;

        // Zone metadata: "x,y" -> { label, desc }
        this.zoneData     = {};          // global (all maps)
        this.mapZoneData  = {};          // mapId -> { "x,y" -> {label,desc} }

        // Fallback descriptions when a zone has no specific desc
        this.globalDefaultDesc = P_DEFAULT_DESC;
        this.mapDefaultDesc    = {};     // mapId -> string
    };

    // --- zone key helpers ---------------------------------------------------

    Game_Battlefield.prototype._key = function (x, y) {
        return x + ',' + y;
    };

    Game_Battlefield.prototype.getZoneLabel = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].label) return mapData[key].label;
        if (this.zoneData[key] && this.zoneData[key].label) return this.zoneData[key].label;
        return '(' + x + ', ' + y + ')';
    };

    Game_Battlefield.prototype.getZoneDesc = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].desc) return mapData[key].desc;
        if (this.zoneData[key] && this.zoneData[key].desc) return this.zoneData[key].desc;
        if (this.currentMapId && this.mapDefaultDesc[this.currentMapId]) {
            return this.mapDefaultDesc[this.currentMapId];
        }
        return this.globalDefaultDesc;
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

    // --- boundary check -----------------------------------------------------

    Game_Battlefield.prototype.isInBounds = function (x, y) {
        return (x >= this.bounds.minX && x <= this.bounds.maxX &&
                y >= this.bounds.minY && y <= this.bounds.maxY);
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

    // Find the next unused positive Z integer at the given X/Y cell.
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

    // Return all battlers currently in a specific (x, y, z>0) group.
    Game_Battlefield.prototype.groupAt = function (x, y, z) {
        return this.allBattlers().filter(function (b) {
            return b._bfX === x && b._bfY === y && b._bfZ === z;
        });
    };

    // --- ENGAGE -------------------------------------------------------------
    //
    //  Rules:
    //    • attacker must be free (Z = 0) and at the same X/Y as the target
    //    • if target is already in a Z group, attacker joins it
    //    • otherwise a new Z group is created and both enter it
    //    • attacker._bfEngagedWith is set to the target's battler key
    //    • the target is pulled into the group but does not set engagedWith
    //      (they were the object of engagement, not the initiator)

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
            // Join the target's existing group
            z = target._bfZ;
        } else {
            // Create a new group; pull target in
            z          = this._nextZ(attacker._bfX, attacker._bfY);
            target._bfZ = z;
        }

        attacker._bfZ          = z;
        attacker._bfEngagedWith = this.battlerKey(target);
        return true;
    };

    // --- DISENGAGE ----------------------------------------------------------
    //
    //  Rules:
    //    1. The battler leaves its Z group (Z → 0, engagedWith → null).
    //    2. Any other group member whose _bfEngagedWith pointed at the
    //       departing battler has that reference cleared.
    //    3. A cascade cleanup removes any remaining member that has neither
    //       an active engagedWith target nor anyone actively engaging them.
    //       This repeats until the group stabilises.

    Game_Battlefield.prototype.disengage = function (battler) {
        if (!battler || battler._bfZ === 0) return;

        var x   = battler._bfX;
        var y   = battler._bfY;
        var z   = battler._bfZ;
        var key = this.battlerKey(battler);

        // Step 1: remove the battler
        battler._bfZ          = 0;
        battler._bfEngagedWith = null;

        // Step 2: clear stale references to the departing battler
        this.allBattlers().forEach(function (b) {
            if (b._bfEngagedWith === key) b._bfEngagedWith = null;
        });

        // Step 3: cascade cleanup
        var changed = true;
        while (changed) {
            changed = false;
            var group = this.groupAt(x, y, z);
            for (var i = 0; i < group.length; i++) {
                var e    = group[i];
                var eKey = this.battlerKey(e);
                var hasReason = false;

                // Does e actively engage someone still in the group?
                if (e._bfEngagedWith) {
                    var tgt = this.battlerFromKey(e._bfEngagedWith);
                    if (tgt && tgt._bfX === x && tgt._bfY === y && tgt._bfZ === z) {
                        hasReason = true;
                    }
                }

                // Is someone in the group actively engaging e?
                if (!hasReason) {
                    for (var j = 0; j < group.length; j++) {
                        if (j !== i && group[j]._bfEngagedWith === eKey) {
                            hasReason = true;
                            break;
                        }
                    }
                }

                if (!hasReason) {
                    e._bfZ          = 0;
                    e._bfEngagedWith = null;
                    changed = true;
                    break;   // group changed; restart the scan
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
        this._bfX          = 0;
        this._bfY          = 0;
        this._bfZ          = 0;   // 0 = free; >0 = engaged group index
        this._bfEngagedWith = null; // battler key of the target this unit engaged
    };

    // Convenience accessor so scripts can check engagement
    Game_Battler.prototype.bfIsEngaged = function () {
        return this._bfZ > 0;
    };

    // -----------------------------------------------------------------------
    // Auto-initialise at the start of every battle
    // -----------------------------------------------------------------------

    var _Scene_Battle_start = Scene_Battle.prototype.start;
    Scene_Battle.prototype.start = function () {
        _Scene_Battle_start.call(this);
        $gameBattlefield.currentMapId = $gameMap.mapId();
        // Reset all battler positions; zone data is intentionally preserved
        $gameBattlefield.allBattlers().forEach(function (b) {
            b._bfX          = 0;
            b._bfY          = 0;
            b._bfZ          = 0;
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
    // Plugin commands
    // -----------------------------------------------------------------------

    var _pluginCommand = Game_Interpreter.prototype.pluginCommand;
    Game_Interpreter.prototype.pluginCommand = function (command, args) {
        _pluginCommand.call(this, command, args);
        if (command.toUpperCase() !== 'BATTLEFIELD') return;

        var sub = (args[0] || '').toUpperCase();

        switch (sub) {

            // ---- MOVE -------------------------------------------------------
            // BATTLEFIELD MOVE battlerKey x y
            case 'MOVE': {
                var moveBattler = $gameBattlefield.battlerFromKey(args[1]);
                if (!moveBattler) { console.warn('BattlefieldMovement MOVE: battler not found: ' + args[1]); break; }
                if (moveBattler._bfZ !== 0) { console.warn('BattlefieldMovement MOVE: battler is engaged and cannot move.'); break; }
                var mx = parseInt(args[2], 10);
                var my = parseInt(args[3], 10);
                if (!$gameBattlefield.isInBounds(mx, my)) { console.warn('BattlefieldMovement MOVE: (' + mx + ',' + my + ') is outside bounds.'); break; }
                moveBattler._bfX = mx;
                moveBattler._bfY = my;
                break;
            }

            // ---- ENGAGE -----------------------------------------------------
            // BATTLEFIELD ENGAGE attackerKey targetKey
            case 'ENGAGE': {
                var attacker = $gameBattlefield.battlerFromKey(args[1]);
                var target   = $gameBattlefield.battlerFromKey(args[2]);
                if (!attacker) { console.warn('BattlefieldMovement ENGAGE: attacker not found: ' + args[1]); break; }
                if (!target)   { console.warn('BattlefieldMovement ENGAGE: target not found: '   + args[2]); break; }
                $gameBattlefield.engage(attacker, target);
                break;
            }

            // ---- DISENGAGE --------------------------------------------------
            // BATTLEFIELD DISENGAGE battlerKey
            case 'DISENGAGE': {
                var disengager = $gameBattlefield.battlerFromKey(args[1]);
                if (!disengager) { console.warn('BattlefieldMovement DISENGAGE: battler not found: ' + args[1]); break; }
                $gameBattlefield.disengage(disengager);
                break;
            }

            // ---- BOUNDS -----------------------------------------------------
            // BATTLEFIELD BOUNDS minX maxX minY maxY
            case 'BOUNDS': {
                $gameBattlefield.bounds.minX = parseInt(args[1], 10);
                $gameBattlefield.bounds.maxX = parseInt(args[2], 10);
                $gameBattlefield.bounds.minY = parseInt(args[3], 10);
                $gameBattlefield.bounds.maxY = parseInt(args[4], 10);
                break;
            }

            // ---- LABEL (global) --------------------------------------------
            // BATTLEFIELD LABEL x y label_text...
            case 'LABEL': {
                var lx    = parseInt(args[1], 10);
                var ly    = parseInt(args[2], 10);
                var ltext = args.slice(3).join(' ');
                $gameBattlefield.setZoneLabel(lx, ly, ltext, null);
                break;
            }

            // ---- LABEL_MAP (per-map) ----------------------------------------
            // BATTLEFIELD LABEL_MAP mapId x y label_text...
            case 'LABEL_MAP': {
                var lmMapId = parseInt(args[1], 10);
                var lmx     = parseInt(args[2], 10);
                var lmy     = parseInt(args[3], 10);
                var lmtext  = args.slice(4).join(' ');
                $gameBattlefield.setZoneLabel(lmx, lmy, lmtext, lmMapId);
                break;
            }

            // ---- DESC (global) ---------------------------------------------
            // BATTLEFIELD DESC x y description_text...
            case 'DESC': {
                var dx    = parseInt(args[1], 10);
                var dy    = parseInt(args[2], 10);
                var dtext = args.slice(3).join(' ');
                $gameBattlefield.setZoneDesc(dx, dy, dtext, null);
                break;
            }

            // ---- DESC_MAP (per-map) -----------------------------------------
            // BATTLEFIELD DESC_MAP mapId x y description_text...
            case 'DESC_MAP': {
                var dmMapId = parseInt(args[1], 10);
                var dmx     = parseInt(args[2], 10);
                var dmy     = parseInt(args[3], 10);
                var dmtext  = args.slice(4).join(' ');
                $gameBattlefield.setZoneDesc(dmx, dmy, dmtext, dmMapId);
                break;
            }

            // ---- DEFAULT_DESC (global fallback) ----------------------------
            // BATTLEFIELD DEFAULT_DESC description_text...
            case 'DEFAULT_DESC': {
                $gameBattlefield.globalDefaultDesc = args.slice(1).join(' ');
                break;
            }

            // ---- MAP_DESC (per-map fallback) --------------------------------
            // BATTLEFIELD MAP_DESC mapId description_text...
            case 'MAP_DESC': {
                var mdMapId = parseInt(args[1], 10);
                $gameBattlefield.mapDefaultDesc[mdMapId] = args.slice(2).join(' ');
                break;
            }

            // ---- QUERY ------------------------------------------------------
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

            // ---- SAME_ZONE --------------------------------------------------
            // BATTLEFIELD SAME_ZONE battlerKey otherKey switchId
            case 'SAME_ZONE': {
                var szA  = $gameBattlefield.battlerFromKey(args[1]);
                var szB  = $gameBattlefield.battlerFromKey(args[2]);
                var szSw = parseInt(args[3], 10);
                if (!szA || !szB) { console.warn('BattlefieldMovement SAME_ZONE: battler not found.'); break; }
                var same = (szA._bfX === szB._bfX && szA._bfY === szB._bfY);
                $gameSwitches.setValue(szSw, same);
                break;
            }
        }
    };

    // -----------------------------------------------------------------------
    // Public global  (will be overwritten by DataManager.createGameObjects)
    // -----------------------------------------------------------------------
    /* global $gameBattlefield */
    var $gameBattlefield = new Game_Battlefield(); // jshint ignore:line

})();
