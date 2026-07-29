// cards.js — card/deck primitives, no DOM, no game rules here.
"use strict";

const SUITS = ["spades", "hearts", "diamonds", "clubs"];
const SUIT_SYMBOL = { spades: "♠", hearts: "♥", diamonds: "♦", clubs: "♣" };
const SUIT_COLOR = { spades: "black", hearts: "red", diamonds: "red", clubs: "black" };
const RANK_LABEL = ["", "A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

/** @returns {Array<object>} a fresh, unshuffled 52 card deck */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push({ suit, rank, faceUp: false, id: `${suit[0]}${rank}` });
    }
  }
  return deck;
}

/** Fisher-Yates shuffle, returns a new array (does not mutate input). */
function shuffle(array) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function cardLabel(card) {
  return `${RANK_LABEL[card.rank]}${SUIT_SYMBOL[card.suit]}`;
}

function isRed(card) {
  return SUIT_COLOR[card.suit] === "red";
}

window.Cards = { SUITS, SUIT_SYMBOL, SUIT_COLOR, RANK_LABEL, createDeck, shuffle, cardLabel, isRed };
