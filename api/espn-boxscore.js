export default async function handler(req, res) {
    const event = req.query.event;
    if (!event) return res.status(400).json({ error: "No event id" });
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/boxscore?event=${event}`;
    try {
      const data = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } }).then(r => r.json());
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(200).json(data);
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  }
  