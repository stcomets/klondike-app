// storage.js — everything touching localStorage lives here.
// No data ever leaves the device: there is no network call in this file.
"use strict";

const Storage = (() => {
  const HISTORY_KEY = "klondike.history.v1";
  const MAX_HISTORY = 300;

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.warn("history load failed, resetting", e);
      return [];
    }
  }

  function saveHistory(history) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch (e) {
      console.warn("history save failed (storage full/disabled)", e);
    }
  }

  function recordResult({ mode, won, moves, durationMs, redeals }) {
    const history = loadHistory();
    history.push({
      mode,
      won,
      moves,
      durationMs,
      redeals,
      finishedAt: new Date().toISOString(),
    });
    saveHistory(history);
    return history;
  }

  function getStats() {
    const history = loadHistory();
    const byMode = { classic: { plays: 0, wins: 0, bestMs: null }, noFoundation: { plays: 0, wins: 0, bestMs: null } };
    for (const g of history) {
      const bucket = byMode[g.mode] || (byMode[g.mode] = { plays: 0, wins: 0, bestMs: null });
      bucket.plays += 1;
      if (g.won) {
        bucket.wins += 1;
        if (bucket.bestMs === null || g.durationMs < bucket.bestMs) bucket.bestMs = g.durationMs;
      }
    }
    return { history, byMode };
  }

  function exportJson() {
    const payload = {
      exportedAt: new Date().toISOString(),
      app: "klondike-app",
      version: 1,
      history: loadHistory(),
    };
    return JSON.stringify(payload, null, 2);
  }

  function importJson(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.history)) throw new Error("不正なバックアップファイルです");
    saveHistory(data.history);
    return data.history;
  }

  function clearAll() {
    localStorage.removeItem(HISTORY_KEY);
  }

  return { loadHistory, saveHistory, recordResult, getStats, exportJson, importJson, clearAll };
})();

window.Storage = Storage;
