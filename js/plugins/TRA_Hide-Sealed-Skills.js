/*:
 * @target MV
 * @plugindesc Hides skills that are sealed (by a Seal Skill or Seal Skill Type
 *             trait) from the skill list window so the player never sees
 *             abilities their character cannot currently use.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * RPG Maker MV normally shows skills even when the actor cannot use them due
 * to Seal Skill / Seal Skill Type traits. This plugin removes those skills
 * from the list entirely for a cleaner UI.
 *
 * ============================================================================
 * Behavior
 * ============================================================================
 *
 * - Applies to skill list inclusion checks.
 * - Respects both per-skill and per-skill-type seals.
 */

(function () {
    'use strict';

    // Window_SkillList.includes decides which skills are shown in the list.
    // We extend it to also exclude any skill that is sealed on the actor,
    // either individually (Seal Skill trait) or by skill type (Seal Skill Type).

    var _orig_includes = Window_SkillList.prototype.includes;
    Window_SkillList.prototype.includes = function (item) {
        if (!_orig_includes.call(this, item)) return false;
        if (!this._actor) return true;
        if (this._actor.isSkillSealed(item.id)) return false;
        if (this._actor.isSkillTypeSealed(item.stypeId)) return false;
        return true;
    };

})();
