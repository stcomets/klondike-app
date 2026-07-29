// app.js — bootstrap only.
"use strict";

window.addEventListener("DOMContentLoaded", () => {
  UI.init();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch((err) => {
      console.warn("service worker registration failed", err);
    });
  });
}
