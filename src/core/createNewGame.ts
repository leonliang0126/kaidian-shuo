// 开局：由 OpeningConfig 生成 GameState（统一 10 万 + setup 超额自动贷款）（架构 V3-3）
import type {
  GameState,
  LocationType,
  DecorationLevel,
  StoreType,
  StoreState,
  SupplierTier,
  PriceStrategy,
  PromotionTier,
} from '../types';
import type { RNG } from './rng';
import type { Loan } from '../types/actions';
import { applyEffects } from './effectResolver';
import { emptyModifiers } from './modifiers';
import { getStoreProfile } from '../data/storeProfiles';
import { getLocationProfile } from '../data/locationProfiles';
import { getDecorationCost, getDecisionEffects, getOption } from '../data/decisionOptions';
import { DEFAULT_DELIVERY_RATIO, DEFAULT_PLATFORM_RATE, DEPOSIT_MULTIPLIER } from '../utils/constants';
import {
  INITIAL_CASH,
  OPENING_INVENTORY_COST,
  LOCATION_TRANSFER_FEE,
} from '../data/setupCosts';
import { computeSetupLoan } from './loanSystem';
import { HEAT_INIT } from '../data/repurchaseHeat';
import { stabilityToBaseQuality, BATCH_CYCLE } from '../data/supplierStability';
import { MONTHLY_INTEREST_DIVISOR } from '../data/setupCosts';
import { computeNetWorth } from './branch';
import { generateCandidate, generateEmployee } from './staffSystem';

export interface OpeningConfig {
  /** 旧四档字段，已弃用（v3 统一 10 万）；保留以兼容历史调用。 */
  initialCashTier?: number;
  storeType: StoreType;
  locationType: LocationType;
  decorationLevel: DecorationLevel;
  storeName: string;
  tutorialSeen?: boolean;
  seed?: number;
}

// 开局默认决策（开局仅选 5 项，其余每日在决策面板调整）
const DEFAULT_SUPPLIER: SupplierTier = 'local';
const DEFAULT_PRICE: PriceStrategy = 'normal';
const DEFAULT_PROMOTION: PromotionTier = 'light';
const INITIAL_RATING = 80; // 4.0★
const INITIAL_CREDIT = 70;

