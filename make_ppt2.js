const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

const BG  = '1A1A2E';
const WT  = 'FFFFFF';
const GY  = 'AAAAAA';
const C2  = 'E8734A';
const C3  = 'FFB347';
const GRN = '4CAF50';
const ORG = 'FF9800';

function card(x, y, w, h) {
  return { x, y, w, h, fill:'2D1B4E', rectRadius:0.15 };
}
function title(text) {
  return { x:0.5, y:0.3, w:9, h:0.8, fontSize:30, bold:true, color:C3 };
}

// ===== 第1页：封面 =====
const s1 = pptx.addSlide();
s1.background = { fill: BG };
s1.addText('🐰 兔子躲蛋糕 🎂', { x:0.5, y:1.0, w:9, h:1.5, fontSize:44, bold:true, color:C3, align:'center' });
s1.addText('基于 Canvas 的休闲躲避堆叠小游戏', { x:0.5, y:2.4, w:9, h:0.6, fontSize:18, color:GY, align:'center' });
s1.addText('项目名称', { x:0.5, y:3.5, w:9, h:0.4, fontSize:14, color:GY, align:'center' });
s1.addText('兔子躲蛋糕（Bunny vs Cake）', { x:0.5, y:3.8, w:9, h:0.4, fontSize:20, bold:true, color:WT, align:'center' });
s1.addText('团队成员', { x:0.5, y:4.4, w:9, h:0.4, fontSize:14, color:GY, align:'center' });
s1.addText('独立开发', { x:0.5, y:4.7, w:9, h:0.4, fontSize:20, bold:true, color:WT, align:'center' });
s1.addText('2026年5月', { x:0.5, y:5.5, w:9, h:0.4, fontSize:13, color:GY, align:'center' });

// ===== 第2页：背景+痛点（0-1分钟开场） =====
const s2 = pptx.addSlide();
s2.background = { fill: BG };
s2.addText('📌 项目背景 & 核心定位', title());
s2.addText('第 0-1 分钟：项目开篇与核心定位', { x:0.5, y:1.0, w:9, h:0.4, fontSize:14, color:GY });

// 背景+问题+痛点
s2.addShape(pptx.ShapeType.roundRect, card(0.5, 1.5, 9, 1.4));
s2.addText('🔍 背景与痛点', { x:0.7, y:1.55, w:8.5, h:0.4, fontSize:18, bold:true, color:C2 });
s2.addText([
  { text:'碎片化时间场景下，用户需要轻量、即开即玩的休闲游戏\n', options:{color:GY,fontSize:14} },
  { text:'现有小游戏玩法同质化严重（跳一跳、堆一堆），缺乏\"躲避+堆叠\"双机制融合的创新体验\n', options:{color:GY,fontSize:14} },
  { text:'市面上缺少可同时满足\"休闲放松\"与\"硬核挑战\"双模式的单款小游戏', options:{color:GY,fontSize:14} },
], { x:0.7, y:1.95, w:8.5, h:0.9 });

// 核心定位
s2.addShape(pptx.ShapeType.roundRect, card(0.5, 3.1, 9, 1.2));
s2.addText('🎯 核心定位', { x:0.7, y:3.15, w:8.5, h:0.4, fontSize:18, bold:true, color:C3 });
s2.addText([
  { text:'创新类型：', options:{bold:true,color:WT,fontSize:14} }, { text:'模式创新 — 躲避 + 堆叠双机制融合', options:{color:GY,fontSize:14} },
], { x:0.7, y:3.55, w:8.5, h:0.35 });
s2.addText([
  { text:'目标群体：', options:{bold:true,color:WT,fontSize:14} }, { text:'通勤族、学生、微信小游戏用户（16-35岁移动端用户）', options:{color:GY,fontSize:14} },
], { x:0.7, y:3.9, w:8.5, h:0.35 });

// 项目一句话
s2.addShape(pptx.ShapeType.roundRect, { x:1.5, y:4.6, w:7, h:0.7, fill:'3D1A10', rectRadius:0.1, line:{color:C2,width:1.5} });
s2.addText('一款融合\"精准躲避\"与\"策略堆叠\"的移动端双模式休闲小游戏', { x:1.7, y:4.65, w:6.6, h:0.6, fontSize:16, bold:true, color:WT, align:'center' });

// ===== 第3页：核心思路+创新点 =====
const s3 = pptx.addSlide();
s3.background = { fill: BG };
s3.addText('💡 核心思路 & 创新点', title());
s3.addText('整体解决方案：Canvas 实现双模式游戏，一套代码全平台适配', { x:0.5, y:1.0, w:9, h:0.4, fontSize:14, color:GY });

