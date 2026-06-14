
/* ============================================================
   ソリティア（クロンダイク）- ゲームロジック
   ============================================================ */
(() => {
  'use strict';

  // ── 定数 ─────────────────────────────────────
  const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
  const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
  const SUIT_COLORS = { spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black' };
  const RANK_DISPLAY = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  // ── 状態 ─────────────────────────────────────
  let state = null;
  let dragData = null;
  let selectedInfo = null;       // タップ選択モード用
  let lastTapTime = 0;
  let lastTapCardId = null;

  // ── DOM ヘルパー ──────────────────────────────
  const $ = (id) => document.getElementById(id);

  // ── レイアウト計算 ────────────────────────────
  function getOffsets() {
    const isMobile = window.innerWidth < 600;
    return {
      faceDown: isMobile ? 10 : 14,
      faceUp: isMobile ? 20 : 28
    };
  }

  // ── デッキ生成・シャッフル ────────────────────
  function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ id: `${suit}-${rank}`, suit, rank, faceUp: false });
      }
    }
    return deck;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── 新規ゲーム ───────────────────────────────
  function newGame() {
    if (state && state.timerInterval) clearInterval(state.timerInterval);

    state = {
      stock: [],
      waste: [],
      foundations: [[], [], [], []],
      tableau: [[], [], [], [], [], [], []],
      history: [],
      moves: 0,
      seconds: 0,
      timerInterval: null,
      gameWon: false
    };

    const deck = shuffle(createDeck());
    let idx = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[idx++];
        card.faceUp = (row === col);
        state.tableau[col].push(card);
      }
    }
    state.stock = deck.slice(idx);

    clearSelection();
    $('victory-overlay').classList.add('hidden');
    render();
    dealAnimation();
    startTimer();
  }

  // ── カード配り演出 ─────────────────────────
  function dealAnimation() {
    const cards = document.querySelectorAll('.tableau-pile .card');
    cards.forEach((card, i) => {
      card.classList.add('card--dealing');
      card.style.animationDelay = `${i * 30}ms`;
    });
  }

  // ── タイマー ─────────────────────────────────
  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.seconds = 0;
    updateTimerDisplay();
    state.timerInterval = setInterval(() => {
      if (!state.gameWon) {
        state.seconds++;
        updateTimerDisplay();
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
    const s = String(state.seconds % 60).padStart(2, '0');
    $('timer').textContent = `${m}:${s}`;
  }

  // ── レンダリング ─────────────────────────────
  function render() {
    renderStock();
    renderWaste();
    for (let i = 0; i < 4; i++) renderFoundation(i);
    for (let i = 0; i < 7; i++) renderTableau(i);
    updateStats();
  }

  function createCardElement(card) {
    const el = document.createElement('div');
    if (card.faceUp) {
      el.className = `card card--face-up card--${SUIT_COLORS[card.suit]}`;
      const r = RANK_DISPLAY[card.rank] || String(card.rank);
      const s = SUIT_SYMBOLS[card.suit];
      el.innerHTML =
        `<span class="card-corner card-corner--top">${r}<br>${s}</span>` +
        `<span class="card-center">${s}</span>` +
        `<span class="card-corner card-corner--bottom">${r}<br>${s}</span>`;
    } else {
      el.className = 'card card--face-down';
    }
    el.dataset.id = card.id;
    return el;
  }

  function renderStock() {
    const el = $('stock');
    el.innerHTML = '';
    if (state.stock.length > 0) {
      const cardEl = document.createElement('div');
      cardEl.className = 'card card--face-down';
      el.appendChild(cardEl);
      const count = document.createElement('span');
      count.className = 'pile-count';
      count.textContent = state.stock.length;
      el.appendChild(count);
    } else {
      el.innerHTML = '<div class="pile-placeholder pile-refresh">↻</div>';
    }
  }

  function renderWaste() {
    const el = $('waste');
    el.innerHTML = '';
    if (state.waste.length > 0) {
      const card = state.waste[state.waste.length - 1];
      const cardEl = createCardElement(card);
      if (selectedInfo && selectedInfo.type === 'waste' && selectedInfo.cards[0].id === card.id) {
        cardEl.classList.add('card--selected');
      }
      el.appendChild(cardEl);
    }
  }

  function renderFoundation(i) {
    const el = $(`foundation-${i}`);
    el.innerHTML = '';
    const pile = state.foundations[i];
    if (pile.length > 0) {
      el.appendChild(createCardElement(pile[pile.length - 1]));
    } else {
      const ph = document.createElement('div');
      ph.className = 'pile-placeholder foundation-placeholder';
      ph.textContent = SUIT_SYMBOLS[SUITS[i]];
      el.appendChild(ph);
    }
  }

  function renderTableau(i) {
    const el = $(`tableau-${i}`);
    el.innerHTML = '';
    const pile = state.tableau[i];
    if (pile.length === 0) {
      const ph = document.createElement('div');
      ph.className = 'pile-placeholder';
      el.appendChild(ph);
      return;
    }
    const offsets = getOffsets();
    let top = 0;
    pile.forEach((card, idx) => {
      const cardEl = createCardElement(card);
      cardEl.style.position = 'absolute';
      cardEl.style.top = `${top}px`;
      cardEl.style.left = '0';
      cardEl.style.zIndex = idx;
      cardEl.dataset.pileIndex = idx;
      // 選択中のハイライト
      if (selectedInfo && selectedInfo.type === 'tableau' && selectedInfo.pileIndex === i && idx >= selectedInfo.cardIndex) {
        cardEl.classList.add('card--selected');
      }
      el.appendChild(cardEl);
      if (idx < pile.length - 1) {
        top += card.faceUp ? offsets.faceUp : offsets.faceDown;
      }
    });
    const cardH = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--card-h')) || 130;
    el.style.minHeight = `${top + cardH}px`;
  }

  function updateStats() {
    $('moves').textContent = `${state.moves}手`;
  }

  // ── 移動バリデーション ────────────────────────
  function canMoveToTableau(card, pile) {
    if (pile.length === 0) return card.rank === 13;
    const top = pile[pile.length - 1];
    if (!top.faceUp) return false;
    return SUIT_COLORS[card.suit] !== SUIT_COLORS[top.suit] && card.rank === top.rank - 1;
  }

  function canMoveToFoundation(card, pile) {
    if (pile.length === 0) return card.rank === 1;
    const top = pile[pile.length - 1];
    return card.suit === top.suit && card.rank === top.rank + 1;
  }

  // ── カード位置検索 ────────────────────────────
  function findCardLocation(cardId) {
    for (let i = state.waste.length - 1; i >= 0; i--) {
      if (state.waste[i].id === cardId) return { type: 'waste', pileIndex: 0, cardIndex: i };
    }
    for (let i = 0; i < 4; i++) {
      for (let j = state.foundations[i].length - 1; j >= 0; j--) {
        if (state.foundations[i][j].id === cardId) return { type: 'foundation', pileIndex: i, cardIndex: j };
      }
    }
    for (let i = 0; i < 7; i++) {
      for (let j = state.tableau[i].length - 1; j >= 0; j--) {
        if (state.tableau[i][j].id === cardId) return { type: 'tableau', pileIndex: i, cardIndex: j };
      }
    }
    return null;
  }

  function getPile(type, index) {
    if (type === 'waste') return state.waste;
    if (type === 'foundation') return state.foundations[index];
    if (type === 'tableau') return state.tableau[index];
    return null;
  }

  // ── 移動実行 ──────────────────────────────────
  function executeMove(fromType, fromPileIndex, cardIndex, toType, toPileIndex) {
    const fromPile = getPile(fromType, fromPileIndex);
    const toPile = getPile(toType, toPileIndex);
    const cards = fromPile.splice(cardIndex);
    toPile.push(...cards);

    let flipped = false;
    if (fromType === 'tableau' && fromPile.length > 0) {
      const newTop = fromPile[fromPile.length - 1];
      if (!newTop.faceUp) {
        newTop.faceUp = true;
        flipped = true;
      }
    }

    state.history.push({
      cards: cards.map(c => c.id),
      cardCount: cards.length,
      fromType, fromPileIndex, cardIndex,
      toType, toPileIndex,
      flipped
    });

    state.moves++;
    clearSelection();
    render();

    if (checkWin()) {
      celebrateWin();
    }
  }

  // ── 山札操作 ──────────────────────────────────
  function clickStock() {
    if (state.gameWon) return;
    if (state.stock.length > 0) {
      const card = state.stock.pop();
      card.faceUp = true;
      state.waste.push(card);
      state.history.push({ action: 'draw' });
      state.moves++;
    } else if (state.waste.length > 0) {
      state.history.push({ action: 'recycle', count: state.waste.length });
      while (state.waste.length > 0) {
        const card = state.waste.pop();
        card.faceUp = false;
        state.stock.push(card);
      }
      state.moves++;
    }
    clearSelection();
    render();
  }

  // ── 元に戻す ──────────────────────────────────
  function undo() {
    if (state.history.length === 0 || state.gameWon) return;
    const entry = state.history.pop();

    if (entry.action === 'draw') {
      const card = state.waste.pop();
      card.faceUp = false;
      state.stock.push(card);
    } else if (entry.action === 'recycle') {
      for (let i = 0; i < entry.count; i++) {
        const card = state.stock.pop();
        card.faceUp = true;
        state.waste.push(card);
      }
    } else {
      const toPile = getPile(entry.toType, entry.toPileIndex);
      const fromPile = getPile(entry.fromType, entry.fromPileIndex);

      if (entry.flipped && fromPile.length > 0) {
        fromPile[fromPile.length - 1].faceUp = false;
      }
      const cards = toPile.splice(toPile.length - entry.cardCount);
      fromPile.push(...cards);
    }

    state.moves = Math.max(0, state.moves - 1);
    clearSelection();
    render();
  }

  // ── 自動移動（組札へ） ────────────────────────
  function tryAutoMoveToFoundation(cardId) {
    const loc = findCardLocation(cardId);
    if (!loc) return false;

    const pile = getPile(loc.type, loc.pileIndex);
    const card = pile[loc.cardIndex];

    if (loc.type === 'tableau' && loc.cardIndex !== pile.length - 1) return false;
    if (loc.type === 'waste' && loc.cardIndex !== pile.length - 1) return false;
    if (loc.type === 'foundation') return false;

    for (let i = 0; i < 4; i++) {
      if (canMoveToFoundation(card, state.foundations[i])) {
        executeMove(loc.type, loc.pileIndex, loc.cardIndex, 'foundation', i);
        return true;
      }
    }
    return false;
  }

  // ── タップ選択 ────────────────────────────────
  function clearSelection() {
    selectedInfo = null;
    document.querySelectorAll('.card--selected').forEach(el => el.classList.remove('card--selected'));
  }

  function handleTapSelect(cardId) {
    const loc = findCardLocation(cardId);
    if (!loc) return;

    const pile = getPile(loc.type, loc.pileIndex);
    const card = pile[loc.cardIndex];

    // 組札のカードはタップ選択しない
    if (loc.type === 'foundation') return;

    // 捨て札の場合は最上部のみ
    if (loc.type === 'waste' && loc.cardIndex !== pile.length - 1) return;

    // 既に選択中のカードがあれば移動を試みる
    if (selectedInfo) {
      // 同じカードを再タップ → 選択解除
      if (selectedInfo.cards[0].id === cardId) {
        clearSelection();
        render();
        return;
      }

      // 移動先として試す
      const moved = tryMoveSelectedTo(loc);
      if (moved) return;

      // 移動できなければ新しいカードを選択
    }

    // 新しくカードを選択
    let cards;
    if (loc.type === 'tableau') {
      cards = pile.slice(loc.cardIndex);
    } else {
      cards = [card];
    }

    selectedInfo = {
      type: loc.type,
      pileIndex: loc.pileIndex,
      cardIndex: loc.cardIndex,
      cards
    };
    render();
  }

  function tryMoveSelectedTo(targetLoc) {
    if (!selectedInfo) return false;
    const topCard = selectedInfo.cards[0];

    // タブローへの移動
    if (targetLoc.type === 'tableau') {
      if (canMoveToTableau(topCard, state.tableau[targetLoc.pileIndex])) {
        executeMove(selectedInfo.type, selectedInfo.pileIndex, selectedInfo.cardIndex, 'tableau', targetLoc.pileIndex);
        return true;
      }
    }

    // 組札への移動（1枚のみ）
    if (targetLoc.type === 'foundation' && selectedInfo.cards.length === 1) {
      if (canMoveToFoundation(topCard, state.foundations[targetLoc.pileIndex])) {
        executeMove(selectedInfo.type, selectedInfo.pileIndex, selectedInfo.cardIndex, 'foundation', targetLoc.pileIndex);
        return true;
      }
    }

    return false;
  }

  function handleTapOnEmptyPile(pileEl) {
    if (!selectedInfo) return;

    // タブローの空パイルへの移動
    const tableauPile = pileEl.closest('.tableau-pile');
    if (tableauPile) {
      const toPileIndex = parseInt(tableauPile.id.replace('tableau-', ''));
      if (canMoveToTableau(selectedInfo.cards[0], state.tableau[toPileIndex])) {
        executeMove(selectedInfo.type, selectedInfo.pileIndex, selectedInfo.cardIndex, 'tableau', toPileIndex);
        return;
      }
    }

    // 組札の空パイルへの移動
    const foundationPile = pileEl.closest('.foundation');
    if (foundationPile && selectedInfo.cards.length === 1) {
      const toPileIndex = parseInt(foundationPile.id.replace('foundation-', ''));
      if (canMoveToFoundation(selectedInfo.cards[0], state.foundations[toPileIndex])) {
        executeMove(selectedInfo.type, selectedInfo.pileIndex, selectedInfo.cardIndex, 'foundation', toPileIndex);
      }
    }
  }

  // ── 勝利判定 ──────────────────────────────────
  function checkWin() {
    return state.foundations.every(f => f.length === 13);
  }

  function celebrateWin() {
    state.gameWon = true;
    if (state.timerInterval) clearInterval(state.timerInterval);

    const m = String(Math.floor(state.seconds / 60)).padStart(2, '0');
    const s = String(state.seconds % 60).padStart(2, '0');
    $('victory-stats').textContent = `時間: ${m}:${s} ／ ${state.moves}手`;
    $('victory-overlay').classList.remove('hidden');
    startConfetti();
  }

  // ── 紙吹雪 ────────────────────────────────────
  function startConfetti() {
    const canvas = $('confetti-canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96E6A1', '#DDA0DD', '#FF8C00', '#E056A0'];
    const particles = [];

    for (let i = 0; i < 180; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * -canvas.height,
        w: Math.random() * 10 + 4,
        h: Math.random() * 6 + 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 5,
        vy: Math.random() * 3 + 2,
        rot: Math.random() * 360,
        rotV: (Math.random() - 0.5) * 12
      });
    }

    let frame = 0;
    const maxFrames = 360;

    function animate() {
      if (frame > maxFrames || !state.gameWon) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const alpha = Math.max(0, 1 - frame / maxFrames);

      for (const p of particles) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rot * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;
        p.rot += p.rotV;
        if (p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.vy = Math.random() * 3 + 2;
        }
      }

      frame++;
      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  // ── ドラッグ＆ドロップ ─────────────────────────
  function onPointerDown(e) {
    if (state.gameWon) return;

    // 山札クリック
    const stockEl = e.target.closest('#stock');
    if (stockEl) {
      clickStock();
      e.preventDefault();
      return;
    }

    // プレースホルダーのタップ（選択中カードの移動先として）
    const placeholder = e.target.closest('.pile-placeholder');
    if (placeholder) {
      const pileEl = placeholder.closest('.pile');
      if (pileEl && selectedInfo) {
        handleTapOnEmptyPile(pileEl);
        e.preventDefault();
        return;
      }
    }

    // 表向きカードのみ処理
    const cardEl = e.target.closest('.card--face-up');
    if (!cardEl) {
      clearSelection();
      render();
      return;
    }

    const cardId = cardEl.dataset.id;
    if (!cardId) return;

    const loc = findCardLocation(cardId);
    if (!loc) return;

    const pile = getPile(loc.type, loc.pileIndex);

    // 捨て札・組札は最上部のみ
    if (loc.type === 'waste' && loc.cardIndex !== pile.length - 1) return;
    if (loc.type === 'foundation' && loc.cardIndex !== pile.length - 1) return;

    // ドラッグ対象のカード群
    let cards;
    if (loc.type === 'tableau') {
      cards = pile.slice(loc.cardIndex);
    } else {
      cards = [pile[loc.cardIndex]];
    }

    // ゴースト要素作成
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.style.position = 'fixed';
    ghost.style.zIndex = '10000';
    ghost.style.pointerEvents = 'none';

    const offsets = getOffsets();
    cards.forEach((card, i) => {
      const cel = createCardElement(card);
      cel.style.position = 'absolute';
      cel.style.top = `${i * offsets.faceUp}px`;
      cel.style.left = '0';
      ghost.appendChild(cel);
    });

    const rect = cardEl.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    ghost.style.left = `${e.clientX - offsetX}px`;
    ghost.style.top = `${e.clientY - offsetY}px`;
    ghost.style.width = `${rect.width}px`;

    document.body.appendChild(ghost);

    // 元のカードを半透明に
    if (loc.type === 'tableau') {
      const pileEl = $(`tableau-${loc.pileIndex}`);
      const cardEls = pileEl.querySelectorAll('.card');
      for (let i = loc.cardIndex; i < cardEls.length; i++) {
        cardEls[i].style.opacity = '0.15';
      }
    } else {
      cardEl.style.opacity = '0.15';
    }

    dragData = {
      cards,
      fromType: loc.type,
      fromPileIndex: loc.pileIndex,
      cardIndex: loc.cardIndex,
      ghost,
      offsetX,
      offsetY,
      startX: e.clientX,
      startY: e.clientY,
      moved: false,
      cardId
    };

    e.preventDefault();
  }

  function onPointerMove(e) {
    if (!dragData) return;

    const dx = e.clientX - dragData.startX;
    const dy = e.clientY - dragData.startY;
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
      dragData.moved = true;
    }

    dragData.ghost.style.left = `${e.clientX - dragData.offsetX}px`;
    dragData.ghost.style.top = `${e.clientY - dragData.offsetY}px`;
    e.preventDefault();
  }

  function onPointerUp(e) {
    if (!dragData) return;

    const { ghost, moved, cardId } = dragData;

    if (!moved) {
      // タップ操作
      ghost.remove();

      // ダブルタップ判定
      const now = Date.now();
      if (now - lastTapTime < 350 && lastTapCardId === cardId) {
        lastTapTime = 0;
        lastTapCardId = null;
        clearSelection();
        tryAutoMoveToFoundation(cardId);
        dragData = null;
        return;
      }
      lastTapTime = now;
      lastTapCardId = cardId;

      // シングルタップ → 選択
      handleTapSelect(cardId);
      dragData = null;
      return;
    }

    // ドロップ先を検出
    ghost.style.display = 'none';
    const elem = document.elementFromPoint(e.clientX, e.clientY);
    ghost.style.display = '';

    let dropped = false;

    if (elem) {
      // タブローへのドロップ
      const tableauTarget = elem.closest('.tableau-pile');
      if (tableauTarget) {
        const toPileIndex = parseInt(tableauTarget.id.replace('tableau-', ''));
        if (canMoveToTableau(dragData.cards[0], state.tableau[toPileIndex])) {
          executeMove(dragData.fromType, dragData.fromPileIndex, dragData.cardIndex, 'tableau', toPileIndex);
          dropped = true;
        }
      }

      // 組札へのドロップ（単一カードのみ）
      if (!dropped && dragData.cards.length === 1) {
        const foundationTarget = elem.closest('.foundation');
        if (foundationTarget) {
          const toPileIndex = parseInt(foundationTarget.id.replace('foundation-', ''));
          if (canMoveToFoundation(dragData.cards[0], state.foundations[toPileIndex])) {
            executeMove(dragData.fromType, dragData.fromPileIndex, dragData.cardIndex, 'foundation', toPileIndex);
            dropped = true;
          }
        }
      }
    }

    ghost.remove();
    dragData = null;

    if (!dropped) {
      render();
    }
  }

  // ── キーボードショートカット ───────────────────
  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      newGame();
    }
  }

  // ── イベントリスナー設定 ─────────────────────
  function setupEventListeners() {
    const board = $('game-board');

    board.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);

    // ダブルクリック（デスクトップ）
    board.addEventListener('dblclick', (e) => {
      const cardEl = e.target.closest('.card--face-up');
      if (cardEl && cardEl.dataset.id) {
        clearSelection();
        tryAutoMoveToFoundation(cardEl.dataset.id);
      }
    });

    // ボタン
    $('undo-btn').addEventListener('click', undo);
    $('new-game-btn').addEventListener('click', newGame);
    $('play-again-btn').addEventListener('click', newGame);

    // キーボード
    document.addEventListener('keydown', onKeyDown);

    // リサイズ時の再描画
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => render(), 100);
    });

    // コンテキストメニュー無効化（長押し対策）
    board.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // ── 初期化 ───────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    newGame();
  });
})();
