// 构建 DOM 结构：容器、按钮、计分板、提示文字
(function setupDOM() {
  // 修复 viewport
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  const oldUI = document.getElementById('ui');
  if (oldUI) oldUI.remove();

  const canvas = document.getElementById('gameCanvas');
  const body = document.body;

  const container = document.createElement('div');
  container.id = 'game-container';
  body.insertBefore(container, canvas);
  container.appendChild(canvas);

  const pauseBtn = document.createElement('button');
  pauseBtn.id = 'pauseBtn';
  pauseBtn.textContent = '⏸';
  container.appendChild(pauseBtn);

  const scoreUI = document.createElement('div');
  scoreUI.id = 'score-ui';
  scoreUI.innerHTML = '\u{1F95E} <span id="score">0</span>';
  container.appendChild(scoreUI);

  const hintUI = document.createElement('div');
  hintUI.id = 'hint-ui';
  hintUI.textContent = '点击兔子 或 按空格键 跳跃';
  container.appendChild(hintUI);
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const pauseBtn = document.getElementById('pauseBtn');

// roundRect polyfill
if (!ctx.roundRect) {
  ctx.roundRect = function(x, y, w, h, r) {
    if (typeof r === 'number') r = { tl: r, tr: r, br: r, bl: r };
    ctx.beginPath();
    ctx.moveTo(x + r.tl, y);
    ctx.lineTo(x + w - r.tr, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r.tr);
    ctx.lineTo(x + w, y + h - r.br);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r.br, y + h);
    ctx.lineTo(x + r.bl, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r.bl);
    ctx.lineTo(x, y + r.tl);
    ctx.quadraticCurveTo(x, y, x + r.tl, y);
    ctx.closePath();
  };
}

// ── 缩放变量 ──────────────────────────────
const MAX_W = 430;
const MAX_H = 932;
const REF_W = 390;

let RABBIT_W, RABBIT_H, CAKE_W, CAKE_H, GROUND_H;
let SLIDE_SPEED, JUMP_VELOCITY, GRAVITY;
let SPAWN_INTERVAL = 1.7;
let groundY;

const CAKE_COLORS = [
  { body: '#F4A460', icing: '#FCD5A8', border: '#C68E4E' },
  { body: '#DEB887', icing: '#F5DEB3', border: '#B8944B' },
  { body: '#FFB6C1', icing: '#FFD1DC', border: '#D4909E' },
  { body: '#DDA0DD', icing: '#EEC5EE', border: '#B480B4' },
  { body: '#98FB98', icing: '#C5FDC5', border: '#6CB86C' },
  { body: '#FFD700', icing: '#FFED80', border: '#CCA800' },
  { body: '#FFA07A', icing: '#FFC4B3', border: '#D48060' },
  { body: '#87CEEB', icing: '#B8E2F2', border: '#5CA0C0' },
];

// ── 状态 ──────────────────────────────────
let stack = [];
let cameraOff = 0;
let targetCam = 0;
let score = 0;
let gameOver = false;
let paused = false;
let shakeX = 0, shakeY = 0;
let deathTimer = 0;
let spawnTimer = 0;
let lastSpawnSide = null;
let rabbit, cake, rod;
let clouds = [];
let debris = [];

// ── 游戏状态机 ────────────────────────────
const STATE = { MENU: 'menu', PLAYING: 'playing', SETTINGS: 'settings' };
const MODE = { ARCADE: 'arcade', REALISTIC: 'realistic' };
let gameState = STATE.MENU;
let gameMode = MODE.ARCADE;
let menuBtns = [];

// ── 音频 ──────────────────────────────────
const MENU_MUSIC = '情绪回收站.mp3';
const GAME_MUSIC_POOL = [
  '吉星出租 - 暮色回响 .mp3',
  '汪苏泷&BY2 - 有点甜.mp3',
  '李尧音 - 深海回响 .mp3',
  'HOYO-MiX - 墓志铭 Epitaph .mp3',
  'HOYO-MiX - 再度和你 With You Once More.mp3',
];
const ALL_MUSIC = [MENU_MUSIC, ...GAME_MUSIC_POOL];
let currentMusic = null;
let musicEnabled = true;
let musicVolume = 1.0;
let sfxVolume = 1.0;
let selectedGameMusic = -1; // -1 = 随机，0-5 = ALL_MUSIC 索引
let _ambientMusicTime = 0;
let _ambientMusicSrc = MENU_MUSIC;
let _didPreview = false;
let _settingsFrom = 'menu'; // 记录从哪个界面进入设置：'menu' | 'pause'
let _draggingSlider = null; // 拖拽中的滑块：'music' | 'sfx' | null
let _sliderTimer = null;    // 长按定时器
let _songScroll = 0;        // 歌曲列表滚动偏移量
let _lastTouchY = 0;        // 上次触摸 Y 坐标（用于计算滚动增量）
let _touchStartX = 0;       // 触摸起始 X（用于判断点击 vs 滑动）
let _touchStartY = 0;       // 触摸起始 Y
let _touchInSongList = false; // 触摸是否在歌曲列表区域

// 保存当前音乐状态（进入设置前调用）
function saveAmbientMusic() {
  if (currentMusic) {
    _ambientMusicTime = currentMusic.currentTime;
    _ambientMusicSrc = decodeURI(currentMusic.src).replace(/^.*[\\/]/, '');
  }
  _didPreview = false;
  _songScroll = 0;
}

// 播放指定音乐文件，onEnded 可选（用于随机模式链式切歌）
function playMusic(src, onEnded) {
  stopMusic();
  if (!musicEnabled) return;
  currentMusic = new Audio(encodeURI(src));
  currentMusic.loop = !onEnded;
  currentMusic.volume = musicVolume;
  if (onEnded) currentMusic.addEventListener('ended', onEnded);
  currentMusic.play().catch(() => {});
}

// 更新当前音乐音量
function applyMusicVolume() {
  if (currentMusic) currentMusic.volume = musicVolume;
}

// 停止当前音乐
function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}

