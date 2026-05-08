/*:
 * @target MV
 * @plugindesc Star Wars dice utilities plus melee attack debug pool rolls.
 *
 * @param Debug
 * @text Debug
 * @desc When ON, logs dice pool rolls to the console and to dice-debug.log in the game folder.
 * @type boolean
 * @default false
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * This plugin provides:
 *   1) A global DiceSystem utility for rolling narrative dice.
 *   2) Optional debug dice-pool output when pools are rolled.
 *
 * For melee attacks, the current temporary pool is:
 *   - Difficulty: 2
 *   - Ability:    attacker's Brawn rating
 *
 * ============================================================================
 * Available DiceSystem API
 * ============================================================================
 *
 *   DiceSystem.rollOne(type)
 *   DiceSystem.roll(type, count)
 *   DiceSystem.rollPool({ ability: 2, difficulty: 2, boost: 1, ... })
 *   DiceSystem.rollPoolDetailed(pool)   // includes per-die type + face data
 *   DiceSystem.tally(results)
 *   DiceSystem.d10()
 *   DiceSystem.d100()
 *
 * ============================================================================
 * Melee Attack Debug Output
 * ============================================================================
 *
 * With Debug ON, on each actor melee attack launch this plugin logs:
 *   - attacker and target
 *   - dice pool composition
 *   - each die rolled and its face result
 *   - final cancelled totals
 *
 * Output is written to dice-debug.log in the game root folder (NW.js desktop)
 * and to the browser/NW.js console.
 * The log file is cleared each time the game launches.
 * Open it in a text editor or tail-capable viewer to follow events live.
 * This is debug behavior for early iteration.
 */

