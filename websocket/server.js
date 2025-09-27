// server.js
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

import express from "express";
import { WebSocketServer } from "ws";
import { fetchGameData } from "./gameFetcher.js";
import { initializeFirebase, createMicroBet } from "../firebase/firebaseService.js";

// === CONFIG ===
const PORT = 8080;
const LOOP_INTERVAL = 4000; // 4s per play

const app = express();
const wss = new WebSocketServer({ port: PORT });

let plays = [];
let playIndex = 0;

// === ON STARTUP: FETCH GAME DATA & INIT FIREBASE ===
(async () => {
  initializeFirebase();
  plays = await fetchGameData();
  console.log(`✅ Loaded ${plays.length} plays from Sportradar`);
})();

// === BROADCAST FUNCTION ===
function broadcast(data) {
  wss.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// === LOOP THROUGH PLAYS ===
setInterval(async () => {
  if (plays.length > 0) {
    const play = plays[playIndex];

    // Send a clean JSON event
    const event = {
      type: "play",
      timestamp: new Date().toISOString(),
      gameId: "gt-vs-uga-2025", // placeholder
      payload: play,
    };

    broadcast(event);
    console.log("📡 Sent event:", event);

    // Create microbet every 10 plays
    if (playIndex % 10 === 0) {
      try {
        await createMicroBet(Math.floor(playIndex / 10));
      } catch (error) {
        console.error('Failed to create microbet:', error.message);
      }
    }

    playIndex = (playIndex + 1) % plays.length; // loop back
  }
}, LOOP_INTERVAL);

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);