// 两栏
// 左：核心玩法
s3.addShape(pptx.ShapeType.roundRect, card(0.5, 1.5, 4.3, 3.0));
s3.addText('🎮 核心玩法', { x:0.7, y:1.55, w:3.9, h:0.4, fontSize:18, bold:true, color:C2 });
s3.addText([
  { text:'① 蛋糕从左右交替滑向中间\n', options:{color:GY,fontSize:14} },
  { text:'② 兔子点击跳跃躲避蛋糕\n', options:{color:GY,fontSize:14} },
  { text:'③ 脚踩蛋糕顶部触发堆叠\n', options:{color:GY,fontSize:14} },
  { text:'④ 蛋糕停在被抓位置，计算重叠\n', options:{color:GY,fontSize:14} },
  { text:'⑤ 无重叠→游戏结束\n', options:{color:GY,fontSize:14} },
  { text:'⑥ 堆叠成山，镜头自动上移', options:{color:GY,fontSize:14} },
], { x:0.7, y:2.0, w:3.9, h:2.4 });

// 右：创新点
s3.addShape(pptx.ShapeType.roundRect, card(5.2, 1.5, 4.3, 3.0));
s3.addText('⭐ 核心创新点', { x:5.4, y:1.55, w:3.9, h:0.4, fontSize:18, bold:true, color:C3 });
s3.addText([
  { text:'• 双机制融合：', options:{bold:true,color:WT,fontSize:14} },
  { text:'躲避+堆叠，一游戏两体验\n', options:{color:GY,fontSize:14} },
  { text:'• 双模式设计：', options:{bold:true,color:WT,fontSize:14} },
  { text:'街机（休闲）/拟真（硬核）\n', options:{color:GY,fontSize:14} },
  { text:'• 物理碰撞：', options:{bold:true,color:WT,fontSize:14} },
  { text:'AABB矩形碰撞 + 重叠判定\n', options:{color:GY,fontSize:14} },
  { text:'• 拟真切边：', options:{bold:true,color:WT,fontSize:14} },
  { text:'无重叠部分切掉+碎片动画\n', options:{color:GY,fontSize:14} },
  { text:'• 弹性缩放：', options:{bold:true,color:WT,fontSize:14} },
  { text:'一套代码适配 iPhone~桌面', options:{color:GY,fontSize:14} },
], { x:5.4, y:2.0, w:3.9, h:2.4 });

// 可行性
s3.addShape(pptx.ShapeType.roundRect, card(0.5, 4.7, 9, 0.9));
s3.addText('✅ 可行性分析', { x:0.7, y:4.75, w:2, h:0.35, fontSize:16, bold:true, color:GRN });
s3.addText('纯前端技术栈（HTML5 Canvas + Vanilla JS），零后端依赖，开发周期短；已实现完整可玩版本（~850行代码）；移动端触屏完美适配，可快速移植微信小游戏平台', { x:0.7, y:5.1, w:8.5, h:0.4, fontSize:13, color:GY });

// ===== 第4页：商业模式 =====
const s4 = pptx.addSlide();
s4.background = { fill: BG };
s4.addText('💰 商业模式 & 变现路径', title());

// 核心商业模式
s4.addShape(pptx.ShapeType.roundRect, card(0.5, 1.3, 9, 1.5));
s4.addText('🏗 核心商业模式', { x:0.7, y:1.35, w:8.5, h:0.4, fontSize:18, bold:true, color:C2 });
s4.addText([
  { text:'盈利逻辑：', options:{bold:true,color:WT,fontSize:14} }, { text:'免费下载 + 广告变现 + 增值内购的 Freemium 模式\n', options:{color:GY,fontSize:14} },
  { text:'运营模式：', options:{bold:true,color:WT,fontSize:14} }, { text:'微信小游戏平台上线，利用社交裂变（好友排行、分享复活）低成本获客\n', options:{color:GY,fontSize:14} },
  { text:'合作模式：', options:{bold:true,color:WT,fontSize:14} }, { text:'与微信/抖音小游戏平台分成 + 品牌联动定制皮肤', options:{color:GY,fontSize:14} },
], { x:0.7, y:1.8, w:8.5, h:0.9 });

// 变现方式
s4.addShape(pptx.ShapeType.roundRect, card(0.5, 3.0, 4.3, 2.5));
s4.addText('💵 变现方式（3种）', { x:0.7, y:3.05, w:3.9, h:0.4, fontSize:17, bold:true, color:C3 });
s4.addText([
  { text:'① 激励视频广告\n', options:{bold:true,color:WT,fontSize:14} },
  { text:'  复活/双倍积分看广告\n\n', options:{color:GY,fontSize:13} },
  { text:'② 皮肤内购\n', options:{bold:true,color:WT,fontSize:14} },
  { text:'  兔子皮肤/蛋糕主题/场景\n\n', options:{color:GY,fontSize:13} },
  { text:'③ 平台分成\n', options:{bold:true,color:WT,fontSize:14} },
  { text:'  微信/抖音小游戏流量主', options:{color:GY,fontSize:13} },
], { x:0.7, y:3.5, w:3.9, h:1.8 });

