/*:
 * @target MV
 * @plugindesc Action + Manoeuvre dual selection (fixed)
 */

(function() {

    const ACTION_STYPE = 1;
    const MANOEUVRE_STYPE = 2;

    let step = 0;
    let firstChoice = null;

    Window_ActorCommand.prototype.makeCommandList = function() {
        if (this._actor) {
            this.addCommand("Action", "action", true, ACTION_STYPE);
            this.addCommand("Manoeuvre", "manoeuvre", true, MANOEUVRE_STYPE);
        }
    };

    Scene_Battle.prototype.createActorCommandWindow = function() {
        this._actorCommandWindow = new Window_ActorCommand();
        this._actorCommandWindow.setHandler("action", this.commandCustomSkill.bind(this));
        this._actorCommandWindow.setHandler("manoeuvre", this.commandCustomSkill.bind(this));
        this.addWindow(this._actorCommandWindow);
    };

    Scene_Battle.prototype.commandCustomSkill = function() {
        firstChoice = this._actorCommandWindow.currentSymbol();
        step = 0;

        this._actorCommandWindow._ext = this._actorCommandWindow.currentExt();
        this.commandSkill();
    };

    const _onSkillOk = Scene_Battle.prototype.onSkillOk;
    Scene_Battle.prototype.onSkillOk = function() {
        const action = BattleManager.inputtingAction();
        action.setSkill(this._skillWindow.item().id);

        if (step === 0) {
            step = 1;

            if (firstChoice === "action") {
                this._actorCommandWindow._ext = MANOEUVRE_STYPE;
            } else {
                this._actorCommandWindow._ext = ACTION_STYPE;
            }

            this.commandSkill();
        } else {
            this.selectNextCommand();
        }
    };

})();