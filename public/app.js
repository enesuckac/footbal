const dashboardEl = document.getElementById("dashboard");
const loadingEl = document.getElementById("loadingState");
const errorEl = document.getElementById("errorState");
const errorMessageEl = document.getElementById("errorMessage");

const formEl = document.getElementById("compareForm");
const homeSelectEl = document.getElementById("homeTeamSelect");
const awaySelectEl = document.getElementById("awayTeamSelect");

const homePanelEl = document.getElementById("homePanel");
const awayPanelEl = document.getElementById("awayPanel");
const generatedAtTextEl = document.getElementById("generatedAtText");

const comparisonRowsEl = document.getElementById("comparisonRows");

const homePlayersTitleEl = document.getElementById("homePlayersTitle");
const awayPlayersTitleEl = document.getElementById("awayPlayersTitle");
const homePlayersListEl = document.getElementById("homePlayersList");
const awayPlayersListEl = document.getElementById("awayPlayersList");

const sourceListEl = document.getElementById("sourceList");
const warningBoxEl = document.getElementById("warningBox");

let teams = [];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(timestamp) {
  if (!timestamp) {
    return "N/A";
  }
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function toggleState({ loading = false, error = null, showDashboard = false }) {
  loadingEl.hidden = !loading;
  dashboardEl.hidden = !showDashboard;
  errorEl.hidden = !error;
  if (error) {
    errorMessageEl.textContent = error;
  }
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || "Beklenmeyen bir hata oluştu.");
  }
  return payload;
}

function renderTeamOptions() {
  const optionsMarkup = teams
    .map((team) => `<option value="${escapeHtml(team.slug)}">${escapeHtml(team.name)}</option>`)
    .join("");

  homeSelectEl.innerHTML = optionsMarkup;
  awaySelectEl.innerHTML = optionsMarkup;

  homeSelectEl.value = teams.some((team) => team.slug === "galatasaray")
    ? "galatasaray"
    : teams[0].slug;
  awaySelectEl.value = teams.some((team) => team.slug === "fenerbahce")
    ? "fenerbahce"
    : teams[1]?.slug || teams[0].slug;
}

function buildFormRow(recentForm) {
  if (!recentForm || !recentForm.length) {
    return '<div class="form-pill form-pill--d">-</div>';
  }

  return recentForm
    .map((result) => {
      const className =
        result === "W" ? "form-pill--w" : result === "L" ? "form-pill--l" : "form-pill--d";
      return `<div class="form-pill ${className}">${escapeHtml(result)}</div>`;
    })
    .join("");
}

function renderTeamPanel(snapshot, side) {
  const team = snapshot.team;
  const tff = snapshot.tff;
  const transfermarkt = snapshot.transfermarkt;
  const colors = team.colors || { primary: "#2d6cdf", secondary: "#ff8f43" };
  const badgeBackground = `linear-gradient(150deg, ${colors.primary}, ${colors.secondary})`;

  const badgeText = team.shortName || team.name.slice(0, 3).toUpperCase();

  const panelHtml = `
    <header class="team-head">
      <div class="team-id">
        <div class="badge" style="background:${escapeHtml(badgeBackground)}">${escapeHtml(badgeText)}</div>
        <div>
          <p class="team-name">${escapeHtml(team.name)}</p>
          <p class="team-city">${escapeHtml(team.city)}</p>
        </div>
      </div>
      <span>${side === "home" ? "Ev Sahibi" : "Deplasman"}</span>
    </header>
    <div class="form-row">${buildFormRow(tff.recentForm)}</div>
    <div class="mini-grid">
      <div class="mini-stat">
        <div class="label">Piyasa Değeri</div>
        <div class="value">${escapeHtml(transfermarkt.marketValue.display || "N/A")}</div>
      </div>
      <div class="mini-stat">
        <div class="label">Transfer Bilançosu</div>
        <div class="value">${escapeHtml(transfermarkt.netTransferBalance.display || "N/A")}</div>
      </div>
      <div class="mini-stat">
        <div class="label">Lig Pozisyonu</div>
        <div class="value">${escapeHtml(tff.leaguePosition ?? "N/A")}</div>
      </div>
      <div class="mini-stat">
        <div class="label">Puan</div>
        <div class="value">${escapeHtml(tff.points ?? "N/A")}</div>
      </div>
      <div class="mini-stat">
        <div class="label">Kadro</div>
        <div class="value">${escapeHtml(transfermarkt.squadSize ?? "N/A")}</div>
      </div>
      <div class="mini-stat">
        <div class="label">Yaş Ort.</div>
        <div class="value">${escapeHtml(transfermarkt.averageAge ?? "N/A")}</div>
      </div>
    </div>
  `;

  return panelHtml;
}

