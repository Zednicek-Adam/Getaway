import { RunProgression } from "./progression.js";

export const progression = new RunProgression();

export function beginGetawayRun() {
  return progression.startRun();
}

export function onMoneyDeposited(amount) {
  progression.recordDeposit(amount);
}

export function onWantedLevelChanged(stars) {
  progression.setWantedLevel(stars);
}

export function onPoliceVehicleDestroyed(count = 1) {
  progression.recordPoliceDestroyed(count);
}

export function onDiamondCollected(count = 1) {
  progression.recordDiamondsStolen(count);
}

export function onRunEnded(reason) {
  return progression.finishRun(reason);
}
