import { UIManager } from '../src/managers/UIManager.js';
import { MockScene } from './mocks.js';

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export function testUIManager() {
    console.log("Running UIManager tests...");
    const scene = new MockScene();
    const ui = new UIManager(scene);

    // Test initial state
    assert(ui.score === 0, "Initial score should be 0");
    assert(ui.fuel === 100, "Initial fuel should be 100");
    assert(ui.scoreText.text === 'SCORE: 0', "Initial score text should be SCORE: 0");
    assert(ui.fuelText.text === 'FUEL: 100%', "Initial fuel text should be FUEL: 100%");

    // Test updateScore
    ui.updateScore(10);
    assert(ui.score === 10, "Score should be 10");
    assert(ui.scoreText.text === 'SCORE: 10', "Score text should be updated to 10");

    ui.updateScore(-5);
    assert(ui.score === 5, "Score should be 5");
    assert(ui.scoreText.text === 'SCORE: 5', "Score text should be updated to 5");

    // Test updateFuel
    ui.updateFuel(-20);
    assert(ui.fuel === 80, "Fuel should be 80");
    assert(ui.fuelText.text === 'FUEL: 80%', "Fuel text should be 80%");
    assert(ui.fuelText.color === '#00FF00', "Fuel color should be green");

    ui.updateFuel(-70);
    assert(ui.fuel === 10, "Fuel should be 10");
    assert(ui.fuelText.text === 'FUEL: 10%', "Fuel text should be 10%");
    assert(ui.fuelText.color === '#FF0000', "Fuel color should be red for low fuel");

    ui.updateFuel(100);
    assert(ui.fuel === 100, "Fuel should be capped at 100");
    assert(ui.fuelText.text === 'FUEL: 100%', "Fuel text should be 100%");
    assert(ui.fuelText.color === '#00FF00', "Fuel color should be green again");

    ui.updateFuel(-150);
    assert(ui.fuel === 0, "Fuel should be floored at 0");
    assert(ui.fuelText.text === 'FUEL: 0%', "Fuel text should be 0%");
    assert(ui.fuelText.color === '#FF0000', "Fuel color should be red");

    console.log("All UIManager tests passed!");
}
