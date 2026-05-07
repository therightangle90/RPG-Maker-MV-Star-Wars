/*:
 * @target MV
 * @plugindesc Skips the party command window and jumps directly to actor input.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * Removes the Party Command step ("Fight / Escape") during battle flow by
 * closing that window and immediately selecting the next actor command.
 */

(function () {
    'use strict';

    Scene_Battle.prototype.startPartyCommandSelection = function () {
        this._partyCommandWindow.close();
        this.selectNextCommand();
    };

})();