var DiceSystem = (function () {

    var _params = PluginManager.parameters('TRA_Star-Wars-Dice');
    if (!_params || Object.keys(_params).length === 0) {
        _params = PluginManager.parameters('StarWarsDice');
    }
    function _boolParam(v) {
        return String(v || '').toLowerCase() === 'true';
    }
    var DICE_DEBUG = _boolParam(_params.Debug);

    // File-based logger (NW.js only; silently disabled in browser)
    var _diceFileLogger = (function () {
        try {
            var fs   = require('fs');   // jshint ignore:line
            var path = require('path'); // jshint ignore:line
            var logPath = path.join(process.cwd(), 'dice-debug.log'); // jshint ignore:line
            fs.writeFileSync(logPath, '=== TRA Dice Debug Log ===\n', 'utf8');
            return {
                write: function (msg) {
                    try {
                        var ts = new Date().toTimeString().substring(0, 8);
                        fs.appendFileSync(logPath, '[' + ts + '] ' + msg + '\n', 'utf8');
                    } catch (e) { /* ignore */ }
                }
            };
        } catch (e) {
            return { write: function () {} };
        }
    }());

    const dice = {
        boost: [
            {}, 
            {},
            { advantage: 1 },
            { advantage: 2 },
            { success: 1 },
            { success: 1, advantage: 1 }
        ],
        ability: [
            {},
            { advantage: 1 },
            { advantage: 1 },
            { advantage: 2 },
            { success: 1 },
            { success: 1 },
            { success: 1, advantage: 1 },
            { success: 2 }
        ],
        proficiency: [
            {},
            { advantage: 1 },
            { advantage: 2 },
            { advantage: 2 },
            { success: 1 },
            { success: 1 },
            { success: 1, advantage: 1 },
            { success: 1, advantage: 1 },
            { success: 1, advantage: 1 },
            { success: 2 }, 
            { success: 2 },
            { triumph: 1 }
        ],
        setback: [
            {},
            {}, 
            { disadvantage: 1 },
            { disadvantage: 1 },
            { failure: 1 },
            { failure: 1 }
        ],
        difficulty: [
            {},
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 2 },
            { failure: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 2 }
        ],
        challenge: [
            {}, 
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 2 },
            { disadvantage: 2 },
            { failure: 1 }, 
            { failure: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 2 },
            { failure: 2 },
            { despair: 1 }
        ],
        force: [
            { light: 1 },
            { light: 1 },
            { light: 2 },
            { light: 2 },
            { light: 2 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 2 }
        ]
    };

    function rollOne(type) {
        const die = dice[type];
        if (!die) return {};
        const face = die[Math.floor(Math.random() * die.length)];
        return Object.assign({}, face);
    }

    function roll(type, count) {
        let results = [];
        for (let i = 0; i < count; i++) {
            results.push(rollOne(type));
        }
        return results;
    }

    function tally(results) {
        let total = {};

        results.forEach(r => {
            Object.keys(r).forEach(k => {
                total[k] = (total[k] || 0) + r[k];
            });
        });

        // --- cancellations ---
        let success = total.success || 0;
        let failure = total.failure || 0;
        let advantage = total.advantage || 0;
        let disadvantage = total.disadvantage || 0;

        let netSuccess = success - failure;
        let netAdvantage = advantage - disadvantage;

        total.success = Math.max(0, netSuccess);
        total.failure = Math.max(0, -netSuccess);

        total.advantage = Math.max(0, netAdvantage);
        total.disadvantage = Math.max(0, -netAdvantage);

        return total;
    }

    function rollPool(pool) {
        let allResults = [];
        let typedRolls = [];
        Object.keys(pool).forEach(type => {
            for (let i = 0; i < pool[type]; i++) {
                let face = rollOne(type);
                typedRolls.push({
                    type: type,
                    result: Object.assign({}, face)
                });
                allResults.push(face);
            }
        });
        let total = tally(allResults);
        if (DICE_DEBUG) {
            _logPoolDebug(pool, typedRolls, total);
        }
        return {
            rolls: allResults,
            total: total
        };
    }

    function rollPoolDetailed(pool) {
        let typedRolls = [];
        let allResults = [];
        Object.keys(pool).forEach(type => {
            for (let i = 0; i < pool[type]; i++) {
                let face = rollOne(type);
                typedRolls.push({
                    type: type,
                    result: Object.assign({}, face)
                });
                allResults.push(face);
            }
        });
        let result = {
            pool: Object.assign({}, pool),
            rolls: typedRolls,
            total: tally(allResults)
        };
        if (DICE_DEBUG) {
            _logPoolDebug(result.pool, result.rolls, result.total);
        }
        return result;
    }

    function _faceToText(face) {
        var keys = Object.keys(face || {});
        if (keys.length === 0) return 'blank';
        return keys.map(function (k) {
            return k + ':' + face[k];
        }).join(', ');
    }

    function _logPoolDebug(pool, typedRolls, total) {
        var poolText = Object.keys(pool).map(function (k) {
            return k + ':' + pool[k];
        }).join(', ');
        var detail = typedRolls.map(function (r, i) {
            return (i + 1) + ') ' + r.type + ' [' + _faceToText(r.result) + ']';
        }).join(' | ');
        var totalsText = 'Totals success:' + (total.success || 0) +
            ' failure:' + (total.failure || 0) +
            ' advantage:' + (total.advantage || 0) +
            ' disadvantage:' + (total.disadvantage || 0) +
            ' triumph:' + (total.triumph || 0) +
            ' despair:' + (total.despair || 0);
        _diceFileLogger.write('Pool ' + poolText);
        _diceFileLogger.write('Rolls ' + detail);
        _diceFileLogger.write(totalsText);
        console.log('[TRA Dice Debug] Pool ' + poolText);
        console.log('[TRA Dice Debug] Rolls ' + detail);
        console.log('[TRA Dice Debug] ' + totalsText);
    }

    function rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    function rollDice(num, sides) {
        let results = [];
        for (let i = 0; i < num; i++) {
            results.push(rollDie(sides));
        }
        return results;
    }

    function rollTotal(num, sides) {
        return rollDice(num, sides).reduce((a, b) => a + b, 0);
    }

    function d10() {
        return rollDie(10);
    }

    function d100() {
        let tens = Math.floor(Math.random() * 10); // 0–9
        let ones = Math.floor(Math.random() * 10); // 0–9
        let value = tens * 10 + ones;
        return value === 0 ? 100 : value;
    }

    return {
        rollOne,
        roll,
        tally,
        rollPool,
        rollPoolDetailed,
        isDebugEnabled: function () { return DICE_DEBUG; },
        rollDie,
        rollDice,
        rollTotal,
        d10,
        d100
    };

})();

