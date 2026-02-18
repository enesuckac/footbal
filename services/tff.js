const axios = require("axios");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");

const TFF_HOME_URL = "https://www.tff.org/default.aspx";
const TFF_STANDINGS_URL = "https://www.tff.org/Default.aspx?pageId=198";
const LEAGUE_CACHE_TTL_MS = 10 * 60 * 1000;
const RETRY_DELAYS_MS = [450, 900, 1600, 2600];

const SPONSOR_STOP_WORDS = new Set([
  "a",
  "s",
  "as",
  "futbol",
  "kulubu",
  "kulubu",
  "kulubu",
  "spor",
  "com",
  "tr",
  "misirli",
  "natura",
  "dunyasi",
  "rams",
  "corendon",
  "ikas",
  "tumosan",
  "hesap",
  "zecorner",
  "misirlicomtr",
  "fk",
]);

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
};

let leagueSnapshotCache = null;
let leagueSnapshotPromise = null;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(String(value).replace(/\s+/g, "").replace(",", "."));
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

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function transliterateTurkish(value) {
  return String(value || "")
    .replaceAll("İ", "I")
    .replaceAll("ı", "i")
    .replaceAll("Ş", "S")
    .replaceAll("ş", "s")
    .replaceAll("Ğ", "G")
    .replaceAll("ğ", "g")
    .replaceAll("Ü", "U")
    .replaceAll("ü", "u")
    .replaceAll("Ö", "O")
    .replaceAll("ö", "o")
    .replaceAll("Ç", "C")
    .replaceAll("ç", "c");
}

function canonicalTeamKey(teamName) {
  const raw = transliterateTurkish(teamName)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return raw
    .split(" ")
    .filter(Boolean)
    .filter((token) => !SPONSOR_STOP_WORDS.has(token))
    .join(" ");
}

function isRequestRejected(html) {
  return html.includes("Request Rejected");
}

function decodeTffHtml(dataBuffer) {
  return iconv.decode(Buffer.from(dataBuffer), "ISO-8859-9");
}

function buildCookieHeader(setCookieHeader = []) {
  return setCookieHeader.map((entry) => entry.split(";")[0]).join("; ");
}

function createBaseStats(partial = {}) {
  return {
    leaguePosition: toNumber(partial.leaguePosition),
    points: toNumber(partial.points),
    matchesPlayed: toNumber(partial.matchesPlayed),
    wins: toNumber(partial.wins),
    draws: toNumber(partial.draws),
    losses: toNumber(partial.losses),
    goalsFor: toNumber(partial.goalsFor),
    goalsAgainst: toNumber(partial.goalsAgainst),
    cleanSheets: toNumber(partial.cleanSheets),
    avgPossession: toNumber(partial.avgPossession),
    ppda: toNumber(partial.ppda),
    recentForm: normalizeRecentForm(partial.recentForm),
  };
}

function createEmptyStatsWithSource(source) {
  return {
    ...createBaseStats(),
    source,
  };
}

function parseTeamPositionAndName(rawTeamCellText) {
  const normalized = normalizeText(rawTeamCellText);
  const match = normalized.match(/^(\d+)\.(.+)$/);
  if (!match) {
    return {
      position: null,
      teamName: normalized,
    };
  }
  return {
    position: toNumber(match[1]),
    teamName: normalizeText(match[2]),
  };
}

function parseHomeStandings(html) {
  const $ = cheerio.load(html);
  const byClubId = {};
  const byTeamKey = {};

  $("tr.s-item").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length < 3) {
      return;
    }

    const teamCell = $(tds[0]);
    const href = teamCell.find("a").attr("href") || "";
    const clubIdMatch = href.match(/kulupID=(\d+)/i);
    if (!clubIdMatch) {
      return;
    }

    const clubId = Number(clubIdMatch[1]);
    const { position, teamName } = parseTeamPositionAndName(teamCell.text());
    const matchesPlayed = toNumber($(tds[1]).text());
    const points = toNumber($(tds[2]).text());
    const teamKey = canonicalTeamKey(teamName);

    byClubId[clubId] = {
      ...createBaseStats({
        leaguePosition: position,
        matchesPlayed,
        points,
      }),
      teamName,
      clubId,
    };

    if (teamKey) {
      byTeamKey[teamKey] = clubId;
    }
  });

  return { byClubId, byTeamKey };
}