// 播放游戏音乐：选中单曲则循环，随机则播完自动切下一首
function playGameMusic() {
  if (selectedGameMusic >= 0 && selectedGameMusic < ALL_MUSIC.length) {
    playMusic(ALL_MUSIC[selectedGameMusic]);
  } else {
    const playNext = () => {
      playMusic(GAME_MUSIC_POOL[Math.floor(Math.random() * GAME_MUSIC_POOL.length)], playNext);
    };
    playNext();
  }
}

// 构建主菜单按钮列表
function buildMenu() {
  menuBtns = [
    { label: '街机模式', mode: MODE.ARCADE, desc: '悬空保留·轻松堆叠' },
    { label: '拟真模式', mode: MODE.REALISTIC, desc: '切边掉落·精准对齐' },
    { label: '最高记录', mode: null, desc: '最高堆叠0层' },
    { label: '设置', mode: null, desc: '音效与操控' },
  ];
}

// 根据窗口尺寸计算画布和所有游戏物体的缩放大小
function resize() {
  const w = window.innerWidth < MAX_W ? window.innerWidth : MAX_W;
  const h = window.innerHeight < MAX_H ? window.innerHeight : MAX_H;
  canvas.width = w;
  canvas.height = h;

  const s = w / REF_W;
  RABBIT_W = 42 * s;
  RABBIT_H = 56 * s;
  CAKE_W = 70 * s;
  CAKE_H = 30 * s;
  GROUND_H = 50 * s;
  SLIDE_SPEED = 170 * s;
  JUMP_VELOCITY = 580 * s;
  GRAVITY = 1600 * s;

  groundY = canvas.height - GROUND_H;
  if (rabbit) rabbit.x = canvas.width / 2;
  initClouds();
}

// 随机初始化背景装饰云朵
function initClouds() {
  clouds = [];
  for (let i = 0; i < 3; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 30 + Math.random() * canvas.height * 0.3,
      w: 60 + Math.random() * 70,
      h: 22 + Math.random() * 16,
      speed: 10 + Math.random() * 16,
    });
  }
}

// 初始化 / 重置游戏状态（兔子、蛋糕堆、分数、计时器等）
function init() {
  resize();
  rabbit = {
    x: canvas.width / 2,
    y: groundY - RABBIT_H,
    vy: 0,
    onGround: true,
  };
  stack = [];
  cameraOff = 0;
  targetCam = 0;
  score = 0;
  gameOver = false;
  paused = false;
  shakeX = 0; shakeY = 0;
  deathTimer = 0;
  rabbit.x = canvas.width / 2;
  spawnTimer = 1.0;
  lastSpawnSide = null;
  cake = null;
  rod = null;
  debris = [];
  scoreEl.textContent = '0';
  updatePauseBtn();
  showHint(true);
}

// ── 工具 ──────────────────────────────────
// 计算当前蛋糕堆顶部的 Y 坐标
function stackTopY() {
  return groundY - stack.length * CAKE_H;
}

// 蛋糕到达兔子脚下时堆叠：拟真模式切边对齐，街机模式仅检测完全落空
function stackCake(cakeX, cakeW) {
  const prev = stack.length > 0 ? stack[stack.length - 1] : null;
  const cLeft = cakeX - cakeW / 2;
  const cRight = cakeX + cakeW / 2;

  if (gameMode === MODE.REALISTIC && prev) {
    const pLeft = prev.cx - prev.width / 2;
    const pRight = prev.cx + prev.width / 2;
    const ovLeft = Math.max(cLeft, pLeft);
    const ovRight = Math.min(cRight, pRight);
    const ovW = ovRight - ovLeft;
    if (ovW <= 1) {
      gameOver = true;
      updatePauseBtn();
      shakeX = 14; shakeY = 8; deathTimer = 0.8;
      rabbit.vy = -420;
      rabbit.vx = (cake.fromRight ? -1 : 1) * 220;
      rabbit.onGround = false;
      return false;
    }
    if (ovLeft > cLeft) debris.push({ x:(cLeft+ovLeft)/2, y:cake.y+CAKE_H/2, w:ovLeft-cLeft, vx:-90, vy:-180, rot:-3, life:1.0, color:cake.color });
    if (ovRight < cRight) debris.push({ x:(ovRight+cRight)/2, y:cake.y+CAKE_H/2, w:cRight-ovRight, vx:90, vy:-180, rot:3, life:1.0, color:cake.color });
    cake.y = stackTopY() - CAKE_H;
    rabbit.y = cake.y - RABBIT_H;
    rabbit.vy = 0;
    cake.state = 'done';
    stack.push({ color: cake.color, cx: (ovLeft+ovRight)/2, width: ovW });
  } else {
    if (prev) {
      const pLeft = prev.cx - prev.width / 2;
      const pRight = prev.cx + prev.width / 2;
      if (Math.min(cRight,pRight) - Math.max(cLeft,pLeft) <= 0) {
        gameOver = true;
        updatePauseBtn();
        shakeX = 14; shakeY = 8; deathTimer = 0.8;
        rabbit.vy = -420;
        rabbit.vx = (cake.fromRight ? -1 : 1) * 220;
        rabbit.onGround = false;
        return false;
      }
    }
    cake.y = stackTopY() - CAKE_H;
    rabbit.y = cake.y - RABBIT_H;
    rabbit.vy = 0;
    cake.state = 'done';
    stack.push({ color: cake.color, cx: cakeX, width: cakeW });
  }
  score++;
  scoreEl.textContent = score;
  targetCam = Math.max(0, canvas.height * 0.55 - stackTopY());
  return true;
}

// 将 hex 颜色字符串转为 {r,g,b} 对象
function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