(function () {
    'use strict';

    // File-based logger reusing same path as the DiceSystem module, but
    // opened in append mode (DiceSystem already cleared it on load).
    var _meleeFileLogger = (function () {
        try {
            var fs   = require('fs');   // jshint ignore:line
            var path = require('path'); // jshint ignore:line
            var logPath = path.join(process.cwd(), 'dice-debug.log'); // jshint ignore:line
            return {
                write: function (msg) {
                    try {
                        var ts = new Date().toTimeString().substring(0, 8);
                        fs.appendFileSync(logPath, '[' + ts + '] ' + msg + '\n', 'utf8');
                    } catch (e) { /* ignore */ }
                }
            };
        } catch (e) {
            return { write: function () {} };
        }
    }());

    var MELEE_ELEMENT_NAME = 'melee';
    var _cachedMeleeElementId = null;

    function meleeElementId() {
        if (_cachedMeleeElementId !== null) return _cachedMeleeElementId;
        if (!$dataSystem || !$dataSystem.elements) return -1;
        for (var i = 0; i < $dataSystem.elements.length; i++) {
            var name = $dataSystem.elements[i];
            if (name && String(name).toLowerCase() === MELEE_ELEMENT_NAME) {
                _cachedMeleeElementId = i;
                return i;
            }
        }
        return -1;
    }

    function hasMeleeElement(action, subject) {
        var item = action && action.item ? action.item() : null;
        if (!item || !item.damage) return false;
        var meleeId = meleeElementId();
        if (meleeId < 0) return false;
        if (item.damage.elementId === meleeId) return true;
        if (item.damage.elementId === -1 && subject && subject.attackElements) {
            return subject.attackElements().indexOf(meleeId) >= 0;
        }
        return false;
    }

    function extractBrawn(actor) {
        if (!actor) return 0;
        if (typeof actor.brawn === 'function') {
            var fromFn = Number(actor.brawn());
            if (!isNaN(fromFn)) return Math.max(0, fromFn);
        }
        if (actor._attrs && actor._attrs.brawn !== undefined) {
            var fromAttrs = Number(actor._attrs.brawn);
            if (!isNaN(fromAttrs)) return Math.max(0, fromAttrs);
        }
        if (actor._brawn !== undefined) {
            var fromPrivate = Number(actor._brawn);
            if (!isNaN(fromPrivate)) return Math.max(0, fromPrivate);
        }
        var note = actor.actor && actor.actor() ? String(actor.actor().note || '') : '';
        var m = /<brawn:(\d+)>/i.exec(note);
        if (m) return Math.max(0, Number(m[1]));
        return 0;
    }

    function faceToText(face) {
        var keys = Object.keys(face || {});
        if (keys.length === 0) return 'blank';
        return keys.map(function (k) {
            return k + ':' + face[k];
        }).join(', ');
    }

    var _BattleManager_startAction = BattleManager.startAction;
    BattleManager.startAction = function () {
        _BattleManager_startAction.call(this);

        var action = this._action;
        var subject = this._subject;
        if (!action || !subject || !subject.isActor || !subject.isActor()) return;
        if (!hasMeleeElement(action, subject)) return;

        var brawn = extractBrawn(subject);
        var pool = {
            difficulty: 2,
            ability: brawn
        };
        var result = DiceSystem.rollPoolDetailed(pool);
        action._traDiceDebug = result;

        if (!DiceSystem.isDebugEnabled()) return;

        var target     = (this._targets && this._targets.length > 0) ? this._targets[0] : null;
        var targetName = target && target.name ? target.name() : 'No Target';
        var header     = subject.name() + ' -> ' + targetName +
            ' | Pool ability:' + pool.ability + ', difficulty:' + pool.difficulty;
        var detail = result.rolls.map(function (r, i) {
            return (i + 1) + ') ' + r.type + ' [' + faceToText(r.result) + ']';
        }).join(' | ');
        var totalsText = 'Totals success:' + (result.total.success || 0) +
            ' failure:' + (result.total.failure || 0) +
            ' advantage:' + (result.total.advantage || 0) +
            ' disadvantage:' + (result.total.disadvantage || 0) +
            ' triumph:' + (result.total.triumph || 0) +
            ' despair:' + (result.total.despair || 0);

        _meleeFileLogger.write(header);
        _meleeFileLogger.write('Rolls: ' + detail);
        _meleeFileLogger.write(totalsText);
        console.log('[TRA Dice] ' + header);
        console.log('[TRA Dice] Rolls: ' + detail);
        console.log('[TRA Dice] ' + totalsText);
    };
})();
