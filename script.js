// ============================================================
//  Bunny vs Cake — script.js
//  基于 Bunny_vs_Cake_UI设计方案.md 全面重构 UI 视觉
//  游戏逻辑保持不变
// ============================================================

// ── 构建 DOM 结构 ────────────────────────────
(function setupDOM() {
  const vp = document.querySelector('meta[name="viewport"]');
  if (vp) vp.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';

  const canvas = document.getElementById('gameCanvas');
  const container = canvas.parentElement || document.getElementById('game-container');
  if (!container.querySelector('#pauseBtn')) {
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

    const adOverlay = document.createElement('div');
    adOverlay.id = 'ad-overlay';
    adOverlay.style.display = 'none';
    const adVideo = document.createElement('video');
    adVideo.id = 'ad-video';
    adVideo.playsInline = true;
    adVideo.setAttribute('webkit-playsinline', '');
    adOverlay.appendChild(adVideo);
    const adClose = document.createElement('button');
    adClose.id = 'ad-close';
    adClose.textContent = '✕';
    adOverlay.appendChild(adClose);
    container.appendChild(adOverlay);
  }
})();

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const pauseBtn = document.getElementById('pauseBtn');

document.getElementById('ad-close').addEventListener('click', (e) => {
  e.stopPropagation();
  hideAd();
});

document.getElementById('ad-video').addEventListener('click', () => {
  if (Date.now() < _adRedirectCooldown) return;
  const url = AD_LINKS[_currentAdSrc];
  if (url) {
    _adRedirectCooldown = Date.now() + 10000;
    window.open(url, '_blank');
  }
});

// ── 自定义字体（Canvas 内使用）────────────────
const UI_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans SC", sans-serif';
const NUM_FONT = '"SF Pro Display", "Segoe UI", "Roboto", sans-serif';

// ── roundRect polyfill ────────────────────────
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

// ── 缩放变量 ──────────────────────────────────
const REF_W = 390; // 设计稿参考宽度（9:16 比例下宽 390 → 高 693）

let RABBIT_W, RABBIT_H, CAKE_W, CAKE_H, GROUND_H;
let SLIDE_SPEED, JUMP_VELOCITY, GRAVITY;
let SPAWN_INTERVAL = 1.7;
let groundY;

// 蛋糕最高速度倍率（根据模式返回上限）
function cakeMaxSpeed() {
  return gameMode === MODE.REALISTIC ? 1.3 : 1.8;
}
// 蛋糕当前速度倍率（按堆叠层数递增）
function cakeSpeedMul() {
  if (stack.length < 5) return 1.0;
  return Math.min(cakeMaxSpeed(), 1.0 + (stack.length - 4) * 0.05);
}
// 蛋糕生成间隔（随速度递增而缩短）
function spawnInterval() {
  return Math.max(0.1, SPAWN_INTERVAL / cakeSpeedMul());
}

// ── 色彩方案（简洁风格）─────────────────────
const C = {
  // 背景层次
  BG_LIGHT:   '#F5F7FA',
  BG_WHITE:   '#F8F9FA',
  BG_GRAY:    '#E9ECEF',
  BG_DARKER:  '#DEE2E6',
  // 强调色（蛋糕交替）
  PINK_SOFT:  '#FFB6C1',
  BLUE_SOFT:  '#A7C7E7',
  GREEN_SOFT: '#C1E1C1',
  // 中性色
  WHITE:      '#FFFFFF',
  TEXT_DARK:  '#000000',
  TEXT_GRAY:  '#868E96',
  TEXT_LIGHT: '#ADB5BD',
  // 兔子
  RABBIT_WHITE: '#FFFFFF',
  RABBIT_SHADOW:'rgba(0,0,0,0.06)',
  RABBIT_EYE:   '#495057',
  RABBIT_NOSE:  '#FFB6C1',
  // 场景
  GROUND_LIGHT:  '#E9ECEF',
  GROUND_DARKER: '#DEE2E6',
  GRASS_LIGHT:   '#C1E1C1',
  // 毛玻璃面板
  GLASS_BG:     'rgba(255,255,255,0.45)',
  GLASS_BORDER: 'rgba(255,255,255,0.45)',
  GLASS_SHADOW: 'rgba(255,255,255,0.6)',
  // UI 按钮
  BTN_BG:     '#FFFFFF',
  BTN_TEXT:   '#495057',
  BTN_SHADOW: 'rgba(0,0,0,0.08)',
  // 兼容别名（旧代码中可能引用）
  ERROR: '#F44336',
  LIGHT_GRAY: '#ADB5BD',
};

// 蛋糕颜色：柔粉 / 浅蓝 / 淡绿 / 浅紫 / 浅橙 循环
const CAKE_COLORS = [
  { body: '#FFB6C1', icing: '#FFF0F3', accent: '#FF8FA3' },  // 柔粉
  { body: '#A7C7E7', icing: '#EDF3FA', accent: '#7DB8E0' },  // 浅蓝
  { body: '#C1E1C1', icing: '#EBF5EB', accent: '#9ED09E' },  // 淡绿
  { body: '#D5C6E0', icing: '#F5F0F8', accent: '#BDA8D0' },  // 浅紫
  { body: '#FAD4C4', icing: '#FEF3EE', accent: '#F5B8A0' },  // 浅橙
];
const HARD_CAKE_COLOR = { body: '#DEE2E6', icing: '#F1F3F5', accent: '#CED4DA' };

// 蛋糕造型类型（全部上下平底，可堆叠）— 20种
// 随机蛋糕造型（0–18）
function randomCakeType() {
  return Math.floor(Math.random() * 19);
}
// 每6层出现一次硬蛋糕（灰色不可切）
function isHardCake() {
  return gameMode === MODE.REALISTIC && stack.length % 6 === 5;
}

// ── 状态 ──────────────────────────────────────
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

const STATE = { MENU: 'menu', PLAYING: 'playing', SETTINGS: 'settings', SKIN: 'skin' };
const MODE = { ARCADE: 'arcade', REALISTIC: 'realistic' };
let gameState = STATE.MENU;
let gameMode = MODE.ARCADE;
let currentScene = 'start';
let menuBtns = [];
let _resultShown = false;
let _splashDone = false;

// ── 皮肤系统 ──────────────────────────────
const SKIN_LIST = ['character/皮肤1.png', 'character/皮肤2.png', 'character/皮肤3.png', 'character/皮肤4.png', 'character/角色5.png', 'character/角色6.png'];
let currentSkin = -1;          // -1 = 默认（无皮肤），-2 = 随机
let _randomSkinIdx = 0;        // 随机皮肤每次游戏锁定一个
let _skinQueue = [];           // 伪随机皮肤队列
const skinImages = [];         // 预加载图片对象

// 预加载皮肤图片
(function preloadSkins() {
  SKIN_LIST.forEach((src, i) => {
    const img = new Image();
    img.src = src;
    skinImages[i] = img;
  });
})();

// 读最高分（localStorage，按模式区分）
function getHighScore(mode) {
  const key = 'bunny_vs_cake_highscore_' + mode;
  return parseInt(localStorage.getItem(key)) || 0;
}
// 写最高分（localStorage，按模式区分）
function setHighScore(mode, value) {
  const key = 'bunny_vs_cake_highscore_' + mode;
  localStorage.setItem(key, value);
}

// ── 音频 ──────────────────────────────────────
const MENU_MUSIC = 'music/情绪回收站.mp3';
const GAME_MUSIC_POOL = [
  'music/有点甜.mp3', 'music/墓志铭 Epitaph .mp3',
  'music/再度和你 With You Once More.mp3', 'music/TruE.mp3',
  'music/云原神之歌.mp3', 'music/日冕 Coronal Radiance.mp3',
  'music/风吹月影的独步 .mp3', 'music/TIRED OF PROBLEMS (Explicit).mp3',
  'music/使一颗心免于哀伤.mp3',
  'music/在银河中孤独摇摆.mp3', 'music/希望有羽毛和翅膀.mp3',
  'music/野火 Wildfire.mp3',
  'music/Komorebi.mp3',
  'music/不眠之夜.mp3', 'music/天生鬼才.mp3', 'music/耀斑.mp3',
  'music/九张机.mp3', 'music/星辰大海.mp3', 'music/猜不透.mp3',
];
const ALL_MUSIC = [MENU_MUSIC, ...GAME_MUSIC_POOL];
const SFX_JUMP = 'effort/跳跃声.mp3';
const SFX_LAND = 'effort/落地声.mp3';
const SFX_HIT  = 'effort/撞击声.mp3';
let currentMusic = null;
let musicEnabled = true;
let musicVolume = 1.0;
let sfxVolume = 1.0;
let selectedGameMusic = -1;
let _gameOverCount = 0;
let _adShowing = false;
let _currentAdSrc = '';
let _adRedirectCooldown = 0;
let _adQueue = [];

// 伪随机取广告（Fisher-Yates 洗牌，每轮各播一次）
function _nextAd() {
  if (_adQueue.length === 0) {
    _adQueue = [...AD_POOL];
    for (let i = _adQueue.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [_adQueue[i], _adQueue[j]] = [_adQueue[j], _adQueue[i]];
    }
    if (_adQueue[0] === _currentAdSrc && _adQueue.length > 1) {
      const j = 1 + Math.floor(Math.random() * (_adQueue.length - 1));
      [_adQueue[0], _adQueue[j]] = [_adQueue[j], _adQueue[0]];
    }
  }
  return _adQueue.pop();
}

