/*:
 * @target MV
 * @plugindesc Dynamic HP / MP / TP bars in the battle status window.
 *
 * Columns are distributed evenly across the available gauge area.  If TP
 * display is disabled (System > Options) the space is split between HP and MP
 * only.  Every bar always shows "current / max".  The abbreviation label
 * (HP / MP / TP) is drawn at the standard font size and is never scaled down.
 */

(function () {
    'use strict';

    // -----------------------------------------------------------------------
    // Layout constants
    // -----------------------------------------------------------------------
    var GAP        = 8;   // pixels between adjacent bars
    var LABEL_W    = 32;  // horizontal space reserved for the abbreviation

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    // Draw a stat label (e.g. "HP") at a fixed font size so it never shrinks.
    Window_Base.prototype._drawStatLabel = function (label, x, y) {
        var savedSize = this.contents.fontSize;
        this.contents.fontSize = this.standardFontSize();
        this.changeTextColor(this.systemColor());
        this.drawText(label, x, y, LABEL_W);
        this.contents.fontSize = savedSize;
    };

    // -----------------------------------------------------------------------
    // Override drawActorTp to show current / max (the default only shows
    // current).
    // -----------------------------------------------------------------------
    Window_Base.prototype.drawActorTp = function (actor, x, y, width) {
        width = width || 96;
        var color1 = this.tpGaugeColor1();
        var color2 = this.tpGaugeColor2();
        this.drawGauge(x, y, width, actor.tpRate(), color1, color2);
        this._drawStatLabel(TextManager.tpA, x, y);
        this.drawCurrentAndMax(actor.tp, actor.maxTp(), x, y, width,
                               this.tpColor(actor), this.normalColor());
    };

    // Also replace HP and MP label drawing so the abbreviation never scales.
    Window_Base.prototype.drawActorHp = function (actor, x, y, width) {
        width = width || 186;
        var color1 = this.hpGaugeColor1();
        var color2 = this.hpGaugeColor2();
        this.drawGauge(x, y, width, actor.hpRate(), color1, color2);
        this._drawStatLabel(TextManager.hpA, x, y);
        this.drawCurrentAndMax(actor.hp, actor.mhp, x, y, width,
                               this.hpColor(actor), this.normalColor());
    };

    Window_Base.prototype.drawActorMp = function (actor, x, y, width) {
        width = width || 186;
        var color1 = this.mpGaugeColor1();
        var color2 = this.mpGaugeColor2();
        this.drawGauge(x, y, width, actor.mpRate(), color1, color2);
        this._drawStatLabel(TextManager.mpA, x, y);
        this.drawCurrentAndMax(actor.mp, actor.mmp, x, y, width,
                               this.mpColor(actor), this.normalColor());
    };

    // -----------------------------------------------------------------------
    // Window_BattleStatus – dynamic column widths
    // -----------------------------------------------------------------------

    Window_BattleStatus.prototype.drawGaugeArea = function (rect, actor) {
        if ($dataSystem.optDisplayTp) {
            this._drawGaugeAreaThree(rect, actor);
        } else {
            this._drawGaugeAreaTwo(rect, actor);
        }
    };

    // Three equal bars: HP | MP | TP
    Window_BattleStatus.prototype._drawGaugeAreaThree = function (rect, actor) {
        var total   = rect.width;
        var barW    = Math.floor((total - GAP * 2) / 3);
        var hpX     = rect.x;
        var mpX     = hpX + barW + GAP;
        var tpX     = mpX + barW + GAP;
        this.drawActorHp(actor, hpX, rect.y, barW);
        this.drawActorMp(actor, mpX, rect.y, barW);
        this.drawActorTp(actor, tpX, rect.y, barW);
    };

    // Two equal bars: HP | MP
    Window_BattleStatus.prototype._drawGaugeAreaTwo = function (rect, actor) {
        var total   = rect.width;
        var barW    = Math.floor((total - GAP) / 2);
        var hpX     = rect.x;
        var mpX     = hpX + barW + GAP;
        this.drawActorHp(actor, hpX, rect.y, barW);
        this.drawActorMp(actor, mpX, rect.y, barW);
    };

})();