// 将 hex 颜色按比例 amt 提亮
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const cl = (c) => Math.max(0, Math.min(255, (c + (255 - c) * amt) | 0));
  return '#' + [cl(r), cl(g), cl(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ── 暂停 ──────────────────────────────────
const PAUSE_BTNS = [
  { label: '继续游戏', action: 'resume' },
  { label: '重新开始', action: 'restart' },
  { label: '设置', action: 'settings' },
  { label: '退出游戏', action: 'quit' },
];

// 切换暂停 / 恢复状态
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  updatePauseBtn();
}

// 根据游戏状态更新左上角按钮的显示与图标
function updatePauseBtn() {
  if (gameState !== STATE.PLAYING) {
    pauseBtn.style.display = 'none';
    return;
  }
  if (gameOver) {
    pauseBtn.style.display = '';
    pauseBtn.textContent = '✕';
    return;
  }
  pauseBtn.style.display = paused ? 'none' : '';
  pauseBtn.textContent = '||';
}

// 显示 / 隐藏底部操作提示文字
function showHint(visible) {
  const hint = document.getElementById('hint-ui');
  if (hint) hint.style.opacity = visible ? '1' : '0';
}

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameState === STATE.SETTINGS) { goToMenu(); return; }
  if (gameOver) { goToMenu(); return; }
  togglePause();
});

// ── 菜单点击 ──────────────────────────────
// 切换游戏中 UI（计分板、提示）的显隐
function showGameUI(v) {
  const d = v ? '' : 'none';
  document.getElementById('score-ui').style.display = d;
  document.getElementById('hint-ui').style.display = d;
  updatePauseBtn();
}

// 检测主菜单按钮点击并启动对应游戏模式
function handleMenuClick(cx, cy) {
  const bw = canvas.width * 0.7;
  const bh = canvas.height * 0.09;
  const startY = canvas.height * 0.28;
  const gap = canvas.height * 0.12;
  for (let i = 0; i < menuBtns.length; i++) {
    const bx = (canvas.width - bw) / 2;
    const by = startY + i * gap;
    if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
      if (menuBtns[i].mode) {
        gameMode = menuBtns[i].mode;
        init();
        gameState = STATE.PLAYING;
        showGameUI(true);
        playGameMusic();
      } else if (i === 3) {
        // 设置按钮
        _settingsFrom = 'menu';
        saveAmbientMusic();
        gameState = STATE.SETTINGS;
        showGameUI(false);
      }
      return true;
    }
  }
  return false;
}

// 检测暂停菜单按钮点击（继续 / 重开 / 退出）
function handlePauseMenuClick(cx, cy) {
  const bw = canvas.width * 0.58;
  const bh = canvas.height * 0.07;
  const gap = canvas.height * 0.095;
  const startY = canvas.height * 0.38;
  for (let i = 0; i < PAUSE_BTNS.length; i++) {
    const bx = (canvas.width - bw) / 2;
    const by = startY + i * gap;
    if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
      const action = PAUSE_BTNS[i].action;
      if (action === 'resume') { togglePause(); }
      else if (action === 'restart') { init(); }
      else if (action === 'settings') { _settingsFrom = 'pause'; saveAmbientMusic(); gameState = STATE.SETTINGS; }
      else if (action === 'quit') { goToMenu(); }
      return true;
    }
  }
  return false;
}

// 检测设置界面点击
function handleSettingsClick(cx, cy) {
  // 返回按钮：根据来源回到不同界面
  if (cx >= 12 && cx <= 64 && cy >= Math.max(14, 8) && cy <= Math.max(14, 8) + 34) {
    if (_settingsFrom === 'pause') {
      if (_didPreview) { _didPreview = false; playGameMusic(); }
      gameState = STATE.PLAYING;
      showGameUI(true);
    } else {
      goToMenu();
    }
    return true;
  }

  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const sh = 30; // slider clickable height

  // 音乐调节滑块
  const s1y = canvas.height * 0.24 + canvas.height * 0.06;
  if (cy >= s1y - sh / 2 && cy <= s1y + sh / 2 && cx >= lx - 10 && cx <= lx + sw + 10) {
    musicVolume = Math.max(0, Math.min(1, (cx - lx) / sw));
    applyMusicVolume();
    clearTimeout(_sliderTimer);
    _sliderTimer = setTimeout(() => { _draggingSlider = 'music'; }, 250);
    return true;
  }

  // 音效调节滑块
  const s2y = canvas.height * 0.38 + canvas.height * 0.06;
  if (cy >= s2y - sh / 2 && cy <= s2y + sh / 2 && cx >= lx - 10 && cx <= lx + sw + 10) {
    sfxVolume = Math.max(0, Math.min(1, (cx - lx) / sw));
    clearTimeout(_sliderTimer);
    _sliderTimer = setTimeout(() => { _draggingSlider = 'sfx'; }, 250);
    return true;
  }

  // 背景音乐列表
  const ibh = canvas.height * 0.054;
  const igap = canvas.height * 0.064;
  const ix = canvas.width * 0.08;
  const iw = canvas.width * 0.84;
  const istartY = canvas.height * 0.50 + canvas.height * 0.058;
  for (let i = -1; i < ALL_MUSIC.length; i++) {
    const idx = i + 1;
    const iy = istartY + idx * igap - _songScroll;
    if (cx >= ix && cx <= ix + iw && cy >= iy && cy <= iy + ibh) {
      selectedGameMusic = i;
      if (gameState === STATE.SETTINGS) {
        if (i >= 0) {
          _didPreview = true;
          playMusic(ALL_MUSIC[i]);
        } else {
          // 选择"随机播放" → 恢复原音乐
          _didPreview = false;
          playMusic(_ambientMusicSrc);
          if (currentMusic) currentMusic.currentTime = _ambientMusicTime;
        }
      }
      return true;
    }
  }

  return false;
}

// 获取事件在 canvas 上的坐标
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  return {
    x: (clientX - rect.left) * (canvas.width / rect.width),
    y: (clientY - rect.top) * (canvas.height / rect.height),
  };
}

// 根据 canvas X 坐标更新拖拽中的滑块
function updateSliderDrag(sx) {
  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const val = Math.max(0, Math.min(1, (sx - lx) / sw));
  if (_draggingSlider === 'music') { musicVolume = val; applyMusicVolume(); }
  else if (_draggingSlider === 'sfx') { sfxVolume = val; }
}