const AD_POOL = [
  'AD/swust宣传1.mp4', 'AD/swust宣传2.mp4', 'AD/三星堆介绍.mp4',
  'AD/云原神.mp4', 'AD/绵阳方特.mp4', 'AD/越王楼.mp4', 'AD/云星穹铁道.mp4',
];
const AD_LINKS = {
  'AD/swust宣传1.mp4': 'https://www.swust.edu.cn/',
  'AD/swust宣传2.mp4': 'https://www.swust.edu.cn/',
  'AD/三星堆介绍.mp4': 'https://www.sxd.cn/',
  'AD/云原神.mp4': 'https://ys.mihoyo.com/cloud/#/',
  'AD/绵阳方特.mp4': 'https://mianyang.fangte.com/oriental/HomePage',
  'AD/越王楼.mp4': 'https://baike.baidu.com/item/%E8%B6%8A%E7%8E%8B%E6%A5%BC/6833504',
  'AD/云星穹铁道.mp4': 'https://sr.mihoyo.com/cloud/?utm_share=1#/',
};

let _ambientMusicTime = 0;
let _ambientMusicSrc = MENU_MUSIC;
let _didPreview = false;
let _settingsFrom = 'menu';
let _draggingSlider = null;
let _sliderTimer = null;
let _songScroll = 0;
let _lastTouchY = 0;
let _touchStartX = 0;
let _touchStartY = 0;
let _touchInSongList = false;
let _skinScroll = 0;

// 保存当前音乐状态（进入设置前调用）
function saveAmbientMusic() {
  if (currentMusic) {
    _ambientMusicTime = currentMusic.currentTime;
    _ambientMusicSrc = decodeURI(currentMusic.src).replace(/^.*[\\/]/, '');
  }
  _didPreview = false;
  _songScroll = 0;
}
// 播放背景音乐（src=文件路径, onEnded=播完回调）
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
// 播放音效（受 sfxVolume 控制）
function playSfx(src) {
  const s = new Audio(encodeURI(src));
  s.volume = sfxVolume;
  s.play().catch(() => {});
}
// 停止当前音乐
function stopMusic() {
  if (currentMusic) {
    currentMusic.pause();
    currentMusic.currentTime = 0;
    currentMusic = null;
  }
}
// 播放游戏音乐（单曲循环或随机链式切歌）
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
    { label: '街机模式', mode: MODE.ARCADE, desc: '休闲轻松·宽容度高' },
    { label: '拟真模式', mode: MODE.REALISTIC, desc: '精准挑战·切边碎片' },
    { label: '设置', mode: null, desc: '音量·音效·音乐' },
    { label: '最高记录', mode: null,
      desc: '',
      getDesc: () => '街机 ' + getHighScore(MODE.ARCADE) + ' 层 · 拟真 ' + getHighScore(MODE.REALISTIC) + ' 层' },
  ];
}
// 更新最高分并刷新菜单显示
function updateHighScore() {
  const currentHigh = getHighScore(gameMode);
  if (score > currentHigh) {
    setHighScore(gameMode, score);
    updateStartHighDesc();
  }
}

