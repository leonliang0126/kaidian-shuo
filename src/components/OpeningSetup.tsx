// 开局设置（phase==='opening'）：店名 / 店型 / 位置 / 装修。
// 起手资金改为开局页随机（5000–20万，可刷新最多 3 次）：开业成本超出部分一次性自动借款，绝不在天里弹窗。
import { useState } from 'react';
import { useGameStore } from '../store/gameStore';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { getDecorationCost, getOption } from '../data/decisionOptions';
import type { StoreType, LocationType, DecorationLevel } from '../types';
import { STORE_PROFILES } from '../data/storeProfiles';
import { LOCATION_PROFILES } from '../data/locationProfiles';
import { DEPOSIT_MULTIPLIER } from '../utils/constants';
import {
  randomInitialCash,
  OPENING_INVENTORY_COST,
  LOCATION_TRANSFER_FEE,
  MONTHLY_INTEREST_DIVISOR,
} from '../data/setupCosts';
import { computeSetupLoan } from '../core/loanSystem';
import { fmtMoney } from '../utils/format';
import clsx from 'clsx';
import type { LoanChannel } from '../types/actions';

const STORE_TYPES = Object.keys(STORE_PROFILES) as StoreType[];
const LOCATIONS = Object.keys(LOCATION_PROFILES) as LocationType[];
const DECORATIONS: DecorationLevel[] = ['bare', 'clean', 'memorable', 'viral', 'designer'];

const CHANNEL_LABEL: Record<LoanChannel, string> = {
  bank: '银行借款 4%',
  private: '民间借款 12%',
  predatory: '高利贷 36%',
};

