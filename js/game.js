// game.js — pure game state and rules for Klondike (draw-1).
// No DOM access here; ui.js is the only module allowed to touch the page.
"use strict";

const Game = (() => {
  const { createDeck, shuffle } = window.Cards;

  /**
   * @param {"classic"|"noFoundation"} mode
   *   classic: standard Klondike, win = all 52 cards on foundations.
   *   noFoundation: foundations are disabled entirely. Win = every card is
   *     face up and in the tableau (stock and waste both empty), i.e. you
   *     revealed the whole deck without ever using a foundation pile.
   */
  function newGame(mode = "classic") {
    const deck = shuffle(createDeck());
    const tableau = [[], [], [], [], [], [], []];
    let cursor = 0;
    for (let col = 0; col < 7; col++) {
      for (let row = 0; row <= col; row++) {
        const card = deck[cursor++];
        card.faceUp = row === col; // only the last dealt card in each pile starts face up
        tableau[col].push(card);
      }
    }
    const stock = deck.slice(cursor).map((c) => ({ ...c, faceUp: false }));

    return {
      mode,
      tableau,
      foundations: { spades: [], hearts: [], diamonds: [], clubs: [] },
      stock,
      waste: [],
      redeals: 0,
      moves: 0,
      startTime: Date.now(),
      endTime: null,
      won: false,
      selection: null, // { zone: 'tableau'|'waste', pile: number, index: number }
      undoStack: [],
    };
  }

  function cloneState(state) {
    // Structured clone is fine here — state is plain data, no functions/DOM.
    return structuredClone(state);
  }

  function pushUndo(state) {
    const snap = cloneState(state);
    snap.undoStack = []; // don't nest history inside history
    state.undoStack.push(snap);
    if (state.undoStack.length > 100) state.undoStack.shift();
  }

  function undo(state) {
    if (state.undoStack.length === 0) return state;
    const prev = state.undoStack[state.undoStack.length - 1];
    prev.undoStack = state.undoStack.slice(0, -1);
    return prev;
  }

  function isOppositeColor(a, b) {
    return window.Cards.isRed(a) !== window.Cards.isRed(b);
  }

  function canPlaceOnTableau(card, destPile) {
    if (destPile.length === 0) return card.rank === 13;
    const top = destPile[destPile.length - 1];
    if (!top.faceUp) return false;
    return isOppositeColor(card, top) && top.rank === card.rank + 1;
  }

  function canPlaceOnFoundation(card, state) {
    if (state.mode === "noFoundation") return false;
    const pile = state.foundations[card.suit];
    const topRank = pile.length === 0 ? 0 : pile[pile.length - 1].rank;
    return card.rank === topRank + 1;
  }

  /** Returns the movable run starting at `index` in a tableau pile, or null if invalid. */
  function getTableauRun(pile, index) {
    if (index < 0 || index >= pile.length) return null;
    for (let i = index; i < pile.length; i++) {
      if (!pile[i].faceUp) return null;
    }
    for (let i = index; i < pile.length - 1; i++) {
      const cur = pile[i];
      const next = pile[i + 1];
      if (!(isOppositeColor(cur, next) && cur.rank === next.rank + 1)) return null;
    }
    return pile.slice(index);
  }

  function flipNewTopCard(pile) {
    if (pile.length > 0 && !pile[pile.length - 1].faceUp) {
      pile[pile.length - 1].faceUp = true;
      return true;
    }
    return false;
  }

  function drawFromStock(state) {
    pushUndo(state);
    if (state.stock.length === 0) {
      if (state.waste.length === 0) {
        state.undoStack.pop();
        return state;
      }
      state.stock = state.waste.reverse().map((c) => ({ ...c, faceUp: false }));
      state.waste = [];
      state.redeals += 1;
      state.moves += 1;
      return state;
    }
    const card = state.stock.pop();
    card.faceUp = true;
    state.waste.push(card);
    state.moves += 1;
    return state;
  }

  function moveWasteToTableau(state, pileIndex) {
    if (state.waste.length === 0) return { state, ok: false };
    const card = state.waste[state.waste.length - 1];
    const dest = state.tableau[pileIndex];
    if (!canPlaceOnTableau(card, dest)) return { state, ok: false };
    pushUndo(state);
    state.waste.pop();
    dest.push(card);
    state.moves += 1;
    return { state, ok: true };
  }

  function moveWasteToFoundation(state) {
    if (state.waste.length === 0) return { state, ok: false };
    const card = state.waste[state.waste.length - 1];
    if (!canPlaceOnFoundation(card, state)) return { state, ok: false };
    pushUndo(state);
    state.waste.pop();
    state.foundations[card.suit].push(card);
    state.moves += 1;
    return { state, ok: true };
  }

  function moveTableauToFoundation(state, pileIndex) {
    const pile = state.tableau[pileIndex];
    if (pile.length === 0) return { state, ok: false };
    const card = pile[pile.length - 1];
    if (!card.faceUp || !canPlaceOnFoundation(card, state)) return { state, ok: false };
    pushUndo(state);
    pile.pop();
    state.foundations[card.suit].push(card);
    flipNewTopCard(pile);
    state.moves += 1;
    return { state, ok: true };
  }

  function moveTableauToTableau(state, fromIndex, cardIndex, toIndex) {
    if (fromIndex === toIndex) return { state, ok: false };
    const fromPile = state.tableau[fromIndex];
    const run = getTableauRun(fromPile, cardIndex);
    if (!run) return { state, ok: false };
    const toPile = state.tableau[toIndex];
    if (!canPlaceOnTableau(run[0], toPile)) return { state, ok: false };
    pushUndo(state);
    state.tableau[fromIndex] = fromPile.slice(0, cardIndex);
    state.tableau[toIndex] = toPile.concat(run);
    flipNewTopCard(state.tableau[fromIndex]);
    state.moves += 1;
    return { state, ok: true };
  }

  function foundationToTableau(state, suit, toIndex) {
    const pile = state.foundations[suit];
    if (pile.length === 0) return { state, ok: false };
    const card = pile[pile.length - 1];
    const toPile = state.tableau[toIndex];
    if (!canPlaceOnTableau(card, toPile)) return { state, ok: false };
    pushUndo(state);
    pile.pop();
    toPile.push(card);
    state.moves += 1;
    return { state, ok: true };
  }

  function checkWin(state) {
    if (state.mode === "classic") {
      return Object.values(state.foundations).every((p) => p.length === 13);
    }
    // noFoundation challenge: whole deck revealed and resting in the tableau.
    const stockEmpty = state.stock.length === 0 && state.waste.length === 0;
    const allFaceUp = state.tableau.every((pile) => pile.every((c) => c.faceUp));
    return stockEmpty && allFaceUp;
  }

  /** Any legal move at all remaining? Rough solvability heuristic, not exhaustive. */
  function hasAnyMove(state) {
    if (state.stock.length > 0) return true;
    if (state.waste.length > 0) {
      const card = state.waste[state.waste.length - 1];
      if (canPlaceOnFoundation(card, state)) return true;
      for (const pile of state.tableau) if (canPlaceOnTableau(card, pile)) return true;
    }
    for (let i = 0; i < 7; i++) {
      const pile = state.tableau[i];
      if (pile.length === 0) continue;
      const top = pile[pile.length - 1];
      if (top.faceUp && canPlaceOnFoundation(top, state)) return true;
      for (let j = pile.length - 1; j >= 0; j--) {
        if (!pile[j].faceUp) break;
        const run = getTableauRun(pile, j);
        if (!run) continue;
        for (let k = 0; k < 7; k++) {
          if (k === i) continue;
          if (canPlaceOnTableau(run[0], state.tableau[k])) return true;
        }
      }
    }
    if (state.waste.length > 0 || state.stock.length > 0) return true; // recycling counts as a move
    return false;
  }

  return {
    newGame,
    cloneState,
    undo,
    canPlaceOnTableau,
    canPlaceOnFoundation,
    getTableauRun,
    drawFromStock,
    moveWasteToTableau,
    moveWasteToFoundation,
    moveTableauToFoundation,
    moveTableauToTableau,
    foundationToTableau,
    checkWin,
    hasAnyMove,
  };
})();

window.Game = Game;
