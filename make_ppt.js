const PptxGenJS = require('pptxgenjs');
const pptx = new PptxGenJS();

const C1 = '2D1B4E';
const C2 = 'E8734A';
const C3 = 'FFB347';
const BG  = '1A1A2E';
const WT  = 'FFFFFF';
const GY  = 'AAAAAA';

// ===== 第1页：封面 =====
const s1 = pptx.addSlide();
s1.background = { fill: BG };
s1.addText('🐰 兔子躲蛋糕 🎂', { x:0.5, y:1.2, w:9, h:1.5, fontSize:48, bold:true, color:C3, align:'center' });
s1.addText('Bunny vs Cake — 休闲躲避堆叠小游戏', { x:0.5, y:2.6, w:9, h:0.6, fontSize:18, color:GY, align:'center' });
s1.addText('5分钟项目汇报', { x:0.5, y:4.5, w:9, h:0.5, fontSize:16, color:GY, align:'center' });
s1.addText('2026年5月', { x:0.5, y:5.0, w:9, h:0.5, fontSize:14, color:GY, align:'center' });

// ===== 第2页：项目概述 =====
const s2 = pptx.addSlide();
s2.background = { fill: BG };
s2.addText('📋 项目概述', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });
const overview = [
  ['游戏类型', '休闲躲避 + 堆叠养成'],
  ['目标平台', '移动端（iPhone 比例）+ 桌面端'],
  ['技术栈', 'HTML5 Canvas + CSS3 + Vanilla JS'],
  ['操作方式', '点击屏幕 / 空格键跳跃，支持触摸'],
  ['核心挑战', '精准跳跃时机，避免被撞，堆出最高的蛋糕山'],
];
overview.forEach((row, i) => {
  s2.addText(row[0], { x:0.8, y:1.5 + i*0.6, w:2.5, h:0.5, fontSize:18, bold:true, color:WT });
  s2.addText(row[1], { x:3.5, y:1.5 + i*0.6, w:5.5, h:0.5, fontSize:18, color:GY });
});

// ===== 第3页：核心玩法 =====
const s3 = pptx.addSlide();
s3.background = { fill: BG };
s3.addText('🎮 核心玩法', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });
const rules = [
  '1. 蛋糕从屏幕左右两侧交替滑向中间',
  '2. 兔子站在蛋糕堆顶端，点击/空格键使其跳跃',
  '3. 兔子跳起后用脚踩蛋糕上边界 → 蛋糕停在当前位置堆叠',
  '4. 蛋糕与下层蛋糕需有重叠区域才能堆叠（>0px）',
  '5. 若兔身被蛋糕撞到（穿透 > 40% 糕体）→ 游戏结束',
  '6. 蛋糕堆叠形成"蛋糕山"，镜头随高度自动上移',
];
rules.forEach((r, i) => {
  s3.addText(r, { x:0.8, y:1.4 + i*0.55, w:8.5, h:0.5, fontSize:16, color:GY });
});
s3.addText('目标：堆出最高的蛋糕山！', { x:0.8, y:4.8, w:8.5, h:0.5, fontSize:20, bold:true, color:C2 });

// ===== 第4页：双模式 =====
const s4 = pptx.addSlide();
s4.background = { fill: BG };
s4.addText('🎯 双游戏模式', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });

// 街机模式卡片
s4.addShape(pptx.ShapeType.roundRect, { x:0.5, y:1.3, w:4, h:3.2, fill:'2D1B4E', rectRadius:0.2, line:{color:C2,width:2} });
s4.addText('🎮 街机模式', { x:0.7, y:1.4, w:3.6, h:0.5, fontSize:22, bold:true, color:C2 });
s4.addText([
  { text:'• 悬空部分保留不动', options:{color:GY,fontSize:16} },
], { x:0.7, y:2.1, w:3.6, h:0.4 });
s4.addText([
  { text:'• 蛋糕可偏移堆叠', options:{color:GY,fontSize:16} },
], { x:0.7, y:2.5, w:3.6, h:0.4 });
s4.addText([
  { text:'  形成楼梯状蛋糕山', options:{color:GY,fontSize:16} },
], { x:0.7, y:2.8, w:3.6, h:0.4 });
s4.addText([
  { text:'• 仅需重叠 > 0 即可', options:{color:GY,fontSize:16} },
], { x:0.7, y:3.2, w:3.6, h:0.4 });
s4.addText([
  { text:'• 宽容度高，适合休闲', options:{color:GY,fontSize:16} },
], { x:0.7, y:3.5, w:3.6, h:0.4 });