// 设置界面：滑块拖拽 / 歌曲列表滚动
canvas.addEventListener('touchmove', (e) => {
  if (gameState !== STATE.SETTINGS) return;
  if (_draggingSlider) {
    e.preventDefault();
    updateSliderDrag(canvasPos(e).x);
    return;
  }
  // 歌曲列表滚动
  const pos = canvasPos(e);
  const dy = _lastTouchY - pos.y;
  _lastTouchY = pos.y;
  const listTop = canvas.height * 0.50 + canvas.height * 0.058;
  const listBottom = canvas.height * 0.94;
  const totalItems = ALL_MUSIC.length + 1;
  const igap = canvas.height * 0.064;
  const listHeight = totalItems * igap;
  const maxScroll = Math.max(0, listHeight - (listBottom - listTop));
  _songScroll = Math.max(0, Math.min(maxScroll, _songScroll + dy));
  if (Math.abs(dy) > 2) e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (gameState !== STATE.SETTINGS || !_draggingSlider) return;
  updateSliderDrag(canvasPos(e).x);
});

// 鼠标滚轮滚动歌曲列表
canvas.addEventListener('wheel', (e) => {
  if (gameState !== STATE.SETTINGS) return;
  const listTop = canvas.height * 0.50 + canvas.height * 0.058;
  const listBottom = canvas.height * 0.94;
  const pos = canvasPos(e);
  if (pos.y >= listTop - 10 && pos.y <= listBottom + 10) {
    e.preventDefault();
    const totalItems = ALL_MUSIC.length + 1;
    const igap = canvas.height * 0.064;
    const listHeight = totalItems * igap;
    const maxScroll = Math.max(0, listHeight - (listBottom - listTop));
    _songScroll = Math.max(0, Math.min(maxScroll, _songScroll + e.deltaY));
  }
});

// 结束拖拽（document 级别确保手指/鼠标移出 canvas 也能松手）
function endSliderDrag() { clearTimeout(_sliderTimer); _draggingSlider = null; }
document.addEventListener('touchend', (e) => {
  if (_touchInSongList && gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    const ex = (e.changedTouches[0].clientX - rect.left) * (canvas.width / rect.width);
    const ey = (e.changedTouches[0].clientY - rect.top) * (canvas.height / rect.height);
    const dx = ex - _touchStartX;
    const dy = ey - _touchStartY;
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
      handleSettingsClick(_touchStartX, _touchStartY);
    }
    _touchInSongList = false;
  }
  endSliderDrag();
});
document.addEventListener('mouseup', endSliderDrag);
document.addEventListener('touchcancel', endSliderDrag);

// 返回主菜单
function goToMenu() {
  if (gameState === STATE.SETTINGS) {
    if (_didPreview) {
      _didPreview = false;
      gameState = STATE.MENU;
      showGameUI(false);
      playMusic(_ambientMusicSrc);
      if (currentMusic) currentMusic.currentTime = _ambientMusicTime;
      return;
    }
    // 未预览过 → 音乐继续播放，直接返回
    gameState = STATE.MENU;
    showGameUI(false);
    return;
  }
  gameState = STATE.MENU;
  showGameUI(false);
  playMusic(MENU_MUSIC);
}

// ── 跳跃 ──────────────────────────────────
// 兔子跳跃：仅在站立时起跳，死亡 / 暂停时也响应
function jump() {
  if (gameState === STATE.MENU || gameState === STATE.SETTINGS) return;
  if (gameOver) { init(); return; }
  if (paused) { togglePause(); return; }
  if (rabbit.onGround) {
    rabbit.vy = -JUMP_VELOCITY;
    rabbit.onGround = false;
    showHint(false);
  }
}

canvas.addEventListener('click', (e) => {
  e.preventDefault();
  if (gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    handleSettingsClick(sx, sy);
    return;
  }
  if (gameState === STATE.MENU) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    handleMenuClick(sx, sy);
    return;
  }
  // 暂停菜单按钮
  if (paused && !gameOver) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.clientY - rect.top) * (canvas.height / rect.height);
    handlePauseMenuClick(sx, sy);
    return;
  }
  jump();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (gameState === STATE.MENU || gameState === STATE.SETTINGS) return;
    if (e.code === 'Space' && (paused || gameOver)) {
      if (gameOver) init();
      else togglePause();
      return;
    }
    jump();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (gameState === STATE.SETTINGS) {
      if (_settingsFrom === 'pause') {
        if (_didPreview) { _didPreview = false; playGameMusic(); }
        gameState = STATE.PLAYING;
        showGameUI(true);
      } else goToMenu();
      return;
    }
    if (gameState === STATE.MENU) return;
    togglePause();
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    _lastTouchY = sy;
    // 歌曲列表区域：只记录位置，等 touchend 判断是点击还是滑动
    const listTop = canvas.height * 0.50 + canvas.height * 0.058;
    const listBottom = canvas.height * 0.94;
    const ix = canvas.width * 0.08;
    const iw = canvas.width * 0.84;
    if (sy >= listTop && sy <= listBottom && sx >= ix && sx <= ix + iw) {
      _touchInSongList = true;
      _touchStartX = sx;
      _touchStartY = sy;
    } else {
      _touchInSongList = false;
      handleSettingsClick(sx, sy);
    }
    return;
  }
  if (gameState === STATE.MENU) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    handleMenuClick(sx, sy);
    return;
  }
  // 暂停菜单按钮
  if (paused && !gameOver) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    handlePauseMenuClick(sx, sy);
    return;
  }
  jump();
});

