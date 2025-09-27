import fetch from "node-fetch";

export async function fetchGameData() {
  const url = "https://api.sportradar.com/nfl/official/trial/v7/en/games/ca9d8f84-8e7b-4ee7-a310-54c2e3ca4edc/pbp.json?api_key=IBmP6JwSOEdQhilLQcwmA1KD7GFr8lTqcOyCEtDQ";

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch game: ${res.status} ${res.statusText}`);

  const data = await res.json();

  // Flatten all plays into a single array
  const plays = [];
  if (data.periods) {
    data.periods.forEach(period => {
      if (period.pbp) {
        period.pbp.forEach(drive => {
          if (drive.events) {
            drive.events.forEach(event => {
              if (event.type === "play") {
                // Optional: normalize only the fields you want
                plays.push({
                  id: event.id,
                  sequence: event.sequence,
                  clock: event.clock,
                  home_points: event.home_points,
                  away_points: event.away_points,
                  play_type: event.play_type,
                  description: event.description,
                  start_possession: event.start_situation?.possession?.alias,
                  start_yardline: event.start_situation?.location?.yardline,
                  end_possession: event.end_situation?.possession?.alias,
                  end_yardline: event.end_situation?.location?.yardline,
                  statistics: event.statistics,
                  details: event.details
                });
              }
            });
          }
        });
      }
    });
  }

  console.log(`✅ Loaded ${plays.length} plays`);
  return plays;
}
