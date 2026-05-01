/*:
 * @target MV
 * @plugindesc Single-click / single-tap selection: the first touch on a menu
 *             item both highlights and confirms it immediately.
 *             The highlight also follows the mouse cursor as it hovers.
 */

(function () {
    'use strict';

    // RPG Maker MV's vanilla processTouch only updates the cursor when the
    // mouse button is held (TouchInput.isPressed()), so plain hover never moves
    // the highlight.  We replace processTouch to:
    //   • Update the highlight every frame by checking the current cursor position.
    //   • Confirm on the very first click/tap (single-click select).
    //   • Still handle cancel and edge-scroll when dragging near list edges.

    Window_Selectable.prototype.processTouch = function () {
        if (this.isOpenAndActive()) {
            var x = this.canvasToLocalX(TouchInput.x);
            var y = this.canvasToLocalY(TouchInput.y);
            var hitIndex = this.hitTest(x, y);

            if (hitIndex >= 0) {
                // Hover: keep the highlight aligned with the mouse every frame.
                if (hitIndex !== this.index()) {
                    this.select(hitIndex);
                    SoundManager.playCursor();
                }
                // Single-click: confirm immediately on the first press.
                if (TouchInput.isTriggered() && this.isTouchOkEnabled()) {
                    this.processOk();
                }
            } else {
                // Edge-scroll when the cursor lingers near the top or bottom.
                if (this._stayCount >= 10) {
                    if (y < this.padding) {
                        this.cursorUp(true);
                    } else if (y >= this.height - this.padding) {
                        this.cursorDown(true);
                    }
                }
            }

            if (TouchInput.isCancelled() && this.isCancelEnabled()) {
                this.processCancel();
            }
        }
    };

})();