function renderComparisonRows(rows) {
  comparisonRowsEl.innerHTML = rows
    .map((row) => {
      const left = Number.isFinite(row.homeValue) ? row.homeValue : 0;
      const right = Number.isFinite(row.awayValue) ? row.awayValue : 0;
      const total = left + right;
      const leftPercent = total > 0 ? (left / total) * 100 : 50;
      const rightPercent = total > 0 ? (right / total) * 100 : 50;

      const trackStyle =
        row.winner === "home"
          ? "linear-gradient(90deg, #42e3a0, #49b8ff)"
          : row.winner === "away"
            ? "linear-gradient(90deg, #8c95ff, #ff6c95)"
            : "linear-gradient(90deg, #8da2be, #6e859f)";

      return `
        <div class="bar-row">
          <div class="bar-meta">
            <span>${escapeHtml(row.label)}</span>
            <span>${escapeHtml(row.homeDisplay)} - ${escapeHtml(row.awayDisplay)}</span>
          </div>
          <div class="bar-track">
            <div class="bar-progress" style="width:${Math.max(leftPercent, rightPercent)}%; background:${trackStyle};"></div>
          </div>
          <div class="bar-meta">
            <span>Ev: ${leftPercent.toFixed(0)}%</span>
            <span>Dep: ${rightPercent.toFixed(0)}%</span>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderPlayerList(element, players) {
  if (!players || !players.length) {
    element.innerHTML = "<li>Oyuncu verisi alınamadı.</li>";
    return;
  }

  element.innerHTML = players
    .map(
      (player) => `
      <li>
        <p class="player-name">${escapeHtml(player.name)}</p>
        <p class="player-value">${escapeHtml(player.marketValueDisplay || "N/A")}</p>
      </li>
    `,
    )
    .join("");
}

function renderSources(sources, warnings) {
  sourceListEl.innerHTML = sources
    .map((source) => {
      const isFallback = source.fallback ? "Evet" : "Hayır";
      return `
        <li>
          <span class="name">${escapeHtml(source.name || "Kaynak")}</span>
          <span class="meta">Güncelleme: ${escapeHtml(formatDateTime(source.fetchedAt))}</span>
          <span class="meta">Fallback: ${escapeHtml(isFallback)}</span>
        </li>
      `;
    })
    .join("");

  if (warnings && warnings.length) {
    warningBoxEl.hidden = false;
    warningBoxEl.innerHTML = warnings
      .map(
        (warning) =>
          `${escapeHtml(warning.team)}: ${escapeHtml(warning.source)} - ${escapeHtml(
            warning.message,
          )}`,
      )
      .join("<br>");
  } else {
    warningBoxEl.hidden = true;
    warningBoxEl.textContent = "";
  }
}

async function loadComparison(homeSlug, awaySlug) {
  toggleState({ loading: true, error: null, showDashboard: false });

  try {
    const payload = await fetchJson(
      `/api/compare?home=${encodeURIComponent(homeSlug)}&away=${encodeURIComponent(awaySlug)}`,
    );
    const comparison = payload.comparison;

    homePanelEl.innerHTML = renderTeamPanel(comparison.home, "home");
    awayPanelEl.innerHTML = renderTeamPanel(comparison.away, "away");
    generatedAtTextEl.textContent = formatDateTime(comparison.generatedAt);

    renderComparisonRows(comparison.comparisonRows || []);

    homePlayersTitleEl.textContent = comparison.home.team.name;
    awayPlayersTitleEl.textContent = comparison.away.team.name;
    renderPlayerList(homePlayersListEl, comparison.home.transfermarkt.topValuablePlayers);
    renderPlayerList(awayPlayersListEl, comparison.away.transfermarkt.topValuablePlayers);

    renderSources(comparison.sources || [], payload.warnings || []);

    toggleState({ loading: false, error: null, showDashboard: true });
  } catch (error) {
    toggleState({
      loading: false,
      error: error.message || "Karşılaştırma yüklenirken hata oluştu.",
      showDashboard: false,
    });
  }
}

async function init() {
  toggleState({ loading: true, error: null, showDashboard: false });

  try {
    const teamsPayload = await fetchJson("/api/teams");
    teams = teamsPayload.teams || [];
    if (teams.length < 2) {
      throw new Error("Karşılaştırma için yeterli takım verisi bulunamadı.");
    }

    renderTeamOptions();
    await loadComparison(homeSelectEl.value, awaySelectEl.value);
  } catch (error) {
    toggleState({
      loading: false,
      error: error.message || "Takım listesi alınamadı.",
      showDashboard: false,
    });
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (homeSelectEl.value === awaySelectEl.value) {
    toggleState({
      loading: false,
      error: "Aynı takımı iki kez seçemezsin, farklı takım seç.",
      showDashboard: false,
    });
    return;
  }
  await loadComparison(homeSelectEl.value, awaySelectEl.value);
});

init();
