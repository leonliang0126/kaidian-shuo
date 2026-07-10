// 经营页（Tab4 内容页 · T07）：StatusBar(mini) + DecisionPanel + BusinessLog。
// 决策②：Tab4 = 供应商/售价/推广（DecisionPanel 现有 3 项）+ 经营日志；不含装修/人工 UI。
import { StatusBar } from '../StatusBar';
import { DecisionPanel } from '../DecisionPanel';
import { BusinessLog } from '../BusinessLog';

export function BusinessTab() {
  return (
    <div>
      <StatusBar variant="mini" />
      <div className="space-y-3 px-4">
        <DecisionPanel />
        <BusinessLog />
      </div>
    </div>
  );
}