function parseDetailedStandings(html) {
  const $ = cheerio.load(html);
  const standingsTable = $("table.s-table")
    .filter((_, table) => $(table).find("tr").length > 10)
    .first();

  if (!standingsTable.length) {
    throw new Error("TFF detaylı puan cetveli tablosu bulunamadı.");
  }

  const byClubId = {};
  const byTeamKey = {};

  standingsTable.find("tr").each((_, row) => {
    const tds = $(row).find("td");
    if (tds.length < 9) {
      return;
    }

    const teamCell = $(tds[0]);
    const href = teamCell.find("a").attr("href") || "";
    const clubIdMatch = href.match(/kulupID=(\d+)/i);
    if (!clubIdMatch) {
      return;
    }

    const clubId = Number(clubIdMatch[1]);
    const { position, teamName } = parseTeamPositionAndName(teamCell.text());
    const teamKey = canonicalTeamKey(teamName);

    byClubId[clubId] = {
      ...createBaseStats({
        leaguePosition: position,
        matchesPlayed: $(tds[1]).text(),
        wins: $(tds[2]).text(),
        draws: $(tds[3]).text(),
        losses: $(tds[4]).text(),
        goalsFor: $(tds[5]).text(),
        goalsAgainst: $(tds[6]).text(),
        points: $(tds[8]).text(),
      }),
      teamName,
      clubId,
    };

    if (teamKey) {
      byTeamKey[teamKey] = clubId;
    }
  });

  return {
    byClubId,
    byTeamKey,
    dom: $,
  };
}

function parseFixtureDerivedStats(dom, teamKeyToClubId) {
  const fixtureTable = dom("table")
    .filter((_, table) => (dom(table).attr("class") || "").includes("fiksturListesiTable"))
    .first();

  if (!fixtureTable.length) {
    return {};
  }

  const matchesByClubId = new Map();

  function pushMatch(clubId, goalsFor, goalsAgainst) {
    const current = matchesByClubId.get(clubId) || [];
    current.push({
      goalsFor,
      goalsAgainst,
      result: goalsFor > goalsAgainst ? "W" : goalsFor < goalsAgainst ? "L" : "D",
    });
    matchesByClubId.set(clubId, current);
  }

  fixtureTable.find("tr").each((_, row) => {
    const tds = dom(row).find("td");
    if (tds.length !== 3) {
      return;
    }

    const homeName = normalizeText(dom(tds[0]).text());
    const scoreText = normalizeText(dom(tds[1]).text());
    const awayName = normalizeText(dom(tds[2]).text());
    const scoreMatch = scoreText.match(/^(\d+)\s*-\s*(\d+)$/);

    if (!scoreMatch) {
      return;
    }

    const homeGoals = Number(scoreMatch[1]);
    const awayGoals = Number(scoreMatch[2]);
    const homeClubId = teamKeyToClubId[canonicalTeamKey(homeName)];
    const awayClubId = teamKeyToClubId[canonicalTeamKey(awayName)];

    if (!homeClubId || !awayClubId) {
      return;
    }

    pushMatch(homeClubId, homeGoals, awayGoals);
    pushMatch(awayClubId, awayGoals, homeGoals);
  });

  const derivedByClubId = {};
  for (const [clubId, matches] of matchesByClubId.entries()) {
    derivedByClubId[clubId] = {
      cleanSheets: matches.filter((match) => match.goalsAgainst === 0).length,
      recentForm: matches.slice(-5).map((match) => match.result),
    };
  }

  return derivedByClubId;
}

async function requestTffPage(url, cookieHeader = "") {
  const headers = { ...defaultHeaders };
  if (cookieHeader) {
    headers.Cookie = cookieHeader;
    headers.Referer = TFF_HOME_URL;
  }

  const response = await axios.get(url, {
    headers,
    responseType: "arraybuffer",
    timeout: 20_000,
    validateStatus: () => true,
  });

  return {
    status: response.status,
    html: decodeTffHtml(response.data),
    cookieHeader: buildCookieHeader(response.headers["set-cookie"] || []),
  };
}

async function tryFetchDetailedStandingsHtml() {
  let initialHome = await requestTffPage(TFF_HOME_URL);
  if (initialHome.status !== 200 || isRequestRejected(initialHome.html)) {
    throw new Error("TFF ana sayfası erişilemedi.");
  }

  let cookieHeader = initialHome.cookieHeader;

  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    const detailResponse = await requestTffPage(TFF_STANDINGS_URL, cookieHeader);
    const isValidDetail =
      detailResponse.status === 200 &&
      !isRequestRejected(detailResponse.html) &&
      detailResponse.html.includes("Puan Cetveli") &&
      detailResponse.html.length > 10_000;

    if (isValidDetail) {
      return {
        homepageHtml: initialHome.html,
        detailedHtml: detailResponse.html,
      };
    }

    if (attempt >= RETRY_DELAYS_MS.length) {
      break;
    }

    await sleep(RETRY_DELAYS_MS[attempt]);

    const refreshedHome = await requestTffPage(TFF_HOME_URL);
    if (refreshedHome.status === 200 && !isRequestRejected(refreshedHome.html)) {
      initialHome = refreshedHome;
      cookieHeader = refreshedHome.cookieHeader;
    }
  }

  return {
    homepageHtml: initialHome.html,
    detailedHtml: null,
  };
}