/** 创建新游戏状态（统一 10 万起手 + setup 超额一次性自动贷款）。 */
export function createNewGame(cfg: OpeningConfig, rng: RNG): GameState {
  const loc = getLocationProfile(cfg.locationType);
  const sp = getStoreProfile(cfg.storeType);
  const rent = loc.baseMonthlyRent;
  const deposit = rent * DEPOSIT_MULTIPLIER;
  const decorationCost = getDecorationCost(cfg.decorationLevel);

  // setup 成本 = 装修 + 押金 + 备货 + 选址转让费
  const setupCost =
    decorationCost + deposit + OPENING_INVENTORY_COST + LOCATION_TRANSFER_FEE[cfg.locationType];
  // 超额 → 一次性自动贷款（仅 setup，绝不在天里弹窗）
  const over = Math.max(0, setupCost - INITIAL_CASH);
  const loans: Loan[] = over > 0 ? [computeSetupLoan(over)] : [];
  const cash = INITIAL_CASH - setupCost + over; // over>0 时等价于 0，over=0 时为 10万内自付后的余量
  const debt = loans.reduce((s, l) => s + l.balance, 0);
  const monthlyRepayment = Math.round(
    loans.reduce((s, l) => s + (l.balance * l.apr) / MONTHLY_INTEREST_DIVISOR, 0),
  );

  const supplierStability = getOption('supplierTier', DEFAULT_SUPPLIER)?.stability ?? 0.6;

  // 开局生成 1-2 名初始员工
  const initialEmployees = (() => {
    const count = 1 + Math.floor(rng() * 2); // 1-2 人
    const employees = [];
    for (let i = 0; i < count; i++) {
      const candidate = generateCandidate(rng, 1, cfg.decorationLevel);
      employees.push(generateEmployee(candidate, 1, false, rng));
    }
    return employees;
  })();

  const mainStore: StoreState = {
    id: 'store_001',
    name: cfg.storeName || '我的小店',
    storeType: cfg.storeType,
    locationType: cfg.locationType,
    rent,
    deposit,
    decorationLevel: cfg.decorationLevel,
    // 装修档效果固化为主店基准（§4）：不再每日参与决策
    decorationEntryBonus: getDecisionEffects('decorationLevel', cfg.decorationLevel).entryRatePct ?? 0,
    decorationAovBonus: getDecisionEffects('decorationLevel', cfg.decorationLevel).avgOrderValuePct ?? 0,
    supplierTier: DEFAULT_SUPPLIER,
    priceStrategy: DEFAULT_PRICE,
    promotionTier: DEFAULT_PROMOTION,
    rating: INITIAL_RATING,
    repurchaseRate: sp.repurchaseRate,
    deliveryRatio: DEFAULT_DELIVERY_RATIO,
    platformRate: DEFAULT_PLATFORM_RATE,
    isInCrisis: false,
    crisisDays: 0,
    cashflowStatus: '健康',
    monthlyRevenue: 0,
    monthlyGrossProfit: 0,
    monthlyNetProfit: 0,
    monthlyPromoCost: 0,
    monthlyDeliveryRevenue: 0,
    monthlyStaffCost: 0,
    lastMonthNetProfit: 0,
    monthlyNetProfitPositiveStreak: 0,
    repurchaseRateStartOfMonth: sp.repurchaseRate,
    ratingStartOfMonth: INITIAL_RATING,
    // —— v3 增量字段 ——
    heat: HEAT_INIT,
    currentBatchQuality: stabilityToBaseQuality(supplierStability),
    batchRenewDay: 1 + BATCH_CYCLE,
    supplierStability,
    employees: initialEmployees,
  };

  const decisions = {
    supplierTier: DEFAULT_SUPPLIER,
    priceStrategy: DEFAULT_PRICE,
    decorationLevel: cfg.decorationLevel,
    promotionTier: DEFAULT_PROMOTION,
  };

  const base: GameState = {
    __version: 1, // 存档版本标记（v3 = 1）
    day: 1,
    month: 1,
    cash,
    debt,
    monthlyRepayment,
    credit: INITIAL_CREDIT,
    netWorth: 0,
    storeCount: 1,
    brandRating: INITIAL_RATING,
    stores: [mainStore],
    hiddenLines: {
      landlordAttention: 0,
      employeePressure: 0,
      customerTrust: 50,
      priceControversy: 0,
      promoHype: 0,
      supplyRisk: 0,
      platformDependence: 0,
      hygieneRisk: 0,
    },
    softHidden: {
      ownerFatigue: 0,
      wasteRisk: 0,
      qualityVariance: 0,
      landlordPatience: 100,
      accountingErrorRisk: 0,
      stability: 100,
    },
    eventHistory: [],
    businessLog: [],
    windMessages: [],
    pendingEffects: [],
    tempModifiers: [],
    dayModifiers: emptyModifiers(),
    activeCooldowns: {},
    unlockedRoutes: [],
    endingsUnlocked: [],
    accountsPayable: 0,
    reserve: 0,
    lastLargeEventDay: -999,
    seed: cfg.seed,
    tutorialSeen: cfg.tutorialSeen ?? false,
    gameOver: false,
    decisions,
    // —— v3 增量字段 ——
    loans,
    actionPointsMax: 3,
    actionPointsCurrent: 3,
    selectedDailyFocus: null,
    selectedActionsToday: [],
    actionCooldowns: {},
    bossStrain: 0,
    cashNegativeStreak: 0,
    hiddenHealthyStreak: 0,
    peakNetWorth: 0,
    cumulativeNetProfit: 0,
    eventWeightMods: {},
    // —— 贷款子系统增量字段（INCREMENTAL_LOANFIX，默认值）——
    autoBailoutCount: 0,
    predatoryLoanCount: 0,
    bailoutRateMultiplier: 1,
    crisisLoanCount: 0,
    staffNotifications: [],
  };

  // 应用初始五项决策的即时效果（hidden/soft/cash 等；Pct 由结算时 addDecisionModifiers 处理）
  let state = base;
  const initDecisions: { cat: 'supplierTier' | 'priceStrategy' | 'decorationLevel' | 'promotionTier'; id: string }[] = [
    { cat: 'supplierTier', id: DEFAULT_SUPPLIER },
    { cat: 'priceStrategy', id: DEFAULT_PRICE },
    { cat: 'decorationLevel', id: cfg.decorationLevel },
    { cat: 'promotionTier', id: DEFAULT_PROMOTION },
  ];
  for (const d of initDecisions) {
    const eff = getDecisionEffects(d.cat, d.id);
    state = applyEffects(state, eff, rng, { accumulateMods: false });
  }

  // 净资产（峰值初始化）
  state.netWorth = Math.round(computeNetWorth(state));
  state.peakNetWorth = state.netWorth;
  state.brandRating = state.stores[0]?.rating ?? INITIAL_RATING;

  return state;
}
