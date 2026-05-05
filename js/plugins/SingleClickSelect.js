/*:
 * @target MV
 * @plugindesc Single-click / single-tap selection: the first touch on a menu
 *             item confirms it immediately. No cursor highlight is shown.
 */

(function () {
    'use strict';

    // Confirm the item under the cursor on the very first click/tap.
    Window_Selectable.prototype.onTouch = function (triggered) {
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

    // Hide the selection highlight entirely by always drawing a zero-size rect.
    Window_Selectable.prototype.updateCursor = function () {
        this.setCursorRect(0, 0, 0, 0);
    };

})();