// 成本收益
s4.addShape(pptx.ShapeType.roundRect, card(5.2, 3.0, 4.3, 2.5));
s4.addText('📊 成本收益测算', { x:5.4, y:3.05, w:3.9, h:0.4, fontSize:17, bold:true, color:ORG });
s4.addText([
  { text:'前期投入：\n', options:{bold:true,color:WT,fontSize:14} },
  { text:'开发1人月 + 美术素材采购\n', options:{color:GY,fontSize:13} },
  { text:'服务器费用极低（纯前端）\n\n', options:{color:GY,fontSize:13} },
  { text:'预期盈利：\n', options:{bold:true,color:WT,fontSize:14} },
  { text:'日活1万 → 月广告收入5k-2w\n', options:{color:GY,fontSize:13} },
  { text:'皮肤内购转化率3-5%\n\n', options:{color:GY,fontSize:13} },
  { text:'回本周期：1-3个月', options:{bold:true,color:GRN,fontSize:14} },
], { x:5.4, y:3.5, w:3.9, h:1.8 });

// ===== 第5页：执行计划 =====
const s5 = pptx.addSlide();
s5.background = { fill: BG };
s5.addText('📅 项目执行计划', title());

const phases = [
  ['Phase 1：核心开发（已完成）', '1-2周', GRN, [
    'Canvas 游戏引擎搭建',
    'AABB 碰撞检测系统',
    '兔子跳跃物理引擎',
    '双模式（街机/拟真）',
    '菜单系统 + 暂停/返回',
    '死亡动画 + 画面抖动',
  ]],
  ['Phase 2：打磨上线（进行中）', '2-4周', C3, [
    '音效 + 背景音乐集成',
    '历史排行榜（localStorage）',
    '设置页面（音量/操控）',
    '微信小游戏 SDK 接入',
    '性能优化 + 兼容测试',
    'App Store / Google Play 打包',
  ]],
  ['Phase 3：运营迭代（规划中）', '1-3月', ORG, [
    '皮肤商城上线（内购）',
    '激励视频广告接入',
    '社交排行 + 好友挑战',
    '节日主题活动更新',
    '用户数据分析 + A/B测试',
    '多语言国际化',
  ]],
];

phases.forEach((p, i) => {
  const y = 1.3 + i * 1.55;
  s5.addShape(pptx.ShapeType.roundRect, card(0.5, y, 9, 1.4));
  s5.addText(p[0], { x:0.7, y:y+0.05, w:4, h:0.35, fontSize:16, bold:true, color:p[2] });
  s5.addText(p[1], { x:8, y:y+0.05, w:1.3, h:0.35, fontSize:13, bold:true, color:p[2], align:'center' });
  p[3].forEach((item, j) => {
    s5.addText('• ' + item, { x:0.9 + (j<3?0:4.5), y:y+0.45 + (j%3)*0.28, w:4.2, h:0.25, fontSize:12, color:GY });
  });
});

// ===== 第6页：总结与展望 =====
const s6 = pptx.addSlide();
s6.background = { fill: BG };
s6.addText('🚀 总结 & 展望', title());

// 三价值
const vals = [
  ['🌍 社会价值', '为碎片化时间提供健康、轻量的娱乐方式；锻炼手眼协调与时机判断能力'],
  ['💰 经济价值', 'Freemium 模式可持续盈利；平台分成+广告+内购多渠道变现；低边际成本高可复制性'],
  ['👥 团队成长', '全栈开发能力提升（Canvas/动画/物理引擎）；产品从0到1完整闭环经验'],
];
vals.forEach((v, i) => {
  const y = 1.3 + i * 1.0;
  s6.addShape(pptx.ShapeType.roundRect, card(0.5, y, 9, 0.85));
  s6.addText(v[0], { x:0.7, y:y+0.05, w:2.5, h:0.35, fontSize:17, bold:true, color:C2 });
  s6.addText(v[1], { x:3.3, y:y+0.05, w:6, h:0.35, fontSize:14, color:GY });
});

// 未来展望
s6.addShape(pptx.ShapeType.roundRect, card(0.5, 4.3, 9, 0.9));
s6.addText('🔭 未来发展展望', { x:0.7, y:4.35, w:3, h:0.35, fontSize:17, bold:true, color:C3 });
s6.addText('长期目标：成为微信小游戏平台 Top100 休闲游戏；扩展更多主题场景与角色皮肤；探索多人联机对战模式（双人同时堆叠竞技）', { x:0.7, y:4.7, w:8.5, h:0.4, fontSize:14, color:GY });

// 致谢
s6.addText('🙏 感谢聆听 · 欢迎试玩', { x:0.5, y:5.5, w:9, h:0.6, fontSize:28, bold:true, color:C3, align:'center' });

// ── 保存 ──
const outPath = 'C:/Users/tx/Desktop/兔子躲蛋糕_路演汇报.pptx';
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log('PPT saved: ' + outPath);
}).catch(e => console.error(e));
