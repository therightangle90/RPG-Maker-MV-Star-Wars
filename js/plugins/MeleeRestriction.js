/*:
 * @target MV
 * @plugindesc Seals a character's attack skill whenever they wield a weapon
 *             that carries the "Melee" Attack Element but are not currently
 *             engaged with any alive enemy on the battlefield.
 *
 * The seal is lifted automatically the moment the character becomes engaged
 * (BattlefieldMovement Z > 0 and at least one alive enemy shares that Z
 * group).  Switching to a non-Melee weapon also lifts the seal immediately.
 *
 * This plugin requires BattlefieldMovement.js and HideSealedSkills.js.
 * HideSealedSkills.js already hides any sealed skill from the selection
 * window, so no extra display work is needed here.
 *
 * ---------------------------------------------------------------------------
 * Setup
 * ---------------------------------------------------------------------------
 * 1.  In the RPG Maker database (System > Elements), add an element named
 *     exactly "Melee" (case-insensitive).
 * 2.  On every melee weapon's Traits tab, add the trait:
 *       Attack Element → Melee
 * That is all.  No note-tags or plugin commands are required.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Find the "Melee" element ID from $dataSystem at runtime.
    // The result is cached after the first successful lookup.
    // -----------------------------------------------------------------------

    var MELEE_ELEMENT_NAME    = 'melee'; // must match the database element name (case-insensitive)
    var _cachedMeleeElementId = null;

    function meleeElementId() {
        if (_cachedMeleeElementId !== null) return _cachedMeleeElementId;
        if (!$dataSystem || !$dataSystem.elements) return -1;
        var elements = $dataSystem.elements;
        for (var i = 0; i < elements.length; i++) {
            if (elements[i] && elements[i].toLowerCase() === MELEE_ELEMENT_NAME) {
                _cachedMeleeElementId = i;
                return i;
            }
        }
        return -1; // "Melee" element not defined in the database
    }

    // -----------------------------------------------------------------------
    // Return true if any of the actor's equipped weapons carries the Melee
    // attack-element trait (trait code 31 = TRAIT_ATTACK_ELEMENT).
    // -----------------------------------------------------------------------

    function actorHasMeleeWeapon(actor) {
        var id = meleeElementId();
        if (id < 0) return false;
        var weapons = actor.weapons ? actor.weapons() : [];
        for (var w = 0; w < weapons.length; w++) {
            var traits = weapons[w].traits;
            for (var t = 0; t < traits.length; t++) {
                if (traits[t].code === Game_BattlerBase.TRAIT_ATTACK_ELEMENT &&
                        traits[t].dataId === id) {
                    return true;
                }
            }
        }
        return false;
    }

    // -----------------------------------------------------------------------
    // Return true if the actor is in an engagement group (Z > 0) that
    // contains at least one alive enemy.
    // -----------------------------------------------------------------------

    function actorEngagedWithEnemy(actor) {
        if (!actor.bfIsEngaged()) return false; // Z = 0, not engaged at all
        var x = actor._bfX;
        var y = actor._bfY;
        var z = actor._bfZ;
        var enemies = $gameTroop ? $gameTroop.aliveMembers() : [];
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (e._bfX === x && e._bfY === y && e._bfZ === z) {
                return true;
            }
        }
        return false;
    }

    // -----------------------------------------------------------------------
    // Extend Game_Actor.isSkillSealed so that the attack skill is sealed when
    // a Melee weapon is equipped but no engaged enemy is present.
    //
    // The existing HideSealedSkills.js plugin already reads isSkillSealed and
    // removes the skill from the selection window, so nothing extra is needed.
    // -----------------------------------------------------------------------

    var _orig_isSkillSealed = Game_Actor.prototype.isSkillSealed;
    Game_Actor.prototype.isSkillSealed = function (skillId) {
        if (_orig_isSkillSealed.call(this, skillId)) return true;
        if (skillId === this.attackSkillId()) {
            if (actorHasMeleeWeapon(this) && !actorEngagedWithEnemy(this)) {
                return true;
            }
        }
        return false;
    };

})();
