/*:
 * @target MV
 * @plugindesc Replaces standard combat commands with Action, Manoeuvre, Second Manoeuvre,
 * and End Turn.
 *
 * Each turn an actor may use:
 *   - Action only
 *   - Manoeuvre only
 *   - Action + Manoeuvre
 *   - Two Manoeuvres (free – uses the Action slot as a second Manoeuvre)
 *   - Action + Two Manoeuvres (costs 2 MP / strain)
 *
 * The "Second Manoeuvre" command is always shown in warning yellow. When an Action
 * has already been chosen the label shows "(2 MP)" to signal the strain cost.
 * The command is greyed-out if the cost cannot currently be paid.
 *
 * Enemies follow the same structure; their AI selects Action-type skills for slot 0
 * and Manoeuvre-type skills for slots 1–2, paying the MP cost when applicable.
 */

(function () {
    'use strict';

    // Skill type IDs (System.json skillTypes array):
    // 0='' 1=Magic 2=Special 3=Action 4=Manoeuvre 5=Incidental
    var ACTION_STYPE        = 3;
    var MANOEUVRE_STYPE     = 4;

    var ACTION_SLOT         = 0;  // Action-type skill
    var MANOEUVRE_SLOT      = 1;  // First Manoeuvre
    var MANOEUVRE2_SLOT     = 2;  // Second Manoeuvre (costly when Action also used)
    var TOTAL_SLOTS         = 3;

    var SECOND_MANO_MP_COST = 2;  // MP (strain) charged for Action + Two Manoeuvres

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    // Returns true if the action slot (slot 0) of a battler holds a valid skill.
    function actionSlotFilled(battler) {
        var a = battler._actions[ACTION_SLOT];
        return !!(a && a.item());
    }

    // Pick one action from actionList using the rating-weighted system.
    function selectWeightedAction(actionList) {
        if (!actionList || actionList.length === 0) return null;
        var ratingMax  = Math.max.apply(null, actionList.map(function (a) { return a.rating; }));
        var ratingZero = ratingMax - 3;
        var valid = actionList.filter(function (a) { return a.rating > ratingZero; });
        if (valid.length === 0) return null;
        var sum = valid.reduce(function (r, a) { return r + a.rating - ratingZero; }, 0);
        var value = Math.randomInt(sum);
        for (var i = 0; i < valid.length; i++) {
            value -= valid[i].rating - ratingZero;
            if (value < 0) return valid[i];
        }
        return valid[valid.length - 1];
    }

    // -----------------------------------------------------------------------
    // Game_Actor – always provide three action slots per turn.
    // Slot advancement is driven exclusively by End Turn.
    // -----------------------------------------------------------------------

    Game_Actor.prototype.makeActions = function () {
        Game_Battler.prototype.makeActions.call(this);
        if (this._actions.length === 0) return; // actor cannot move
        while (this._actions.length < TOTAL_SLOTS) this._actions.push(new Game_Action(this));
        while (this._actions.length > TOTAL_SLOTS) this._actions.pop();
        this.setActionState('undecided');
    };

    // Never auto-advance; End Turn drives it.
    Game_Actor.prototype.selectNextCommand = function () {
        return false;
    };

    // -----------------------------------------------------------------------
    // Game_Enemy – three slots filled by skill type via AI.
    // -----------------------------------------------------------------------

    Game_Enemy.prototype.makeActions = function () {
        this.clearActions();
        if (!this.canMove()) {
            this.setActionState('waiting');
            return;
        }

        // Always provision three slots.
        this._actions = [];
        for (var i = 0; i < TOTAL_SLOTS; i++) {
            this._actions.push(new Game_Action(this));
        }

        var allValid = this.enemy().actions.filter(function (a) {
            return this.isActionValid(a);
        }, this);

        // Split available actions by skill type.
        var actionTypeList = allValid.filter(function (a) {
            var skill = $dataSkills[a.skillId];
            return skill && skill.stypeId === ACTION_STYPE;
        });
        var manoeuvreTypeList = allValid.filter(function (a) {
            var skill = $dataSkills[a.skillId];
            return skill && skill.stypeId === MANOEUVRE_STYPE;
        });

        // Slot 0 – Action
        if (actionTypeList.length > 0) {
            var chosenAction = selectWeightedAction(actionTypeList);
            if (chosenAction) this._actions[ACTION_SLOT].setEnemyAction(chosenAction);
        }

        // Slot 1 – First Manoeuvre
        if (manoeuvreTypeList.length > 0) {
            var chosenMano1 = selectWeightedAction(manoeuvreTypeList);
            if (chosenMano1) this._actions[MANOEUVRE_SLOT].setEnemyAction(chosenMano1);
        }

        // Slot 2 – Second Manoeuvre (free when Action slot is empty; costs MP otherwise)
        if (manoeuvreTypeList.length > 0) {
            var slot0HasAction = actionSlotFilled(this);
            var canAfford      = !slot0HasAction || this.mp >= SECOND_MANO_MP_COST;
            if (canAfford) {
                var chosenMano2 = selectWeightedAction(manoeuvreTypeList);
                if (chosenMano2) {
                    this._actions[MANOEUVRE2_SLOT].setEnemyAction(chosenMano2);
                    if (slot0HasAction) this.gainMp(-SECOND_MANO_MP_COST);
                }
            }
        }

        this.setActionState('waiting');
    };

    // -----------------------------------------------------------------------
    // Window_ActorCommand – four entries with checkmark indicators.
    // -----------------------------------------------------------------------

    Window_ActorCommand.prototype.numVisibleRows = function () {
        return 4;
    };

    Window_ActorCommand.prototype.makeCommandList = function () {
        if (!this._actor) return;
        var actor   = this._actor;
        var aChosen = !!actor._actionChosen;
        var mChosen = !!actor._manoeuvreChosen;
        var m2Chosen = !!actor._manoeuvre2Chosen;

        // Second Manoeuvre is free when Action hasn't been chosen; costs 2 MP otherwise.
        var m2Cost    = aChosen ? SECOND_MANO_MP_COST : 0;
        var m2Enabled = m2Cost === 0 || actor.mp >= m2Cost;
        var m2Label   = 'Second Manoeuvre' +
                        (m2Chosen  ? ' \u2713' : '') +
                        (aChosen   ? ' (2 MP)' : '');

        this.addCommand('Action'    + (aChosen  ? ' \u2713' : ''), 'action',     true);
        this.addCommand('Manoeuvre' + (mChosen  ? ' \u2713' : ''), 'manoeuvre',  true);
        this.addCommand(m2Label,                                    'manoeuvre2', m2Enabled);
        this.addCommand('End Turn',                                 'endTurn',    true);
    };

    // Draw the Second Manoeuvre entry in warning-yellow to highlight its potential cost.
    Window_ActorCommand.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        this.resetTextColor();
        if (this.commandSymbol(index) === 'manoeuvre2') {
            this.changeTextColor(this.crisisColor());
        }
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), rect.x, rect.y, rect.width, this.itemTextAlign());
        this.resetTextColor();
    };

    // Auto-advance cursor to the most logical next option.
    Window_ActorCommand.prototype.selectLast = function () {
        var actor    = this._actor;
        var aChosen  = actor && actor._actionChosen;
        var mChosen  = actor && actor._manoeuvreChosen;
        var m2Chosen = actor && actor._manoeuvre2Chosen;
        if (aChosen && mChosen && m2Chosen) {
            this.select(3); // suggest End Turn
        } else if (aChosen && mChosen) {
            this.select(2); // suggest Second Manoeuvre
        } else if (aChosen) {
            this.select(1); // suggest Manoeuvre
        } else {
            this.select(0); // start at Action
        }
    };

    // -----------------------------------------------------------------------
    // Scene_Battle – command handlers and skill/target flow.
    // -----------------------------------------------------------------------

    Scene_Battle.prototype.createActorCommandWindow = function () {
        this._actorCommandWindow = new Window_ActorCommand();
        this._actorCommandWindow.setHandler('action',     this.commandAction.bind(this));
        this._actorCommandWindow.setHandler('manoeuvre',  this.commandManoeuvre.bind(this));
        this._actorCommandWindow.setHandler('manoeuvre2', this.commandManoeuvre2.bind(this));
        this._actorCommandWindow.setHandler('endTurn',    this.commandEndTurn.bind(this));
        this._actorCommandWindow.setHandler('cancel',     this.selectPreviousCommand.bind(this));
        this.addWindow(this._actorCommandWindow);
    };

    // Reset per-actor choice state at the start of each actor's input phase.
    Scene_Battle.prototype.startActorCommandSelection = function () {
        var actor = BattleManager.actor();
        if (actor) {
            actor._actionChosen    = false;
            actor._manoeuvreChosen = false;
            actor._manoeuvre2Chosen = false;
            actor._actionInputIndex = 0;
            actor._actions[ACTION_SLOT].clear();
            actor._actions[MANOEUVRE_SLOT].clear();
            actor._actions[MANOEUVRE2_SLOT].clear();
        }
        this._currentInputSlot = ACTION_SLOT;
        this._statusWindow.select(actor ? actor.index() : 0);
        this._partyCommandWindow.close();
        this._actorCommandWindow.setup(actor);
    };

    // Opens the skill list for Action-type skills (slot 0).
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

    // Opens the skill list for Manoeuvre-type skills (slot 1).
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

    // Opens the skill list for Manoeuvre-type skills (slot 2 – potentially costly).
    Scene_Battle.prototype.commandManoeuvre2 = function () {
        this._currentInputSlot = MANOEUVRE2_SLOT;
        var actor = BattleManager.actor();
        actor._actionInputIndex = MANOEUVRE2_SLOT;
        this._skillWindow.setActor(actor);
        this._skillWindow.setStypeId(MANOEUVRE_STYPE);
        this._skillWindow.refresh();
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // Confirms the actor's choices.  Pays the strain cost if Action + Second Manoeuvre
    // are both filled; clears slot 2 if the cost can no longer be met.
    Scene_Battle.prototype.commandEndTurn = function () {
        var actor = BattleManager.actor();

        if (actor._manoeuvre2Chosen && actionSlotFilled(actor)) {
            if (actor.mp >= SECOND_MANO_MP_COST) {
                actor.gainMp(-SECOND_MANO_MP_COST);
            } else {
                // Cannot pay – silently clear the second-manoeuvre slot.
                actor._actions[MANOEUVRE2_SLOT].clear();
                actor._manoeuvre2Chosen = false;
            }
        }

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
            actor._actionChosen     = true;
        } else if (this._currentInputSlot === MANOEUVRE_SLOT) {
            actor._manoeuvreChosen  = true;
        } else {
            actor._manoeuvre2Chosen = true;
        }

        this._skillWindow.hide();

        if (!action.needsSelection()) {
            this._actorCommandWindow.setup(actor);
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

    // Enemy target cancelled – re-open the appropriate skill list.
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

    // Ally target cancelled – re-open the appropriate skill list.
    Scene_Battle.prototype.onActorCancel = function () {
        this._actorWindow.hide();
        var stypeId = (this._currentInputSlot === ACTION_SLOT) ? ACTION_STYPE : MANOEUVRE_STYPE;
        this._skillWindow.setStypeId(stypeId);
        this._skillWindow.show();
        this._skillWindow.activate();
    };

})();