export function OpeningSetup() {
  const startGame = useGameStore((s) => s.startGame);
  const reopenTutorial = useGameStore((s) => s.reopenTutorial);
  const [name, setName] = useState('我的小店');
  const [storeType, setStoreType] = useState<StoreType>('奶茶饮品');
  const [location, setLocation] = useState<LocationType>('学校门口');
  const [decoration, setDecoration] = useState<DecorationLevel>('clean');
  const [initialCash, setInitialCash] = useState(() => randomInitialCash());
  const [reroll, setReroll] = useState(0);
  const MAX_REROLL = 3;

  // —— 与 createNewGame 完全一致的 setup 成本公式 ——
  const rent = LOCATION_PROFILES[location].baseMonthlyRent;
  const deposit = Math.round(rent * DEPOSIT_MULTIPLIER);
  const decoCost = getDecorationCost(decoration);
  const transfer = LOCATION_TRANSFER_FEE[location];
  const setupCost = decoCost + deposit + OPENING_INVENTORY_COST + transfer;
  const over = Math.max(0, setupCost - initialCash);
  const loan = over > 0 ? computeSetupLoan(over) : null;
  const availableCash = initialCash - setupCost + over; // over>0 时恒为 0
  const loanInterest = loan ? Math.round((loan.balance * loan.apr) / MONTHLY_INTEREST_DIVISOR) : 0;

  return (
    <div className="h-[100dvh] overflow-y-auto px-4 py-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-ink">开店说</h1>
        <p className="text-sm text-sub mt-1">先给你的店定个基础盘，起手资金可刷新（最多 3 次）。</p>
      </div>

      <Card className="px-4 py-3">
        <label className="text-sm font-semibold text-ink">店名</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={12}
          className="mt-2 w-full rounded-xl border border-black/10 px-3 py-2 text-sm outline-none focus:border-primary"
          placeholder="给店起个名字"
        />
      </Card>

      <Card className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-ink">开局资金</div>
            <div className="text-2xl font-bold text-ink mt-0.5">{fmtMoney(initialCash)}</div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={reroll >= MAX_REROLL}
            onClick={() => {
              setInitialCash(randomInitialCash());
              setReroll((c) => c + 1);
            }}
          >
            {reroll >= MAX_REROLL ? '已刷新满 3 次' : `刷新随机（剩 ${MAX_REROLL - reroll} 次）`}
          </Button>
        </div>
      </Card>

      <Selector
        label="店型"
        options={STORE_TYPES.map((t) => ({ id: t, label: t }))}
        current={storeType}
        onPick={(id) => setStoreType(id as StoreType)}
        hint={`客单价约 ¥${STORE_PROFILES[storeType].avgOrderValue} · 毛利率 ${Math.round(
          STORE_PROFILES[storeType].grossMargin * 100,
        )}%`}
      />

      <Selector
        label="位置"
        options={LOCATIONS.map((t) => ({ id: t, label: t }))}
        current={location}
        onPick={(id) => setLocation(id as LocationType)}
        hint={`月租约 ${fmtMoney(LOCATION_PROFILES[location].baseMonthlyRent)} · 人流 ${
          LOCATION_PROFILES[location].trafficCoef
        }x`}
      />

      <Selector
        label="装修"
        options={DECORATIONS.map((d) => ({ id: d, label: getOption('decorationLevel', d)?.label ?? d }))}
        current={decoration}
        onPick={(id) => setDecoration(id as DecorationLevel)}
        hint={`一次性装修成本 ${fmtMoney(decoCost)}`}
      />

      {/* 开业成本拆解 + 借款预览 */}
      <Card className="px-4 py-3 space-y-1.5">
        <div className="text-sm font-semibold text-ink mb-1">开业成本</div>
        <Row label="装修" value={fmtMoney(decoCost)} />
        <Row label={`押金（${DEPOSIT_MULTIPLIER} 个月租）`} value={fmtMoney(deposit)} />
        <Row label="首批备货" value={fmtMoney(OPENING_INVENTORY_COST)} />
        {transfer > 0 && <Row label="选址转让费" value={fmtMoney(transfer)} />}
        <div className="border-t border-black/5 my-1" />
        <Row label="合计" value={fmtMoney(setupCost)} bold />
        <Row label="起手资金" value={fmtMoney(initialCash)} />
        {loan ? (
          <>
            <div className="border-t border-black/5 my-1" />
            <div className="rounded-xl bg-risk/[0.06] px-3 py-2">
              <Row label="超出部分自动借款" value={fmtMoney(over)} tone="risk" />
              <div className="text-xs text-sub mt-0.5">
                渠道：{CHANNEL_LABEL[loan.channel]} · 月息约 {fmtMoney(loanInterest)}
              </div>
            </div>
            <Row label="开业后可用现金" value={fmtMoney(availableCash)} />
          </>
        ) : (
          <Row label="开业后可用现金" value={fmtMoney(availableCash)} tone="profit" />
        )}
      </Card>

      <Button
        fullWidth
        size="lg"
        onClick={() =>
          startGame({
            storeType,
            locationType: location,
            decorationLevel: decoration,
            storeName: name.trim() || '我的小店',
            seed: Math.floor(Math.random() * 1e9),
            initialCash,
          })
        }
      >
        开始开店
      </Button>
      <button className="w-full text-center text-sm text-sub py-2" onClick={reopenTutorial}>
        重新查看玩法说明
      </button>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'risk' | 'profit';
}) {
  const color = tone === 'risk' ? 'text-risk' : tone === 'profit' ? 'text-profit' : 'text-ink';
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-sub">{label}</span>
      <span className={clsx('font-semibold', bold ? 'text-base' : '', color)}>{value}</span>
    </div>
  );
}

function Selector({
  label,
  options,
  current,
  onPick,
  hint,
}: {
  label: string;
  options: { id: string; label: string }[];
  current: string;
  onPick: (id: string) => void;
  hint?: string;
}) {
  return (
    <Card className="px-4 py-3">
      <div className="text-sm font-semibold text-ink mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.id}
            onClick={() => onPick(o.id)}
            className={clsx(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              o.id === current
                ? 'bg-primary text-white border-primary'
                : 'bg-black/[0.03] text-ink border-transparent active:bg-black/10',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <div className="text-xs text-sub mt-2">{hint}</div>}
    </Card>
  );
}