// 自适应画布尺寸（读取容器实际渲染大小）
function resize() {
  const container = document.getElementById('game-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
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

// 随机生成4朵背景装饰云
function initClouds() {
  clouds = [];
  for (let i = 0; i < 4; i++) {
    clouds.push({
      x: Math.random() * canvas.width,
      y: 30 + Math.random() * canvas.height * 0.3,
      w: 60 + Math.random() * 70,
      h: 22 + Math.random() * 16,
      speed: 10 + Math.random() * 16,
    });
  }
}
// 每2次游戏结束弹出广告（伪随机洗牌）
function tryShowAd() {
  _gameOverCount++;
  if (_gameOverCount % 2 === 0) {
    const ov = document.getElementById('ad-overlay');
    const v = document.getElementById('ad-video');
    const btn = document.getElementById('ad-close');
    _currentAdSrc = _nextAd();
    v.src = _currentAdSrc;
    v.loop = true;
    ov.style.display = 'flex';
    _adShowing = true;
    if (currentMusic) currentMusic.pause();
    const corner = Math.floor(Math.random() * 4);
    btn.style.top = ''; btn.style.right = ''; btn.style.bottom = ''; btn.style.left = '';
    v.addEventListener('loadedmetadata', function posClose() {
      const ovr = ov.getBoundingClientRect();
      const vr = v.getBoundingClientRect();
      const rTop  = vr.top  - ovr.top;
      const rLeft = vr.left - ovr.left;
      const rBottom = ovr.bottom - vr.bottom;
      const rRight  = ovr.right  - vr.right;
      switch (corner) {
        case 0: btn.style.top  = (rTop  - 12) + 'px'; btn.style.right  = (rRight  - 8) + 'px'; break;
        case 1: btn.style.top  = (rTop  - 12) + 'px'; btn.style.left   = (rLeft   - 8) + 'px'; break;
        case 2: btn.style.bottom = (rBottom - 12) + 'px'; btn.style.right  = (rRight  - 8) + 'px'; break;
        case 3: btn.style.bottom = (rBottom - 12) + 'px'; btn.style.left   = (rLeft   - 8) + 'px'; break;
      }
    }, { once: true });
    v.play().catch(() => {});
  }
}

// 关闭广告弹窗，恢复音乐或显示结算页
function hideAd() {
  const v = document.getElementById('ad-video');
  v.pause();
  v.removeAttribute('src');
  v.load();
  document.getElementById('ad-overlay').style.display = 'none';
  _adShowing = false;
  if (gameOver && !_resultShown) {
    _resultShown = true;
    showResult(gameMode, score);
    if (currentMusic) currentMusic.play().catch(() => {});
  } else if (currentMusic) {
    currentMusic.play().catch(() => {});
  }
}

// 初始化/重置游戏状态（兔子、蛋糕堆、分数等）
function init() {
  // 随机皮肤：每次新游戏锁定一个
  // 随机皮肤：伪随机轮换（每轮各播一次）
  if (currentSkin === -2) {
    if (_skinQueue.length === 0) {
      _skinQueue = [...Array(SKIN_LIST.length).keys()];
      for (let i = _skinQueue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [_skinQueue[i], _skinQueue[j]] = [_skinQueue[j], _skinQueue[i]];
      }
      if (_skinQueue[0] === _randomSkinIdx && _skinQueue.length > 1) {
        [_skinQueue[0], _skinQueue[1]] = [_skinQueue[1], _skinQueue[0]];
      }
    }
    _randomSkinIdx = _skinQueue.pop();
  }
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
  _resultShown = false;
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

// 堆顶 Y 坐标
function stackTopY() {
  return groundY - stack.length * CAKE_H;
}
// 蛋糕堆叠：拟真切边/街机全宽，失败返回 false
function stackCake(cakeX, cakeW) {
  const prev = stack.length > 0 ? stack[stack.length - 1] : null;
  const cLeft = cakeX - cakeW / 2;
  const cRight = cakeX + cakeW / 2;

  if (gameMode === MODE.REALISTIC && prev && !cake.hard) {
    const pLeft = prev.cx - prev.width / 2;
    const pRight = prev.cx + prev.width / 2;
    const ovLeft = Math.max(cLeft, pLeft);
    const ovRight = Math.min(cRight, pRight);
    const ovW = ovRight - ovLeft;
    if (ovW <= 1) {
      gameOver = true;
      updatePauseBtn();
      updateHighScore();
      playSfx(SFX_HIT);
      setTimeout(() => tryShowAd(), 500);
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
    stack.push({ color: cake.color, cx: (ovLeft+ovRight)/2, width: ovW, cakeType: cake.cakeType });
  } else {
    if (prev) {
      const pLeft = prev.cx - prev.width / 2;
      const pRight = prev.cx + prev.width / 2;
      if (Math.min(cRight,pRight) - Math.max(cLeft,pLeft) <= 0) {
        gameOver = true;
        updatePauseBtn();
        updateHighScore();
        playSfx(SFX_HIT);
        setTimeout(() => tryShowAd(), 500);
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
    stack.push({ color: cake.color, cx: cakeX, width: cakeW, cakeType: cake.cakeType });
  }
  score++;
  scoreEl.textContent = score;
  playSfx(SFX_LAND);
  targetCam = Math.max(0, canvas.height * 0.55 - stackTopY());
  return true;
}

// ── 暂停按钮定义 ──────────────────────────────
const PAUSE_BTNS = [
  { label: '▶️ 继续游戏', action: 'resume' },
  { label: '🔄 重新开始', action: 'restart' },
  { label: '⚙️ 设置', action: 'settings' },
  { label: '🏠 返回主页', action: 'quit' },
];

// 切换暂停/恢复
function togglePause() {
  if (gameOver) return;
  paused = !paused;
  updatePauseBtn();
}
// 更新暂停按钮显示（游戏中/暂停/结束三种状态）
function updatePauseBtn() {
  if (gameState !== STATE.PLAYING) {
    pauseBtn.style.display = 'none';
    return;
  }
  if (gameOver) { pauseBtn.style.display = 'none'; return; }
  pauseBtn.style.display = paused ? 'none' : '';
  pauseBtn.textContent = '||';
}
// 显示/隐藏底部操作提示
function showHint(visible) {
  const hint = document.getElementById('hint-ui');
  if (hint) hint.style.opacity = visible ? '1' : '0';
}
// 切换 HTML 场景（start/game/result/splash）
function switchScene(sceneId) {
  document.querySelectorAll('.scene').forEach(s => s.classList.remove('active'));
  document.getElementById('scene-' + sceneId).classList.add('active');
  currentScene = sceneId;
}

// ── 启动画面流程 ──────────────────────────────
// 显示进度条 → 预加载媒体 → 标题→淡出→健康忠告→主菜单
function runSplashSequence() {
  const titleGrp = document.getElementById('splash-title-group');
  const healthGrp = document.getElementById('splash-health-group');
  const splashEl = document.getElementById('scene-splash');
  const startEl = document.getElementById('scene-start');
  const bar = document.getElementById('splash-progress-fill');

  // 收集需预加载的媒体：广告视频 + 音效 + 菜单音乐
  const toLoad = [...AD_POOL, SFX_JUMP, SFX_LAND, SFX_HIT, MENU_MUSIC];
  let loaded = 0;
  const total = toLoad.length;

  function updateBar() {
    loaded++;
    bar.style.width = Math.round((loaded / total) * 100) + '%';
    if (loaded >= total) {
      // 全部加载完成，开始正常的 splash 序列
      setTimeout(() => startTextSequence(), 300);
    }
  }

  toLoad.forEach(src => {
    if (/\.mp4$/i.test(src)) {
      // 视频：用 fetch 触发缓存下载
      fetch(encodeURI(src), { mode: 'cors' })
        .then(() => updateBar())
        .catch(() => updateBar()); // 失败也算完成，不卡进度
    } else {
      // 音频：用 Audio 预加载
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('canplaythrough', () => updateBar(), { once: true });
      a.addEventListener('error', () => updateBar(), { once: true });
      a.src = encodeURI(src);
      a.load();
    }
  });

  function startTextSequence() {
    // 2s 后标题文字淡出
  setTimeout(() => {
    titleGrp.style.opacity = '0';
    // 0.8s 后健康忠告淡入
    setTimeout(() => {
      healthGrp.style.opacity = '1';
      // 2.5s 后整体切到主菜单
      setTimeout(() => {
        _splashDone = true;
        startEl.classList.add('active');
        startEl.style.visibility = 'visible';
        startEl.style.opacity = '0';
        requestAnimationFrame(() => {
          splashEl.style.opacity = '0';
          startEl.style.opacity = '1';
          playMusic(MENU_MUSIC);
        });
        setTimeout(() => {
          splashEl.classList.remove('active'); splashEl.style.opacity = '';
          startEl.style.opacity = ''; startEl.style.visibility = '';
        }, 500);
      }, 2500);
    }, 800);
  }, 2000);
  }
}

// ── 开始菜单按钮事件（HTML）───────────────────
// 绑定主菜单按钮事件（click + touchend）
function initStartButtons() {
  const btns = document.getElementById('start-buttons');
  btns.addEventListener('click', function(e) {
    if (!_splashDone) return;
    const btn = e.target.closest('.start-btn');
    if (!btn) return;
    handleStartAction(btn.dataset.action);
  });
  btns.addEventListener('touchend', function(e) {
    if (!_splashDone) return;
    const btn = e.target.closest('.start-btn');
    if (!btn) return;
    e.preventDefault();
    handleStartAction(btn.dataset.action);
  });
}
// 处理主菜单按钮点击（arcade/realistic/settings/skin）
function handleStartAction(action) {
  if (action === 'arcade') {
    gameMode = MODE.ARCADE;
    init();
    gameState = STATE.PLAYING;
    showGameUI(true);
    switchScene('game');
    playGameMusic();
  } else if (action === 'realistic') {
    gameMode = MODE.REALISTIC;
    init();
    gameState = STATE.PLAYING;
    showGameUI(true);
    switchScene('game');
    playGameMusic();
  } else if (action === 'settings') {
    _settingsFrom = 'menu';
    saveAmbientMusic();
    gameState = STATE.SETTINGS;
    showGameUI(false);
    switchScene('game');
    resize();
  } else if (action === 'skin') {
    gameState = STATE.SKIN;
    _skinScroll = 0;
    showGameUI(false);
    switchScene('game');
    resize();
  }
}

// ── 更新开始页高分描述 ────────────────────────
function updateStartHighDesc() {
  const desc = document.getElementById('start-high-desc');
  if (desc) desc.textContent = '街机 ' + getHighScore(MODE.ARCADE) + ' 层 · 拟真 ' + getHighScore(MODE.REALISTIC) + ' 层';
}

pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (gameState === STATE.SETTINGS || gameState === STATE.SKIN) { goToMenu(); return; }
  if (gameOver) return;
  togglePause();
});

// 切换游戏中 UI（分数、提示）显隐
function showGameUI(v) {
  const d = v ? '' : 'none';
  document.getElementById('score-ui').style.display = d;
  document.getElementById('hint-ui').style.display = d;
  updatePauseBtn();
}

// ── 菜单点击 ─────────────────────────────────
function handleMenuClick(cx, cy) {
  const bw = canvas.width * 0.72;
  const bh = canvas.height * 0.08;
  const startY = canvas.height * 0.30;
  const gap = canvas.height * 0.11;
  for (let i = 0; i < menuBtns.length; i++) {
    const bx = (canvas.width - bw) / 2;
    const by = startY + i * gap;
    if (cx >= bx && cx <= bx + bw && cy >= by && cy <= by + bh) {
      if (menuBtns[i].mode) {
        gameMode = menuBtns[i].mode;
        init();
        gameState = STATE.PLAYING;
        showGameUI(true);
        switchScene('game');
        playGameMusic();
      } else if (i === 2) {
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

// 检测暂停菜单按钮点击
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

// 检测游戏结束按钮点击
function handleGameOverClick(cx, cy) {
  const bw = canvas.width * 0.50;
  const bh = canvas.height * 0.06;
  const gap = canvas.height * 0.04;
  const bx = canvas.width / 2 - bw / 2;
  const by1 = canvas.height * 0.48;
  const by2 = by1 + bh + gap;
  if (cx >= bx && cx <= bx + bw && cy >= by1 && cy <= by1 + bh) { init(); return true; }
  if (cx >= bx && cx <= bx + bw && cy >= by2 && cy <= by2 + bh) { goToMenu(); return true; }
  return false;
}

// 检测皮肤选择界面点击
function handleSkinClick(cx, cy) {
  // 返回按钮
  if (cx >= 12 && cx <= 64 && cy >= Math.max(14, 8) && cy <= Math.max(14, 8) + 34) {
    gameState = STATE.MENU;
    showGameUI(false);
    switchScene('start');
    return true;
  }

  // 皮肤网格点击
  const cols = 2;
  const margin = canvas.width * 0.10;
  const gap = canvas.width * 0.05;
  const cellW = (canvas.width - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = cellW * 1.2;
  const startY = canvas.height * 0.20 - _skinScroll;
  const items = [-2, -1, ...SKIN_LIST.map((_, i) => i)];

  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx2 = margin + col * (cellW + gap);
    const cy2 = startY + row * (cellH + gap);
    if (cx >= cx2 && cx <= cx2 + cellW && cy >= cy2 && cy <= cy2 + cellH) {
      currentSkin = items[i];
      return true;
    }
  }
  return false;
}

// 检测设置界面点击
function handleSettingsClick(cx, cy) {
  if (cx >= 12 && cx <= 64 && cy >= Math.max(14, 8) && cy <= Math.max(14, 8) + 34) {
    if (_settingsFrom === 'pause') {
      if (_didPreview) { _didPreview = false; playGameMusic(); }
      gameState = STATE.PLAYING; showGameUI(true);
    } else { goToMenu(); }
    return true;
  }

  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const sh = 30;

  const s1y = canvas.height * 0.24 + canvas.height * 0.06;
  if (cy >= s1y - sh / 2 && cy <= s1y + sh / 2 && cx >= lx - 10 && cx <= lx + sw + 10) {
    musicVolume = Math.max(0, Math.min(1, (cx - lx) / sw));
    applyMusicVolume();
    clearTimeout(_sliderTimer);
    _sliderTimer = setTimeout(() => { _draggingSlider = 'music'; }, 250);
    return true;
  }

  const s2y = canvas.height * 0.38 + canvas.height * 0.06;
  if (cy >= s2y - sh / 2 && cy <= s2y + sh / 2 && cx >= lx - 10 && cx <= lx + sw + 10) {
    sfxVolume = Math.max(0, Math.min(1, (cx - lx) / sw));
    clearTimeout(_sliderTimer);
    _sliderTimer = setTimeout(() => { _draggingSlider = 'sfx'; }, 250);
    return true;
  }

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
        if (i >= 0) { _didPreview = true; playMusic(ALL_MUSIC[i]); }
        else { _didPreview = false; playMusic(_ambientMusicSrc); if (currentMusic) currentMusic.currentTime = _ambientMusicTime; }
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

// 根据 X 坐标更新拖拽中滑块值
function updateSliderDrag(sx) {
  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const val = Math.max(0, Math.min(1, (sx - lx) / sw));
  if (_draggingSlider === 'music') { musicVolume = val; applyMusicVolume(); }
  else if (_draggingSlider === 'sfx') { sfxVolume = val; }
}

// ── 触摸滚动 / 拖拽 ──────────────────────────
canvas.addEventListener('touchmove', (e) => {
  if (gameState === STATE.SKIN) {
    const pos = canvasPos(e);
    const dy = _lastTouchY - pos.y;
    _lastTouchY = pos.y;
    const cols = 2; const gap = canvas.width * 0.05;
    const cellW = (canvas.width - canvas.width * 0.10 * 2 - gap * (cols - 1)) / cols;
    const cellH = cellW * 1.2;
    const items = [-2, -1, ...SKIN_LIST.map((_, i) => i)];
    const listTop = canvas.height * 0.20;
    const listBottom = canvas.height * 0.94;
    const totalRows = Math.ceil(items.length / cols);
    const maxScroll = Math.max(0, totalRows * (cellH + gap) - (listBottom - listTop));
    _skinScroll = Math.max(0, Math.min(maxScroll, _skinScroll + dy));
    if (Math.abs(dy) > 2) e.preventDefault();
    return;
  }
  if (gameState !== STATE.SETTINGS) return;
  if (_draggingSlider) { e.preventDefault(); updateSliderDrag(canvasPos(e).x); return; }
  const pos = canvasPos(e);
  const dy = _lastTouchY - pos.y;
  _lastTouchY = pos.y;
  const listTop = canvas.height * 0.50 + canvas.height * 0.058;
  const listBottom = canvas.height * 0.94;
  const totalItems = ALL_MUSIC.length + 1;
  const igap = canvas.height * 0.064;
  const maxScroll = Math.max(0, totalItems * igap - (listBottom - listTop));
  _songScroll = Math.max(0, Math.min(maxScroll, _songScroll + dy));
  if (Math.abs(dy) > 2) e.preventDefault();
});
document.addEventListener('mousemove', (e) => {
  if (gameState !== STATE.SETTINGS || !_draggingSlider) return;
  updateSliderDrag(canvasPos(e).x);
});
canvas.addEventListener('wheel', (e) => {
  if (gameState === STATE.SKIN) {
    const cols = 2; const gap = canvas.width * 0.05;
    const cellW = (canvas.width - canvas.width * 0.10 * 2 - gap * (cols - 1)) / cols;
    const cellH = cellW * 1.2;
    const items = [-2, -1, ...SKIN_LIST.map((_, i) => i)];
    const listTop = canvas.height * 0.20;
    const listBottom = canvas.height * 0.94;
    const totalRows = Math.ceil(items.length / cols);
    const maxScroll = Math.max(0, totalRows * (cellH + gap) - (listBottom - listTop));
    _skinScroll = Math.max(0, Math.min(maxScroll, _skinScroll + e.deltaY));
    return;
  }
  if (gameState !== STATE.SETTINGS) return;
  const listTop = canvas.height * 0.50 + canvas.height * 0.058;
  const listBottom = canvas.height * 0.94;
  const pos = canvasPos(e);
  if (pos.y >= listTop - 10 && pos.y <= listBottom + 10) {
    e.preventDefault();
    const totalItems = ALL_MUSIC.length + 1;
    const igap = canvas.height * 0.064;
    const maxScroll = Math.max(0, totalItems * igap - (listBottom - listTop));
    _songScroll = Math.max(0, Math.min(maxScroll, _songScroll + e.deltaY));
  }
});

// 结束滑块拖拽
function endSliderDrag() { clearTimeout(_sliderTimer); _draggingSlider = null; }
document.addEventListener('touchend', (e) => {
  if (_touchInSongList && gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    const ex = (e.changedTouches[0].clientX - rect.left) * (canvas.width / rect.width);
    const ey = (e.changedTouches[0].clientY - rect.top) * (canvas.height / rect.height);
    if (Math.abs(ex - _touchStartX) < 10 && Math.abs(ey - _touchStartY) < 10)
      handleSettingsClick(_touchStartX, _touchStartY);
    _touchInSongList = false;
  }
  endSliderDrag();
});
document.addEventListener('mouseup', endSliderDrag);
document.addEventListener('touchcancel', endSliderDrag);

// 返回主菜单
function goToMenu() {
  if (gameState === STATE.SETTINGS) {
    if (_didPreview) { _didPreview = false; playMusic(_ambientMusicSrc); if (currentMusic) currentMusic.currentTime = _ambientMusicTime; }
  }
  gameState = STATE.MENU; showGameUI(false);
  switchScene('start');
  // 已在播菜单音乐则不再重启
  if (currentMusic && decodeURI(currentMusic.src).replace(/^.*[\\/]/, '') === MENU_MUSIC.replace(/^music\//, '')) return;
  playMusic(MENU_MUSIC);
}

// 兔子跳跃（站立时起跳/死亡重开/暂停恢复）
function jump() {
  if (gameState === STATE.MENU || gameState === STATE.SETTINGS) return;
  if (gameOver) { init(); return; }
  if (paused) { togglePause(); return; }
  if (rabbit.onGround) { rabbit.vy = -JUMP_VELOCITY; rabbit.onGround = false; showHint(false); playSfx(SFX_JUMP); }
}

// ── 事件处理 ──────────────────────────────────
canvas.addEventListener('click', (e) => {
  e.preventDefault();
  if (!_splashDone) return;
  if (gameState === STATE.SKIN) {
    const rect = canvas.getBoundingClientRect();
    handleSkinClick((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  if (gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    handleSettingsClick((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  if (gameState === STATE.MENU) {
    const rect = canvas.getBoundingClientRect();
    handleMenuClick((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  if (gameOver && !_adShowing) {
    if (!_resultShown) {
      _resultShown = true;
      showResult(gameMode, score);
    }
    return;
  }
  if (paused && !gameOver) {
    const rect = canvas.getBoundingClientRect();
    handlePauseMenuClick((e.clientX - rect.left) * (canvas.width / rect.width), (e.clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  jump();
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    if (gameState === STATE.MENU || gameState === STATE.SETTINGS) return;
    if (e.code === 'Space' && (paused || gameOver)) {
      if (gameOver && !_adShowing && !_resultShown) {
        _resultShown = true;
        showResult(gameMode, score);
      }
      else if (paused) togglePause();
      return;
    }
    jump();
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (gameState === STATE.SKIN) { goToMenu(); return; }
    if (gameState === STATE.SETTINGS) {
      if (_settingsFrom === 'pause') { if (_didPreview) { _didPreview = false; playGameMusic(); } gameState = STATE.PLAYING; showGameUI(true); }
      else goToMenu();
      return;
    }
    if (gameState === STATE.MENU) return;
    togglePause();
  }
});

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  if (!_splashDone) return;
  if (gameState === STATE.SKIN) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    _lastTouchY = sy;
    _touchInSongList = false;
    handleSkinClick(sx, sy);
    return;
  }
  if (gameState === STATE.SETTINGS) {
    const rect = canvas.getBoundingClientRect();
    const sx = (e.touches[0].clientX - rect.left) * (canvas.width / rect.width);
    const sy = (e.touches[0].clientY - rect.top) * (canvas.height / rect.height);
    _lastTouchY = sy;
    const listTop = canvas.height * 0.50 + canvas.height * 0.058;
    const listBottom = canvas.height * 0.94;
    const ix = canvas.width * 0.08;
    const iw = canvas.width * 0.84;
    if (sy >= listTop && sy <= listBottom && sx >= ix && sx <= ix + iw) {
      _touchInSongList = true; _touchStartX = sx; _touchStartY = sy;
    } else {
      _touchInSongList = false;
      handleSettingsClick(sx, sy);
    }
    return;
  }
  if (gameState === STATE.MENU) {
    const rect = canvas.getBoundingClientRect();
    handleMenuClick((e.touches[0].clientX - rect.left) * (canvas.width / rect.width), (e.touches[0].clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  if (gameOver && !_adShowing) {
    if (!_resultShown) {
      _resultShown = true;
      showResult(gameMode, score);
    }
    return;
  }
  if (paused && !gameOver) {
    const rect = canvas.getBoundingClientRect();
    handlePauseMenuClick((e.touches[0].clientX - rect.left) * (canvas.width / rect.width), (e.touches[0].clientY - rect.top) * (canvas.height / rect.height));
    return;
  }
  jump();
});

// ── 生成蛋糕 ──────────────────────────────────
function spawnCake() {
  const fromRight = lastSpawnSide === null
    ? Math.random() < 0.5
    : lastSpawnSide === 'left';
  lastSpawnSide = fromRight ? 'right' : 'left';

  const cy = stackTopY() - CAKE_H * 1.8;
  const isHard = isHardCake();
  const c = isHard ? HARD_CAKE_COLOR : CAKE_COLORS[stack.length % 2]; // 橙红/金黄交替

  let cakeW = CAKE_W;
  if (!isHard && gameMode === MODE.REALISTIC && stack.length > 0) {
    cakeW = Math.max(CAKE_W * 0.25, stack[stack.length - 1].width);
  }

  let sm = cakeSpeedMul();
  if (sm >= cakeMaxSpeed()) {
    sm = Math.round((0.8 + Math.random() * (sm - 0.8)) * 100) / 100;
  }

  cake = {
    x: fromRight ? canvas.width + 60 : -60, y: cy, fromRight, color: c,
    state: 'sliding', w: cakeW, speedMul: sm, hard: isHard, cakeType: randomCakeType(),
  };
  rod = { x: cake.x, side: fromRight ? 'right' : 'left', state: 'out' };
}

// ── 更新逻辑 ──────────────────────────────────
function update(dt) {
  if (gameState === STATE.MENU || gameState === STATE.SETTINGS || gameState === STATE.SKIN) return;
  if (paused) return;
  dt = Math.min(dt, 0.05);

  if (gameOver) {
    shakeX = -shakeX * 0.72;
    shakeY = -shakeY * 0.72;
    if (Math.abs(shakeX) < 0.3) { shakeX = 0; shakeY = 0; }
    deathTimer -= dt;
    if (rabbit) {
      rabbit.vy += GRAVITY * dt;
      rabbit.y += rabbit.vy * dt;
      rabbit.x += (rabbit.vx || 0) * dt;
      if (rabbit.y >= groundY - RABBIT_H) { rabbit.y = groundY - RABBIT_H; rabbit.vy = 0; rabbit.vx = 0; }
    }
    if (rod && rod.state === 'retracting') {
      const edge = rod.side === 'left' ? -40 : canvas.width + 40;
      rod.x += (edge - rod.x) * 8 * dt;
      if (Math.abs(rod.x - edge) < 2) rod = null;
    }
    for (const d of debris) { d.vy += GRAVITY * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vx * dt * 0.03; d.life -= dt * 0.7; }
    debris = debris.filter(d => d.life > 0);
    if (deathTimer <= 0 && !_resultShown && !_adShowing) {
      _resultShown = true;
      showResult(gameMode, score);
    }
    return;
  }

  const st = stackTopY();
  if (!rabbit.onGround) {
    rabbit.vy += GRAVITY * dt;
    rabbit.y += rabbit.vy * dt;
    if (rabbit.y >= st - RABBIT_H) { rabbit.y = st - RABBIT_H; rabbit.vy = 0; rabbit.onGround = true; }
  } else { rabbit.y = st - RABBIT_H; }

  if (!cake || cake.state === 'done') {
    spawnTimer -= dt;
    if (spawnTimer <= 0) { spawnCake(); spawnTimer = spawnInterval(); }
  }

  if (cake && cake.state === 'sliding') {
    cake.x += (cake.fromRight ? -1 : 1) * SLIDE_SPEED * cake.speedMul * dt;
    const cw = cake.w || CAKE_W;
    const cLeft = cake.x - cw / 2;
    const cRight = cake.x + cw / 2;
    const rLeft = rabbit.x - RABBIT_W / 2;
    const rRight = rabbit.x + RABBIT_W / 2;
    const hOverlap = cLeft < rRight && cRight > rLeft;
    const rabbitBottom = rabbit.y + RABBIT_H;
    const colTop = cake.y + CAKE_H * 0.15;
    const colBottom = cake.y + CAKE_H;

    if (hOverlap) {
      if (!rabbit.onGround && rabbitBottom >= colTop - 3 && rabbitBottom <= colTop + CAKE_H * 0.2) {
        if (!stackCake(cake.x, cw)) return;
      } else if (rabbit.onGround || rabbitBottom > colTop + CAKE_H * 0.4) {
        gameOver = true; updatePauseBtn(); updateHighScore(); playSfx(SFX_HIT); setTimeout(() => tryShowAd(), 500);
        shakeX = 14; shakeY = 8; deathTimer = 0.8;
        rabbit.vy = -420; rabbit.vx = (cake.fromRight ? -1 : 1) * 220; rabbit.onGround = false;
        return;
      }
    }

    const offScreen = cake.fromRight
      ? cake.x < rabbit.x - RABBIT_W/2 - cw
      : cake.x > rabbit.x + RABBIT_W/2 + cw;
    if (offScreen) { cake = null; rod = null; }
  }

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

  for (const d of debris) { d.vy += GRAVITY * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vx * dt * 0.03; d.life -= dt * 0.7; }
  debris = debris.filter(d => d.life > 0);

  for (const c of clouds) { c.x -= c.speed * dt; if (c.x + c.w < -20) c.x = canvas.width + 20; }
  cameraOff += (targetCam - cameraOff) * 0.08;
}

// ================================================================
//  绘制函数（按设计方案全面重构）
// ================================================================

// ── 云朵（简洁风格）───────────────────────────
function drawClouds() {
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (const cld of clouds) {
    ctx.beginPath(); ctx.ellipse(cld.x, cld.y, cld.w * 0.5, cld.h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cld.x - cld.w * 0.22, cld.y + 6, cld.w * 0.28, cld.h * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cld.x + cld.w * 0.25, cld.y + 3, cld.w * 0.3, cld.h * 0.33, 0, 0, Math.PI * 2); ctx.fill();
  }
}

// ── 兔子（极简纯白）───────────────────────────
function drawRabbit(x, sy, dying) {
  const top = sy - RABBIT_H;
  const bot = sy;
  const mid = sy - RABBIT_H * 0.5;
  ctx.save();

  if (dying) { ctx.translate(x, mid); ctx.rotate(deathTimer * 6); ctx.translate(-x, -mid); }

  let scx = 1, scy = 1;
  if (!rabbit.onGround && !dying) { scy = 1.1; scx = 0.93; }
  ctx.translate(x, mid); ctx.scale(scx, scy); ctx.translate(-x, -mid);

  // 皮肤渲染（使用图片替代几何兔子）
  if (currentSkin >= 0 && skinImages[currentSkin] && skinImages[currentSkin].complete) {
    const skin = skinImages[currentSkin];
    const w = skin.naturalWidth; const h = skin.naturalHeight;
    ctx.drawImage(skin, x - w / 2, sy - h, w, h);
    ctx.restore(); return;
  }
  // 随机皮肤（每局锁定一张）
  if (currentSkin === -2 && skinImages[_randomSkinIdx] && skinImages[_randomSkinIdx].complete) {
    const skin = skinImages[_randomSkinIdx];
    const w = skin.naturalWidth; const h = skin.naturalHeight;
    ctx.drawImage(skin, x - w / 2, sy - h, w, h);
    ctx.restore(); return;
  }

  // 阴影（极轻）
  ctx.fillStyle = C.RABBIT_SHADOW;
  ctx.beginPath(); ctx.ellipse(x, bot, RABBIT_W * 0.28, RABBIT_H * 0.03, 0, 0, Math.PI * 2); ctx.fill();

  // 尾巴
  ctx.fillStyle = C.RABBIT_WHITE;
  ctx.beginPath(); ctx.arc(x + RABBIT_W * 0.30, mid + RABBIT_H * 0.06, RABBIT_W * 0.10, 0, Math.PI * 2); ctx.fill();

  // 身体（纯白椭圆）
  ctx.fillStyle = C.RABBIT_WHITE;
  ctx.beginPath(); ctx.ellipse(x, mid + RABBIT_H * 0.10, RABBIT_W * 0.34, RABBIT_H * 0.20, 0, 0, Math.PI * 2); ctx.fill();

  // 头部（纯白圆）
  const headY = top + RABBIT_H * 0.34;
  ctx.fillStyle = C.RABBIT_WHITE;
  ctx.beginPath(); ctx.arc(x, headY, RABBIT_W * 0.28, 0, Math.PI * 2); ctx.fill();

  // 耳朵（纯白，无内耳细节）
  ctx.fillStyle = C.RABBIT_WHITE;
  ctx.beginPath(); ctx.ellipse(x - RABBIT_W * 0.12, top + RABBIT_H * 0.11, RABBIT_W * 0.08, RABBIT_H * 0.11, -0.08, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + RABBIT_W * 0.12, top + RABBIT_H * 0.12, RABBIT_W * 0.08, RABBIT_H * 0.11, 0.08, 0, Math.PI * 2); ctx.fill();

  // 眼睛（小黑点）
  ctx.fillStyle = C.RABBIT_EYE;
  ctx.beginPath(); ctx.arc(x - RABBIT_W * 0.09, headY - RABBIT_H * 0.04, RABBIT_W * 0.045, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + RABBIT_W * 0.09, headY - RABBIT_H * 0.04, RABBIT_W * 0.045, 0, Math.PI * 2); ctx.fill();

  // 鼻子（小粉点）
  ctx.fillStyle = C.RABBIT_NOSE;
  ctx.beginPath(); ctx.arc(x, headY + RABBIT_H * 0.04, RABBIT_W * 0.04, 0, Math.PI * 2); ctx.fill();

  // 前腿（纯白小椭圆）
  ctx.fillStyle = C.RABBIT_WHITE;
  ctx.beginPath(); ctx.ellipse(x - RABBIT_W * 0.16, bot - RABBIT_H * 0.05, RABBIT_W * 0.12, RABBIT_H * 0.05, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + RABBIT_W * 0.16, bot - RABBIT_H * 0.05, RABBIT_W * 0.12, RABBIT_H * 0.05, 0, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ── 蛋糕（极简风格）────────────────────────
function drawCake(x, cy, color, w, cakeType) {
  const W = w !== undefined ? w : CAKE_W;
  const type = cakeType !== undefined ? cakeType : 0;
  const cx = x - W / 2;
  ctx.save();

  switch(type) {

    case 0: // 双层蛋糕 - 两层+奶油夹心+草莓
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.42, W-4, CAKE_H*0.53, 3); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(cx+2, cy+CAKE_H*0.38, W-4, CAKE_H*0.06);
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+8, cy+CAKE_H*0.05, W-16, CAKE_H*0.31, 3); ctx.fill();
      ctx.fillStyle = color.accent;
      ctx.beginPath(); ctx.arc(x, cy-CAKE_H*0.03, W*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#A8D8A8';
      ctx.beginPath(); ctx.arc(x-W*0.025, cy-CAKE_H*0.08, W*0.028, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+W*0.025, cy-CAKE_H*0.08, W*0.028, 0, Math.PI*2); ctx.fill();
      break;

    case 1: // 宽矮糖粒 - 矩形+糖霜+三色糖粒
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.16, W-1, CAKE_H*0.79, W*0.10); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.03, W-6, CAKE_H*0.18, 3); ctx.fill();
      ctx.fillStyle = '#FF6B8A';
      ctx.beginPath(); ctx.arc(cx+W*0.22, cy+CAKE_H*0.09, W*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#FFD93D';
      ctx.beginPath(); ctx.arc(cx+W*0.50, cy+CAKE_H*0.09, W*0.05, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#6BCB77';
      ctx.beginPath(); ctx.arc(cx+W*0.78, cy+CAKE_H*0.09, W*0.05, 0, Math.PI*2); ctx.fill();
      break;

    case 2: // 高窄奶油 - 矩形+奶油花+蓝莓
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.10, W-1, CAKE_H*0.85, W*0.10); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+4, cy+CAKE_H*0.02, W-8, CAKE_H*0.14, 3); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.arc(x, cy+CAKE_H*0.07, W*0.11, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x-W*0.08, cy+CAKE_H*0.05, W*0.07, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x+W*0.08, cy+CAKE_H*0.05, W*0.07, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#5B7DB1';
      ctx.beginPath(); ctx.arc(x, cy-CAKE_H*0.04, W*0.06, 0, Math.PI*2); ctx.fill();
      break;

    case 3: // 奶油波浪 - 波边+巧克力豆
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.89, W*0.08); ctx.fill();
      ctx.fillStyle = color.icing;
      for (let wi=0; wi<3; wi++) {
        ctx.beginPath(); ctx.arc(cx+2, cy+CAKE_H*(0.16+wi*0.28), W*0.09, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(cx+W-2, cy+CAKE_H*(0.16+wi*0.28), W*0.09, 0, Math.PI*2); ctx.fill();
      }
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.12, 2); ctx.fill();
      ctx.fillStyle = '#5D4037';
      ctx.beginPath(); ctx.arc(cx+W*0.20, cy+CAKE_H*0.06, W*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.40, cy+CAKE_H*0.05, W*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.60, cy+CAKE_H*0.07, W*0.04, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.78, cy+CAKE_H*0.04, W*0.04, 0, Math.PI*2); ctx.fill();
      break;

    case 4: // 甘纳许 - 巧克力滴落
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.90, W*0.08); ctx.fill();
      ctx.fillStyle = '#6D4C41';
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.12, 3); ctx.fill();
      const dripX = [0.14, 0.28, 0.42, 0.57, 0.72, 0.86];
      const dripH = [0.15, 0.22, 0.13, 0.20, 0.17, 0.14];
      for (let di=0; di<6; di++) {
        ctx.fillStyle = '#6D4C41';
        ctx.beginPath(); ctx.roundRect(cx+W*dripX[di]-2, cy+CAKE_H*0.07, 4, CAKE_H*dripH[di], 2); ctx.fill();
      }
      break;

    case 5: // 糖霜漩涡 - 厚糖霜+漩涡纹
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.22, W-1, CAKE_H*0.73, W*0.06); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.03, W-4, CAKE_H*0.24, 3); ctx.fill();
      ctx.strokeStyle = color.accent;
      ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(x, cy+CAKE_H*0.16, W*0.12, 0, Math.PI); ctx.stroke();
      ctx.beginPath(); ctx.arc(x-W*0.04, cy+CAKE_H*0.10, W*0.06, Math.PI, Math.PI*2); ctx.stroke();
      break;

    case 6: // 海绵 - 点状纹理
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.90, W*0.06); ctx.fill();
      ctx.fillStyle = lighten(color.body, 0.12);
      for (let dy=0.15; dy<0.90; dy+=0.20) {
        for (let dx=0.10; dx<0.94; dx+=0.18) {
          ctx.beginPath(); ctx.arc(cx+W*dx, cy+CAKE_H*dy, W*0.028, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.09, 2); ctx.fill();
      break;

    case 7: // 条纹 - 上下双色
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.02, W-1, CAKE_H*0.46, W*0.06); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.52, W-1, CAKE_H*0.43, W*0.06); ctx.fill();
      ctx.fillStyle = color.accent;
      ctx.fillRect(cx+2, cy+CAKE_H*0.46, W-4, CAKE_H*0.06);
      ctx.fillRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.04);
      break;

    case 8: // 大理石 - 漩涡糖霜纹
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.10, W-1, CAKE_H*0.86, W*0.08); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.02, W-4, CAKE_H*0.16, 2); ctx.fill();
      ctx.strokeStyle = color.accent;
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(cx+W*0.18, cy+CAKE_H*0.10);
      ctx.quadraticCurveTo(cx+W*0.35, cy+CAKE_H*0.02, cx+W*0.52, cy+CAKE_H*0.08);
      ctx.quadraticCurveTo(cx+W*0.68, cy+CAKE_H*0.14, cx+W*0.82, cy+CAKE_H*0.06);
      ctx.stroke();
      break;

    case 9: // 丝绒 - 碎屑底边
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.88, W*0.06); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.11, 2); ctx.fill();
      ctx.fillStyle = color.accent;
      for (let di=0; di<8; di++) {
        ctx.beginPath();
        ctx.arc(cx+W*(0.08+di*0.12), cy+CAKE_H*0.92, W*0.045, 0, Math.PI*2);
        ctx.fill();
      }
      break;

    case 10: // 磅蛋糕 - 柠檬糖霜+柠檬屑
      ctx.fillStyle = '#FFF9C4';
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.88, W*0.08); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.01, W-4, CAKE_H*0.14, 2); ctx.fill();
      ctx.fillStyle = '#FFD54F';
      for (let zi=0; zi<7; zi++) {
        ctx.beginPath();
        ctx.arc(cx+W*(0.10+zi*0.13), cy+CAKE_H*0.06, W*0.028, 0, Math.PI*2);
        ctx.fill();
      }
      break;

    case 11: // 胡萝卜 - 核桃碎
      ctx.fillStyle = '#E8C97A';
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.88, W*0.06); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.roundRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.13, 2); ctx.fill();
      ctx.fillStyle = '#8D6E63';
      ctx.beginPath(); ctx.arc(cx+W*0.15, cy+CAKE_H*0.06, W*0.045, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.35, cy+CAKE_H*0.06, W*0.045, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.55, cy+CAKE_H*0.06, W*0.045, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(cx+W*0.75, cy+CAKE_H*0.06, W*0.045, 0, Math.PI*2); ctx.fill();
      break;

    case 12: // 芝士 - 格子纹理
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.88, W*0.06); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.01, W-4, CAKE_H*0.14, 2); ctx.fill();
      ctx.strokeStyle = color.accent;
      ctx.lineWidth = 0.7;
      for (let li=0; li<4; li++) {
        ctx.beginPath();
        ctx.moveTo(cx+W*0.10, cy+CAKE_H*(0.03+li*0.04));
        ctx.lineTo(cx+W*0.90, cy+CAKE_H*(0.03+li*0.04));
        ctx.stroke();
      }
      for (let li=0; li<4; li++) {
        ctx.beginPath();
        ctx.moveTo(cx+W*(0.20+li*0.23), cy+CAKE_H*0.03);
        ctx.lineTo(cx+W*(0.20+li*0.23), cy+CAKE_H*0.14);
        ctx.stroke();
      }
      break;

    case 13: // 摩卡 - 咖啡豆+可可粉
      ctx.fillStyle = '#A1887F';
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.88, W*0.08); ctx.fill();
      ctx.fillStyle = 'rgba(93,64,55,0.45)';
      ctx.fillRect(cx+3, cy+CAKE_H*0.01, W-6, CAKE_H*0.10);
      ctx.fillStyle = '#4E342E';
      ctx.beginPath(); ctx.ellipse(x-W*0.07, cy+CAKE_H*0.06, W*0.065, W*0.04, 0.3, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.ellipse(x+W*0.07, cy+CAKE_H*0.06, W*0.065, W*0.04, -0.3, 0, Math.PI*2); ctx.fill();
      break;

    case 14: // 蛋白霜 - 尖峰顶饰
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.12, W-1, CAKE_H*0.84, W*0.06); ctx.fill();
      ctx.fillStyle = color.icing;
      const peaks = [0.08, 0.24, 0.40, 0.56, 0.72, 0.88];
      for (const pk of peaks) {
        ctx.beginPath();
        ctx.moveTo(cx+W*(pk-0.04), cy+CAKE_H*0.12);
        ctx.quadraticCurveTo(cx+W*pk, cy-CAKE_H*0.04, cx+W*(pk+0.04), cy+CAKE_H*0.12);
        ctx.fill();
      }
      break;

    case 15: // 提拉米苏 - 可可粉+层次
      ctx.fillStyle = '#FFF9E6';
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.40, W*0.06); ctx.fill();
      ctx.fillStyle = '#8D6E63';
      ctx.fillRect(cx+2, cy+CAKE_H*0.44, W-4, CAKE_H*0.14);
      ctx.fillStyle = '#FFF9E6';
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.56, W-1, CAKE_H*0.36, W*0.06); ctx.fill();
      ctx.fillStyle = 'rgba(93,64,55,0.5)';
      ctx.fillRect(cx+3, cy+CAKE_H*0.02, W-6, CAKE_H*0.10);
      break;

    case 16: // 蛋糕卷 - 侧面螺旋纹理
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.06, W-1, CAKE_H*0.90, W*0.06); ctx.fill();
      ctx.strokeStyle = color.icing;
      ctx.lineWidth = 1.2;
      for (let si=0; si<3; si++) {
        ctx.beginPath();
        ctx.arc(x, cy+CAKE_H*(0.16+si*0.28), W*0.32, -0.50, 0.50);
        ctx.stroke();
      }
      ctx.fillStyle = color.icing;
      ctx.fillRect(cx+4, cy+CAKE_H*0.02, W-8, CAKE_H*0.07);
      break;

    case 17: // 迷你 - 彩色糖针
      ctx.fillStyle = color.body;
      ctx.beginPath(); ctx.roundRect(cx+0.5, cy+CAKE_H*0.10, W-1, CAKE_H*0.86, W*0.08); ctx.fill();
      ctx.fillStyle = color.icing;
      ctx.beginPath(); ctx.roundRect(cx+2, cy+CAKE_H*0.01, W-4, CAKE_H*0.14, 2); ctx.fill();
      const spkColors = ['#FF6B8A','#FFD93D','#6BCB77','#5B7DB1','#FF8A65','#CE93D8'];
      for (let sp=0; sp<12; sp++) {
        ctx.fillStyle = spkColors[sp%6];
        ctx.save();
        ctx.translate(cx+W*(0.06+sp*0.08), cy+CAKE_H*0.07);
        ctx.rotate(sp*0.6);
        ctx.fillRect(-W*0.028, -W*0.008, W*0.056, W*0.016);
        ctx.restore();
      }
      break;

    case 18: // 千层 - 三色分层
      ctx.fillStyle = color.body;
      ctx.fillRect(cx+1, cy+CAKE_H*0.03, W-2, CAKE_H*0.30);
      ctx.fillStyle = color.icing;
      ctx.fillRect(cx+1, cy+CAKE_H*0.34, W-2, CAKE_H*0.30);
      ctx.fillStyle = color.accent;
      ctx.fillRect(cx+1, cy+CAKE_H*0.65, W-2, CAKE_H*0.30);
      ctx.fillStyle = color.icing;
      ctx.fillRect(cx+3, cy+CAKE_H*0.02, W-6, CAKE_H*0.04);
      break;
  }

  ctx.restore();
}

// hex 颜色转 {r,g,b}
function hexToRgb(hex) {
  const v = parseInt(hex.slice(1), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}
// hex 颜色提亮
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  const cl = (c) => Math.max(0, Math.min(255, (c + (255 - c) * amt) | 0));
  return '#' + [cl(r), cl(g), cl(b)].map(c => c.toString(16).padStart(2, '0')).join('');
}

// ── 绘制滑块（简洁风格）───────────────────
function drawSlider(x, y, w, value) {
  const h = 6;
  const r = 12;
  ctx.fillStyle = 'rgba(0,0,0,0.08)';
  ctx.fillRect(x, y - h / 2, w, h);
  const fillW = w * value;
  ctx.fillStyle = C.BLUE_SOFT;
  ctx.fillRect(x, y - h / 2, fillW, h);
  ctx.fillStyle = C.WHITE;
  ctx.beginPath(); ctx.arc(x + fillW, y, r, 0, Math.PI * 2); ctx.fill();
}

// ── 绘制主菜单（简洁风格）──────────────────
function drawMenu() {
  // 背景（浅灰蓝渐变 + 毛玻璃）
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0,   C.BG_LIGHT);
  skyGrad.addColorStop(0.50, C.BG_WHITE);
  skyGrad.addColorStop(1,   C.BG_GRAY);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 大圆光晕（柔粉/浅蓝装饰）
  ctx.fillStyle = 'rgba(255,182,193,0.12)';
  ctx.beginPath(); ctx.arc(canvas.width * 0.8, canvas.height * 0.12, canvas.width * 0.50, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(167,199,231,0.10)';
  ctx.beginPath(); ctx.arc(canvas.width * 0.22, canvas.height * 0.75, canvas.width * 0.42, 0, Math.PI * 2); ctx.fill();

  // 游戏图标区
  ctx.font = Math.round(canvas.width * 0.16) + 'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('🐰🎂', canvas.width / 2, canvas.height * 0.11);

  // 英文标题
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.092) + 'px ' + UI_FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Bunny vs Cake', canvas.width / 2, canvas.height * 0.177);

  // 中文副标题
  ctx.fillStyle = C.TEXT_GRAY;
  ctx.font = Math.round(canvas.width * 0.048) + 'px ' + UI_FONT;
  ctx.fillText('兔子躲蛋糕', canvas.width / 2, canvas.height * 0.215);

  // 按钮（4 个，白色毛玻璃风格）
  const bw = canvas.width * 0.72;
  const bh = canvas.height * 0.08;
  const startY = canvas.height * 0.30;
  const gap = canvas.height * 0.11;

  for (let i = 0; i < menuBtns.length; i++) {
    const bx = (canvas.width - bw) / 2;
    const by = startY + i * gap;

    // 白色按钮 + 轻微阴影
    ctx.fillStyle = C.BTN_BG;
    ctx.shadowColor = C.BTN_SHADOW;
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    // 按钮边线
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 标签
    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = 'bold ' + Math.round(canvas.width * 0.048) + 'px ' + UI_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(menuBtns[i].label, canvas.width / 2, by + bh * 0.38);

    // 描述
    const desc = menuBtns[i].getDesc ? menuBtns[i].getDesc() : menuBtns[i].desc;
    ctx.fillStyle = C.TEXT_LIGHT;
    ctx.font = Math.round(canvas.width * 0.03) + 'px ' + UI_FONT;
    ctx.fillText(desc, canvas.width / 2, by + bh * 0.73);
  }

  // 版本号
  ctx.fillStyle = C.TEXT_LIGHT;
  ctx.font = Math.round(canvas.width * 0.028) + 'px ' + UI_FONT;
  ctx.textBaseline = 'bottom';
  ctx.fillText('v1.0.0', canvas.width / 2, canvas.height - 12);
  ctx.textBaseline = 'alphabetic';
}

// ── 绘制设置界面（简洁毛玻璃风格）─────────
function drawSettings() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0,   C.BG_LIGHT);
  skyGrad.addColorStop(0.50, C.BG_WHITE);
  skyGrad.addColorStop(1,   C.BG_GRAY);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 装饰光晕
  ctx.fillStyle = 'rgba(255,182,193,0.10)';
  ctx.beginPath(); ctx.arc(canvas.width * 0.8, canvas.height * 0.15, canvas.width * 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(167,199,231,0.08)';
  ctx.beginPath(); ctx.arc(canvas.width * 0.2, canvas.height * 0.78, canvas.width * 0.35, 0, Math.PI * 2); ctx.fill();

  // 返回按钮
  const topY = Math.max(14, 8);
  ctx.fillStyle = C.WHITE;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.shadowColor = C.BTN_SHADOW;
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1;
  ctx.beginPath(); ctx.roundRect(12, topY, 52, 34, 8); ctx.fill(); ctx.stroke();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.05) + 'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('←', 38, topY + 17);

  // 标题
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.075) + 'px ' + UI_FONT;
  ctx.textAlign = 'center';
  ctx.fillText('设置', canvas.width / 2, canvas.height * 0.11);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';

  const lx = canvas.width * 0.13;
  const sw = canvas.width * 0.52;
  const fs = Math.round(canvas.width * 0.041);

  // 音乐调节
  const s1y = canvas.height * 0.24;
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = fs + 'px ' + UI_FONT;
  ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
  ctx.fillText('音乐调节', lx, s1y);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(musicVolume * 100) + '%', lx + sw + 34, s1y);
  drawSlider(lx, s1y + canvas.height * 0.06, sw, musicVolume);

  // 音效调节
  const s2y = canvas.height * 0.38;
  ctx.fillStyle = C.TEXT_DARK;
  ctx.textAlign = 'start';
  ctx.fillText('音效调节', lx, s2y);
  ctx.textAlign = 'right';
  ctx.fillText(Math.round(sfxVolume * 100) + '%', lx + sw + 34, s2y);
  drawSlider(lx, s2y + canvas.height * 0.06, sw, sfxVolume);

  // 背景音乐标题
  const s3y = canvas.height * 0.50;
  ctx.fillStyle = C.TEXT_DARK;
  ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
  ctx.fillText('背景音乐', lx, s3y);

  const ibh = canvas.height * 0.054;
  const igap = canvas.height * 0.064;
  const ix = canvas.width * 0.08;
  const iw = canvas.width * 0.84;
  const istartY = s3y + canvas.height * 0.058;
  const listTop = istartY;
  const listBottom = canvas.height * 0.94;
  const totalItems = ALL_MUSIC.length + 1;
  const listHeight = totalItems * igap;
  const maxScroll = Math.max(0, listHeight - (listBottom - listTop));

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop - 4, canvas.width, listBottom - listTop + 8);
  ctx.clip();

  const labels = ['随机播放', ...ALL_MUSIC.map(f => f.replace(/^music\//, '').replace(/\.mp3$/i, '').replace(/^\S+\s*-\s*/, '').trim())];

  for (let i = -1; i < ALL_MUSIC.length; i++) {
    const idx = i + 1;
    const iy = istartY + idx * igap - _songScroll;
    if (iy + ibh < listTop || iy > listBottom) continue;
    const isSelected = (i === -1 && selectedGameMusic < 0) || (i >= 0 && selectedGameMusic === i);
    ctx.fillStyle = isSelected ? 'rgba(255,182,193,0.25)' : C.WHITE;
    ctx.strokeStyle = isSelected ? C.PINK_SOFT : 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect(ix, iy, iw, ibh, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = isSelected ? C.TEXT_DARK : C.TEXT_GRAY;
    ctx.font = fs + 'px ' + UI_FONT;
    ctx.textAlign = 'start'; ctx.textBaseline = 'middle';
    let label = labels[idx];
    const maxTextW = iw - 32 - (isSelected ? 24 : 0);
    while (ctx.measureText(label).width > maxTextW && label.length > 1) label = label.slice(0, -1);
    if (label !== labels[idx]) label = label.replace(/.{0,2}$/, '…');
    ctx.fillText(label, ix + 14, iy + ibh / 2);
    if (isSelected) {
      ctx.fillStyle = C.PINK_SOFT;
      ctx.font = 'bold ' + fs + 'px ' + UI_FONT;
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
    ctx.fillStyle = C.TEXT_LIGHT;
    ctx.beginPath(); ctx.roundRect(sbX, Math.max(listTop, sbY), sbW, Math.min(sbH, listBottom - sbY), 2); ctx.fill();
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ── 皮肤选择界面 ─────────────────────────────
function drawSkinSelection() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0,   C.BG_LIGHT);
  skyGrad.addColorStop(0.50, C.BG_WHITE);
  skyGrad.addColorStop(1,   C.BG_GRAY);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 返回按钮
  const topY = Math.max(14, 8);
  ctx.fillStyle = C.WHITE;
  ctx.strokeStyle = 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.roundRect(12, topY, 52, 34, 8); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.05) + 'px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('←', 38, topY + 17);

  // 标题
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.075) + 'px "PingFang SC","Microsoft YaHei",sans-serif';
  ctx.fillText('皮肤选择', canvas.width / 2, canvas.height * 0.11);

  // 皮肤网格（2列，可滚动）
  const cols = 2;
  const margin = canvas.width * 0.10;
  const gap = canvas.width * 0.05;
  const cellW = (canvas.width - margin * 2 - gap * (cols - 1)) / cols;
  const cellH = cellW * 1.2;
  const items = [-2, -1, ...SKIN_LIST.map((_, i) => i)];
  const totalRows = Math.ceil(items.length / cols);
  const listTop = canvas.height * 0.20;
  const listBottom = canvas.height * 0.94;
  const listHeight = totalRows * (cellH + gap);
  const maxScroll = Math.max(0, listHeight - (listBottom - listTop));

  // 裁剪区域
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, listTop - 4, canvas.width, listBottom - listTop + 8);
  ctx.clip();

  const startY = listTop - _skinScroll;
  const fs = Math.round(canvas.width * 0.038);

  for (let i = 0; i < items.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = margin + col * (cellW + gap);
    const cy = startY + row * (cellH + gap);
    if (cy + cellH < listTop || cy > listBottom) continue;
    const isSelected = currentSkin === items[i];

    // 卡片背景
    ctx.fillStyle = isSelected ? 'rgba(255,182,193,0.20)' : C.WHITE;
    ctx.strokeStyle = isSelected ? C.PINK_SOFT : 'rgba(0,0,0,0.10)';
    ctx.lineWidth = isSelected ? 2 : 1;
    ctx.beginPath(); ctx.roundRect(cx, cy, cellW, cellH, 12); ctx.fill(); ctx.stroke();

    // 预览图区域
    const imgPad = 8;
    const imgAreaW = cellW - imgPad * 2;
    const imgAreaH = cellH * 0.50;
    const imgX = cx + imgPad;
    const imgY = cy + imgPad;
    if (items[i] >= 0 && skinImages[items[i]] && skinImages[items[i]].complete) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(imgX, imgY, imgAreaW, imgAreaH);
      ctx.clip();
      const s = skinImages[items[i]];
      const sRatio = s.naturalWidth / s.naturalHeight;
      let drawW, drawH;
      if (sRatio > imgAreaW / imgAreaH) {
        drawW = imgAreaW; drawH = imgAreaW / sRatio;
      } else {
        drawH = imgAreaH; drawW = imgAreaH * sRatio;
      }
      ctx.drawImage(s, imgX + (imgAreaW - drawW) / 2, imgY + (imgAreaH - drawH) / 2, drawW, drawH);
      ctx.restore();
    } else if (items[i] === -2) {
      ctx.font = 'bold ' + Math.round(cellW * 0.35) + 'px Arial';
      ctx.fillStyle = '#ADB5BD';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', cx + cellW / 2, cy + imgAreaH * 0.52);
    } else {
      ctx.font = fs + 'px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🐰', cx + cellW / 2, cy + imgAreaH * 0.55);
    }

    // 标签
    ctx.fillStyle = C.TEXT_DARK;
    ctx.font = fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const label = items[i] === -2 ? '随机皮肤' : items[i] === -1 ? '默认皮肤' : ('皮肤 ' + (items[i] + 1));
    ctx.fillText(label, cx + cellW / 2, cy + cellH * 0.70);

    // 选中标记
    if (isSelected) {
      ctx.fillStyle = C.PINK_SOFT;
      ctx.font = 'bold ' + fs + 'px "PingFang SC","Microsoft YaHei",sans-serif';
      ctx.fillText('✓', cx + cellW / 2, cy + cellH * 0.85);
    }
  }
  ctx.restore();

  // 滚动条
  if (maxScroll > 0) {
    const sbW = 4;
    const sbX = canvas.width - 12;
    const sbH = (listBottom - listTop) * (listBottom - listTop) / listHeight;
    const sbY = listTop + (_skinScroll / maxScroll) * (listBottom - listTop - sbH);
    ctx.fillStyle = C.TEXT_LIGHT;
    ctx.beginPath(); ctx.roundRect(sbX, Math.max(listTop, sbY), sbW, Math.min(sbH, listBottom - sbY), 2); ctx.fill();
  }

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ── 绘制游戏场景（简洁风格）────────────────
function drawGameScene() {
  // 天空渐变：浅灰蓝 → 浅灰 → 稍深灰
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0,   C.BG_LIGHT);
  skyGrad.addColorStop(0.60, C.BG_GRAY);
  skyGrad.addColorStop(1,   C.BG_DARKER);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawClouds();

  // 地面（简洁：浅灰条 + 淡绿草地条，无远山无波浪）
  const gnd = groundY + cameraOff;

  // 草地（淡绿条）
  ctx.fillStyle = C.GRASS_LIGHT;
  ctx.fillRect(0, gnd - 8, canvas.width, 10);

  // 地面（浅灰）
  ctx.fillStyle = C.GROUND_LIGHT;
  ctx.fillRect(0, gnd + 2, canvas.width, canvas.height - gnd);
  // 地面顶部分隔线
  ctx.fillStyle = C.GROUND_DARKER;
  ctx.fillRect(0, gnd + 2, canvas.width, 4);

  // 蛋糕堆
  for (let i = 0; i < stack.length; i++) {
    drawCake(stack[i].cx, gnd - (i + 1) * CAKE_H, stack[i].color, stack[i].width, stack[i].cakeType || 0);
  }

  // 送餐杆
  if (rod) {
    const px = rod.side === 'right' ? canvas.width : 0;
    const py = (cake ? cake.y + CAKE_H : groundY) + cameraOff;
    const rw = (cake && cake.w) || CAKE_W;
    ctx.strokeStyle = '#A08070';
    ctx.lineWidth = Math.max(2.5, rw * 0.04);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(rod.x, py); ctx.stroke();
    ctx.fillStyle = '#D4C5B9';
    ctx.beginPath(); ctx.ellipse(rod.x, py, rw * 0.55, CAKE_H * 0.18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#B0A090'; ctx.lineWidth = 1.5; ctx.stroke();
  }

  // 滑行蛋糕
  if (cake && cake.state !== 'done') {
    drawCake(cake.x, cake.y + cameraOff, cake.color, cake.w, cake.cakeType || 0);
  }

  // 碎片
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
}

