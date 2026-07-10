// @vitest-environment jsdom
// 分页重构 · 组件渲染测试（T10）。
// 文件级 jsdom 隔离，不污染全局 node 环境与既有 380 个纯逻辑测试。
import '@testing-library/jest-dom/vitest';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { useGameStore } from '../src/store/gameStore';
import { AppShell } from '../src/components/AppShell';
import { StatusBar } from '../src/components/StatusBar';
import App from '../src/App';

afterEach(cleanup);

/** 注入一个可玩的 game 状态（与既有 qa 测试同款开局方式）。 */
function startGame() {
  useGameStore.getState().startGame({
    storeType: '奶茶饮品',
    locationType: '学校门口',
    decorationLevel: 'clean',
    storeName: '测试店',
    seed: 1,
  });
}

beforeEach(() => {
  localStorage.clear();
  useGameStore.setState({ phase: 'opening', game: null });
});

describe('AppShell · 渲染', () => {
  it('渲染 TabBar 与全部 4 页（keep-alive 同挂载）', () => {
    startGame();
    render(<AppShell />);

    // TabBar 4 个 tab
    expect(screen.getByText('首页')).toBeInTheDocument();
    expect(screen.getByText('员工')).toBeInTheDocument();
    expect(screen.getByText('行动')).toBeInTheDocument();
    expect(screen.getByText('经营')).toBeInTheDocument();

    // 4 页内容同时存在（即便非 active 也保留在 DOM，保证滚动位置保留）
    expect(screen.getByText('今日经营重点')).toBeInTheDocument(); // HomePage → FocusSelector
    expect(screen.getByText('员工管理')).toBeInTheDocument(); // StaffTab → StaffPage
    expect(screen.getByText('行动点')).toBeInTheDocument(); // ActionTab → ActionPointPanel
    expect(screen.getByText('经营日志')).toBeInTheDocument(); // BusinessTab → BusinessLog
  });

  it('点击 tab 切换 activeTab，对应 tab 获得 aria-current=page', () => {
    startGame();
    render(<AppShell />);

    const staffBtn = screen.getByRole('button', { name: /员工/ });
    fireEvent.click(staffBtn);
    expect(staffBtn).toHaveAttribute('aria-current', 'page');

    // 切换后其它页内容仍挂载（keep-alive），active 页可见
    expect(screen.getByText('员工管理')).toBeInTheDocument();
    expect(screen.getByText('今日经营重点')).toBeInTheDocument();

    const actionBtn = screen.getByRole('button', { name: /行动/ });
    fireEvent.click(actionBtn);
    expect(actionBtn).toHaveAttribute('aria-current', 'page');

    const businessBtn = screen.getByRole('button', { name: /经营/ });
    fireEvent.click(businessBtn);
    expect(businessBtn).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('经营日志')).toBeInTheDocument();
  });

  it('keep-alive：4 页始终同挂载，保证各 tab 滚动位置不丢', () => {
    startGame();
    render(<AppShell />);
    // 切到非首页再切回，首页内容仍在 DOM（滚动位置天然保留）
    fireEvent.click(screen.getByRole('button', { name: /员工/ }));
    fireEvent.click(screen.getByRole('button', { name: /首页/ }));
    expect(screen.getByText('今日经营重点')).toBeInTheDocument();
    expect(screen.getByText('员工管理')).toBeInTheDocument();
    expect(screen.getByText('行动点')).toBeInTheDocument();
    expect(screen.getByText('经营日志')).toBeInTheDocument();
  });
});

describe('StatusBar · 双形态', () => {
  it("variant='home' 显示大卡关键字段（现金/净资产/预估到店/月份）", () => {
    startGame();
    render(<StatusBar variant="home" />);
    expect(screen.getByText('现金')).toBeInTheDocument();
    expect(screen.getByText('净资产')).toBeInTheDocument();
    expect(screen.getByText(/预估到店/)).toBeInTheDocument(); // TrafficPill 成块
    expect(screen.getByText(/第1周/)).toBeInTheDocument(); // 月份进标题小字
  });

  it("variant='mini' 显示 4 项（周几/第几周/品牌/现金）", () => {
    startGame();
    render(<StatusBar variant="mini" />);
    expect(screen.getByText(/周一/)).toBeInTheDocument(); // 周几（day 1）
    expect(screen.getByText(/第1周/)).toBeInTheDocument(); // 第几周
    expect(screen.getByText(/品牌/)).toBeInTheDocument(); // 品牌 ★
    expect(screen.getByText(/¥/)).toBeInTheDocument(); // 现金
  });
});

describe('阶段门控 · TabBar 仅在 playing 显示', () => {
  it('教程期(phase=tutorial) 不显示 TabBar', () => {
    useGameStore.setState({ phase: 'tutorial', game: null });
    render(<App />);
    expect(screen.queryByText('首页')).not.toBeInTheDocument();
  });

  it('开店设置期(phase=opening) 不显示 TabBar', () => {
    useGameStore.setState({ phase: 'opening', game: null });
    render(<App />);
    expect(screen.queryByText('首页')).not.toBeInTheDocument();
  });
});
