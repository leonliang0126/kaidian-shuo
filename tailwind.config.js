/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // 配色方案（架构 §9.7）：暖白背景 + 橙色主按钮 + 绿色盈利 + 红色风险
        bg: '#FFFDF9',
        card: '#FFFFFF',
        primary: '#FF7A1A',
        'primary-dark': '#E8650A',
        profit: '#1FA971',
        risk: '#E5484D',
        ink: '#2B2B2B',
        sub: '#8A8580',
      },
      borderRadius: {
        card: '16px',
      },
      boxShadow: {
        card: '0 2px 12px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
};