// ── 暂停遮罩（毛玻璃风格）────────────────
function drawPauseOverlay() {
  // 毛玻璃背景
  ctx.fillStyle = C.GLASS_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 标题
  ctx.fillStyle = C.TEXT_DARK;
  ctx.font = 'bold ' + Math.round(canvas.width * 0.08) + 'px ' + UI_FONT;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('游戏暂停', canvas.width / 2, canvas.height * 0.24);

  // 按钮（白色毛玻璃）
  const bw = canvas.width * 0.58;
  const bh = canvas.height * 0.07;
  const gap = canvas.height * 0.095;
  const startY = canvas.height * 0.38;

  ctx.font = 'bold ' + Math.round(canvas.width * 0.043) + 'px ' + UI_FONT;
  for (let i = 0; i < PAUSE_BTNS.length; i++) {
    const bx = (canvas.width - bw) / 2;
    const by = startY + i * gap;

    // 白色按钮 + 毛玻璃边框
    ctx.fillStyle = C.BTN_BG;
    ctx.shadowColor = C.BTN_SHADOW;
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 12); ctx.fill();
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;

    ctx.strokeStyle = C.GLASS_BORDER;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = C.TEXT_DARK;
    ctx.fillText(PAUSE_BTNS[i].label, canvas.width / 2, by + bh / 2);
  }

  // 当前分数
  ctx.fillStyle = C.TEXT_GRAY;
  ctx.font = Math.round(canvas.width * 0.048) + 'px ' + UI_FONT;
  ctx.fillText('当前分数：' + score, canvas.width / 2, canvas.height * 0.78);

  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ── 结算页面 ──────────────────────────────────
