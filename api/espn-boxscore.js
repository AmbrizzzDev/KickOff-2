export default async function handler(req, res) {
    const { event } = req.query;
    if (!event) return res.status(400).json({ error: "Missing event id" });
  
    const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/boxscore?event=${event}`;
    try {
      const response = await fetch(espnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!response.ok) {
        // Forward ESPN error code & body
        res.status(response.status).json(await response.json());
        return;
      }
      const data = await response.json();
      res.setHeader('Access-Control-Allow-Origin', '*'); // Por si quieres usarlo desde otros frontends
      res.status(200).json(data);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
  