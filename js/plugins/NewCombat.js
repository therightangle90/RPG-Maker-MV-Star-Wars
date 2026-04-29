/*:
 * @target MV
 * @plugindesc Replaces standard combat commands with Action, Manoeuvre, and End Turn.
 * Selecting Action opens the skill list for Skill Type "Action" (id 3).
 * Selecting Manoeuvre opens the skill list for Skill Type "Manoeuvre" (id 4).
 * Each actor may use one, both, or neither before pressing End Turn.
 */

(function () {
    'use strict';

    // Skill type IDs from System.json skillTypes:
    // index 0='' 1=Magic 2=Special 3=Action 4=Manoeuvre 5=Incidental
    var ACTION_STYPE    = 3;
    var MANOEUVRE_STYPE = 4;

    var ACTION_SLOT    = 0;
    var MANOEUVRE_SLOT = 1;

    // -----------------------------------------------------------------------
    // Game_Actor – always provide two action slots per turn.
    // Slot advancement is handled manually via End Turn, not the default flow.
    // -----------------------------------------------------------------------

    Game_Actor.prototype.makeActions = function () {
        Game_Battler.prototype.makeActions.call(this);
        if (this._actions.length === 0) return; // actor cannot move
        while (this._actions.length < 2) this._actions.push(new Game_Action(this));
        while (this._actions.length > 2) this._actions.pop();
        this.setActionState('undecided');
    };

    // Never advance via the slot index automatically; End Turn drives advancement.
    Game_Actor.prototype.selectNextCommand = function () {
        return false;
    };

    // -----------------------------------------------------------------------
    // Window_ActorCommand – three entries with checkmark indicators
    // -----------------------------------------------------------------------

    Window_ActorCommand.prototype.numVisibleRows = function () {
        return 3;
    };

    Window_ActorCommand.prototype.makeCommandList = function () {
        if (this._actor) {
            var aChosen = !!this._actor._actionChosen;
            var mChosen = !!this._actor._manoeuvreChosen;
            this.addCommand('Action'    + (aChosen ? ' \u2713' : ''), 'action',    true);
            this.addCommand('Manoeuvre' + (mChosen ? ' \u2713' : ''), 'manoeuvre', true);
            this.addCommand('End Turn',                                'endTurn',   true);
        }
    };

    // Auto-advance cursor to the most useful next command after a selection.
    Window_ActorCommand.prototype.selectLast = function () {
        var aChosen = this._actor && this._actor._actionChosen;
        var mChosen = this._actor && this._actor._manoeuvreChosen;
        if (aChosen && mChosen) {
            this.select(2); // suggest End Turn when both are done
        } else if (aChosen) {
            this.select(1); // suggest Manoeuvre next
        } else {
            this.select(0); // start at Action
        }
    };

    // -----------------------------------------------------------------------
    // Scene_Battle – wire up the new command flow
    // -----------------------------------------------------------------------

    Scene_Battle.prototype.createActorCommandWindow = function () {
        this._actorCommandWindow = new Window_ActorCommand();
        this._actorCommandWindow.setHandler('action',    this.commandAction.bind(this));
        this._actorCommandWindow.setHandler('manoeuvre', this.commandManoeuvre.bind(this));
        this._actorCommandWindow.setHandler('endTurn',   this.commandEndTurn.bind(this));
        this._actorCommandWindow.setHandler('cancel',    this.selectPreviousCommand.bind(this));
        this.addWindow(this._actorCommandWindow);
    };

    // Reset per-actor choice state at the start of each actor's input phase.
    Scene_Battle.prototype.startActorCommandSelection = function () {
        var actor = BattleManager.actor();
        if (actor) {
            actor._actionChosen    = false;
            actor._manoeuvreChosen = false;
            actor._actionInputIndex = 0;
            actor._actions[ACTION_SLOT].clear();
            actor._actions[MANOEUVRE_SLOT].clear();
        }
        this._currentInputSlot = ACTION_SLOT; // safe default
        this._statusWindow.select(actor ? actor.index() : 0);
        this._partyCommandWindow.close();
        this._actorCommandWindow.setup(actor);
    };

    // Opens the skill list filtered to Action-type skills.
    Scene_Battle.prototype.commandAction = function () {
        this._currentInputSlot = ACTION_SLOT;
        var actor = BattleManager.actor();
        actor._actionInputIndex = ACTION_SLOT;
        this._skillWindow.setActor(actor);
        this._skillWindow.setStypeId(ACTION_STYPE);
        this._skillWindow.refresh();
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // Opens the skill list filtered to Manoeuvre-type skills.
    Scene_Battle.prototype.commandManoeuvre = function () {
        this._currentInputSlot = MANOEUVRE_SLOT;
        var actor = BattleManager.actor();
        actor._actionInputIndex = MANOEUVRE_SLOT;
        this._skillWindow.setActor(actor);
        this._skillWindow.setStypeId(MANOEUVRE_STYPE);
        this._skillWindow.refresh();
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // Confirms the actor's choices and moves input to the next actor (or starts the turn).
    Scene_Battle.prototype.commandEndTurn = function () {
        var actor = BattleManager.actor();
        // Place the index on the last slot so actor.selectNextCommand() returns false,
        // which tells BattleManager to advance to the next actor.
        actor._actionInputIndex = actor.numActions() - 1;
        this.selectNextCommand();
    };

    // Skill confirmed – store it in the correct slot, then handle target selection or
    // return to the command window.
    Scene_Battle.prototype.onSkillOk = function () {
        var skill  = this._skillWindow.item();
        var actor  = BattleManager.actor();
        var action = actor._actions[this._currentInputSlot];
        action.setSkill(skill.id);
        actor.setLastBattleSkill(skill);

        if (this._currentInputSlot === ACTION_SLOT) {
            actor._actionChosen    = true;
        } else {
            actor._manoeuvreChosen = true;
        }

        this._skillWindow.hide();

        if (!action.needsSelection()) {
            this._actorCommandWindow.setup(actor); // refresh checkmarks; return to command
        } else if (action.isForOpponent()) {
            this.selectEnemySelection();
        } else {
            this.selectActorSelection();
        }
    };

    // Skill cancelled – return to the command window.
    Scene_Battle.prototype.onSkillCancel = function () {
        this._skillWindow.hide();
        this._actorCommandWindow.activate();
    };

    // Enemy target confirmed – return to the command window.
    Scene_Battle.prototype.onEnemyOk = function () {
        var action = BattleManager.inputtingAction();
        action.setTarget(this._enemyWindow.enemyIndex());
        this._enemyWindow.hide();
        this._skillWindow.hide();
        this._itemWindow.hide();
        this._actorCommandWindow.setup(BattleManager.actor());
    };

    // Enemy target cancelled – re-open the skill list for the current slot.
    Scene_Battle.prototype.onEnemyCancel = function () {
        this._enemyWindow.hide();
        var stypeId = (this._currentInputSlot === ACTION_SLOT) ? ACTION_STYPE : MANOEUVRE_STYPE;
        this._skillWindow.setStypeId(stypeId);
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // Ally target confirmed – return to the command window.
    Scene_Battle.prototype.onActorOk = function () {
        var action = BattleManager.inputtingAction();
        action.setTarget(this._actorWindow.index());
        this._actorWindow.hide();
        this._skillWindow.hide();
        this._itemWindow.hide();
        this._actorCommandWindow.setup(BattleManager.actor());
    };

    // Ally target cancelled – re-open the skill list for the current slot.
    Scene_Battle.prototype.onActorCancel = function () {
        this._actorWindow.hide();
        var stypeId = (this._currentInputSlot === ACTION_SLOT) ? ACTION_STYPE : MANOEUVRE_STYPE;
        this._skillWindow.setStypeId(stypeId);
        this._skillWindow.show();
        this._skillWindow.activate();
    };

})();