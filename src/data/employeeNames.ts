// 员工姓名随机库（《开店说》员工系统重构 v3）
// 预设 40+ 中文名 + 随机生成器

/** 常用中文姓氏 */
const SURNAMES: string[] = [
  '张', '王', '李', '赵', '刘', '陈', '杨', '黄', '周', '吴',
  '徐', '孙', '马', '朱', '胡', '林', '郭', '何', '高', '罗',
  '郑', '梁', '谢', '宋', '唐', '韩', '曹', '许', '邓', '冯',
  '程', '蔡', '彭', '潘', '袁', '董', '余', '苏', '叶', '卢',
  '蒋', '田', '杜', '丁', '沈', '任', '姚', '卢', '傅', '钟',
];

/** 常用中文名（单字名） */
const GIVEN_SINGLE: string[] = [
  '伟', '芳', '娜', '敏', '静', '丽', '强', '磊', '洋', '勇',
  '艳', '杰', '军', '婷', '明', '超', '秀', '霞', '平', '刚',
];

/** 常用中文名（双字名） */
const GIVEN_DOUBLE_FIRST: string[] = [
  '小', '大', '文', '志', '建', '家', '海', '德', '俊', '子',
  '晓', '一', '思', '天', '永', '学', '瑞', '景', '庆', '春',
];

/** 常用中文名（双字名后半） */
const GIVEN_DOUBLE_LAST: string[] = [
  '明', '华', '平', '强', '刚', '军', '杰', '峰', '辉', '龙',
  '丽', '芳', '娜', '娟', '敏', '玲', '婷', '燕', '霞', '红',
];

/** 用 RNG 生成一个中文员工姓名 */
export function generateEmployeeName(rng: () => number): string {
  const surname = SURNAMES[Math.floor(rng() * SURNAMES.length)];
  // 50% 单字名，50% 双字名
  if (rng() < 0.5) {
    const given = GIVEN_SINGLE[Math.floor(rng() * GIVEN_SINGLE.length)];
    return surname + given;
  }
  const first = GIVEN_DOUBLE_FIRST[Math.floor(rng() * GIVEN_DOUBLE_FIRST.length)];
  const last = GIVEN_DOUBLE_LAST[Math.floor(rng() * GIVEN_DOUBLE_LAST.length)];
  return surname + first + last;
}