function buildLeagueSnapshot(homepageHtml, detailedHtml) {
  const homeSnapshot = parseHomeStandings(homepageHtml);
  const mergedByClubId = { ...homeSnapshot.byClubId };
  const mergedByTeamKey = { ...homeSnapshot.byTeamKey };

  let sourceName = "TFF Homepage Puan Durumu";
  let fallback = true;

  if (detailedHtml) {
    const detailedSnapshot = parseDetailedStandings(detailedHtml);
    const fixtureDerivedStats = parseFixtureDerivedStats(
      detailedSnapshot.dom,
      detailedSnapshot.byTeamKey,
    );

    Object.entries(detailedSnapshot.byClubId).forEach(([clubId, stats]) => {
      const fixtureStats = fixtureDerivedStats[clubId] || {};
      mergedByClubId[clubId] = {
        ...stats,
        cleanSheets: toNumber(fixtureStats.cleanSheets ?? stats.cleanSheets),
        recentForm: normalizeRecentForm(fixtureStats.recentForm || stats.recentForm),
      };
    });

    Object.assign(mergedByTeamKey, detailedSnapshot.byTeamKey);
    sourceName = "TFF Resmi Puan Cetveli + Fikstür";
    fallback = false;
  }

  return {
    byClubId: mergedByClubId,
    byTeamKey: mergedByTeamKey,
    sourceName,
    fallback,
    fetchedAt: new Date().toISOString(),
  };
}

async function fetchTffLeagueSnapshot() {
  const cacheIsFresh =
    leagueSnapshotCache &&
    Date.now() - leagueSnapshotCache.fetchedAtMs < LEAGUE_CACHE_TTL_MS;
  if (cacheIsFresh) {
    return leagueSnapshotCache;
  }

  if (leagueSnapshotPromise) {
    return leagueSnapshotPromise;
  }

  leagueSnapshotPromise = (async () => {
    const { homepageHtml, detailedHtml } = await tryFetchDetailedStandingsHtml();
    const snapshot = buildLeagueSnapshot(homepageHtml, detailedHtml);
    leagueSnapshotCache = {
      ...snapshot,
      fetchedAtMs: Date.now(),
    };
    return leagueSnapshotCache;
  })().finally(() => {
    leagueSnapshotPromise = null;
  });

  return leagueSnapshotPromise;
}

function resolveTffEnvConfig() {
  const baseUrl = process.env.TFF_API_BASE_URL || process.env.TIF_API_BASE_URL;
  const apiKey = process.env.TFF_API_KEY || process.env.TIF_API_KEY;
  return { baseUrl, apiKey };
}

function normalizeTffPayload(payload) {
  return createBaseStats(payload);
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

function resolveTeamStatsFromSnapshot(team, snapshot) {
  const clubIdKey = String(team.tffClubId || "");
  let stats = clubIdKey ? snapshot.byClubId[clubIdKey] : null;

  if (!stats) {
    const teamKey =
      canonicalTeamKey(team.name) ||
      canonicalTeamKey(team.transfermarktQuery) ||
      canonicalTeamKey(team.slug);
    const fallbackClubId = snapshot.byTeamKey[teamKey];
    stats = fallbackClubId ? snapshot.byClubId[String(fallbackClubId)] : null;
  }

  if (!stats) {
    return createEmptyStatsWithSource({
      name: snapshot.sourceName,
      fetchedAt: snapshot.fetchedAt,
      fallback: true,
      warning: "team_not_found_in_tff_snapshot",
    });
  }

  return {
    ...createBaseStats(stats),
    source: {
      name: snapshot.sourceName,
      fetchedAt: snapshot.fetchedAt,
      fallback: snapshot.fallback,
    },
  };
}

async function fetchTffTeamStats(team) {
  try {
    const apiStats = await tryFetchFromTffApi(team);
    if (apiStats) {
      return apiStats;
    }
  } catch (_error) {
    // Özel TFF API tanımlıysa ama erişilemezse resmi web kaynağına düşüyoruz.
  }

  try {
    const snapshot = await fetchTffLeagueSnapshot();
    return resolveTeamStatsFromSnapshot(team, snapshot);
  } catch (_error) {
    return createEmptyStatsWithSource({
      name: "TFF unavailable",
      fetchedAt: new Date().toISOString(),
      fallback: true,
    });
  }
}

module.exports = {
  fetchTffTeamStats,
};