// 拟真模式卡片
s4.addShape(pptx.ShapeType.roundRect, { x:5.0, y:1.3, w:4, h:3.2, fill:'2D1B4E', rectRadius:0.2, line:{color:C3,width:2} });
s4.addText('🔪 拟真模式', { x:5.2, y:1.4, w:3.6, h:0.5, fontSize:22, bold:true, color:C3 });
s4.addText([
  { text:'• 未重叠部分切掉', options:{color:GY,fontSize:16} },
], { x:5.2, y:2.1, w:3.6, h:0.4 });
s4.addText([
  { text:'  + 碎片飞落动画', options:{color:GY,fontSize:16} },
], { x:5.2, y:2.4, w:3.6, h:0.4 });
s4.addText([
  { text:'• 蛋糕宽度随对齐变化', options:{color:GY,fontSize:16} },
], { x:5.2, y:2.8, w:3.6, h:0.4 });
s4.addText([
  { text:'• 精准对齐 → 完整保留', options:{color:GY,fontSize:16} },
], { x:5.2, y:3.2, w:3.6, h:0.4 });
s4.addText([
  { text:'• 完全偏出 → 游戏结束', options:{color:GY,fontSize:16} },
], { x:5.2, y:3.5, w:3.6, h:0.4 });

// ===== 第5页：碰撞与堆叠机制 =====
const s5 = pptx.addSlide();
s5.background = { fill: BG };
s5.addText('⚙️ 碰撞 & 堆叠机制', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });

s5.addShape(pptx.ShapeType.roundRect, { x:0.5, y:1.3, w:4.2, h:2.5, fill:'2D1B4E', rectRadius:0.15 });
s5.addText('AABB 碰撞检测', { x:0.7, y:1.4, w:3.8, h:0.4, fontSize:20, bold:true, color:C2 });
s5.addText([
  { text:'兔子和蛋糕均为矩形碰撞盒\n\n', options:{color:GY,fontSize:15} },
  { text:'两者底部处于同一基线（地面）\n\n', options:{color:GY,fontSize:15} },
  { text:'水平重叠 + 兔子在地 = 被撞\n\n', options:{color:GY,fontSize:15} },
  { text:'跳起后水平重叠 = 安全通过', options:{color:GY,fontSize:15} },
], { x:0.7, y:1.9, w:3.8, h:1.8 });

s5.addShape(pptx.ShapeType.roundRect, { x:5.3, y:1.3, w:4.2, h:2.5, fill:'2D1B4E', rectRadius:0.15 });
s5.addText('堆叠判定流程', { x:5.5, y:1.4, w:3.8, h:0.4, fontSize:20, bold:true, color:C3 });
s5.addText([
  { text:'① 兔脚踩蛋糕上边界\n', options:{color:GY,fontSize:15} },
  { text:'② 蛋糕停在当前x坐标\n', options:{color:GY,fontSize:15} },
  { text:'③ 计算与下层重叠区域\n', options:{color:GY,fontSize:15} },
  { text:'④ 重叠>0 → 堆叠成功\n', options:{color:GY,fontSize:15} },
  { text:'⑤ 重叠≤0 → 游戏结束', options:{color:GY,fontSize:15} },
], { x:5.5, y:1.9, w:3.8, h:1.8 });

s5.addText('碰撞公式：cLeft < rRight && cRight > rLeft  &&  rabbit.onGround  →  Game Over', { x:0.5, y:4.2, w:9, h:0.5, fontSize:13, color:GY, align:'center' });

