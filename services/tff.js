const axios = require("axios");
const { getFallbackTffStats } = require("../data/fallback-tff");

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeRecentForm(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item || "").toUpperCase().trim())
    .filter((item) => item === "W" || item === "D" || item === "L")
    .slice(0, 5);
}

function normalizeTffPayload(payload) {
  return {
    leaguePosition: toNumber(payload.leaguePosition),
    points: toNumber(payload.points),
    matchesPlayed: toNumber(payload.matchesPlayed),
    wins: toNumber(payload.wins),
    draws: toNumber(payload.draws),
    losses: toNumber(payload.losses),
    goalsFor: toNumber(payload.goalsFor),
    goalsAgainst: toNumber(payload.goalsAgainst),
    cleanSheets: toNumber(payload.cleanSheets),
    avgPossession: toNumber(payload.avgPossession),
    ppda: toNumber(payload.ppda),
    recentForm: normalizeRecentForm(payload.recentForm),
  };
}

function resolveTffEnvConfig() {
  const baseUrl = process.env.TFF_API_BASE_URL || process.env.TIF_API_BASE_URL;
  const apiKey = process.env.TFF_API_KEY || process.env.TIF_API_KEY;
  return { baseUrl, apiKey };
}

async function tryFetchFromTffApi(team) {
  const { baseUrl, apiKey } = resolveTffEnvConfig();
  if (!baseUrl) {
    return null;
  }

  const teamCode = team.tffCode || team.slug;
  const apiUrl = `${baseUrl.replace(/\/$/, "")}/teams/${teamCode}/prematch`;
  const headers = {};

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await axios.get(apiUrl, {
    headers,
    timeout: 12_000,
  });

  const normalized = normalizeTffPayload(response.data?.data || response.data || {});
  return {
    ...normalized,
    source: {
      name: "TFF API",
      fetchedAt: new Date().toISOString(),
      fallback: false,
    },
  };
}

async function fetchTffTeamStats(team) {
  try {
    const liveStats = await tryFetchFromTffApi(team);
    if (liveStats) {
      return liveStats;
    }
  } catch (_error) {
    // Live endpoint başarısız olursa fallback data ile devam ediyoruz.
  }

  const fallback = getFallbackTffStats(team.slug);
  if (!fallback) {
    return {
      leaguePosition: null,
      points: null,
      matchesPlayed: null,
      wins: null,
      draws: null,
      losses: null,
      goalsFor: null,
      goalsAgainst: null,
      cleanSheets: null,
      avgPossession: null,
      ppda: null,
      recentForm: [],
      source: {
        name: "TFF Fallback",
        fetchedAt: new Date().toISOString(),
        fallback: true,
      },
    };
  }

  return {
    ...fallback,
    source: {
      name: "TFF Fallback",
      fetchedAt: new Date().toISOString(),
      fallback: true,
    },
  };
}

module.exports = {
  fetchTffTeamStats,
};
