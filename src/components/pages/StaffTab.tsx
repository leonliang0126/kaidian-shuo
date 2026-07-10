// 员工页（Tab2 内容页 · T05）：StatusBar(mini) + StaffPage（内容页）。
import { StatusBar } from '../StatusBar';
import { StaffPage } from '../StaffPage';

export function StaffTab() {
  return (
    <div>
      <StatusBar variant="mini" />
      <StaffPage />
    </div>
  );
}
