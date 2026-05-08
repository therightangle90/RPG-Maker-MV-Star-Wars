/*:
 * @target MV
 * @plugindesc Replaces standard combat commands with Action, Manoeuvre, Incidental, and End Turn.
 *             Selected skills execute immediately; the menu reappears after each execution.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * Replaces the default turn-command flow with:
 *   - Action
 *   - Manoeuvre
 *   - Incidental
 *   - End Turn
 *
 * Selected skills execute immediately and control returns to the actor command
 * menu until the player chooses End Turn.
 *
 * When used with TRA_Battlefield-Movement, if a move prompt is cancelled
 * (BATTLEFIELD PROMPT_MOVE cancel), the immediate action/manoeuvre spend for
 * that selection is rolled back.
 *
 * Turn economy (actors and enemies):
 *   Free:   Action + Manoeuvre  OR  two Manoeuvres
 *   Costly: a third activity costs 2 MP (strain), deducted at the moment of execution
 *   Incidental: unlimited; never costs strain and does not count toward the above limits
 *
 * Menu state (colours update dynamically):
 *   • Nothing chosen        → Action (white)    Manoeuvre (white)
 *   • Action taken          → Action (grey)     Manoeuvre (white)
 *   • 1 Manoeuvre taken     → Action (white)    Manoeuvre (white)
 *   • Action + 1 Manoeuvre  → Action (grey)     Manoeuvre (orange, 2 MP; disabled if can't pay)
 *   • 2 Manoeuvres taken    → Action (orange, 2 MP; disabled if can't pay)  Manoeuvre (grey)
 *   • All three done        → Action (grey)     Manoeuvre (grey)
 *   • Incidental            → always available, white, no limit
 *
 * Enemies use the same three-slot structure.  AI picks Action-type skills for
 * slot 0 and Manoeuvre-type skills for slots 1–2, paying the MP cost when the
 * action slot is also filled.
 */

