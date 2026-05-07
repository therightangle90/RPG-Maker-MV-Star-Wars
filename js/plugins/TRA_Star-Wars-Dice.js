// let r = DiceSystem.d10();
// let r = DiceSystem.d100();
// let percent = DiceSystem.d100();
// let pool = DiceSystem.rollPool({ boost: 2, ability: 1 });
// $gameVariables.setValue(1, pool.total.success);
// $gameVariables.setValue(2, pool.total.advantage);

var DiceSystem = (function () {

    const dice = {
        boost: [
            {}, 
            {},
            { advantage: 1 },
            { advantage: 2 },
            { success: 1 },
            { success: 1, advantage: 1 }
        ],
        ability: [
            {},
            { advantage: 1 },
            { advantage: 1 },
            { advantage: 2 },
            { success: 1 },
            { success: 1 },
            { success: 1, advantage: 1 },
            { success: 2 }
        ],
        proficiency: [
            {},
            { advantage: 1 },
            { advantage: 2 },
            { advantage: 2 },
            { success: 1 },
            { success: 1 },
            { success: 1, advantage: 1 },
            { success: 1, advantage: 1 },
            { success: 1, advantage: 1 },
            { success: 2 }, 
            { success: 2 },
            { triumph: 1 }
        ],
        setback: [
            {},
            {}, 
            { disadvantage: 1 },
            { disadvantage: 1 },
            { failure: 1 },
            { failure: 1 }
        ],
        difficulty: [
            {},
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 2 },
            { failure: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 2 }
        ],
        challenge: [
            {}, 
            { disadvantage: 1 },
            { disadvantage: 1 },
            { disadvantage: 2 },
            { disadvantage: 2 },
            { failure: 1 }, 
            { failure: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 1, disadvantage: 1 },
            { failure: 2 },
            { failure: 2 },
            { dispair: 1 }
        ],
        force: [
            { light: 1 },
            { light: 1 },
            { light: 2 },
            { light: 2 },
            { light: 2 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 1 },
            { dark: 2 }
        ]
    };

    function rollOne(type) {
        const die = dice[type];
        if (!die) return {};
        const face = die[Math.floor(Math.random() * die.length)];
        return Object.assign({}, face);
    }

    function roll(type, count) {
        let results = [];
        for (let i = 0; i < count; i++) {
            results.push(rollOne(type));
        }
        return results;
    }

    function tally(results) {
        let total = {};

        results.forEach(r => {
            Object.keys(r).forEach(k => {
                total[k] = (total[k] || 0) + r[k];
            });
        });

        // --- cancellations ---
        let success = total.success || 0;
        let failure = total.failure || 0;
        let advantage = total.advantage || 0;
        let disadvantage = total.disadvantage || 0;

        let netSuccess = success - failure;
        let netAdvantage = advantage - disadvantage;

        total.success = Math.max(0, netSuccess);
        total.failure = Math.max(0, -netSuccess);

        total.advantage = Math.max(0, netAdvantage);
        total.disadvantage = Math.max(0, -netAdvantage);

        return total;
    }

    function rollPool(pool) {
        let allResults = [];
        Object.keys(pool).forEach(type => {
            for (let i = 0; i < pool[type]; i++) {
                allResults.push(rollOne(type));
            }
        });
        return {
            rolls: allResults,
            total: tally(allResults)
        };
    }

    function rollDie(sides) {
        return Math.floor(Math.random() * sides) + 1;
    }

    function rollDice(num, sides) {
        let results = [];
        for (let i = 0; i < num; i++) {
            results.push(rollDie(sides));
        }
        return results;
    }

    function rollTotal(num, sides) {
        return rollDice(num, sides).reduce((a, b) => a + b, 0);
    }

    function d10() {
        return rollDie(10);
    }

    function d100() {
        let tens = Math.floor(Math.random() * 10); // 0–9
        let ones = Math.floor(Math.random() * 10); // 0–9
        let value = tens * 10 + ones;
        return value === 0 ? 100 : value;
    }

    return {
        rollOne,
        roll,
        tally,
        rollPool,
        rollDie,
        rollDice,
        rollTotal,
        d10,
        d100
    };

})();