// ── 生成蛋糕 ──────────────────────────────
// 从屏幕一侧生成新蛋糕（拟真模式下宽度继承栈顶）
function spawnCake() {
  const fromRight = lastSpawnSide === null
    ? Math.random() < 0.5
    : lastSpawnSide === 'left';
  lastSpawnSide = fromRight ? 'right' : 'left';

  const cy = stackTopY() - CAKE_H * 1.8;
  const c = CAKE_COLORS[Math.floor(Math.random() * CAKE_COLORS.length)];

  // 拟真模式：新蛋糕宽度 = 上一跳剩余（栈顶）宽度，最小不低于 CAKE_W 的 25%
  let cakeW = CAKE_W;
  if (gameMode === MODE.REALISTIC && stack.length > 0) {
    cakeW = Math.max(CAKE_W * 0.25, stack[stack.length - 1].width);
  }

  cake = {
    x: fromRight ? canvas.width + 60 : -60,
    y: cy,
    fromRight,
    color: c,
    state: 'sliding',
    w: cakeW,
  };
  rod = { x: cake.x, side: fromRight ? 'right' : 'left', state: 'out' };
}

// ── 更新逻辑 ──────────────────────────────
// 每帧更新：物理、碰撞检测、动画状态
function update(dt) {
  if (gameState === STATE.MENU || gameState === STATE.SETTINGS) return;
  if (paused) return;

  dt = Math.min(dt, 0.05);

  // 死亡动画
  if (gameOver) {
    shakeX = -shakeX * 0.72;
    shakeY = -shakeY * 0.72;
    if (Math.abs(shakeX) < 0.3) { shakeX = 0; shakeY = 0; }
    deathTimer -= dt;
    if (rabbit) {
      rabbit.vy += GRAVITY * dt;
      rabbit.y += rabbit.vy * dt;
      rabbit.x += (rabbit.vx || 0) * dt;
      if (rabbit.y >= groundY - RABBIT_H) {
        rabbit.y = groundY - RABBIT_H;
        rabbit.vy = 0;
        rabbit.vx = 0;
      }
    }
    if (rod && rod.state === 'retracting') {
      const edge = rod.side === 'left' ? -40 : canvas.width + 40;
      rod.x += (edge - rod.x) * 8 * dt;
      if (Math.abs(rod.x - edge) < 2) rod = null;
    }
    for (const d of debris) {
      d.vy += GRAVITY * dt;
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      d.rot += d.vx * dt * 0.03;
      d.life -= dt * 0.7;
    }
    debris = debris.filter(d => d.life > 0);
    return;
  }

  const st = stackTopY();

  // 兔子物理
  if (!rabbit.onGround) {
    rabbit.vy += GRAVITY * dt;
    rabbit.y += rabbit.vy * dt;
    if (rabbit.y >= st - RABBIT_H) {
      rabbit.y = st - RABBIT_H;
      rabbit.vy = 0;
      rabbit.onGround = true;
    }
  } else {
    rabbit.y = st - RABBIT_H;
  }

  // 蛋糕生成计时（仅当没有活跃蛋糕时）
  if (!cake || cake.state === 'done') {
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnCake();
      spawnTimer = SPAWN_INTERVAL;
    }
  }

  // ── 滑行 ──
  if (cake && cake.state === 'sliding') {
    cake.x += (cake.fromRight ? -1 : 1) * SLIDE_SPEED * dt;

    const cw = cake.w || CAKE_W;
    const cLeft = cake.x - cw / 2;
    const cRight = cake.x + cw / 2;
    const rLeft = rabbit.x - RABBIT_W / 2;
    const rRight = rabbit.x + RABBIT_W / 2;
    const hOverlap = cLeft < rRight && cRight > rLeft;
    const rabbitBottom = rabbit.y + RABBIT_H;
    // 碰撞仅含蛋糕实体（糖霜+樱桃无碰撞箱）
    const colTop = cake.y + CAKE_H * 0.15;
    const colBottom = cake.y + CAKE_H;

    // 蛋糕边缘碰到兔子 → 检查是否撞入兔身还是兔子踩顶
    if (hOverlap) {
      // 兔脚踩在蛋糕实体上边界 → 直接堆叠
      if (!rabbit.onGround && rabbitBottom >= colTop - 3 && rabbitBottom <= colTop + CAKE_H * 0.2) {
        if (!stackCake(cake.x, cw)) return;
      }
      // 兔子在地面或身体深入蛋糕实体 → 被撞
      else if (rabbit.onGround || rabbitBottom > colTop + CAKE_H * 0.4) {
        gameOver = true;
        updatePauseBtn();
        shakeX = 14; shakeY = 8;
        deathTimer = 0.8;
        rabbit.vy = -420;
        rabbit.vx = (cake.fromRight ? -1 : 1) * 220;
        rabbit.onGround = false;
        return;
      }
      // 兔子完全在蛋糕上方 → 蛋糕继续滑行，不停留
    }

    // 蛋糕穿过兔子后滑出屏幕 → 消失，开始下一轮
    const offScreen = cake.fromRight
      ? cake.x < rabbit.x - RABBIT_W/2 - cw
      : cake.x > rabbit.x + RABBIT_W/2 + cw;
    if (offScreen) { cake = null; rod = null; }
  }

  // 杆跟随 / 回收
  if (rod) {
    if (rod.state === 'out') {
      if (cake && cake.state !== 'done') rod.x = cake.x;
      else rod.state = 'retracting';
    }
    if (rod.state === 'retracting') {
      const edge = rod.side === 'left' ? -40 : canvas.width + 40;
      rod.x += (edge - rod.x) * 8 * dt;
      if (Math.abs(rod.x - edge) < 2) rod = null;
    }
  }

  // 碎片物理（拟真模式切边）
  for (const d of debris) {
    d.vy += GRAVITY * dt;
    d.y += d.vy * dt;
    d.x += d.vx * dt;
    d.rot += d.vx * dt * 0.03;
    d.life -= dt * 0.7;
  }
  debris = debris.filter(d => d.life > 0);

  // 云
  for (const c of clouds) {
    c.x -= c.speed * dt;
    if (c.x + c.w < -20) c.x = canvas.width + 20;
  }

  // 相机平滑
  cameraOff += (targetCam - cameraOff) * 0.08;
}

