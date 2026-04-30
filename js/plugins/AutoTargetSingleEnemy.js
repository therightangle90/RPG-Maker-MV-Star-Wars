/*:
 * @target MV
 * @plugindesc When a skill targets 1 Enemy (scope 1) and there is only one
 *             alive enemy in the battle, the enemy is targeted automatically
 *             without showing the enemy-selection window.
 */

(function () {
    'use strict';

    var _orig_selectEnemySelection = Scene_Battle.prototype.selectEnemySelection;
    Scene_Battle.prototype.selectEnemySelection = function () {
        var aliveEnemies = $gameTroop.aliveMembers();
        if (aliveEnemies.length === 1) {
            var action = BattleManager.inputtingAction();
            if (action && action.item() && action.item().scope === 1) {
                // Set the target directly. Do NOT call onEnemyOk() here because
                // that overrides the target with _enemyWindow.enemyIndex() which
                // returns -1 on an unshown window, leading to makeTargets() using
                // randomTarget() which can return null and break the action loop.
                action.setTarget(aliveEnemies[0].index());
                this._enemyWindow.hide();
                this._skillWindow.hide();
                this._itemWindow.hide();
                this._executeImmediateAction();
                return;
            }
        }
        _orig_selectEnemySelection.call(this);
    };

})();
