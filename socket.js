// server.js
const WebSocket = require("ws");

const wss = new WebSocket.Server({ port: 8080 });
console.log("WebSocket server running on ws://localhost:8080");

// Example game data
let team1Score = 0;
let team2Score = 0;
const commentary = [
  "The match kicks off!",
  "Team 1 is on the attack...",
  "Brilliant save by Team 2’s goalkeeper!",
  "GOAL! Team 1 scores!",
  "Team 2 equalizes quickly!",
];

let i = 0;

// Broadcast helper
function broadcast(message) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
}

setInterval(() => {
  // Simulate score changes
  if (Math.random() > 0.7) team1Score++;
  if (Math.random() > 0.7) team2Score++;

  const data = {
    transcript: commentary[i % commentary.length],
    team1Score,
    team2Score,
  };

  // 👇 Log to server console
  console.log("Broadcasting:", data);

  broadcast(data);
  i++;
}, 3000);

wss.on("connection", () => {
  console.log("Client connected");
});
