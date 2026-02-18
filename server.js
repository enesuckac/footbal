const express = require("express");
const path = require("path");
const { superLigTeams, teamsBySlug } = require("./data/teams");
const { fetchTransfermarktTeamStats } = require("./services/transfermarkt");
const { fetchTffTeamStats } = require("./services/tff");
const { buildComparison } = require("./services/comparison");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function createTransfermarktFallback() {
  return {
    marketValue: { display: "N/A", euro: null },
    netTransferBalance: { display: "N/A", euro: null },
    squadSize: null,
    averageAge: null,
    foreignPlayers: null,
    currentNationalPlayers: null,
    topValuablePlayers: [],
    profileUrl: null,
    source: {
      name: "Transfermarkt (unavailable)",
      fetchedAt: new Date().toISOString(),
    },
  };
}

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/teams", (_req, res) => {
  res.json({
    league: "Trendyol Süper Lig",
    count: superLigTeams.length,
    teams: superLigTeams,
  });
});

app.get("/api/compare", async (req, res) => {
  const homeSlug = String(req.query.home || "").trim();
  const awaySlug = String(req.query.away || "").trim();

  if (!homeSlug || !awaySlug) {
    return res.status(400).json({
      error: "home ve away parametreleri zorunludur.",
    });
  }

  if (homeSlug === awaySlug) {
    return res.status(400).json({
      error: "Karşılaştırma için iki farklı takım seçin.",
    });
  }

  const homeTeam = teamsBySlug[homeSlug];
  const awayTeam = teamsBySlug[awaySlug];

  if (!homeTeam || !awayTeam) {
    return res.status(404).json({
      error: "Takım bulunamadı. Geçerli slug değerleri için /api/teams endpoint'ini kullanın.",
    });
  }

  const warnings = [];

  const homeTransfermarktPromise = fetchTransfermarktTeamStats(homeTeam).catch((error) => {
    warnings.push({
      team: homeTeam.slug,
      source: "transfermarkt",
      message: error.message,
    });
    return createTransfermarktFallback();
  });

  const awayTransfermarktPromise = fetchTransfermarktTeamStats(awayTeam).catch((error) => {
    warnings.push({
      team: awayTeam.slug,
      source: "transfermarkt",
      message: error.message,
    });
    return createTransfermarktFallback();
  });

  const homeTffPromise = fetchTffTeamStats(homeTeam);
  const awayTffPromise = fetchTffTeamStats(awayTeam);

  const [homeTransfermarkt, awayTransfermarkt, homeTff, awayTff] = await Promise.all([
    homeTransfermarktPromise,
    awayTransfermarktPromise,
    homeTffPromise,
    awayTffPromise,
  ]);

  const comparison = buildComparison(
    homeTeam,
    awayTeam,
    homeTransfermarkt,
    awayTransfermarkt,
    homeTff,
    awayTff,
  );

  return res.json({
    matchCardTitle: `${homeTeam.name} vs ${awayTeam.name}`,
    comparison,
    warnings,
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Süper Lig karşılaştırma kartı hazır: http://localhost:${PORT}`);
});
