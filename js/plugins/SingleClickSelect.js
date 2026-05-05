/*:
 * @target MV
 * @plugindesc Single-click / single-tap selection: the first touch on a menu
 *             item confirms it immediately. The cursor highlight follows the
 *             mouse/cursor as it hovers over options.
 */

(function () {
    'use strict';

    // RPG Maker MV's TouchInput only updates its stored x/y coordinates while
    // a mouse button is pressed (TouchInput.isPressed()).  Pure mouse movement
    // without a button held is therefore invisible to TouchInput.x/y, which is
    // why overriding processTouch alone never produced hover behaviour.
    //
    // Fix: maintain our own canvas-space coordinates that are updated on every
    // mousemove event, regardless of button state.
    var _hoverCanvasX = 0;
    var _hoverCanvasY = 0;

    document.addEventListener('mousemove', function (e) {
        _hoverCanvasX = Graphics.pageToCanvasX(e.pageX);
        _hoverCanvasY = Graphics.pageToCanvasY(e.pageY);
    });

    // Every frame, check whether the cursor is over a different cell and move
    // the selection highlight there.  The coordinate guard prevents needless
    // redraws when the mouse is stationary; keyboard/gamepad nav is unaffected.
    var _processTouch = Window_Selectable.prototype.processTouch;
    Window_Selectable.prototype.processTouch = function () {
        _processTouch.call(this);
        if (this.isOpenAndActive()) {
            var x = this.canvasToLocalX(_hoverCanvasX);
            var y = this.canvasToLocalY(_hoverCanvasY);
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