// ===== 第6页：视觉特效 =====
const s6 = pptx.addSlide();
s6.background = { fill: BG };
s6.addText('✨ 视觉特效', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });
const fx = [
  ['🖥 画面抖动', '被撞后全屏震颤，shakeX/Y ×0.72 交替衰减，持续 0.8s'],
  ['🐰 死亡弹飞', '兔子朝反方向飞出(vy=-420)，旋转翻滚(6rad/s)后落地'],
  ['🪨 碎片飞落', '拟真模式切边生成碎片，重力下落+旋转+渐隐(1.4s)'],
  ['📷 镜头跟随', '蛋糕山超屏幕55%时镜头平滑上移(lerp 8%/帧)'],
  ['☁️ 动态背景', '渐变天空 + 飘动云朵 + 远山起伏 + 草地'],
  ['🎨 弹性缩放', '所有尺寸×(canvas.width/390)，适配全平台'],
];
fx.forEach((f, i) => {
  const y = 1.4 + i * 0.6;
  s6.addShape(pptx.ShapeType.roundRect, { x:0.5, y:y, w:9, h:0.5, fill:'2D1B4E', rectRadius:0.1 });
  s6.addText(f[0], { x:0.7, y:y+0.02, w:3, h:0.45, fontSize:16, bold:true, color:C2 });
  s6.addText(f[1], { x:3.8, y:y+0.02, w:5.5, h:0.45, fontSize:14, color:GY });
});

// ===== 第7页：技术架构 =====
const s7 = pptx.addSlide();
s7.background = { fill: BG };
s7.addText('🏗 技术架构', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });

const arch = [
  ['Canvas 渲染', '60fps requestAnimationFrame 游戏循环，分层绘制'],
  ['状态机', 'Menu → Playing(Arcade/Realistic)，暂停/返回/GameOver'],
  ['AABB 碰撞', '轴对齐矩形碰撞检测，底部同基线，纯水平重叠判定'],
  ['弹性缩放', '所有尺寸 ×(canvas.width/390)，适配 iPhone~桌面'],
  ['DOM 动态构建', 'JS 注入 game-container、暂停键、计分板、提示'],
  ['多事件支持', 'click + touchstart + keydown，统一 jump() 接口'],
  ['代码量', '约 850 行纯 JavaScript，单文件零外部依赖'],
];
arch.forEach((a, i) => {
  const y = 1.4 + i * 0.55;
  s7.addText(a[0], { x:0.8, y:y, w:2.8, h:0.45, fontSize:17, bold:true, color:C2 });
  s7.addText(a[1], { x:3.8, y:y, w:5.5, h:0.45, fontSize:15, color:GY });
});

// ===== 第8页：总结与展望 =====
const s8 = pptx.addSlide();
s8.background = { fill: BG };
s8.addText('🚀 总结 & 后续规划', { x:0.5, y:0.3, w:9, h:0.8, fontSize:32, bold:true, color:C3 });

s8.addShape(pptx.ShapeType.roundRect, { x:0.5, y:1.3, w:4.2, h:3.0, fill:'2D1B4E', rectRadius:0.15 });
s8.addText('✅ 已完成', { x:0.7, y:1.4, w:3.8, h:0.4, fontSize:20, bold:true, color:'4CAF50' });
const done = [
  '街机模式（完整可玩）',
  '拟真模式（切边+碎片）',
  'AABB 碰撞 + 堆叠检测',
  '主页菜单（4按钮）',
  '死亡动画 + 画面抖动',
  '移动端适配（iPhone比例）',
  '暂停 + 返回主页',
  '弹性缩放 + 镜头跟随',
];
done.forEach((d, i) => {
  s8.addText('✓ ' + d, { x:0.7, y:1.9 + i*0.35, w:3.8, h:0.3, fontSize:14, color:GY });
});

s8.addShape(pptx.ShapeType.roundRect, { x:5.3, y:1.3, w:4.2, h:3.0, fill:'2D1B4E', rectRadius:0.15 });
s8.addText('📝 待完成', { x:5.5, y:1.4, w:3.8, h:0.4, fontSize:20, bold:true, color:'FF9800' });
const todo = [
  '历史记录功能',
  '设置页面（音效/操控）',
  '音效 + 背景音乐',
  '蛋糕/兔子皮肤系统',
  '排行榜（本地存储）',
  '粒子特效增强',
  '横屏适配',
];
todo.forEach((t, i) => {
  s8.addText('○ ' + t, { x:5.5, y:1.9 + i*0.35, w:3.8, h:0.3, fontSize:14, color:GY });
});

s8.addText('🙏 谢谢！欢迎试玩', { x:0.5, y:4.8, w:9, h:0.6, fontSize:28, bold:true, color:C3, align:'center' });

// ── 保存 ──
const outPath = 'C:/Users/tx/Desktop/兔子躲蛋糕_项目汇报.pptx';
pptx.writeFile({ fileName: outPath }).then(() => {
  console.log('PPT saved to: ' + outPath);
}).catch(e => console.error(e));
