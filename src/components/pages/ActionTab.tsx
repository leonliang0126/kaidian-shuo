// 行动页（Tab3 内容页 · T06）：StatusBar(mini) + ActionPointPanel。
import { StatusBar } from '../StatusBar';
import { ActionPointPanel } from '../ActionPointPanel';

export function ActionTab() {
  return (
    <div>
      <StatusBar variant="mini" />
      <div className="space-y-3 px-4">
        <ActionPointPanel />
      </div>
    </div>
  );
}