// ── 绘制 ──────────────────────────────────
// 绘制背景装饰云朵
function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  for (const c of clouds) {
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, c.w * 0.5, c.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c.x - c.w * 0.22, c.y + 6, c.w * 0.28, c.h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(c.x + c.w * 0.25, c.y + 3, c.w * 0.3, c.h * 0.33, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 绘制兔子（身体、耳朵、眼睛、腿），dying 时附加旋转动画
function drawRabbit(x, sy, dying) {
  // sy = 兔脚底 = 碰撞盒下边界；碰撞盒 = [x±W/2, sy-H .. sy]
  const top = sy - RABBIT_H;
  const bot = sy;
  const mid = sy - RABBIT_H * 0.5;
  ctx.save();

  // 死亡旋转
  if (dying) {
    ctx.translate(x, mid);
    ctx.rotate(deathTimer * 6);
    ctx.translate(-x, -mid);
  }

  let scx = 1, scy = 1;
  if (!rabbit.onGround && !dying) { scy = 1.1; scx = 0.93; }
  ctx.translate(x, mid);
  ctx.scale(scx, scy);
  ctx.translate(-x, -mid);

  // 脚底阴影
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.beginPath();
  ctx.ellipse(x, bot, RABBIT_W * 0.3, RABBIT_H * 0.04, 0, 0, Math.PI * 2);
  ctx.fill();

  // 尾巴
  const tailX = x + RABBIT_W * 0.32;
  const tailY = mid + RABBIT_H * 0.04;
  const tailR = RABBIT_W * 0.14;
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(tailX, tailY, tailR, 0, Math.PI * 2);
  ctx.fill();

  // 身体
  ctx.fillStyle = '#FFF5EE';
  ctx.beginPath();
  ctx.ellipse(x, mid + RABBIT_H * 0.12, RABBIT_W * 0.36, RABBIT_H * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();

  // 头
  const headY = top + RABBIT_H * 0.36;
  const headR = RABBIT_W * 0.30;
  ctx.fillStyle = '#FFF5EE';
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // 左耳
  const earLX = x - RABBIT_W * 0.14;
  const earY = top + RABBIT_H * 0.12;
  const earRX = RABBIT_W * 0.10;
  const earRY = RABBIT_H * 0.12;
  ctx.fillStyle = '#FFF5EE';
  ctx.beginPath();
  ctx.ellipse(earLX, earY, earRX, earRY, -0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath();
  ctx.ellipse(earLX, earY + RABBIT_H * 0.01, earRX * 0.52, earRY * 0.7, -0.08, 0, Math.PI * 2);
  ctx.fill();

  // 右耳
  const earRX2 = x + RABBIT_W * 0.14;
  ctx.fillStyle = '#FFF5EE';
  ctx.beginPath();
  ctx.ellipse(earRX2, earY + RABBIT_H * 0.01, earRX, earRY, 0.08, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath();
  ctx.ellipse(earRX2, earY + RABBIT_H * 0.02, earRX * 0.52, earRY * 0.7, 0.06, 0, Math.PI * 2);
  ctx.fill();

  // 眼睛
  const eyeY = headY - RABBIT_H * 0.04;
  const eyeR = RABBIT_W * 0.06;
  ctx.fillStyle = '#333';
  ctx.beginPath();
  ctx.arc(x - RABBIT_W * 0.11, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + RABBIT_W * 0.11, eyeY, eyeR, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(x - RABBIT_W * 0.09, eyeY - RABBIT_H * 0.02, eyeR * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x + RABBIT_W * 0.13, eyeY - RABBIT_H * 0.02, eyeR * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // 鼻子
  const noseY = headY + RABBIT_H * 0.05;
  ctx.fillStyle = '#FFB6C1';
  ctx.beginPath();
  ctx.moveTo(x, noseY - RABBIT_H * 0.02);
  ctx.lineTo(x - RABBIT_W * 0.05, noseY + RABBIT_H * 0.03);
  ctx.lineTo(x + RABBIT_W * 0.05, noseY + RABBIT_H * 0.03);
  ctx.closePath();
  ctx.fill();

  // 前腿
  const feetY = bot - RABBIT_H * 0.06;
  ctx.fillStyle = '#FFF5EE';
  ctx.beginPath();
  ctx.ellipse(x - RABBIT_W * 0.18, feetY, RABBIT_W * 0.14, RABBIT_H * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + RABBIT_W * 0.18, feetY, RABBIT_W * 0.14, RABBIT_H * 0.06, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// 绘制一块蛋糕（含蛋糕体、糖霜、奶油花纹、樱桃）
function drawCake(x, cy, color, w) {
  const W = w !== undefined ? w : CAKE_W;
  const cx = x - W / 2;
  ctx.save();

  ctx.fillStyle = color.border;
  ctx.fillRect(cx + 2, cy + CAKE_H * 0.15 + 2, W, CAKE_H * 0.85);

  ctx.fillStyle = color.body;
  ctx.fillRect(cx, cy + CAKE_H * 0.15, W, CAKE_H * 0.85);

  ctx.fillStyle = lighten(color.body, 0.15);
  ctx.fillRect(cx + W * 0.06, cy + CAKE_H * 0.5, W - W * 0.12, CAKE_H * 0.1);

  ctx.fillStyle = color.icing;
  ctx.beginPath();
  ctx.moveTo(cx - W * 0.06, cy + CAKE_H * 0.2);
  ctx.quadraticCurveTo(cx + W / 2, cy - CAKE_H * 0.2, cx + W + W * 0.06, cy + CAKE_H * 0.2);
  ctx.lineTo(cx + W, cy + CAKE_H * 0.15);
  ctx.lineTo(cx, cy + CAKE_H * 0.15);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#FFF';
  for (let i = cx + W * 0.14; i < cx + W * 0.93; i += W * 0.2) {
    ctx.beginPath();
    ctx.arc(i, cy + CAKE_H * 0.08, W * 0.065, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = '#E03030';
  ctx.beginPath();
  ctx.arc(cx + W / 2 + W * 0.06, cy - CAKE_H * 0.1, W * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(cx + W / 2 + W * 0.03, cy - CAKE_H * 0.17, W * 0.03, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#228B22';
  ctx.lineWidth = Math.max(1.5, W * 0.03);
  ctx.beginPath();
  ctx.moveTo(cx + W / 2 + W * 0.06, cy - CAKE_H * 0.3);
  ctx.quadraticCurveTo(cx + W / 2 + W * 0.14, cy - CAKE_H * 0.47, cx + W / 2 + W * 0.08, cy - CAKE_H * 0.53);
  ctx.stroke();

  ctx.restore();
}

// 绘制滑块条（纯轨道+圆点，无文字）
function drawSlider(x, y, w, value) {
  const h = 6;
  const r = 12;
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(x, y - h / 2, w, h);
  const fillW = w * value;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.fillRect(x, y - h / 2, fillW, h);
  ctx.fillStyle = '#FFF';
  ctx.beginPath();
  ctx.arc(x + fillW, y, r, 0, Math.PI * 2);
  ctx.fill();
}

// 绘制设置界面
function drawSettings() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#1a1a2e');
  skyGrad.addColorStop(0.5, '#16213e');
  skyGrad.addColorStop(1, '#0f3460');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = 'rgba(255,255,255,0.03)';
  ctx.beginPath(); ctx.arc(canvas.width * 0.8, canvas.height * 0.15, canvas.width * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(canvas.width * 0.2, canvas.height * 0.78, canvas.width * 0.35, 0, Math.PI * 2); ctx.fill();

  // 顶部返回栏
  const topY = Math.max(14, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(12, topY, 52, 34, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold ' + Math.round(canvas.width * 0.05) + 'px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('←', 38, topY + 17);

  // 标题
  ctx.fillStyle = '#FFF';
  ctx.font = 'bold ' + Math.round(canvas.width * 0.08) + 'px Arial';
  ctx.fillText('设置', canvas.width / 2, canvas.height * 0.11);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  // ── 音乐调节 ──
  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const fs = Math.round(canvas.width * 0.041);
  ctx.fillStyle = '#FFF';
  ctx.font = fs + 'px Arial';

  const s1y = canvas.height * 0.24;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('音乐调节', lx, s1y);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(musicVolume * 100) + '%', lx + sw + 34, s1y);
  drawSlider(lx, s1y + canvas.height * 0.06, sw, musicVolume);

  // ── 音效调节 ──
  const s2y = canvas.height * 0.38;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('音效调节', lx, s2y);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(sfxVolume * 100) + '%', lx + sw + 34, s2y);
  drawSlider(lx, s2y + canvas.height * 0.06, sw, sfxVolume);

  // ── 背景音乐 ──
  const s3y = canvas.height * 0.50;
  ctx.textAlign = 'start';
  ctx.textBaseline = 'middle';
  ctx.fillText('背景音乐', lx, s3y);

  const ibh = canvas.height * 0.054;
  const igap = canvas.height * 0.064;
  const ix = canvas.width * 0.08;
  const iw = canvas.width * 0.84;
  const istartY = s3y + canvas.height * 0.058;
  const listTop = istartY;
  const listBottom = canvas.height * 0.94;
  const totalItems = ALL_MUSIC.length + 1; // +1 for 随机播放
  const listHeight = totalItems * igap;
  const maxScroll = Math.max(0, listHeight - (listBottom - listTop));

  // 裁剪区域
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop - 4, canvas.width, listBottom - listTop + 8);
  ctx.clip();

  const labels = ['随机播放', ...ALL_MUSIC.map(f => f.replace(/\.mp3$/i, '').replace(/^\S+\s*-\s*/, '').trim())];

  for (let i = -1; i < ALL_MUSIC.length; i++) {
    const idx = i + 1;
    const iy = istartY + idx * igap - _songScroll;
    if (iy + ibh < listTop || iy > listBottom) continue;
    const isSelected = (i === -1 && selectedGameMusic < 0) || (i >= 0 && selectedGameMusic === i);
    ctx.fillStyle = isSelected ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.06)';
    ctx.strokeStyle = isSelected ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ibh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isSelected ? '#FFF' : 'rgba(255,255,255,0.6)';
    ctx.font = fs + 'px Arial';
    ctx.textAlign = 'start';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[idx], ix + 14, iy + ibh / 2);
    if (isSelected) {
      ctx.fillStyle = '#FFD700';
      ctx.font = 'bold ' + fs + 'px Arial';
      ctx.textAlign = 'right';
      ctx.fillText('✓', ix + iw - 14, iy + ibh / 2);
    }
  }

  ctx.restore();

  // 滚动条
  if (maxScroll > 0) {
    const sbW = 4;
    const sbX = ix + iw + 6;
    const sbH = (listBottom - listTop) * (listBottom - listTop) / listHeight;
    const sbY = listTop + (_songScroll / maxScroll) * (listBottom - listTop - sbH);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.beginPath(); ctx.roundRect(sbX, Math.max(listTop, sbY), sbW, Math.min(sbH, listBottom - sbY), 2); ctx.fill();
  }
}

// 主绘制入口：菜单画面 / 游戏画面（天空、地面、蛋糕、兔子、覆盖层）
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // ── 设置 ──
  if (gameState === STATE.SETTINGS) { drawSettings(); return; }

  // ── 菜单 ──
  if (gameState === STATE.MENU) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    skyGrad.addColorStop(0, '#1a1a2e');
    skyGrad.addColorStop(0.5, '#16213e');
    skyGrad.addColorStop(1, '#0f3460');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 装饰圆
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.beginPath(); ctx.arc(canvas.width*0.8, canvas.height*0.15, canvas.width*0.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(canvas.width*0.2, canvas.height*0.78, canvas.width*0.35, 0, Math.PI*2); ctx.fill();

    // 标题
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold ' + Math.round(canvas.width*0.1) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🐰 兔子躲蛋糕 🎂', canvas.width/2, canvas.height*0.14);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = Math.round(canvas.width*0.036) + 'px Arial';
    ctx.fillText('点击跳跃·躲避蛋糕·堆叠成山', canvas.width/2, canvas.height*0.21);

    // 按钮
    const bw = canvas.width * 0.7;
    const bh = canvas.height * 0.09;
    const startY = canvas.height * 0.28;
    const gap = canvas.height * 0.12;
    for (let i = 0; i < menuBtns.length; i++) {
      const bx = (canvas.width - bw) / 2;
      const by = startY + i * gap;
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill(); ctx.stroke();

      ctx.fillStyle = '#FFF';
      ctx.font = 'bold ' + Math.round(canvas.width*0.045) + 'px Arial';
      ctx.fillText(menuBtns[i].label, canvas.width/2, by + bh*0.38);
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.font = Math.round(canvas.width*0.03) + 'px Arial';
      ctx.fillText(menuBtns[i].desc, canvas.width/2, by + bh*0.72);
    }
    return;
  }

  // ── 游戏画面 ──
  // 画面抖动（被撞时）
  ctx.save();
  if (gameOver && (shakeX || shakeY)) {
    ctx.translate(shakeX, shakeY);
  }

  // 天空
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, '#87CEEB');
  skyGrad.addColorStop(0.55, '#B0E0E6');
  skyGrad.addColorStop(0.85, '#C1E8C1');
  skyGrad.addColorStop(1, '#90EE90');
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawClouds();

  // 山丘
  ctx.fillStyle = '#7CCD7C';
  ctx.beginPath();
  ctx.moveTo(0, canvas.height);
  for (let x = 0; x <= canvas.width; x += 3) {
    ctx.lineTo(x, canvas.height - 30 + Math.sin(x * 0.008) * 20 + Math.sin(x * 0.02) * 10);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.closePath();
  ctx.fill();

  // 地面
  const gnd = groundY + cameraOff;
  ctx.fillStyle = '#8B7355';
  ctx.fillRect(0, gnd, canvas.width, canvas.height - gnd + 10);
  ctx.fillStyle = '#7CCD7C';
  ctx.fillRect(0, gnd - 5, canvas.width, 8);

  // 蛋糕堆
  for (let i = 0; i < stack.length; i++) {
    drawCake(stack[i].cx, gnd - (i + 1) * CAKE_H, stack[i].color, stack[i].width);
  }

  // 送餐杆 + 餐盘（纯视觉，蛋糕堆叠后杆回收）
  if (rod) {
    const px = rod.side === 'right' ? canvas.width : 0;
    const py = (cake ? cake.y + CAKE_H : groundY) + cameraOff;
    const rw = (cake && cake.w) || CAKE_W;
    // 杆
    ctx.strokeStyle = '#A08070';
    ctx.lineWidth = Math.max(2.5, rw * 0.04);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(rod.x, py);
    ctx.stroke();
    // 餐盘
    ctx.fillStyle = '#D4C5B9';
    ctx.beginPath();
    ctx.ellipse(rod.x, py, rw * 0.55, CAKE_H * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#B0A090';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  // 滑行/等待中的蛋糕
  if (cake && cake.state !== 'done') {
    drawCake(cake.x, cake.y + cameraOff, cake.color, cake.w);
  }

  // 碎片（拟真模式切边）
  for (const d of debris) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, d.life);
    ctx.translate(d.x, d.y + cameraOff);
    ctx.rotate(d.rot);
    ctx.fillStyle = d.color.body;
    ctx.fillRect(-d.w/2, -CAKE_H*0.35, d.w, CAKE_H*0.7);
    ctx.fillStyle = d.color.icing;
    ctx.fillRect(-d.w/2, -CAKE_H*0.35, d.w, CAKE_H*0.14);
    ctx.restore();
  }

  // 兔子
  drawRabbit(rabbit.x, rabbit.y + RABBIT_H + cameraOff, gameOver && deathTimer > 0);

  ctx.restore();

  // 暂停菜单
  if (paused && !gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 标题
    ctx.fillStyle = '#FFF';
    ctx.font = 'bold ' + Math.round(canvas.width * 0.09) + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('暂停', canvas.width / 2, canvas.height * 0.24);

    // 按钮
    const bw = canvas.width * 0.58;
    const bh = canvas.height * 0.07;
    const gap = canvas.height * 0.095;
    const startY = canvas.height * 0.38;
    ctx.font = 'bold ' + Math.round(canvas.width * 0.043) + 'px Arial';
    for (let i = 0; i < PAUSE_BTNS.length; i++) {
      const bx = (canvas.width - bw) / 2;
      const by = startY + i * gap;
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#FFF';
      ctx.fillText(PAUSE_BTNS[i].label, canvas.width / 2, by + bh / 2);
    }
    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
  }

  // 游戏结束覆盖（不参与抖动）
  if (gameOver) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#FFF';
    const fs = Math.round(canvas.width * 0.12);
    ctx.font = 'bold ' + fs + 'px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('游戏结束', canvas.width / 2, canvas.height / 2 - canvas.height * 0.05);
    ctx.font = Math.round(canvas.width * 0.05) + 'px Arial';
    ctx.fillStyle = '#DDD';
    ctx.fillText('点击或按空格键重新开始', canvas.width / 2, canvas.height / 2 + canvas.height * 0.06);
    ctx.font = Math.round(canvas.width * 0.045) + 'px Arial';
    ctx.fillStyle = '#FFD700';
    ctx.fillText('堆了 ' + score + ' 层蛋糕', canvas.width / 2, canvas.height / 2 + canvas.height * 0.12);
  }
}

// ── 游戏循环 ──────────────────────────────
let lastTime = performance.now();

// 游戏主循环：每帧计算 dt 并驱动 update + draw
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

// ── 启动 ──────────────────────────────────
window.addEventListener('resize', resize);
buildMenu();
resize();
showGameUI(false);
requestAnimationFrame(loop);

// 尝试播放首页音乐（浏览器自动播放策略可能阻止，首次交互后恢复）
playMusic(MENU_MUSIC);
let _audioUnlocked = false;
document.addEventListener('click', function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  if (!currentMusic || currentMusic.paused) playMusic(MENU_MUSIC);
}, { once: false });
