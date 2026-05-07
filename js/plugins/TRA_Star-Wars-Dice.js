/*:
 * @target MV
 * @plugindesc Star Wars dice utilities plus melee attack debug pool rolls.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * This plugin provides:
 *   1) A global DiceSystem utility for rolling narrative dice.
 *   2) Automatic debug dice-pool output when a melee attack is launched.
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
 * On each actor melee attack launch, this plugin logs:
 *   - attacker and target
 *   - dice pool composition
 *   - each die rolled and its face result
 *   - final cancelled totals
 *
 * Output appears in the browser console and battle log window.
 * This is debug behavior for early iteration.
 */

var DiceSystem = (function () {

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
            { dispair: 1 }
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
        Object.keys(pool).forEach(type => {
            for (let i = 0; i < pool[type]; i++) {
                allResults.push(rollOne(type));
            }
        });
        return {
            rolls: allResults,
            total: tally(allResults)
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
        return {
            pool: Object.assign({}, pool),
            rolls: typedRolls,
            total: tally(allResults)
        };
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
        rollDie,
        rollDice,
        rollTotal,
        d10,
        d100
    };

})();

(function () {
    'use strict';

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

        var target = (this._targets && this._targets.length > 0) ? this._targets[0] : null;
        var targetName = target && target.name ? target.name() : 'No Target';
        var header = '[TRA Dice] ' + subject.name() + ' -> ' + targetName +
            ' | Pool ability:' + pool.ability + ', difficulty:' + pool.difficulty;
        var detail = result.rolls.map(function (r, i) {
            return (i + 1) + ') ' + r.type + ' [' + faceToText(r.result) + ']';
        }).join(' | ');
        var totals = '[TRA Dice] Totals success:' + (result.total.success || 0) +
            ' failure:' + (result.total.failure || 0) +
            ' advantage:' + (result.total.advantage || 0) +
            ' disadvantage:' + (result.total.disadvantage || 0) +
            ' triumph:' + (result.total.triumph || 0) +
            ' dispair:' + (result.total.dispair || 0);

        console.log(header);
        console.log('[TRA Dice] Rolls: ' + detail);
        console.log(totals);

        if (this._logWindow && this._logWindow.addText) {
            this._logWindow.addText(header);
            this._logWindow.addText(totals);
        }
    };
})();
