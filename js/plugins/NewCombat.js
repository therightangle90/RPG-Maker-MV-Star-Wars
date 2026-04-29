/*:
 * @target MV
 * @plugindesc Replaces standard combat commands with Action, Manoeuvre, and End Turn.
 *
 * Turn economy (actors and enemies):
 *   Free:   Action + Manoeuvre  OR  two Manoeuvres
 *   Costly: a third activity on top of the above, at the price of 2 MP (strain)
 *
 * The menu always shows three entries with the same labels.  Their colour and
 * enabled state update automatically after each choice:
 *
 *   • Nothing chosen yet        → Action (white)   Manoeuvre (white)
 *   • Action taken              → Action (grey)    Manoeuvre (white)
 *   • 1 Manoeuvre taken         → Action (white)   Manoeuvre (white)
 *   • Action + 1 Manoeuvre      → Action (grey)    Manoeuvre (yellow, costs 2 MP)
 *   • 2 Manoeuvres taken        → Action (yellow, costs 2 MP)   Manoeuvre (grey)
 *   • All three done            → Action (grey)    Manoeuvre (grey)
 *
 * Enemies use the same three-slot structure.  AI picks Action-type skills for
 * slot 0 and Manoeuvre-type skills for slots 1–2, paying the MP cost when the
 * action slot is also filled.
 */

