function safeValue(value, fallback = 0) {
  return Number.isFinite(value) ? value : fallback;
}

function formatCurrencyShort(euroValue) {
  if (!Number.isFinite(euroValue)) {
    return "N/A";
  }
  const absValue = Math.abs(euroValue);
  if (absValue >= 1_000_000_000) {
    return `€${(euroValue / 1_000_000_000).toFixed(2)}B`;
  }
  if (absValue >= 1_000_000) {
    return `€${(euroValue / 1_000_000).toFixed(1)}M`;
  }
  if (absValue >= 1_000) {
    return `€${(euroValue / 1_000).toFixed(0)}K`;
  }
  return `€${euroValue.toFixed(0)}`;
}

function formatPercent(value) {
  return Number.isFinite(value) ? `${value.toFixed(1)}%` : "N/A";
}

function formatNumber(value, digits = 0) {
  return Number.isFinite(value) ? value.toFixed(digits) : "N/A";
}

function getRecentFormScore(recentForm) {
  if (!Array.isArray(recentForm) || !recentForm.length) {
    return null;
  }
  return (recentForm || []).reduce((score, result) => {
    if (result === "W") {
      return score + 3;
    }
    if (result === "D") {
      return score + 1;
    }
    return score;
  }, 0);
}

function calculateComparisonRow(config, homeStats, awayStats) {
  const homeValue = safeValue(config.getHome(homeStats), null);
  const awayValue = safeValue(config.getAway(awayStats), null);

  const bothAvailable =
    Number.isFinite(homeValue) && Number.isFinite(awayValue) && homeValue !== awayValue;

  let winner = "draw";
  if (bothAvailable) {
    const homeIsBetter = config.higherIsBetter
      ? homeValue > awayValue
      : homeValue < awayValue;
    winner = homeIsBetter ? "home" : "away";
  }

  return {
    key: config.key,
    label: config.label,
    homeValue,
    awayValue,
    homeDisplay: config.formatter(homeValue),
    awayDisplay: config.formatter(awayValue),
    higherIsBetter: config.higherIsBetter,
    winner,
  };
}

function buildComparison(homeTeam, awayTeam, homeTransfermarkt, awayTransfermarkt, homeTff, awayTff) {
  const homeSnapshot = {
    team: homeTeam,
    transfermarkt: homeTransfermarkt,
    tff: homeTff,
    derived: {
      goalDifference:
        safeValue(homeTff.goalsFor, 0) - safeValue(homeTff.goalsAgainst, 0),
      pointsPerMatch:
        safeValue(homeTff.matchesPlayed, 0) > 0
          ? safeValue(homeTff.points, 0) / safeValue(homeTff.matchesPlayed, 1)
          : null,
      formScore: getRecentFormScore(homeTff.recentForm),
    },
  };

  const awaySnapshot = {
    team: awayTeam,
    transfermarkt: awayTransfermarkt,
    tff: awayTff,
    derived: {
      goalDifference:
        safeValue(awayTff.goalsFor, 0) - safeValue(awayTff.goalsAgainst, 0),
      pointsPerMatch:
        safeValue(awayTff.matchesPlayed, 0) > 0
          ? safeValue(awayTff.points, 0) / safeValue(awayTff.matchesPlayed, 1)
          : null,
      formScore: getRecentFormScore(awayTff.recentForm),
    },
  };

  const comparisonRows = [
    {
      key: "marketValue",
      label: "Kadro Piyasa Değeri",
      getHome: (stats) => stats.transfermarkt.marketValue.euro,
      getAway: (stats) => stats.transfermarkt.marketValue.euro,
      formatter: formatCurrencyShort,
      higherIsBetter: true,
    },
    {
      key: "points",
      label: "Lig Puanı",
      getHome: (stats) => stats.tff.points,
      getAway: (stats) => stats.tff.points,
      formatter: (value) => formatNumber(value, 0),
      higherIsBetter: true,
    },
    {
      key: "formScore",
      label: "Son 5 Maç Form Puanı",
      getHome: (stats) => stats.derived.formScore,
      getAway: (stats) => stats.derived.formScore,
      formatter: (value) => formatNumber(value, 0),
      higherIsBetter: true,
    },
    {
      key: "goalsFor",
      label: "Atılan Gol",
      getHome: (stats) => stats.tff.goalsFor,
      getAway: (stats) => stats.tff.goalsFor,
      formatter: (value) => formatNumber(value, 0),
      higherIsBetter: true,
    },
    {
      key: "goalsAgainst",
      label: "Yenilen Gol",
      getHome: (stats) => stats.tff.goalsAgainst,
      getAway: (stats) => stats.tff.goalsAgainst,
      formatter: (value) => formatNumber(value, 0),
      higherIsBetter: false,
    },
    {
      key: "cleanSheets",
      label: "Gol Yemeden Maç",
      getHome: (stats) => stats.tff.cleanSheets,
      getAway: (stats) => stats.tff.cleanSheets,
      formatter: (value) => formatNumber(value, 0),
      higherIsBetter: true,
    },
    {
      key: "possession",
      label: "Topa Sahip Olma",
      getHome: (stats) => stats.tff.avgPossession,
      getAway: (stats) => stats.tff.avgPossession,
      formatter: formatPercent,
      higherIsBetter: true,
    },
    {
      key: "ppda",
      label: "PPDA (Defansif Yoğunluk)",
      getHome: (stats) => stats.tff.ppda,
      getAway: (stats) => stats.tff.ppda,
      formatter: (value) => formatNumber(value, 1),
      higherIsBetter: false,
    },
  ]
    .map((config) => calculateComparisonRow(config, homeSnapshot, awaySnapshot))
    .filter((row) => Number.isFinite(row.homeValue) || Number.isFinite(row.awayValue));

  return {
    generatedAt: new Date().toISOString(),
    sources: [homeTransfermarkt.source, homeTff.source, awayTransfermarkt.source, awayTff.source],
    home: homeSnapshot,
    away: awaySnapshot,
    comparisonRows,
  };
}

module.exports = {
  buildComparison,
};
