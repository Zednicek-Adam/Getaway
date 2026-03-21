import { testUIManager } from './UIManager.test.js';

try {
    testUIManager();
    console.log("\nAll test suites passed!");
} catch (error) {
    console.error("\nTests failed!");
    console.error(error);
    process.exit(1);
}
