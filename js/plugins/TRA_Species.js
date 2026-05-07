/*:
 * @target MV
 * @plugindesc Loads species data and applies species-derived attributes to actors.
 *
 * @help
 * ============================================================================
 * Introduction
 * ============================================================================
 *
 * Reads actor species tags from notes and applies matching stat data loaded
 * from a species data file at database load time.
 *
 * ============================================================================
 * Actor Note Tag
 * ============================================================================
 *
 *   <species:human>
 *   <species:zabrak>
 *
 * Species keys are matched case-insensitively.
 */

var SpeciesData = {};

(function () {

    const _loadDatabase = DataManager.loadDatabase;
    DataManager.loadDatabase = function() {
        _loadDatabase.call(this);
        this.loadDataFile("speciesData", "species.json");
    };

    function getSpecies(actor) {
        let m = /<species:(\w+)>/i.exec(actor.actor().note);
        return m ? m[1].toLowerCase() : null;
    }

    function applySpecies(obj) {
        let key = getSpecies(obj);
        let data = window.speciesData?.[key];
        if (!data) return;

        if (data.attrs) {
            Object.keys(data.attrs).forEach(k => {
                obj.setAttr(k, data.attrs[k]);
            });
        }

        if (data.strain !== undefined) {
            obj._maxStrain = data.strain;
        }

        if (data.wound !== undefined) {
            obj.mhp = data.wound; // optional, or store separately
        }
    }

    const _setup = Game_Actor.prototype.setup;
    Game_Actor.prototype.setup = function(actorId) {
        _setup.call(this, actorId);
        applySpecies(this);
    };

})();
