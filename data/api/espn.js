// /js/teams/api/espn.js
const _cache = new Map();
const TTL_MS = 2 * 60 * 1000; // 2 min (ajusta a gusto)

async function fetchJson(url) {
    const now = Date.now();
    const hit = _cache.get(url);
    if (hit && (now - hit.t) < TTL_MS) return hit.v;

    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} on ${url}`);
    const json = await res.json();
    _cache.set(url, { t: now, v: json });
    return json;
}

/** LISTA DE EQUIPOS */
export async function getAllTeamsNFL() {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams`;
    const data = await fetchJson(url);
    // Normaliza
    const teams = (data?.sports?.[0]?.leagues?.[0]?.teams || []).map(t => t.team);
    return teams.map(t => ({
        id: t.id,
        uid: t.uid,
        slug: t.slug,
        displayName: t.displayName,
        shortDisplayName: t.shortDisplayName,
        abbreviation: t.abbreviation,
        logos: t.logos,
        conference: t?.groups?.parent?.name || t?.groups?.name || null,
        division: t?.groups?.name || null
    }));
}

/** INFO BÁSICA DEL EQUIPO */
export async function getTeamInfo(teamId) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}`;
    const data = await fetchJson(url);
    const t = data?.team || data;
    return {
        id: String(t.id),
        displayName: t.displayName,
        abbreviation: t.abbreviation,
        nickname: t.name,
        logos: t.logos,
        record: t.record || t.recordSummary || null
    };
}

/** ROSTER */
export async function getTeamRoster(teamId) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/roster?enable=roster,projection,stats`;
    const data = await fetchJson(url);
    const items = data?.athletes || data?.items || [];
    return items.map(p => ({
        id: String(p.id),
        fullName: p.displayName,
        position: p.position?.abbreviation,
        jersey: p.jersey,
        headshot: p.headshot?.href,
        height: p.height,
        weight: p.weight,
        age: p.age,
        experience: p.experience?.years,
        college: p.college?.name,
        stats: p.stats || null
    }));
}

/** DETALLE JUGADOR */
export async function getAthleteOverview(athId) {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athId}/overview`;
    return fetchJson(url);
}
export async function getAthleteGamelog(athId) {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athId}/gamelog`;
    return fetchJson(url);
}
export async function getAthleteSplits(athId) {
    const url = `https://site.web.api.espn.com/apis/common/v3/sports/football/nfl/athletes/${athId}/splits`;
    return fetchJson(url);
}
export async function getAthleteEventlog(athId, year) {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/athletes/${athId}/eventlog`;
    return fetchJson(url);
}

/** CALENDARIO DEL EQUIPO */
export async function getTeamSchedule(teamId, season) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/${teamId}/schedule?season=${season}`;
    const data = await fetchJson(url);
    return (data?.events || []).map(e => ({
        id: e.id,
        date: e.date,
        name: e.name,
        shortName: e.shortName,
        status: e.status,
        competitions: e.competitions
    }));
}

/** NOTICIAS DEL EQUIPO */
export async function getTeamNews(teamId, limit = 20) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/news?team=${teamId}&limit=${limit}`;
    const data = await fetchJson(url);
    const headlines = data?.headlines || [];
    return headlines.map(h => ({
        id: h.id,
        title: h.headline || h.title,
        description: h.description,
        images: h.images,
        links: h.links,
        categories: h.categories,
        published: h.published
    }));
}

/** LESIONES */
export async function getTeamInjuries(teamId) {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/teams/${teamId}/injuries`;
    return fetchJson(url);
}

/** DEPTH CHART */
export async function getTeamDepthChart(teamId, year) {
    const url = `https://sports.core.api.espn.com/v2/sports/football/leagues/nfl/seasons/${year}/teams/${teamId}/depthcharts`;
    return fetchJson(url);
}