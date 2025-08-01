export default async function handler(req, res) {
  const { gameId } = req.query;
  if (!gameId) return res.status(400).json({ error: "Missing gameId" });

  const espnUrl = `https://cdn.espn.com/core/nfl/boxscore?xhr=1&gameId=${gameId}`;
  try {
    const response = await fetch(espnUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!response.ok) {
      res.status(response.status).json({ error: "ESPN error" });
      return;
    }
    const data = await response.json();
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
