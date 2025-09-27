// server.js
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(process.cwd(), '..', '.env') });

import express from "express";
import { WebSocketServer } from "ws";
import { fetchGameData } from "./gameFetcher.js";
import { initializeFirebase, createMicroBet, updateMicroBetWithAnswer } from "../firebase/firebaseService.js";

// === CONFIG ===
const PORT = 8080;
const LOOP_INTERVAL = 10000; 

const app = express();
const wss = new WebSocketServer({ port: 8080, host: "0.0.0.0" });

let plays = [];
let playIndex = 0;
let recentPlays = [];
let activeMicroBet = null;

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
      gameId: "superbowl", // placeholder
      payload: play,
      activeMicroBetId: activeMicroBet ? activeMicroBet.id : null,
      homeTeamScore: play.home_points || 0,
      awayTeamScore: play.away_points || 0,
    };

    broadcast(event);
    console.log("📡 Sent event:", event);

    // Track recent plays
    recentPlays.push(event);
    if (recentPlays.length > 3) {
      recentPlays.shift();
    }

    // Create microbet every 3 plays (at the end of 3rd play)
    if (playIndex % 3 === 2) {
      try {
        activeMicroBet = await createMicroBet(recentPlays);
      } catch (error) {
        console.error('Failed to create microbet:', error.message);
      }
    }

    // Close microbet after the next play (this play determines the answer)
    if (playIndex % 3 === 0 && activeMicroBet) {
      try {
        await updateMicroBetWithAnswer(activeMicroBet.id, event, activeMicroBet);
        activeMicroBet = null;
      } catch (error) {
        console.error('Failed to close microbet:', error.message);
      }
    }

    playIndex = (playIndex + 1) % plays.length; // loop back
  }
}, LOOP_INTERVAL);

console.log(`🚀 WebSocket server running on ws://localhost:${PORT}`);