(function () {
    'use strict';

    // Skill type IDs (System.json skillTypes):
    // 0='' 1=Magic 2=Special 3=Action 4=Manoeuvre 5=Incidental
    var ACTION_STYPE    = 3;
    var MANOEUVRE_STYPE = 4;

    var ACTION_SLOT     = 0;  // Action-type skill
    var MANOEUVRE_SLOT  = 1;  // First Manoeuvre
    var MANOEUVRE2_SLOT = 2;  // Second Manoeuvre (costly when Action also used)
    var TOTAL_SLOTS     = 3;

    var STRAIN_MP_COST  = 2;  // MP charged for the costly third activity

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    function actionSlotFilled(battler) {
        var a = battler._actions[ACTION_SLOT];
        return !!(a && a.item());
    }

    // Rating-weighted random pick from an enemy action list.
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
    // Game_Actor – always provision three slots; End Turn drives advancement.
    // -----------------------------------------------------------------------

    Game_Actor.prototype.makeActions = function () {
        Game_Battler.prototype.makeActions.call(this);
        if (this._actions.length === 0) return;
        while (this._actions.length < TOTAL_SLOTS) this._actions.push(new Game_Action(this));
        while (this._actions.length > TOTAL_SLOTS) this._actions.pop();
        this.setActionState('undecided');
    };

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

        this._actions = [];
        for (var i = 0; i < TOTAL_SLOTS; i++) {
            this._actions.push(new Game_Action(this));
        }

        var allValid = this.enemy().actions.filter(function (a) {
            return this.isActionValid(a);
        }, this);

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
            var chosen0 = selectWeightedAction(actionTypeList);
            if (chosen0) this._actions[ACTION_SLOT].setEnemyAction(chosen0);
        }

        // Slot 1 – First Manoeuvre
        if (manoeuvreTypeList.length > 0) {
            var chosen1 = selectWeightedAction(manoeuvreTypeList);
            if (chosen1) this._actions[MANOEUVRE_SLOT].setEnemyAction(chosen1);
        }

        // Slot 2 – Second Manoeuvre (free when Action slot empty; costs MP otherwise)
        if (manoeuvreTypeList.length > 0) {
            var slot0Filled = actionSlotFilled(this);
            var canAfford   = !slot0Filled || this.mp >= STRAIN_MP_COST;
            if (canAfford) {
                var chosen2 = selectWeightedAction(manoeuvreTypeList);
                if (chosen2) {
                    this._actions[MANOEUVRE2_SLOT].setEnemyAction(chosen2);
                    if (slot0Filled) this.gainMp(-STRAIN_MP_COST);
                }
            }
        }

        this.setActionState('waiting');
    };

    // -----------------------------------------------------------------------
    // Window_ActorCommand – three entries whose state changes each selection.
    //
    // Per-actor state tracked on the actor object:
    //   _actionChosen   {boolean} – action slot has been committed
    //   _manoeuvreCount {number}  – 0, 1, or 2 manoeuvres committed
    //   _strainPending  {boolean} – 2 MP to be deducted at End Turn
    // -----------------------------------------------------------------------

    Window_ActorCommand.prototype.numVisibleRows = function () {
        return 3;
    };

    Window_ActorCommand.prototype.makeCommandList = function () {
        if (!this._actor) return;
        var actor = this._actor;
        var aC    = !!actor._actionChosen;
        var mC    = actor._manoeuvreCount || 0;

        // "Two free things" have been used when: Action + ≥1 Manoeuvre, or ≥2 Manoeuvres.
        var twoUsed = (aC && mC >= 1) || mC >= 2;

        // ---- Action entry ----
        var aEnabled, aExt;
        if (aC) {
            aEnabled = false; aExt = null;              // already used – grey
        } else if (twoUsed) {                           // 2 manoeuvres taken; action is costly
            aEnabled = actor.mp >= STRAIN_MP_COST;
            aExt     = 'yellow';
        } else {
            aEnabled = true; aExt = null;
        }

        // ---- Manoeuvre entry ----
        var mEnabled, mExt;
        if (mC >= 2) {
            mEnabled = false; mExt = null;              // max manoeuvres – grey
        } else if (twoUsed) {                           // Action + 1 Manoeuvre taken; 2nd is costly
            mEnabled = actor.mp >= STRAIN_MP_COST;
            mExt     = 'yellow';
        } else {
            mEnabled = true; mExt = null;
        }

        this.addCommand('Action',    'action',    aEnabled, aExt);
        this.addCommand('Manoeuvre', 'manoeuvre', mEnabled, mExt);
        this.addCommand('End Turn',  'endTurn',   true,     null);
    };

    // Render entries that carry the 'yellow' ext tag in crisis/warning colour.
    Window_ActorCommand.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        this.resetTextColor();
        var ext = this._list[index] ? this._list[index].ext : null;
        if (ext === 'yellow') {
            this.changeTextColor(this.crisisColor());
        }
        this.changePaintOpacity(this.isCommandEnabled(index));
        this.drawText(this.commandName(index), rect.x, rect.y, rect.width, this.itemTextAlign());
        this.resetTextColor();
    };

    // Point the cursor at the most logical next option after each committed choice.
    Window_ActorCommand.prototype.selectLast = function () {
        if (!this._actor) { this.select(0); return; }
        var aC = !!this._actor._actionChosen;
        var mC = this._actor._manoeuvreCount || 0;
        if (aC && mC >= 1) {
            this.select(2); // both free slots used – suggest End Turn
        } else if (aC) {
            this.select(1); // action done – suggest Manoeuvre
        } else if (mC >= 1) {
            this.select(0); // manoeuvre done – suggest Action (or second Manoeuvre)
        } else {
            this.select(0);
        }
    };

    // -----------------------------------------------------------------------
    // Scene_Battle – command wiring and action flow.
    // -----------------------------------------------------------------------

    Scene_Battle.prototype.createActorCommandWindow = function () {
        this._actorCommandWindow = new Window_ActorCommand();
        this._actorCommandWindow.setHandler('action',    this.commandAction.bind(this));
        this._actorCommandWindow.setHandler('manoeuvre', this.commandManoeuvre.bind(this));
        this._actorCommandWindow.setHandler('endTurn',   this.commandEndTurn.bind(this));
        this._actorCommandWindow.setHandler('cancel',    this.selectPreviousCommand.bind(this));
        this.addWindow(this._actorCommandWindow);
    };

    // Initialise per-actor turn state at the start of the input phase.
    Scene_Battle.prototype.startActorCommandSelection = function () {
        var actor = BattleManager.actor();
        if (actor) {
            actor._actionChosen    = false;
            actor._manoeuvreCount  = 0;
            actor._strainPending   = false;
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

    // Action – always maps to slot 0.
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

    // Manoeuvre – maps to slot 1 for the first pick, slot 2 for the second.
    Scene_Battle.prototype.commandManoeuvre = function () {
        var actor = BattleManager.actor();
        this._currentInputSlot  = (actor._manoeuvreCount || 0) === 0 ? MANOEUVRE_SLOT : MANOEUVRE2_SLOT;
        actor._actionInputIndex = this._currentInputSlot;
        this._skillWindow.setActor(actor);
        this._skillWindow.setStypeId(MANOEUVRE_STYPE);
        this._skillWindow.refresh();
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // End Turn – deduct strain cost if a costly third activity was committed.
    Scene_Battle.prototype.commandEndTurn = function () {
        var actor = BattleManager.actor();
        if (actor._strainPending) {
            actor.gainMp(-STRAIN_MP_COST);
            actor._strainPending = false;
        }
        actor._actionInputIndex = actor.numActions() - 1;
        this.selectNextCommand();
    };

    // Skill confirmed – record choice, flag strain if this was the costly third activity,
    // then handle target selection or return to the (refreshed) command window.
    Scene_Battle.prototype.onSkillOk = function () {
        var skill  = this._skillWindow.item();
        var actor  = BattleManager.actor();
        var action = actor._actions[this._currentInputSlot];
        action.setSkill(skill.id);
        actor.setLastBattleSkill(skill);

        var aC = !!actor._actionChosen;
        var mC = actor._manoeuvreCount || 0;

        // Costly "third thing": Action chosen while 2 manoeuvres already taken,
        // or second Manoeuvre chosen while Action is already taken.
        var isThird = (!aC && mC >= 2 && this._currentInputSlot === ACTION_SLOT) ||
                      (aC  && mC >= 1 && this._currentInputSlot !== ACTION_SLOT);
        if (isThird) actor._strainPending = true;

        if (this._currentInputSlot === ACTION_SLOT) {
            actor._actionChosen = true;
        } else {
            actor._manoeuvreCount = mC + 1;
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