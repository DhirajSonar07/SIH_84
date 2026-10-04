import LocalReplayProvider from '../providers/LocalReplayProvider';
import { defaultParameters, scenarios } from '../data/scenarios';
export function evaluateScenarios() {
  const provider = new LocalReplayProvider();
  return scenarios.map(scenario => {
    let truePositive = 0, falsePositive = 0, falseNegative = 0, trueNegative = 0;
    const samples = [];
    for (let minute = 0; minute <= 240; minute += 10) {
      const snapshot = provider.getSnapshot({ scenarioId: scenario.id, minute, lead:0, parameters:{ ...defaultParameters,...scenario.parameters } });
      const detection = snapshot.fusion.signal > 32 && snapshot.fusion.confidence >= 55;
      if (snapshot.truth && detection) truePositive++;
      else if (snapshot.truth) falseNegative++;
      else if (detection) falsePositive++;
      else trueNegative++;
      samples.push(snapshot.performance.computationMs);
    }
    return { id:scenario.id, name:scenario.name, truePositive, falsePositive, falseNegative, trueNegative, samples:samples.length, averageMs:samples.reduce((sum,value) => sum+value,0)/samples.length, pod:truePositive+falseNegative ? truePositive/(truePositive+falseNegative)*100 : null, far:truePositive+falsePositive ? falsePositive/(truePositive+falsePositive)*100 : null, csi:truePositive+falsePositive+falseNegative ? truePositive/(truePositive+falsePositive+falseNegative)*100 : null };
  });
}
