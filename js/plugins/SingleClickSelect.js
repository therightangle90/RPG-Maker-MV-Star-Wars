/*:
 * @target MV
 * @plugindesc Single-click / single-tap selection: the first touch on a menu
 *             item both highlights and confirms it immediately.
 */

(function () {
    'use strict';

    // RPG Maker MV's Window_Selectable.onTouch normally requires two actions:
    //   1st touch – move cursor to the item under the finger/mouse
    //   2nd touch – confirm (call 'ok' handler)
    //
    // We replace it so that any touch whose hit-test finds a valid index
    // immediately calls processOk(), bypassing the two-step logic.

    Window_Selectable.prototype.onTouch = function (triggered) {
        var lastIndex = this.index();
        var x = this.canvasToLocalX(TouchInput.x);
        var y = this.canvasToLocalY(TouchInput.y);
        var hitIndex = this.hitTest(x, y);
        if (hitIndex >= 0) {
            if (hitIndex !== this.index()) {
                this.select(hitIndex);
            }
            if (triggered && this.isTouchOkEnabled()) {
                this.processOk();
            }
        } else if (this._stayCount >= 10) {
            if (y < this.padding) {
                this.cursorUp(true);
            } else if (y >= this.height - this.padding) {
                this.cursorDown(true);
            }
        }
    };

})();
