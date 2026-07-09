// 每日结算弹窗：展示今日净利、现金与成本拆解。关闭后由 store 推进阶段。
import { useGameStore } from '../../store/gameStore';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { fmtMoney, fmtSignedMoney } from '../../utils/format';

export function SettlementModal() {
  const r = useGameStore((s) => s.settlementModal);
  const close = useGameStore((s) => s.closeSettlement);
  if (!r) return null;

  return (
    <Modal open title={`第 ${r.day} 天 · 结算`} dismissable={false}>
      <div className="text-center mb-3">
        <div className="text-xs text-sub">今日净利</div>
        <div className={`text-3xl font-bold ${r.netProfit >= 0 ? 'text-profit' : 'text-risk'}`}>
          {fmtSignedMoney(r.netProfit)}
        </div>
        <div className="text-sm text-sub mt-1">现金 {fmtMoney(r.cashAfter)}</div>
      </div>
      <div className="rounded-card bg-black/[0.03] px-4 py-3 text-sm space-y-1">
        <Row k="流水" v={fmtMoney(r.revenue)} />
        <Row k="毛利" v={fmtMoney(r.grossProfit)} />
        <Row k="推广成本" v={'-' + fmtMoney(r.promoCost)} />
        <Row k="人工成本" v={'-' + fmtMoney(r.staffCost)} />
        <Row k="房租日摊" v={'-' + fmtMoney(r.fixedCostDaily)} />
        <Row k="平台抽成" v={'-' + fmtMoney(r.platformCost)} />
        {r.capacityOverload && (
          <div className="text-xs text-risk pt-1">⚠ 订单超过承载，顾客信任下降。</div>
        )}
      </div>
      <Button fullWidth size="lg" className="mt-4" onClick={close}>
        继续
      </Button>
    </Modal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sub">{k}</span>
      <span className="text-ink font-medium">{v}</span>
    </div>
  );
}
