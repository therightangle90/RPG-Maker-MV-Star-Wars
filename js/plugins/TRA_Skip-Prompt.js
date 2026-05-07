(function () {
    'use strict';

    Scene_Battle.prototype.startPartyCommandSelection = function () {
        this._partyCommandWindow.close();
        this.selectNextCommand();
    };

})();