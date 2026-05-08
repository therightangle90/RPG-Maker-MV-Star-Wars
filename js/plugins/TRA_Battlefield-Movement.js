/*:
 * @target MV
 * @plugindesc Battlefield positioning and engagement system for combat.
 *             Valid coordinates are explicitly declared per map; players choose
 *             destinations via an in-battle menu.  A Z layer handles
 *             close-quarters engagement.
 *
 * @param Debug
 * @text Debug
 * @desc When ON, logs battlefield events to the console and to battlefield-debug.log in the game folder.
 * @type boolean
 * @default false
 *
 * @param Engaged State Id
 * @type state
 * @default 0
 * @desc State applied while a battler is engaged (Z > 0). 0 disables.
 *
 * @param Disengaged State Id
 * @type state
 * @default 0
 * @desc State applied while a battler is not engaged and not near an enemy. 0 disables.
 *
 * @param Proximity State Id
 * @type state
 * @default 0
 * @desc State applied while a battler is not engaged but is within 1 zone of an enemy. 0 disables.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * This plugin adds battle-space positioning with:
 * - declared valid zones per map
 * - battler movement between adjacent zones
 * - engagement groups using Z layers
 * - plugin commands for setup and movement prompts
 *
 * ---------------------------------------------------------------------------
 * QUICK START
 * ---------------------------------------------------------------------------
 * 1.  Declare reachable locations for a map either in map notes (recommended)
 *     or with plugin commands.
 *
 *     Map note format:
 *       <BATTLEFIELD_ZONES>
 *       0,0,Grassy Knoll | Open ground near the trees. | Low Light | Soft Cover
 *       0,1,Book Depository | A six-floor building.
 *       1,0,Public Road | A busy street.
 *       </BATTLEFIELD_ZONES>
 *
 *     Segments in each line are separated by '|':
 *       x,y,Label | Description | Property One | Property Two | ...
 *
 *     Properties are arbitrary text strings (no restricted list).  Any number
 *     of properties can be appended after the description.
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
 *   a<N>       – actor whose database ID is N  (e.g. a1, a2, a3)
 *   e<N>       – enemy at troop index N, 0-based  (e.g. e0, e1, e2)
 *
 *   Variable substitution (useful when the same event covers multiple actors):
 *   a$v<N>     – actor with database ID = value of game variable N
 *                  e.g. a$v3  →  a<value of variable 3>
 *   e$v<N>     – enemy at troop index = value of game variable N
 *   $v<N>      – variable N holds the full key string (e.g. "a2" or "e0")
 *
 *   Examples:
 *     Set variable 1 to 2, then use:   BATTLEFIELD PROMPT_MOVE a$v1
 *     Set variable 1 to "a2", then use: BATTLEFIELD PROMPT_MOVE $v1
 *
 * ---------------------------------------------------------------------------
 * DEBUG LOGGING
 * ---------------------------------------------------------------------------
 *   When the Debug parameter is ON, events are written to:
 *     battlefield-debug.log  (created in the game root folder)
 *   The log file is cleared each time the game launches.
 *   Open it in a text editor or a tail-capable viewer (e.g. VSCode, Notepad++)
 *   to follow events live without anything on screen.
 *   Events are also printed to the browser/NW.js console.
 *
 * ---------------------------------------------------------------------------
 * PLUGIN COMMANDS
 * ---------------------------------------------------------------------------
 *
 *  BATTLEFIELD ZONE_MAP mapId x y zone_label [| description [| prop1 [| prop2...]]]
 *    Declare a valid zone for a specific map, giving it a name, optional
 *    description, and any number of optional properties.
 *    Multi-word labels, descriptions, and property names are all supported.
 *    Example:  BATTLEFIELD ZONE_MAP 5 0 0 Grassy Knoll | Open ground. | Low Light
 *
 *  BATTLEFIELD ZONE x y zone_label [| description [| prop1 [| prop2...]]]
 *    Declare a zone globally (used when the current map has no override).
 *    Example:  BATTLEFIELD ZONE 0 0 Central Plaza | Busy marketplace. | Crowded
 *
 *  MAP NOTE TAGS (auto-loaded at battle start for the current map)
 *    <BATTLEFIELD_ZONES>
 *      x,y,label
 *      x,y,label | description
 *      x,y,label | description | Property One | Property Two
 *    </BATTLEFIELD_ZONES>
 *
 *    Optional single-line variant:
 *      <BATTLEFIELD_ZONE:x,y,label>
 *      <BATTLEFIELD_ZONE:x,y,label | description | Property One>
 *
 *  BATTLEFIELD ZONE_PROP x y property name words...
 *    Add a property to a global zone (will not overwrite existing properties).
 *    Example:  BATTLEFIELD ZONE_PROP 0 0 Heavy Rain
 *
 *  BATTLEFIELD ZONE_PROP_MAP mapId x y property name words...
 *    Add a property to a per-map zone.
 *    Example:  BATTLEFIELD ZONE_PROP_MAP 5 0 1 Reinforced Barricade
 *
 *  BATTLEFIELD ZONE_HAS_PROP battlerKey switchId property name words...
 *    Set switch ON if the battler's current zone has the given property
 *    (case-insensitive), OFF otherwise.
 *    Example:  BATTLEFIELD ZONE_HAS_PROP a1 10 Low Light
 *
 *  BATTLEFIELD ZONE_HAS_PROP_XY x y switchId property name words...
 *    Same but checks a specific coordinate instead of a battler's position.
 *    Example:  BATTLEFIELD ZONE_HAS_PROP_XY 0 0 11 Dense Cover
 *
 *  BATTLEFIELD MOVE battlerKey x y
 *    Force-place a battler at (x, y).  Blocked only if the battler is
 *    engaged (Z > 0).  Use this for scripted / enemy-AI movement; no
 *    player menu is shown.
 *    Example:  BATTLEFIELD MOVE a1 0 0
 *
 *  BATTLEFIELD PROMPT_MOVE battlerKey [cancelSwitchId]
 *    Show the player a menu of valid adjacent zones and wait for a choice.
 *    Movement is applied automatically after selection.  Cancelled input
 *    leaves the battler in place.  Blocked if the battler is engaged.
 *    Optional cancelSwitchId: if provided, the switch is set ON when the
 *    player cancels (so you can refund a manoeuvre) and OFF on confirmation.
 *    Example (with cancel detection):  BATTLEFIELD PROMPT_MOVE a1 5
 *      After the command returns, check switch 5:
 *        ON  = player cancelled, movement was NOT made (refund the skill)
 *        OFF = player confirmed, movement was applied
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

    var _bfParams = PluginManager.parameters('TRA_Battlefield-Movement');
    if (!_bfParams || Object.keys(_bfParams).length === 0) {
        _bfParams = PluginManager.parameters('BattlefieldMovement');
    }

    function _bfBoolParam(v) {
        return String(v || '').toLowerCase() === 'true';
    }

    function _bfIntParam(v) {
        var n = parseInt(v || 0, 10);
        return isNaN(n) ? 0 : Math.max(0, n);
    }

    var BATTLEFIELD_DEBUG = _bfBoolParam(_bfParams.Debug);
    var BATTLEFIELD_STATE_ENGAGED    = _bfIntParam(_bfParams['Engaged State Id']);
    var BATTLEFIELD_STATE_DISENGAGED = _bfIntParam(_bfParams['Disengaged State Id']);
    var BATTLEFIELD_STATE_PROXIMITY  = _bfIntParam(_bfParams['Proximity State Id']);

    // -----------------------------------------------------------------------
    // File-based debug logger (NW.js only; silently disabled in browser)
    // -----------------------------------------------------------------------

    var _bfFileLogger = (function () {
        try {
            var fs   = require('fs');   // jshint ignore:line
            var path = require('path'); // jshint ignore:line
            var logPath = path.join(process.cwd(), 'battlefield-debug.log'); // jshint ignore:line
            fs.writeFileSync(logPath, '=== TRA Battlefield Debug Log ===\n', 'utf8');
            return {
                write: function (msg) {
                    try {
                        var ts = new Date().toTimeString().substring(0, 8);
                        fs.appendFileSync(logPath, '[' + ts + '] ' + msg + '\n', 'utf8');
                    } catch (e) { /* ignore write errors */ }
                }
            };
        } catch (e) {
            return { write: function () {} };
        }
    }());

    function _bfLog(message) {
        if (!BATTLEFIELD_DEBUG) return;
        _bfFileLogger.write(message);
        console.log('[TRA Battlefield] ' + message);
    }

    function _bfWarn(message) {
        if (!BATTLEFIELD_DEBUG) return;
        _bfFileLogger.write('WARN: ' + message);
        console.warn('[TRA Battlefield] WARN: ' + message);
    }

    // -----------------------------------------------------------------------
    // Utility helpers
    // -----------------------------------------------------------------------

    function _bfBattlerDisplayName(battler) {
        if (!battler) return 'Unknown';
        var key  = $gameBattlefield ? $gameBattlefield.battlerKey(battler) : null;
        var name = battler.name ? battler.name() : 'Unknown';
        return (key || '?') + ':' + name + '(z=' + (battler._bfZ || 0) + ')';
    }

    /**
     * Resolve a raw battler-key argument, supporting variable substitution:
     *   a$v<N>  →  a + value-of-variable-N
     *   e$v<N>  →  e + value-of-variable-N
     *   $v<N>   →  value-of-variable-N  (variable holds the full key, e.g. "a2")
     */
    function _bfResolveKey(rawKey) {
        if (!rawKey) return rawKey;
        var m;
        m = rawKey.match(/^a\$v(\d+)$/i);
        if (m) return 'a' + $gameVariables.value(parseInt(m[1], 10));
        m = rawKey.match(/^e\$v(\d+)$/i);
        if (m) return 'e' + $gameVariables.value(parseInt(m[1], 10));
        m = rawKey.match(/^\$v(\d+)$/i);
        if (m) return String($gameVariables.value(parseInt(m[1], 10)));
        return rawKey;
    }

    function _bfDeclaredZoneKeys() {
        if (!$gameBattlefield) return [];
        var zoneKeys = {};
        var mapId   = $gameBattlefield.currentMapId;
        var mapData = mapId ? ($gameBattlefield.mapZoneData[mapId] || {}) : {};
        Object.keys($gameBattlefield.zoneData || {}).forEach(function (k) { zoneKeys[k] = true; });
        Object.keys(mapData).forEach(function (k) { zoneKeys[k] = true; });
        return Object.keys(zoneKeys).sort();
    }

    function _bfZoneSnapshotText() {
        if (!$gameBattlefield) return '';
        var lines = [];
        _bfDeclaredZoneKeys().forEach(function (key) {
            var parts = key.split(',');
            var x = parseInt(parts[0], 10);
            var y = parseInt(parts[1], 10);
            var label = $gameBattlefield.getZoneLabel(x, y) || '(unnamed)';
            var props = $gameBattlefield.getZoneProps(x, y);
            var propText = props.length > 0 ? ' [' + props.join(', ') + ']' : '';
            var participants = $gameBattlefield.allBattlers().filter(function (b) {
                return b && b.isAlive && b.isAlive() && b._bfX === x && b._bfY === y;
            }).map(_bfBattlerDisplayName);
            lines.push('[' + x + ',' + y + '] ' + label + propText + ' => ' +
                (participants.length ? participants.join(', ') : '(none)'));
        });
        return lines.join('\n');
    }

    function _bfLogZoneSnapshot() {
        if (!BATTLEFIELD_DEBUG) return;
        var text = _bfZoneSnapshotText();
        var zoneCount = _bfDeclaredZoneKeys().length;
        if (!text) {
            _bfWarn('Map ' + ($gameBattlefield.currentMapId || 0) + ' has no declared zones.');
            return;
        }
        _bfLog('Map ' + ($gameBattlefield.currentMapId || 0) + ' zones (' + zoneCount + '):\n' + text);
    }

    // Parse "label | desc | prop1 | prop2 ..." from a joined args string.
    function _bfParseLabelDesc(args, startIndex) {
        var raw = args.slice(startIndex).join(' ').trim();
        if (!raw) return { label: '', desc: '', props: [] };
        var segments = raw.split('|').map(function (s) { return s.trim(); });
        return {
            label: segments[0] || '',
            desc:  segments[1] || '',
            props: segments.slice(2).filter(function (s) { return s.length > 0; })
        };
    }

    // Parse a single zone line from a map note block:
    //   x,y,label | description | prop1 | prop2 ...
    function _bfParseNoteZoneLine(line) {
        var clean = String(line || '').trim();
        if (!clean || clean.charAt(0) === '#') return null;
        var segments = clean.split('|').map(function (s) { return s.trim(); });
        var left  = segments[0];
        var desc  = segments[1] || '';
        var props = segments.slice(2).filter(function (s) { return s.length > 0; });
        var parts = left.split(',');
        if (parts.length < 3) return null;
        var x = parseInt(parts[0], 10);
        var y = parseInt(parts[1], 10);
        if (isNaN(x) || isNaN(y)) return null;
        var label = parts.slice(2).join(',').trim();
        if (!label) return null;
        return { x: x, y: y, label: label, desc: desc, props: props };
    }

    function _bfLoadMapZonesFromNote(mapId) {
        if (!$dataMap || !$dataMap.note) return 0;
        var note  = String($dataMap.note || '');
        var count = 0;
        var match;
        var blockRe = /<BATTLEFIELD_ZONES>([\s\S]*?)<\/BATTLEFIELD_ZONES>/gi;
        while ((match = blockRe.exec(note))) {
            String(match[1] || '').split(/\r?\n/).forEach(function (line) {
                var parsed = _bfParseNoteZoneLine(line);
                if (!parsed) return;
                $gameBattlefield.setZoneLabel(parsed.x, parsed.y, parsed.label, mapId);
                if (parsed.desc)               $gameBattlefield.setZoneDesc(parsed.x, parsed.y, parsed.desc, mapId);
                if (parsed.props.length > 0)   $gameBattlefield.setZoneProps(parsed.x, parsed.y, parsed.props, mapId);
                count++;
            });
        }
        var inlineRe = /<BATTLEFIELD_ZONE\s*:\s*([^>]+)>/gi;
        while ((match = inlineRe.exec(note))) {
            var p = _bfParseNoteZoneLine(match[1]);
            if (!p) continue;
            $gameBattlefield.setZoneLabel(p.x, p.y, p.label, mapId);
            if (p.desc)             $gameBattlefield.setZoneDesc(p.x, p.y, p.desc, mapId);
            if (p.props.length > 0) $gameBattlefield.setZoneProps(p.x, p.y, p.props, mapId);
            count++;
        }
        return count;
    }

    // -----------------------------------------------------------------------
    // Game_Battlefield  –  central store, written to save data
    // -----------------------------------------------------------------------

    function Game_Battlefield() {
        this.initialize();
    }

    Game_Battlefield.prototype.initialize = function () {
        this.currentMapId = null;
        this.zoneData     = {};   // global:  "x,y" -> { label, desc, props }
        this.mapZoneData  = {};   // mapId -> { "x,y" -> { label, desc, props } }
    };

    // --- internal key -------------------------------------------------------

    Game_Battlefield.prototype._key = function (x, y) {
        return x + ',' + y;
    };

    // --- zone data access ---------------------------------------------------

    Game_Battlefield.prototype.getZoneLabel = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].label) return mapData[key].label;
        if (this.zoneData[key] && this.zoneData[key].label) return this.zoneData[key].label;
        return null;
    };

    Game_Battlefield.prototype.getZoneDesc = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].desc) return mapData[key].desc;
        if (this.zoneData[key] && this.zoneData[key].desc) return this.zoneData[key].desc;
        return null;
    };

    Game_Battlefield.prototype.getZoneProps = function (x, y) {
        var key     = this._key(x, y);
        var mapData = this.currentMapId ? (this.mapZoneData[this.currentMapId] || {}) : {};
        if (mapData[key] && mapData[key].props && mapData[key].props.length > 0) return mapData[key].props;
        if (this.zoneData[key] && this.zoneData[key].props && this.zoneData[key].props.length > 0) return this.zoneData[key].props;
        return [];
    };

    Game_Battlefield.prototype.zoneHasProp = function (x, y, prop) {
        var propLower = String(prop).toLowerCase();
        return this.getZoneProps(x, y).some(function (p) {
            return String(p).toLowerCase() === propLower;
        });
    };

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

    Game_Battlefield.prototype.setZoneProps = function (x, y, props, mapId) {
        var key = this._key(x, y);
        if (mapId !== null && mapId !== undefined) {
            this.mapZoneData[mapId] = this.mapZoneData[mapId] || {};
            this.mapZoneData[mapId][key] = this.mapZoneData[mapId][key] || {};
            this.mapZoneData[mapId][key].props = props.slice();
        } else {
            this.zoneData[key] = this.zoneData[key] || {};
            this.zoneData[key].props = props.slice();
        }
    };

    Game_Battlefield.prototype.addZoneProp = function (x, y, prop, mapId) {
        var key       = this._key(x, y);
        var propLower = String(prop).toLowerCase();
        if (mapId !== null && mapId !== undefined) {
            this.mapZoneData[mapId] = this.mapZoneData[mapId] || {};
            this.mapZoneData[mapId][key] = this.mapZoneData[mapId][key] || {};
            this.mapZoneData[mapId][key].props = this.mapZoneData[mapId][key].props || [];
            if (!this.mapZoneData[mapId][key].props.some(function (p) { return String(p).toLowerCase() === propLower; })) {
                this.mapZoneData[mapId][key].props.push(String(prop));
            }
        } else {
            this.zoneData[key] = this.zoneData[key] || {};
            this.zoneData[key].props = this.zoneData[key].props || [];
            if (!this.zoneData[key].props.some(function (p) { return String(p).toLowerCase() === propLower; })) {
                this.zoneData[key].props.push(String(prop));
            }
        }
    };

    // --- adjacency ----------------------------------------------------------

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
                if (entry.label) {
                    seen[key] = true;
                    result.push({ x: zx, y: zy, label: entry.label });
                }
            }
        }

        Object.keys(mapData).forEach(function (key) { addIfAdjacent(key, mapData[key]); });
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

    Game_Battlefield.prototype.groupAt = function (x, y, z) {
        return this.allBattlers().filter(function (b) {
            return b._bfX === x && b._bfY === y && b._bfZ === z;
        });
    };

    Game_Battlefield.prototype._bfHasNearbyEnemy = function (battler) {
        if (!battler || !battler.isAlive || !battler.isAlive()) return false;
        return this.allBattlers().some(function (other) {
            if (!other || other === battler || !other.isAlive || !other.isAlive()) return false;
            if (other.isActor() === battler.isActor()) return false;
            return Math.abs((other._bfX || 0) - (battler._bfX || 0)) <= 1 &&
                   Math.abs((other._bfY || 0) - (battler._bfY || 0)) <= 1;
        });
    };

    Game_Battlefield.prototype.refreshRelationStates = function () {
        var self = this;
        var ids = [BATTLEFIELD_STATE_ENGAGED, BATTLEFIELD_STATE_DISENGAGED, BATTLEFIELD_STATE_PROXIMITY]
            .filter(function (id, index, arr) { return id > 0 && arr.indexOf(id) === index; });
        this.allBattlers().forEach(function (b) {
            if (!b || !b.isAlive || !b.isAlive()) return;
            ids.forEach(function (id) {
                if (b.isStateAffected(id)) b.removeState(id);
            });
            if (b._bfZ > 0) {
                if (BATTLEFIELD_STATE_ENGAGED > 0) b.addState(BATTLEFIELD_STATE_ENGAGED);
            } else if (self._bfHasNearbyEnemy(b)) {
                if (BATTLEFIELD_STATE_PROXIMITY > 0) b.addState(BATTLEFIELD_STATE_PROXIMITY);
            } else if (BATTLEFIELD_STATE_DISENGAGED > 0) {
                b.addState(BATTLEFIELD_STATE_DISENGAGED);
            }
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

        attacker._bfZ           = z;
        attacker._bfEngagedWith = this.battlerKey(target);
        this.refreshRelationStates();
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
        this.refreshRelationStates();
    };

    // -----------------------------------------------------------------------
    // Extend Game_Battler with battlefield position fields
    // -----------------------------------------------------------------------

    var _Battler_initMembers = Game_Battler.prototype.initMembers;
    Game_Battler.prototype.initMembers = function () {
        _Battler_initMembers.call(this);
        this._bfX           = 0;
        this._bfY           = 0;
        this._bfZ           = 0;
        this._bfEngagedWith = null;
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
        var loadedFromNote = _bfLoadMapZonesFromNote($gameBattlefield.currentMapId);
        _bfLog('Battle start on map ' + $gameBattlefield.currentMapId +
            '. Zones loaded from note: ' + loadedFromNote +
            '. Total declared zones: ' + _bfDeclaredZoneKeys().length + '.');
        $gameBattlefield.allBattlers().forEach(function (b) {
            b._bfX           = 0;
            b._bfY           = 0;
            b._bfZ           = 0;
            b._bfEngagedWith = null;
        });
        $gameBattlefield.refreshRelationStates();
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
        pending:        false,   // set by PROMPT_MOVE; cleared when window closes
        battler:        null,    // the battler that is moving
        completed:      false,   // set to true when the player has made (or cancelled) a choice
        cancelSwitchId: 0        // optional switch to set ON when cancelled, OFF on confirm
    };

    // ---- Window_BfMoveSelect -----------------------------------------------

    function Window_BfMoveSelect() {
        this.initialize.apply(this, arguments);
    }

    Window_BfMoveSelect.prototype = Object.create(Window_Command.prototype);
    Window_BfMoveSelect.prototype.constructor = Window_BfMoveSelect;

    Window_BfMoveSelect.prototype.initialize = function (choices) {
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
        if (!battler) {
            _bfWarn('Move prompt requested without a battler.');
            _bfSelect.pending   = false;
            _bfSelect.completed = true;
            return;
        }
        var choices = $gameBattlefield.adjacentValidZones(battler._bfX, battler._bfY);

        if (choices.length === 0) {
            if (_bfDeclaredZoneKeys().length === 0) {
                _bfWarn('No move prompt for ' + _bfBattlerDisplayName(battler) +
                    ': no declared zones on map ' + ($gameBattlefield.currentMapId || 0) + '.');
            } else {
                _bfWarn('No move prompt for ' + _bfBattlerDisplayName(battler) +
                    ' at [' + battler._bfX + ',' + battler._bfY + ']: no adjacent declared zones.');
                _bfLogZoneSnapshot();
            }
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
        _bfLogZoneSnapshot();
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
            $gameBattlefield.refreshRelationStates();
            if (_bfSelect.cancelSwitchId > 0) $gameSwitches.setValue(_bfSelect.cancelSwitchId, false);
            _bfLog(_bfBattlerDisplayName(_bfSelect.battler) + ' moved to [' + data.x + ',' + data.y + '] (' + data.label + ').');
        }
        _bfLogZoneSnapshot();
        this._bfCloseMoveWindow();
    };

    Scene_Battle.prototype._onBfMoveCancel = function () {
        _bfLog(_bfBattlerDisplayName(_bfSelect.battler) + ' cancelled move.');
        if (_bfSelect.cancelSwitchId > 0) $gameSwitches.setValue(_bfSelect.cancelSwitchId, true);
        this._bfCloseMoveWindow();
    };

    // ---- Game_Interpreter wait-mode ----------------------------------------

    var _updateWaitMode = Game_Interpreter.prototype.updateWaitMode;
    Game_Interpreter.prototype.updateWaitMode = function () {
        if (this._waitMode === 'bfMoveSelect') {
            if (_bfSelect.completed) {
                _bfSelect.completed = false;
                this._waitMode = '';
                return false;
            }
            return true;
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

            // ---- ZONE_MAP (per-map declaration) ----------------------------
            case 'ZONE_MAP': {
                var zmMapId = parseInt(args[1], 10);
                var zmx     = parseInt(args[2], 10);
                var zmy     = parseInt(args[3], 10);
                var zmText  = _bfParseLabelDesc(args, 4);
                $gameBattlefield.setZoneLabel(zmx, zmy, zmText.label, zmMapId);
                if (zmText.desc)               $gameBattlefield.setZoneDesc(zmx, zmy, zmText.desc, zmMapId);
                if (zmText.props.length > 0)   $gameBattlefield.setZoneProps(zmx, zmy, zmText.props, zmMapId);
                _bfLog('Declared map zone [' + zmx + ',' + zmy + '] map=' + zmMapId + ' label="' + zmText.label + '"' +
                    (zmText.props.length ? ' props=[' + zmText.props.join(', ') + ']' : '') + '.');
                break;
            }

            // ---- ZONE (global declaration) ---------------------------------
            case 'ZONE': {
                var zx    = parseInt(args[1], 10);
                var zy    = parseInt(args[2], 10);
                var zText = _bfParseLabelDesc(args, 3);
                $gameBattlefield.setZoneLabel(zx, zy, zText.label, null);
                if (zText.desc)              $gameBattlefield.setZoneDesc(zx, zy, zText.desc, null);
                if (zText.props.length > 0)  $gameBattlefield.setZoneProps(zx, zy, zText.props, null);
                _bfLog('Declared global zone [' + zx + ',' + zy + '] label="' + zText.label + '"' +
                    (zText.props.length ? ' props=[' + zText.props.join(', ') + ']' : '') + '.');
                break;
            }

            // ---- ZONE_PROP (add property to global zone) ------------------
            case 'ZONE_PROP': {
                var zpx  = parseInt(args[1], 10);
                var zpy  = parseInt(args[2], 10);
                var zpProp = args.slice(3).join(' ').trim();
                if (zpProp) {
                    $gameBattlefield.addZoneProp(zpx, zpy, zpProp, null);
                    _bfLog('Added property "' + zpProp + '" to global zone [' + zpx + ',' + zpy + '].');
                }
                break;
            }

            // ---- ZONE_PROP_MAP (add property to per-map zone) -------------
            case 'ZONE_PROP_MAP': {
                var zpmMapId = parseInt(args[1], 10);
                var zpmx     = parseInt(args[2], 10);
                var zpmy     = parseInt(args[3], 10);
                var zpmProp  = args.slice(4).join(' ').trim();
                if (zpmProp) {
                    $gameBattlefield.addZoneProp(zpmx, zpmy, zpmProp, zpmMapId);
                    _bfLog('Added property "' + zpmProp + '" to map zone [' + zpmx + ',' + zpmy + '] map=' + zpmMapId + '.');
                }
                break;
            }

            // ---- ZONE_HAS_PROP (check property for battler's zone) --------
            case 'ZONE_HAS_PROP': {
                var zhpKey  = _bfResolveKey(args[1]);
                var zhpSw   = parseInt(args[2], 10);
                var zhpProp = args.slice(3).join(' ').trim();
                var zhpB    = $gameBattlefield.battlerFromKey(zhpKey);
                if (!zhpB) { console.warn('ZONE_HAS_PROP: battler not found: ' + zhpKey); break; }
                var hasIt = $gameBattlefield.zoneHasProp(zhpB._bfX, zhpB._bfY, zhpProp);
                $gameSwitches.setValue(zhpSw, hasIt);
                _bfLog('ZONE_HAS_PROP ' + zhpKey + ' "' + zhpProp + '" -> ' + hasIt + ' (switch ' + zhpSw + ').');
                break;
            }

            // ---- ZONE_HAS_PROP_XY (check property at given coordinates) ---
            case 'ZONE_HAS_PROP_XY': {
                var zhxyX    = parseInt(args[1], 10);
                var zhxyY    = parseInt(args[2], 10);
                var zhxySw   = parseInt(args[3], 10);
                var zhxyProp = args.slice(4).join(' ').trim();
                var zhxyHas  = $gameBattlefield.zoneHasProp(zhxyX, zhxyY, zhxyProp);
                $gameSwitches.setValue(zhxySw, zhxyHas);
                _bfLog('ZONE_HAS_PROP_XY [' + zhxyX + ',' + zhxyY + '] "' + zhxyProp + '" -> ' + zhxyHas + ' (switch ' + zhxySw + ').');
                break;
            }

            // ---- MOVE (force placement) ------------------------------------
            case 'MOVE': {
                var moveBattler = $gameBattlefield.battlerFromKey(_bfResolveKey(args[1]));
                if (!moveBattler) { console.warn('MOVE: battler not found: ' + args[1]); break; }
                if (moveBattler._bfZ !== 0) { console.warn('MOVE: battler is engaged and cannot move.'); break; }
                moveBattler._bfX = parseInt(args[2], 10);
                moveBattler._bfY = parseInt(args[3], 10);
                $gameBattlefield.refreshRelationStates();
                _bfLog('Moved ' + _bfBattlerDisplayName(moveBattler) + ' to [' + moveBattler._bfX + ',' + moveBattler._bfY + '].');
                break;
            }

            // ---- PROMPT_MOVE -----------------------------------------------
            // BATTLEFIELD PROMPT_MOVE battlerKey [cancelSwitchId]
            case 'PROMPT_MOVE': {
                var pmKey     = _bfResolveKey(args[1]);
                var pmBattler = $gameBattlefield.battlerFromKey(pmKey);
                if (!pmBattler) { console.warn('PROMPT_MOVE: battler not found: ' + args[1] + ' (resolved: ' + pmKey + ')'); break; }
                if (pmBattler._bfZ !== 0) { console.warn('PROMPT_MOVE: battler is engaged and cannot move.'); break; }
                if (!(SceneManager._scene instanceof Scene_Battle)) {
                    _bfWarn('PROMPT_MOVE called outside Scene_Battle. Use from a troop event.');
                    break;
                }
                _bfSelect.cancelSwitchId = args[2] ? parseInt(args[2], 10) : 0;
                _bfLog('PROMPT_MOVE for ' + _bfBattlerDisplayName(pmBattler) + ' at [' + pmBattler._bfX + ',' + pmBattler._bfY + ']' +
                    (_bfSelect.cancelSwitchId ? ' cancelSwitch=' + _bfSelect.cancelSwitchId : '') + '.');
                _bfSelect.pending   = true;
                _bfSelect.battler   = pmBattler;
                _bfSelect.completed = false;
                this.setWaitMode('bfMoveSelect');
                break;
            }

            // ---- ENGAGE ----------------------------------------------------
            case 'ENGAGE': {
                var attacker = $gameBattlefield.battlerFromKey(_bfResolveKey(args[1]));
                var target   = $gameBattlefield.battlerFromKey(_bfResolveKey(args[2]));
                if (!attacker) { console.warn('ENGAGE: attacker not found: ' + args[1]); break; }
                if (!target)   { console.warn('ENGAGE: target not found: '   + args[2]); break; }
                $gameBattlefield.engage(attacker, target);
                _bfLog('ENGAGE: ' + _bfBattlerDisplayName(attacker) + ' -> ' + _bfBattlerDisplayName(target) + '.');
                break;
            }

            // ---- DISENGAGE -------------------------------------------------
            case 'DISENGAGE': {
                var disengager = $gameBattlefield.battlerFromKey(_bfResolveKey(args[1]));
                if (!disengager) { console.warn('DISENGAGE: battler not found: ' + args[1]); break; }
                $gameBattlefield.disengage(disengager);
                _bfLog('DISENGAGE: ' + _bfBattlerDisplayName(disengager) + '.');
                break;
            }

            // ---- LABEL_MAP -------------------------------------------------
            case 'LABEL_MAP': {
                var lmMapId = parseInt(args[1], 10);
                var lmx     = parseInt(args[2], 10);
                var lmy     = parseInt(args[3], 10);
                $gameBattlefield.setZoneLabel(lmx, lmy, args.slice(4).join(' '), lmMapId);
                break;
            }

            // ---- LABEL -----------------------------------------------------
            case 'LABEL': {
                var lx = parseInt(args[1], 10);
                var ly = parseInt(args[2], 10);
                $gameBattlefield.setZoneLabel(lx, ly, args.slice(3).join(' '), null);
                break;
            }

            // ---- DESC_MAP --------------------------------------------------
            case 'DESC_MAP': {
                var dmMapId = parseInt(args[1], 10);
                var dmx     = parseInt(args[2], 10);
                var dmy     = parseInt(args[3], 10);
                $gameBattlefield.setZoneDesc(dmx, dmy, args.slice(4).join(' '), dmMapId);
                break;
            }

            // ---- DESC ------------------------------------------------------
            case 'DESC': {
                var dx = parseInt(args[1], 10);
                var dy = parseInt(args[2], 10);
                $gameBattlefield.setZoneDesc(dx, dy, args.slice(3).join(' '), null);
                break;
            }

            // ---- QUERY -----------------------------------------------------
            case 'QUERY': {
                var qb = $gameBattlefield.battlerFromKey(_bfResolveKey(args[1]));
                if (!qb) { console.warn('QUERY: battler not found: ' + args[1]); break; }
                var qvX = parseInt(args[2], 10);
                var qvY = parseInt(args[3], 10);
                var qvZ = parseInt(args[4], 10);
                if (qvX) $gameVariables.setValue(qvX, qb._bfX);
                if (qvY) $gameVariables.setValue(qvY, qb._bfY);
                if (qvZ) $gameVariables.setValue(qvZ, qb._bfZ);
                break;
            }

            // ---- SAME_ZONE -------------------------------------------------
            case 'SAME_ZONE': {
                var szA  = $gameBattlefield.battlerFromKey(_bfResolveKey(args[1]));
                var szB  = $gameBattlefield.battlerFromKey(_bfResolveKey(args[2]));
                var szSw = parseInt(args[3], 10);
                if (!szA || !szB) { console.warn('SAME_ZONE: battler not found.'); break; }
                $gameSwitches.setValue(szSw, szA._bfX === szB._bfX && szA._bfY === szB._bfY);
                break;
            }
        }
    };

    // -----------------------------------------------------------------------
    // Public global
    // -----------------------------------------------------------------------
    /* global $gameBattlefield */
    var $gameBattlefield = new Game_Battlefield(); // jshint ignore:line

})();
