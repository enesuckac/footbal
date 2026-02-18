const axios = require("axios");
const cheerio = require("cheerio");

const TRANSFERMARKT_BASE_URL = "https://www.transfermarkt.com.tr";
const TEAM_PAGE_TTL_MS = 10 * 60 * 1000;

const teamUrlCache = new Map();
const teamStatsCache = new Map();

const defaultHeaders = {
  "User-Agent":
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7",
};

function normalizeText(value) {
  return value ? value.replace(/\s+/g, " ").trim() : "";
}

function simplifyText(value) {
  return normalizeText(value)
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s/-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseNumber(value) {
  if (!value) {
    return null;
  }
  const firstTokenMatch = String(value).match(/-?[\d.,]+/);
  if (!firstTokenMatch) {
    return null;
  }

  let normalized = firstTokenMatch[0];
  if (normalized.includes(".") && normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  } else {
    normalized = normalized.replace(",", ".");
  }
  const number = Number.parseFloat(normalized);
  return Number.isFinite(number) ? number : null;
}

function parseEuroValue(rawValue) {
  if (!rawValue) {
    return { display: "N/A", euro: null };
  }

  const text = normalizeText(rawValue);
  const match = text.match(/(-?[\d.,]+)\s*([a-zA-ZçğıöşüÇĞİÖŞÜ.]+)?/);
  if (!match) {
    return { display: text, euro: null };
  }

  let numberPart = match[1];
  if (numberPart.includes(".") && numberPart.includes(",")) {
    numberPart = numberPart.replace(/\./g, "").replace(",", ".");
  } else {
    numberPart = numberPart.replace(",", ".");
  }

  const baseNumber = Number.parseFloat(numberPart);
  if (!Number.isFinite(baseNumber)) {
    return { display: text, euro: null };
  }

  const unit = (match[2] || "").toLowerCase();
  let multiplier = 1;

  if (unit.startsWith("mlyr") || unit.startsWith("bn")) {
    multiplier = 1_000_000_000;
  } else if (unit.startsWith("mil") || unit.startsWith("mio")) {
    multiplier = 1_000_000;
  } else if (
    unit.startsWith("bin") ||
    unit.startsWith("th") ||
    unit.startsWith("k")
  ) {
    multiplier = 1_000;
  }

  return {
    display: text,
    euro: Math.round(baseNumber * multiplier),
  };
}

async function searchTeamPage(transfermarktQuery) {
  const cacheHit = teamUrlCache.get(transfermarktQuery);
  if (cacheHit) {
    return cacheHit;
  }

  const url = `${TRANSFERMARKT_BASE_URL}/schnellsuche/ergebnis/schnellsuche?query=${encodeURIComponent(
    transfermarktQuery,
  )}`;

  const response = await axios.get(url, {
    headers: defaultHeaders,
    timeout: 20_000,
  });

  const $ = cheerio.load(response.data);
  const normalizedQuery = simplifyText(transfermarktQuery);
  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  const candidates = [];
  const seenPaths = new Set();

  $("a").each((_, element) => {
    const href = $(element).attr("href");
    if (!href || !href.includes("/startseite/verein/")) {
      return;
    }

    if (seenPaths.has(href)) {
      return;
    }
    seenPaths.add(href);

    const rowText = simplifyText($(element).closest("tr").text());
    const linkText = simplifyText($(element).text());
    const hrefText = simplifyText(href);
    const searchCorpus = `${rowText} ${linkText} ${hrefText}`;

    const hasLeagueHint =
      searchCorpus.includes("super lig") ||
      searchCorpus.includes("super-lig") ||
      searchCorpus.includes("turkiye");

    const tokenHits = queryTokens.reduce((count, token) => {
      return searchCorpus.includes(token) ? count + 1 : count;
    }, 0);

    const exactMention = searchCorpus.includes(normalizedQuery);

    candidates.push({
      href,
      score: (exactMention ? 4 : 0) + tokenHits + (hasLeagueHint ? 2 : 0),
    });
  });

  const bestCandidate = candidates.sort((a, b) => b.score - a.score)[0];

  if (!bestCandidate) {
    throw new Error(`Transfermarkt takım sayfası bulunamadı: ${transfermarktQuery}`);
  }

  const profilePath = bestCandidate.href;
  const profileUrl = profilePath.startsWith("http")
    ? profilePath
    : `${TRANSFERMARKT_BASE_URL}${profilePath}`;

  const squadUrl = profileUrl.replace("/startseite/", "/kader/");
  const payload = { profileUrl, squadUrl };
  teamUrlCache.set(transfermarktQuery, payload);

  return payload;
}

function extractHeaderMetrics($) {
  const metrics = {};

  $("li.data-header__label").each((_, item) => {
    const labelNode = $(item).clone();
    labelNode.find(".data-header__content").remove();

    const label = normalizeText(labelNode.text()).replace(/:+$/, "");
    const content = normalizeText($(item).find(".data-header__content").text());

    if (label) {
      metrics[label] = content;
    }
  });

  return metrics;
}

function extractTopPlayers($) {
  const players = [];

  $("table.items tbody tr").each((_, row) => {
    const name =
      normalizeText(
        $(row).find("td.posrela a.spielprofil_tooltip").first().text(),
      ) || normalizeText($(row).find("td.posrela a").first().text());
    const marketValueText = normalizeText(
      $(row).find("td.rechts.hauptlink").last().text(),
    );

    if (!name || !marketValueText) {
      return;
    }

    const parsedValue = parseEuroValue(marketValueText);
    players.push({
      name,
      marketValueDisplay: parsedValue.display,
      marketValueEuro: parsedValue.euro,
    });
  });

  return players
    .filter((player) => player.marketValueEuro !== null)
    .sort((left, right) => right.marketValueEuro - left.marketValueEuro)
    .slice(0, 3);
}

async function fetchTransfermarktTeamStats(team) {
  const cacheKey = team.slug;
  const cacheEntry = teamStatsCache.get(cacheKey);
  if (cacheEntry && Date.now() - cacheEntry.fetchedAt < TEAM_PAGE_TTL_MS) {
    return cacheEntry.payload;
  }

  const { profileUrl, squadUrl } = await searchTeamPage(team.transfermarktQuery);

  const [profileResponse, squadResponse] = await Promise.all([
    axios.get(profileUrl, { headers: defaultHeaders, timeout: 20_000 }),
    axios.get(squadUrl, { headers: defaultHeaders, timeout: 20_000 }),
  ]);

  const profileDom = cheerio.load(profileResponse.data);
  const squadDom = cheerio.load(squadResponse.data);
  const headerMetrics = extractHeaderMetrics(profileDom);

  const rawMarketValue = normalizeText(
    profileDom("a.data-header__market-value-wrapper").first().text(),
  );
  const marketValue = parseEuroValue(rawMarketValue);
  const netTransferBalance = parseEuroValue(
    headerMetrics["Güncel transfer bilançosu"] ||
      headerMetrics["Current transfer record"] ||
      headerMetrics["Transfer bilançosu"],
  );

  const result = {
    marketValue,
    netTransferBalance,
    squadSize: parseNumber(
      headerMetrics["Kadro genişliği"] || headerMetrics["Squad size"],
    ),
    averageAge: parseNumber(
      headerMetrics["Yaş ortalaması"] || headerMetrics["Average age"],
    ),
    foreignPlayers: parseNumber(
      headerMetrics["Lejyonerler"] || headerMetrics["Foreigners"],
    ),
    currentNationalPlayers: parseNumber(
      headerMetrics["Güncel A Milli oyuncular"] ||
        headerMetrics["Current internationals"],
    ),
    topValuablePlayers: extractTopPlayers(squadDom),
    profileUrl,
    source: {
      name: "Transfermarkt",
      fetchedAt: new Date().toISOString(),
    },
  };

  teamStatsCache.set(cacheKey, {
    fetchedAt: Date.now(),
    payload: result,
  });

  return result;
}

module.exports = {
  fetchTransfermarktTeamStats,
};
