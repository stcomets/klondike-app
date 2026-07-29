// ui.js — the only module that touches the DOM. Talks to Game/Storage only
// through their exported functions; never assumes network access.
"use strict";

const UI = (() => {
  const { cardLabel, isRed } = window.Cards;

  let state = null;
  let timerHandle = null;

  const el = {
    stock: document.getElementById("pile-stock"),
    waste: document.getElementById("pile-waste"),
    foundations: document.getElementById("foundations"),
    tableau: document.getElementById("tableau"),
    timer: document.getElementById("timer"),
    moves: document.getElementById("moves"),
    modeBadge: document.getElementById("mode-badge"),
    toast: document.getElementById("toast"),
    menuDialog: document.getElementById("menu-dialog"),
    winDialog: document.getElementById("win-dialog"),
    winTitle: document.getElementById("win-title"),
    winDetail: document.getElementById("win-detail"),
    deadlockDialog: document.getElementById("deadlock-dialog"),
    statsSummary: document.getElementById("stats-summary"),
    importFile: document.getElementById("import-file"),
    iosHint: document.getElementById("ios-hint"),
  };

  const MODE_LABEL = { classic: "クロンダイク", noFoundation: "組札不使用チャレンジ" };

  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { el.toast.hidden = true; }, 1600);
  }

  function fmtTime(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  function startTimer() {
    stopTimer();
    timerHandle = setInterval(() => {
      el.timer.textContent = fmtTime(Date.now() - state.startTime);
    }, 1000);
  }

  function stopTimer() {
    if (timerHandle) clearInterval(timerHandle);
    timerHandle = null;
  }

  function makeCardEl(card, top, extraClass) {
    const div = document.createElement("div");
    div.className = "card" + (isRed(card) ? " red" : "") + (card.faceUp ? "" : " face-down") + (extraClass ? " " + extraClass : "");
    div.style.top = top + "px";
    if (card.faceUp) {
      div.innerHTML = `<span class="rank">${cardLabel(card)}</span><span class="suit-center">${window.Cards.SUIT_SYMBOL[card.suit]}</span><span class="rank" style="align-self:flex-end;transform:rotate(180deg)">${cardLabel(card)}</span>`;
    }
    div.dataset.cardId = card.id;
    return div;
  }

  function isSelected(zone, pile, index) {
    const s = state.selection;
    if (!s) return false;
    if (zone === "tableau") return s.zone === "tableau" && s.pile === pile && index >= s.index;
    return s.zone === zone && (s.pile === undefined || s.pile === pile);
  }

  function render() {
    // stock
    el.stock.innerHTML = "";
    if (state.stock.length > 0) {
      const back = makeCardEl({ ...state.stock[state.stock.length - 1], faceUp: false }, 0);
      el.stock.appendChild(back);
    }

    // waste
    el.waste.innerHTML = "";
    if (state.waste.length > 0) {
      const card = state.waste[state.waste.length - 1];
      const sel = isSelected("waste", null, null);
      el.waste.appendChild(makeCardEl(card, 0, sel ? "selected" : ""));
    }

    // foundations
    for (const pileEl of el.foundations.children) {
      const suit = pileEl.dataset.suit;
      pileEl.innerHTML = "";
      const pile = state.foundations[suit];
      if (pile.length > 0) {
        const card = pile[pile.length - 1];
        const sel = state.selection && state.selection.zone === "foundation" && state.selection.suit === suit;
        pileEl.appendChild(makeCardEl(card, 0, sel ? "selected" : ""));
      }
      pileEl.classList.toggle("disabled", state.mode === "noFoundation");
    }

    // tableau
    el.tableau.innerHTML = "";
    const cardH = measureCardHeight();
    const offsetUp = cardH * 0.26; // keep in sync with --tableau-offset ratio in style.css
    const offsetDown = cardH * 0.16; // keep in sync with --tableau-offset-down ratio in style.css
    state.tableau.forEach((pile, i) => {
      const col = document.createElement("div");
      col.className = "tableau-pile";
      col.dataset.pile = String(i);
      let top = 0;
      pile.forEach((card, j) => {
        const sel = isSelected("tableau", i, j);
        const cardEl = makeCardEl(card, top, sel ? "selected" : "");
        cardEl.dataset.pile = String(i);
        cardEl.dataset.index = String(j);
        col.appendChild(cardEl);
        top += card.faceUp ? offsetUp : offsetDown;
      });
      col.style.minHeight = Math.max(cardH, top) + "px";
      el.tableau.appendChild(col);
    });

    el.timer.textContent = fmtTime(Date.now() - state.startTime);
    el.moves.textContent = `${state.moves}手`;
    el.modeBadge.textContent = MODE_LABEL[state.mode];
  }

  function measureCardHeight() {
    // CSS custom properties resolve fine when *applied* to real elements, but
    // reading calc()/clamp() values back via getPropertyValue() returns the
    // raw literal string, not a pixel number. Measure a real (hidden) card
    // element instead so offsets always match actual rendered size.
    const probe = document.createElement("div");
    probe.className = "card";
    probe.style.position = "absolute";
    probe.style.visibility = "hidden";
    probe.style.top = "-9999px";
    document.body.appendChild(probe);
    const h = probe.getBoundingClientRect().height;
    probe.remove();
    return h || 60;
  }

  function clearSelection() {
    state.selection = null;
  }

  function finishGame(won, { deadlock = false } = {}) {
    stopTimer();
    state.won = won;
    state.finished = true;
    state.endTime = Date.now();
    Storage.recordResult({
      mode: state.mode,
      won,
      moves: state.moves,
      durationMs: state.endTime - state.startTime,
      redeals: state.redeals,
    });
    if (won) {
      el.winTitle.textContent = state.mode === "classic" ? "クリア！" : "チャレンジ達成！";
      el.winDetail.textContent = `${fmtTime(state.endTime - state.startTime)} / ${state.moves}手`;
      el.iosHint.hidden = true;
      el.winDialog.showModal();
    } else if (deadlock) {
      el.iosHint.hidden = true;
      el.deadlockDialog.showModal();
    }
  }

  /** Call after every mutating action (draw, move, autocomplete step). */
  function checkGameOverConditions() {
    if (state.finished) return;
    if (Game.checkWin(state)) {
      finishGame(true);
    } else if (!Game.hasAnyMove(state)) {
      finishGame(false, { deadlock: true });
    }
  }

  function afterMove() {
    render();
    checkGameOverConditions();
  }

  function onStockTap() {
    Game.drawFromStock(state);
    clearSelection();
    afterMove();
  }

  function onWasteTap() {
    if (state.waste.length === 0) return;
    if (state.selection && state.selection.zone === "waste") {
      clearSelection();
      render();
      return;
    }
    const card = state.waste[state.waste.length - 1];
    if (Game.canPlaceOnFoundation(card, state)) {
      const { ok } = Game.moveWasteToFoundation(state);
      if (ok) { clearSelection(); afterMove(); return; }
    }
    state.selection = { zone: "waste" };
    render();
  }

  function onFoundationTap(suit) {
    const sel = state.selection;
    if (!sel) {
      if (state.foundations[suit].length > 0) {
        state.selection = { zone: "foundation", suit };
        render();
      }
      return;
    }
    if (sel.zone === "foundation" && sel.suit === suit) {
      clearSelection();
      render();
      return;
    }
    if (state.mode === "noFoundation") {
      toast("このモードでは組札は使用できません");
      clearSelection();
      render();
      return;
    }
    let ok = false;
    if (sel.zone === "waste") {
      ({ ok } = Game.moveWasteToFoundation(state));
    } else if (sel.zone === "tableau") {
      const pile = state.tableau[sel.pile];
      if (sel.index === pile.length - 1) ({ ok } = Game.moveTableauToFoundation(state, sel.pile));
    }
    clearSelection();
    if (ok) afterMove(); else { toast("そこには置けません"); render(); }
  }

  function runAutocomplete() {
    if (state.mode === "noFoundation") {
      toast("このモードではオートコンプリートは使えません");
      return;
    }
    clearSelection();
    let movedAny = false;
    let progress = true;
    while (progress) {
      progress = false;
      for (let i = 0; i < 7; i++) {
        const pile = state.tableau[i];
        if (pile.length === 0) continue;
        const top = pile[pile.length - 1];
        if (top.faceUp && Game.canPlaceOnFoundation(top, state)) {
          const { ok } = Game.moveTableauToFoundation(state, i);
          if (ok) { progress = true; movedAny = true; }
        }
      }
      if (state.waste.length > 0) {
        const card = state.waste[state.waste.length - 1];
        if (Game.canPlaceOnFoundation(card, state)) {
          const { ok } = Game.moveWasteToFoundation(state);
          if (ok) { progress = true; movedAny = true; }
        }
      }
    }
    if (!movedAny) toast("自動で送れるカードはありません");
    afterMove();
  }

  function onTableauTap(pileIndex, cardIndex) {
    const pile = state.tableau[pileIndex];
    const sel = state.selection;

    if (!sel) {
      if (cardIndex === undefined) return; // tapped empty area of an empty pile, nothing to select
      const card = pile[cardIndex];
      if (!card.faceUp) return;
      if (cardIndex === pile.length - 1 && Game.canPlaceOnFoundation(card, state)) {
        const { ok } = Game.moveTableauToFoundation(state, pileIndex);
        if (ok) { afterMove(); return; }
      }
      state.selection = { zone: "tableau", pile: pileIndex, index: cardIndex };
      render();
      return;
    }

    if (sel.zone === "tableau" && sel.pile === pileIndex) {
      clearSelection();
      render();
      return;
    }

    let ok = false;
    if (sel.zone === "waste") {
      ({ ok } = Game.moveWasteToTableau(state, pileIndex));
    } else if (sel.zone === "tableau") {
      ({ ok } = Game.moveTableauToTableau(state, sel.pile, sel.index, pileIndex));
    } else if (sel.zone === "foundation") {
      ({ ok } = Game.foundationToTableau(state, sel.suit, pileIndex));
    }
    clearSelection();
    if (ok) afterMove(); else { toast("そこには置けません"); render(); }
  }

  function bindEvents() {
    el.stock.addEventListener("click", onStockTap);
    el.waste.addEventListener("click", onWasteTap);
    for (const pileEl of el.foundations.children) {
      pileEl.addEventListener("click", () => onFoundationTap(pileEl.dataset.suit));
    }
    el.tableau.addEventListener("click", (e) => {
      const cardEl = e.target.closest(".card");
      const colEl = e.target.closest(".tableau-pile");
      if (!colEl) return;
      const pileIndex = Number(colEl.dataset.pile);
      const cardIndex = cardEl ? Number(cardEl.dataset.index) : undefined;
      onTableauTap(pileIndex, cardIndex);
    });
    // Double-tap/double-click on any card triggers autocomplete: send every
    // currently eligible card to its foundation, scanning tableau columns
    // left-to-right first, then the waste, repeating until nothing more moves.
    el.tableau.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".card")) return;
      runAutocomplete();
    });
    el.waste.addEventListener("dblclick", (e) => {
      if (!e.target.closest(".card")) return;
      runAutocomplete();
    });

    document.getElementById("btn-new").addEventListener("click", () => {
      startNewGame(state.mode);
    });
    document.getElementById("btn-undo").addEventListener("click", () => {
      state = Game.undo(state);
      render();
    });
    document.getElementById("btn-menu").addEventListener("click", () => {
      refreshStatsSummary();
      const radios = el.menuDialog.querySelectorAll('input[name="mode"]');
      radios.forEach((r) => { r.checked = r.value === state.mode; });
      el.iosHint.hidden = true;
      el.menuDialog.showModal();
    });
    el.menuDialog.addEventListener("close", maybeShowIosHint);
    el.winDialog.addEventListener("close", maybeShowIosHint);
    document.getElementById("btn-start-mode").addEventListener("click", () => {
      const mode = el.menuDialog.querySelector('input[name="mode"]:checked').value;
      el.menuDialog.close();
      startNewGame(mode);
    });
    document.getElementById("btn-export").addEventListener("click", () => {
      const json = Storage.exportJson();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `klondike-backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
    document.getElementById("btn-import").addEventListener("click", () => el.importFile.click());
    el.importFile.addEventListener("change", async () => {
      const file = el.importFile.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        Storage.importJson(text);
        refreshStatsSummary();
        toast("インポートしました");
      } catch (e) {
        toast("インポートに失敗しました");
        console.warn(e);
      }
      el.importFile.value = "";
    });
    document.getElementById("btn-win-newgame").addEventListener("click", () => {
      el.winDialog.close();
      startNewGame(state.mode);
    });
    document.getElementById("btn-deadlock-newgame").addEventListener("click", () => {
      el.deadlockDialog.close();
      startNewGame(state.mode);
    });
    el.deadlockDialog.addEventListener("close", maybeShowIosHint);
    document.getElementById("ios-hint-close").addEventListener("click", () => {
      el.iosHint.hidden = true;
      localStorage.setItem("klondike.iosHintDismissed", "1");
    });
  }

  function refreshStatsSummary() {
    const { byMode } = Storage.getStats();
    const lines = Object.entries(MODE_LABEL).map(([key, label]) => {
      const s = byMode[key] || { plays: 0, wins: 0, bestMs: null };
      const best = s.bestMs !== null ? fmtTime(s.bestMs) : "—";
      return `<div>${label}：${s.plays}回プレイ / ${s.wins}勝 / 自己ベスト ${best}</div>`;
    });
    el.statsSummary.innerHTML = lines.join("");
  }

  function maybeShowIosHint() {
    const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent);
    const standalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    const dismissed = localStorage.getItem("klondike.iosHintDismissed") === "1";
    if (isIOS && !standalone && !dismissed) el.iosHint.hidden = false;
  }

  function startNewGame(mode) {
    if (state && !state.finished) {
      Storage.recordResult({ mode: state.mode, won: false, moves: state.moves, durationMs: Date.now() - state.startTime, redeals: state.redeals });
    }
    localStorage.setItem("klondike.lastMode", mode);
    state = Game.newGame(mode);
    clearSelection();
    render();
    startTimer();
  }

  function init() {
    bindEvents();
    maybeShowIosHint();
    const lastMode = localStorage.getItem("klondike.lastMode") || "classic";
    startNewGame(lastMode);
  }

  return { init };
})();

window.UI = UI;
