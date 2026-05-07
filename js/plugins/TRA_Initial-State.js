/*:
 * @target MV
 * @plugindesc Applies state ID 12 (Standing) to every party member when a
 *             new game starts and when a save file is loaded.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * Ensures party actors always start in the expected baseline state by applying
 * state 12 (Standing) after new game initialization and after loading a save.
 *
 * ============================================================================
 * Notes
 * ============================================================================
 *
 * - State ID is currently hardcoded to 12.
 * - State is only added when missing; existing applications are not duplicated.
 */

(function () {
    'use strict';

    var STANDING_STATE_ID = 12;

    function applyStandingState() {
        $gameParty.members().forEach(function (actor) {
            if (!actor.isStateAffected(STANDING_STATE_ID)) {
                actor.addState(STANDING_STATE_ID);
            }
        });
    }

    // New game
    var _DataManager_setupNewGame = DataManager.setupNewGame;
    DataManager.setupNewGame = function () {
        _DataManager_setupNewGame.call(this);
        applyStandingState();
    };

    // Load game
    var _DataManager_loadGameWithoutRescue = DataManager.loadGameWithoutRescue;
    DataManager.loadGameWithoutRescue = function (savefileId) {
        var result = _DataManager_loadGameWithoutRescue.call(this, savefileId);
        applyStandingState();
        return result;
    };

})();
