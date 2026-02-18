const { getFallbackTifStats } = require("./fallback-tif");

function getFallbackTffStats(teamSlug) {
  return getFallbackTifStats(teamSlug);
}

module.exports = {
  getFallbackTffStats,
};