// 显示结算页（不中断音乐，仅广告期间暂停；hideAd 负责恢复）
function showResult(mode, score) {
  showGameUI(false);

  const modeName = mode === MODE.ARCADE ? '街机模式' : '拟真模式';
  const high = getHighScore(mode);

  document.getElementById('result-mode').textContent = modeName;
  document.getElementById('result-score').textContent = score;
  document.getElementById('result-high').textContent = high;

  switchScene('result');
}

// 绑定结算页按钮事件
function initResultButtons() {
  const btns = document.getElementById('result-buttons');
  btns.addEventListener('click', function(e) {
    const btn = e.target.closest('.result-btn');
    if (!btn) return;
    handleResultAction(btn.dataset.action);
  });
  btns.addEventListener('touchend', function(e) {
    const btn = e.target.closest('.result-btn');
    if (!btn) return;
    e.preventDefault();
    handleResultAction(btn.dataset.action);
  });
}

// 处理结算页按钮（retry/home）
function handleResultAction(action) {
  if (action === 'retry') {
    init();
    gameState = STATE.PLAYING;
    showGameUI(true);
    switchScene('game');
    // 不换音乐，保持当前播放
  } else if (action === 'home') {
    goToMenu();
  }
}

// ── 主绘制入口 ────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (gameState === STATE.SETTINGS) { drawSettings(); return; }
  if (gameState === STATE.SKIN) { drawSkinSelection(); return; }
  if (gameState === STATE.MENU) return;

  // 画面抖动
  ctx.save();
  if (gameOver && (shakeX || shakeY)) { ctx.translate(shakeX, shakeY); }

  drawGameScene();

  ctx.restore();

  // 暂停遮罩
  if (paused && !gameOver) { drawPauseOverlay(); }
}

// ── 游戏循环 ──────────────────────────────────
let lastTime = performance.now();

// 游戏主循环
function loop(time) {
  const dt = (time - lastTime) / 1000;
  lastTime = time;
  update(dt);
  if (currentScene === 'game') draw();
  requestAnimationFrame(loop);
}

// ── 启动 ──────────────────────────────────
window.addEventListener('resize', resize);
buildMenu();
resize();
showGameUI(false);
switchScene('start');
updateStartHighDesc();
initStartButtons();
initResultButtons();
requestAnimationFrame(loop);
runSplashSequence();

let _audioUnlocked = false;
document.addEventListener('click', function unlockAudio() {
  if (_audioUnlocked) return;
  _audioUnlocked = true;
  if (_splashDone && gameState === STATE.MENU && (!currentMusic || currentMusic.paused)) playMusic(MENU_MUSIC);
}, { once: false });