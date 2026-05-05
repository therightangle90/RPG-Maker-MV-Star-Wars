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
    var GAP           = 8;     // pixels between adjacent bars
    var LABEL_W_RATIO = 0.67;  // fraction of bar width reserved for the label (~2/3)
    var MIN_LABEL_W   = 40;    // minimum label width (pixels)

    // -----------------------------------------------------------------------
    // Core draw helper: gauge + label + "current/max" values.
    //
    // Replaces drawCurrentAndMax (which pre-allocates space for 4 digits and
    // produces large gaps for small numbers like "10/20").  Instead the full
    // "current/max" string is measured at runtime and drawn right-aligned,
    // leaving no wasted space.
    // -----------------------------------------------------------------------
    Window_Base.prototype._drawStatBar = function (
            label, current, max, rate,
            x, y, width,
            gaugeColor1, gaugeColor2, valueColor) {

        // Gauge drawn across the full bar width
        this.drawGauge(x, y, width, rate, gaugeColor1, gaugeColor2);

        var labelW = Math.max(MIN_LABEL_W, Math.floor(width * LABEL_W_RATIO));
        var valueX = x + labelW;
        var valueW = width - labelW;

        // Lock font size so the label abbreviation is never compressed
        var savedSize = this.contents.fontSize;
        this.contents.fontSize = this.standardFontSize();

        // Label (left side) – leave a couple of pixels of padding
        this.changeTextColor(this.systemColor());
        this.drawText(label, x + 2, y, labelW - 4);

        // "current/max" right-aligned in the remaining space.
        // Drawing as a single string means no pre-allocated digit slots and
        // therefore no gaps between the slash and the numbers.
        this.changeTextColor(valueColor);
        this.drawText(current + '/' + max, valueX, y, valueW, 'right');

        this.contents.fontSize = savedSize;
    };

    // -----------------------------------------------------------------------
    // Override the three drawActor* methods to use the new helper
    // -----------------------------------------------------------------------
    Window_Base.prototype.drawActorHp = function (actor, x, y, width) {
        width = width || 186;
        this._drawStatBar(
            TextManager.hpA, actor.hp, actor.mhp, actor.hpRate(),
            x, y, width,
            this.hpGaugeColor1(), this.hpGaugeColor2(),
            this.hpColor(actor)
        );
    };

    Window_Base.prototype.drawActorMp = function (actor, x, y, width) {
        width = width || 186;
        this._drawStatBar(
            TextManager.mpA, actor.mp, actor.mmp, actor.mpRate(),
            x, y, width,
            this.mpGaugeColor1(), this.mpGaugeColor2(),
            this.mpColor(actor)
        );
    };

    Window_Base.prototype.drawActorTp = function (actor, x, y, width) {
        width = width || 96;
        this._drawStatBar(
            TextManager.tpA, actor.tp, actor.maxTp(), actor.tpRate(),
            x, y, width,
            this.tpGaugeColor1(), this.tpGaugeColor2(),
            this.tpColor(actor)
        );
    };

    // -----------------------------------------------------------------------
    // Window_BattleStatus – dynamic equal-width columns
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
        var barW = Math.floor((rect.width - GAP * 2) / 3);
        this.drawActorHp(actor, rect.x,                   rect.y, barW);
        this.drawActorMp(actor, rect.x + (barW + GAP),    rect.y, barW);
        this.drawActorTp(actor, rect.x + (barW + GAP) * 2, rect.y, barW);
    };

    // Two equal bars: HP | MP
    Window_BattleStatus.prototype._drawGaugeAreaTwo = function (rect, actor) {
        var barW = Math.floor((rect.width - GAP) / 2);
        this.drawActorHp(actor, rect.x,            rect.y, barW);
        this.drawActorMp(actor, rect.x + barW + GAP, rect.y, barW);
    };

})();

