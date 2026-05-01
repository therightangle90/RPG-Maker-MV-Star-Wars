/*:
 * @target MV
 * @plugindesc Hides skills that are sealed (by a Seal Skill or Seal Skill Type
 *             trait) from the skill list window so the player never sees
 *             abilities their character cannot currently use.
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