(function () {
    'use strict';

    // Skill type IDs (System.json skillTypes):
    // 0='' 1=Magic 2=Special 3=Action 4=Manoeuvre 5=Incidental
    var ACTION_STYPE     = 3;
    var MANOEUVRE_STYPE  = 4;
    var INCIDENTAL_STYPE = 5;

    var ACTION_SLOT     = 0;  // Action-type skill
    var MANOEUVRE_SLOT  = 1;  // First Manoeuvre
    var MANOEUVRE2_SLOT = 2;  // Second Manoeuvre (costly when Action also used)
    var INCIDENTAL_SLOT = 3;  // Temporary slot used during incidental execution
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
    //   _actionChosen   {boolean} – action slot has been committed this turn
    //   _manoeuvreCount {number}  – 0, 1, or 2 manoeuvres committed this turn
    // -----------------------------------------------------------------------

    Window_ActorCommand.prototype.numVisibleRows = function () {
        return 4;
    };

    Window_ActorCommand.prototype.makeCommandList = function () {
        if (!this._actor) return;
        var actor = this._actor;
        var aC    = !!actor._actionChosen;
        var mC    = actor._manoeuvreCount || 0;

        // "Two free things" have been used when: Action + >=1 Manoeuvre, or >=2 Manoeuvres.
        var twoUsed = (aC && mC >= 1) || mC >= 2;

        // ---- Action entry ----
        var aEnabled, aExt;
        if (aC) {
            aEnabled = false; aExt = null;              // already used – grey
        } else if (twoUsed) {                           // 2 manoeuvres taken; action is costly
            aEnabled = actor.mp >= STRAIN_MP_COST;
            aExt     = 'orange';
        } else {
            aEnabled = true; aExt = null;
        }

        // ---- Manoeuvre entry ----
        var mEnabled, mExt;
        if (mC >= 2) {
            mEnabled = false; mExt = null;              // max manoeuvres – grey
        } else if (twoUsed) {                           // Action + 1 Manoeuvre taken; 2nd is costly
            mEnabled = actor.mp >= STRAIN_MP_COST;
            mExt     = 'orange';
        } else {
            mEnabled = true; mExt = null;
        }

        this.addCommand('Action',     'action',     aEnabled, aExt);
        this.addCommand('Manoeuvre',  'manoeuvre',  mEnabled, mExt);
        this.addCommand('Incidental', 'incidental', true,     null);
        this.addCommand('End Turn',   'endTurn',    true,     null);
    };

    // Render entries that carry the 'orange' ext tag in crisis/warning colour.
    Window_ActorCommand.prototype.drawItem = function (index) {
        var rect = this.itemRectForText(index);
        this.resetTextColor();
        var ext = this._list[index] ? this._list[index].ext : null;
        if (ext === 'orange') {
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
            this.select(3); // both free slots used – suggest End Turn
        } else if (aC) {
            this.select(1); // action done – suggest Manoeuvre
        } else if (mC >= 1) {
            this.select(0); // manoeuvre done – suggest Action (or second Manoeuvre)
        } else {
            this.select(0);
        }
    };

    // -----------------------------------------------------------------------
    // BattleManager – immediate single-action execution machinery.
    //
    // When the actor confirms a skill (and a target if needed), instead of
    // queuing it for later we execute it right away by temporarily replacing
    // the actor's three-slot _actions array with a one-element array that
    // holds only the chosen action.  The engine's own 'turn'/'action' phase
    // machinery runs that single action and then returns control here so we
    // can restore the full array and send the player back to the command menu.
    //
    // BattleManager flags used:
    //   _immediateMode          {boolean} – currently in immediate-exec mode
    //   _immediateActor         {Game_Actor} – actor being executed
    //   _returningFromImmediate {boolean} – tells startActorCommandSelection
    //                                        not to wipe the turn-state flags
    // -----------------------------------------------------------------------

    BattleManager._immediateMode          = false;
    BattleManager._immediateActor         = null;
    BattleManager._returningFromImmediate = false;
    BattleManager._resumeInputAfterImmediateEvent = false;
    BattleManager._immediateActionMeta = null;

    BattleManager._captureImmediateMeta = function (meta) {
        this._immediateActionMeta = meta || null;
    };

    BattleManager._consumeBattlefieldPromptCancel = function () {
        if (!$gameTemp) return false;
        var cancelled = !!$gameTemp._traBfPromptMoveCancelled;
        $gameTemp._traBfPromptMoveCancelled = false;
        return cancelled;
    };

    BattleManager._refundImmediateIfBattlefieldMoveCancelled = function () {
        var actor = this._immediateActor;
        var meta  = this._immediateActionMeta;
        this._immediateActionMeta = null;
        if (!actor || !meta || meta.isIncidental) return;
        if (!this._consumeBattlefieldPromptCancel()) return;

        actor._actionChosen   = !!meta.prevActionChosen;
        actor._manoeuvreCount = meta.prevManoeuvreCount || 0;
        if (meta.paidStrain) actor.gainMp(STRAIN_MP_COST);
    };

    // Swap the actor's full action array for a single-entry array holding the
    // chosen slot, then hand control to the engine's 'turn' phase.
    BattleManager.startImmediateAction = function (actor, slotIndex) {
        actor._immediateActionBackup = actor._actions.slice();
        actor._immediateSlotIndex = slotIndex;
        actor._actions = [actor._actions[slotIndex]];
        this._immediateMode  = true;
        this._immediateActor = actor;
        this._subject        = actor;
        this._phase          = 'turn';
    };

    // Common cleanup: restore the three-slot array and signal a return to input.
    BattleManager._finishImmediate = function () {
        var actor = this._immediateActor;
        if (actor) {
            actor._actions = actor._immediateActionBackup || [];
            actor._immediateActionBackup = null;
            if (actor._immediateSlotIndex >= 0 && actor._actions[actor._immediateSlotIndex]) {
                actor._actions[actor._immediateSlotIndex].clear();
            }
            actor._immediateSlotIndex = -1;
            while (actor._actions.length < TOTAL_SLOTS) {
                actor._actions.push(new Game_Action(actor));
            }
            // Trim any temporary incidental slot back down to the standard three.
            while (actor._actions.length > TOTAL_SLOTS) actor._actions.pop();
        }
    };

    // Guard processTurn so that an invalid immediate action (e.g. the actor
    // somehow ran out of MP between choosing and executing) still returns
    // cleanly to the command menu instead of falling through to enemy turns.
    var _orig_BM_processTurn = BattleManager.processTurn;
    BattleManager.processTurn = function () {
        if (!this._immediateMode) {
            return _orig_BM_processTurn.call(this);
        }
        var subject = this._subject;
        var action  = subject.currentAction();
        if (action) {
            action.prepare();
            var valid = action.isValid();
            if (valid) {
                this.startAction();   // sets _phase = 'action'; endAction() called later
            }
            subject.removeCurrentAction();
            if (!valid) {
                this._finishImmediate();
            }
        } else {
            this._finishImmediate();
        }
    };

    // After the engine finishes executing one action, restore the actor's full
    // slot array and return to the command-input phase.
    var _orig_BM_endAction = BattleManager.endAction;
    BattleManager.endAction = function () {
        if (this._immediateMode) {
            this._logWindow.endAction(this._subject);
            this._finishImmediate();
            this._immediateMode = false;
            this._resumeInputAfterImmediateEvent = false;
            // If the action ended the battle let the engine handle victory/defeat.
            // Otherwise return control to the player's command menu.
            if (!this.checkBattleEnd()) {
                if ($gameTemp.isCommonEventReserved()) {
                    this._resumeInputAfterImmediateEvent = true;
                    this._phase = 'turn';
                } else {
                    this._refundImmediateIfBattlefieldMoveCancelled();
                    this._returningFromImmediate = true;
                    this._phase = 'input';
                }
            } else {
                this._immediateActionMeta = null;
            }
            return;
        }
        _orig_BM_endAction.call(this);
    };

    var _orig_BM_updateTurn = BattleManager.updateTurn;
    BattleManager.updateTurn = function () {
        if (this._resumeInputAfterImmediateEvent) {
            if (!this.updateEventMain()) {
                this._resumeInputAfterImmediateEvent = false;
                this._refundImmediateIfBattlefieldMoveCancelled();
                this._returningFromImmediate = true;
                this._phase = 'input';
            }
            return;
        }
        _orig_BM_updateTurn.call(this);
    };

    // -----------------------------------------------------------------------
    // Scene_Battle – command wiring and action flow.
    // -----------------------------------------------------------------------

    Scene_Battle.prototype.createActorCommandWindow = function () {
        this._actorCommandWindow = new Window_ActorCommand();
        this._actorCommandWindow.setHandler('action',     this.commandAction.bind(this));
        this._actorCommandWindow.setHandler('manoeuvre',  this.commandManoeuvre.bind(this));
        this._actorCommandWindow.setHandler('incidental', this.commandIncidental.bind(this));
        this._actorCommandWindow.setHandler('endTurn',    this.commandEndTurn.bind(this));
        this._actorCommandWindow.setHandler('cancel',     this.onActorCommandCancel.bind(this));
        this.addWindow(this._actorCommandWindow);
    };

    // Initialise per-actor turn state at the start of the input phase.
    // When returning from an immediate execution we preserve the flags so the
    // menu reflects what has already been done this turn.
    Scene_Battle.prototype.startActorCommandSelection = function () {
        var actor = BattleManager.actor();
        if (!BattleManager._returningFromImmediate) {
            if (actor) {
                actor._actionChosen    = false;
                actor._manoeuvreCount  = 0;
                actor._actionInputIndex = 0;
                actor._actions[ACTION_SLOT].clear();
                actor._actions[MANOEUVRE_SLOT].clear();
                actor._actions[MANOEUVRE2_SLOT].clear();
            }
        }
        BattleManager._returningFromImmediate = false;
        this._currentInputSlot = ACTION_SLOT;
        this._statusWindow.select(actor ? actor.index() : 0);
        this._partyCommandWindow.close();
        this._actorCommandWindow.setup(actor);
    };

    // Cancel at the actor command window: only allow navigating back if no
    // actions have been committed this turn. Once any choice is locked in,
    // ignore the cancel so players can't reset their spent actions.
    Scene_Battle.prototype.onActorCommandCancel = function () {
        var actor = BattleManager.actor();
        var committed = actor && (actor._actionChosen || (actor._manoeuvreCount || 0) > 0);
        if (committed) {
            // Choices are already spent – stay on the command window.
            this._actorCommandWindow.activate();
        } else {
            this.selectPreviousCommand();
        }
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

    // Incidental – unlimited; uses a temporary 4th slot that is trimmed away after execution.
    Scene_Battle.prototype.commandIncidental = function () {
        var actor = BattleManager.actor();
        // Ensure the temporary incidental slot exists.
        while (actor._actions.length <= INCIDENTAL_SLOT) {
            actor._actions.push(new Game_Action(actor));
        }
        this._currentInputSlot  = INCIDENTAL_SLOT;
        actor._actionInputIndex = INCIDENTAL_SLOT;
        this._skillWindow.setActor(actor);
        this._skillWindow.setStypeId(INCIDENTAL_STYPE);
        this._skillWindow.refresh();
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // End Turn – all actions have already executed immediately, so just clear the
    // slots to prevent them re-running during the enemy phase, then advance.
    Scene_Battle.prototype.commandEndTurn = function () {
        var actor = BattleManager.actor();
        for (var i = 0; i < TOTAL_SLOTS; i++) {
            actor._actions[i].clear();
        }
        actor._actionInputIndex = actor.numActions() - 1; // satisfies BattleManager.selectNextCommand
        this.selectNextCommand();
    };

    // Record the choice flags and deduct strain (if this is the costly 3rd activity),
    // then hand off to BattleManager for immediate execution.
    Scene_Battle.prototype._executeImmediateAction = function () {
        var actor     = BattleManager.actor();
        var slotIndex = this._currentInputSlot;
        var aC = !!actor._actionChosen;
        var mC = actor._manoeuvreCount || 0;

        // Incidentals are unlimited and never cost strain; skip tracking for them.
        var isIncidental = (slotIndex === INCIDENTAL_SLOT);
        var paidStrain = false;
        if (!isIncidental) {
            // Third activity (Action after 2 Manoeuvres, or 2nd Manoeuvre after Action) costs strain.
            var isThird = (!aC && mC >= 2 && slotIndex === ACTION_SLOT) ||
                          (aC  && mC >= 1 && slotIndex !== ACTION_SLOT);
            if (isThird) {
                actor.gainMp(-STRAIN_MP_COST);
                paidStrain = true;
            }

            if (slotIndex === ACTION_SLOT) {
                actor._actionChosen = true;
            } else {
                actor._manoeuvreCount = mC + 1;
            }
        }

        BattleManager._captureImmediateMeta({
            isIncidental: isIncidental,
            prevActionChosen: aC,
            prevManoeuvreCount: mC,
            paidStrain: paidStrain
        });
        BattleManager.startImmediateAction(actor, slotIndex);
    };

    // Skill confirmed – execute immediately if no target needed; otherwise open
    // the appropriate target-selection window.
    Scene_Battle.prototype.onSkillOk = function () {
        var skill  = this._skillWindow.item();
        var actor  = BattleManager.actor();
        var action = actor._actions[this._currentInputSlot];
        action.setSkill(skill.id);
        actor.setLastBattleSkill(skill);

        this._skillWindow.hide();

        if (!action.needsSelection()) {
            this._executeImmediateAction();
        } else if (action.isForOpponent()) {
            this.selectEnemySelection();
        } else {
            this.selectActorSelection();
        }
    };

    // Skill cancelled – return to the command window.
    // If we were in incidental mode, remove the temporary slot.
    Scene_Battle.prototype.onSkillCancel = function () {
        if (this._currentInputSlot === INCIDENTAL_SLOT) {
            var actor = BattleManager.actor();
            while (actor._actions.length > TOTAL_SLOTS) actor._actions.pop();
        }
        this._skillWindow.hide();
        this._actorCommandWindow.activate();
    };

    // Enemy target confirmed – execute the action immediately.
    Scene_Battle.prototype.onEnemyOk = function () {
        var action = BattleManager.inputtingAction();
        action.setTarget(this._enemyWindow.enemyIndex());
        this._enemyWindow.hide();
        this._skillWindow.hide();
        this._itemWindow.hide();
        this._executeImmediateAction();
    };

    // Enemy target cancelled – re-open the appropriate skill list.
    Scene_Battle.prototype.onEnemyCancel = function () {
        this._enemyWindow.hide();
        var stypeId = this._currentInputSlot === ACTION_SLOT     ? ACTION_STYPE     :
                      this._currentInputSlot === INCIDENTAL_SLOT ? INCIDENTAL_STYPE :
                      MANOEUVRE_STYPE;
        this._skillWindow.setStypeId(stypeId);
        this._skillWindow.show();
        this._skillWindow.activate();
    };

    // Ally target confirmed – execute the action immediately.
    Scene_Battle.prototype.onActorOk = function () {
        var action = BattleManager.inputtingAction();
        action.setTarget(this._actorWindow.index());
        this._actorWindow.hide();
        this._skillWindow.hide();
        this._itemWindow.hide();
        this._executeImmediateAction();
    };

    // Ally target cancelled – re-open the appropriate skill list.
    Scene_Battle.prototype.onActorCancel = function () {
        this._actorWindow.hide();
        var stypeId = this._currentInputSlot === ACTION_SLOT     ? ACTION_STYPE     :
                      this._currentInputSlot === INCIDENTAL_SLOT ? INCIDENTAL_STYPE :
                      MANOEUVRE_STYPE;
        this._skillWindow.setStypeId(stypeId);
        this._skillWindow.show();
        this._skillWindow.activate();
    };

})();
