/*:
 * @target MV
 * @plugindesc Single-click / single-tap selection: the first touch on a menu
 *             item confirms it immediately. The cursor highlight follows the
 *             mouse/cursor as it hovers over options.
 */

(function () {
    'use strict';

    // Update the highlight whenever the pointer moves to a different cell,
    // even without clicking.  Tracking the last checked coordinate means
    // keyboard / gamepad navigation still works normally when the mouse is
    // stationary – the hover check only fires when the pointer actually moves.
    var _processTouch = Window_Selectable.prototype.processTouch;
    Window_Selectable.prototype.processTouch = function () {
        _processTouch.call(this);
        if (this.isOpenAndActive()) {
            var x = this.canvasToLocalX(TouchInput.x);
            var y = this.canvasToLocalY(TouchInput.y);
            if (x !== this._lastHoverX || y !== this._lastHoverY) {
                this._lastHoverX = x;
                this._lastHoverY = y;
                var hitIndex = this.hitTest(x, y);
                if (hitIndex >= 0 && hitIndex !== this.index()) {
                    this.select(hitIndex);
                }
            }
        }
    };

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

})();

