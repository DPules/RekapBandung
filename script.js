// ⚠️ GANTI DENGAN URL DEPLOYMENT WEB APP APPS SCRIPT ANDA (Berakhiran /exec)
const API_URL =
  "https://script.google.com/macros/s/AKfycbytQnTdl9gEqBUX3dfXdwZoEoES54ntEYIrYQP4s1I9RHYjcmkse9IzUKRj-zW_kBRd1Q/exec";

let dashboardData = null;
let dailyChart = null;
let statusChart = null;
let filteredRows = [];

/* =========================
   LOAD DASHBOARD (FETCH API)
========================= */
function loadDashboard() {
  showLoading();

  fetch(API_URL, { method: "GET", redirect: "follow" })
    .then((res) => res.json())
    .then((data) => {
      if (data.error) throw new Error(data.error);
      dashboardData = data;
      initializeDashboard(data);
    })
    .catch((error) => {
      console.error("Gagal mengambil data dari Spreadsheet:", error);
      const tbody = document.getElementById("salesTable");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="loading" style="color:red;">Gagal mengambil data dari Spreadsheet.<br><small>${error.message}</small></td></tr>`;
      }
    });
}

/* =========================
   INITIALIZE DASHBOARD
========================= */
function initializeDashboard(data) {
  const totalKdkmpEl = document.getElementById("totalKdkmp");
  if (totalKdkmpEl) totalKdkmpEl.textContent = data.totalKdkmp || 34;

  populateKdkmpFilter(data.kdkmpList || []);
  renderKdkmpTable(data.kdkmpList || [], data.operationalKdkmp || []);

  // Set tanggal default (01 bulan berjalan s/d hari ini)
  setDefaultDates();

  // Terapkan filter awal ke semua tabel dan chart
  applyFilter();
  updateOperational(data);
  updateLastUpdate();
}

/* =========================
   SET DEFAULT TANGGAL
========================= */
function setDefaultDates() {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");

  if (startDateInput && !startDateInput.value)
    startDateInput.value = `${yyyy}-${mm}-01`;
  if (endDateInput && !endDateInput.value)
    endDateInput.value = `${yyyy}-${mm}-${dd}`;
}

/* =========================
   FILTER DROPDOWN KDKMP
========================= */
function populateKdkmpFilter(list) {
  const select = document.getElementById("kdkmpFilter");
  if (!select) return;

  select.innerHTML = `<option value="ALL">Semua KDKMP</option>`;
  list.forEach((name) => {
    select.innerHTML += `<option value="${name}">${name.replaceAll("_", " ")}</option>`;
  });
}

/* =========================
   APPLY FILTER GLOBAL
========================= */
function applyFilter() {
  if (!dashboardData || !dashboardData.rows) return;

  const start = document.getElementById("startDate")
    ? document.getElementById("startDate").value
    : "";
  const end = document.getElementById("endDate")
    ? document.getElementById("endDate").value
    : "";
  const kdkmp = document.getElementById("kdkmpFilter")
    ? document.getElementById("kdkmpFilter").value
    : "ALL";
  const status = document.getElementById("statusFilter")
    ? document.getElementById("statusFilter").value
    : "ALL";

  filteredRows = dashboardData.rows.filter((row) => {
    if (start && row.date && row.date < start) return false;
    if (end && row.date && row.date > end) return false;
    if (kdkmp !== "ALL" && row.kdkmp !== kdkmp) return false;

    if (status !== "ALL") {
      const stClean = String(row.status || "").toLowerCase();
      if (!stClean.includes(status.toLowerCase())) return false;
    }

    return true;
  });

  // Update ringkasan & grafik
  updateKPI(filteredRows);
  updateDailyChart(filteredRows);

  // Update seluruh tabel menu secara serentak
  updateTable(filteredRows); // Rekap Sales
  renderCloseShiftTable(filteredRows); // Menu Close Shift
  renderSetoranTable(filteredRows); // Menu Setoran
}

/* =========================
   UPDATE KPI CARDS
========================= */
function updateKPI(rows) {
  let closeShift = 0;
  let setorOmset = 0;

  rows.forEach((row) => {
    const statusClean = String(row.status || "")
      .toLowerCase()
      .trim();
    const val = Number(row.nominal || 0);

    if (statusClean.includes("setor") || statusClean.includes("omset")) {
      setorOmset += val;
    } else {
      closeShift += val;
    }
  });

  const selisih = closeShift - setorOmset;

  if (document.getElementById("totalOmset"))
    document.getElementById("totalOmset").textContent =
      formatRupiah(closeShift);
  if (document.getElementById("totalSetoran"))
    document.getElementById("totalSetoran").textContent =
      formatRupiah(setorOmset);
  if (document.getElementById("totalSelisih"))
    document.getElementById("totalSelisih").textContent = formatRupiah(selisih);
}

/* =========================
   UPDATE OPERATIONAL KPI
========================= */
function updateOperational(data) {
  const operational = (data.operationalKdkmp || []).length;
  const total = data.totalKdkmp || 34;
  const belum = total - operational < 0 ? 0 : total - operational;

  if (document.getElementById("operasional"))
    document.getElementById("operasional").textContent = operational;
  if (document.getElementById("belumOperasional"))
    document.getElementById("belumOperasional").textContent = belum;

  createStatusChart(operational, belum);
}

/* =========================
   TABEL REKAP SALES (UTAMA)
========================= */
function updateTable(rows) {
  const tbody = document.getElementById("salesTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Tidak ada data transaksi.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  rows.forEach((row, index) => {
    const proof =
      row.bukti && row.bukti.startsWith("http")
        ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>`
        : "-";
    const isSetor = String(row.status || "")
      .toLowerCase()
      .includes("setor");
    const badgeClass = !isSetor ? "badge-success" : "badge-warning";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</td>
      <td>${!isSetor ? formatRupiah(row.nominal) : "-"}</td>
      <td>${isSetor ? formatRupiah(row.nominal) : "-"}</td>
      <td>${!isSetor ? formatRupiah(row.nominal) : "-" + formatRupiah(row.nominal)}</td>
      <td><span class="badge ${badgeClass}">${row.status || "Close Shift"}</span></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });

  if (document.getElementById("tableInfo"))
    document.getElementById("tableInfo").textContent =
      rows.length + " transaksi";
}

/* =========================
   TABEL MENU KDKMP
========================= */
function renderKdkmpTable(kdkmpList, operationalList) {
  const tbody = document.getElementById("kdkmpTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  kdkmpList.forEach((name, index) => {
    const isOperational = operationalList.includes(name);
    const badgeClass = isOperational ? "badge-success" : "badge-warning";
    const statusText = isOperational ? "Operasional" : "Belum Operasional";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${name.replaceAll("_", " ")}</strong></td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   TABEL MENU CLOSE SHIFT
========================= */
function renderCloseShiftTable(rows) {
  const tbody = document.getElementById("closeShiftTableBody");
  if (!tbody) return;

  const closeRows = rows.filter(
    (row) =>
      !String(row.status || "")
        .toLowerCase()
        .includes("setor"),
  );
  if (!closeRows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Belum ada transaksi close shift.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  closeRows.forEach((row, index) => {
    const proof =
      row.bukti && row.bukti.startsWith("http")
        ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>`
        : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td><strong>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</strong></td>
      <td><strong style="color: #18864b;">${formatRupiah(row.nominal)}</strong></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   TABEL MENU SETORAN
========================= */
function renderSetoranTable(rows) {
  const tbody = document.getElementById("setoranTableBody");
  if (!tbody) return;

  const setoranRows = rows.filter((row) =>
    String(row.status || "")
      .toLowerCase()
      .includes("setor"),
  );
  if (!setoranRows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Belum ada transaksi setor omset.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";
  setoranRows.forEach((row, index) => {
    const proof =
      row.bukti && row.bukti.startsWith("http")
        ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>`
        : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td><strong>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</strong></td>
      <td><strong style="color: #087da5;">${formatRupiah(row.nominal)}</strong></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   CHARTS & FORMATTERS
========================= */
function updateDailyChart(rows) {
  const map = {};
  rows.forEach((row) => {
    const d = row.date || "Lainnya";
    if (!map[d]) map[d] = { close: 0, setor: 0 };
    const isClose = !String(row.status || "")
      .toLowerCase()
      .includes("setor");
    if (isClose) map[d].close += Number(row.nominal || 0);
    else map[d].setor += Number(row.nominal || 0);
  });

  const dates = Object.keys(map).sort();
  if (dailyChart) dailyChart.destroy();

  const ctx = document.getElementById("dailyChart")?.getContext("2d");
  if (!ctx) return;

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates.map(formatDate),
      datasets: [
        {
          label: "Close Shift",
          data: dates.map((d) => map[d].close),
          tension: 0.3,
          borderColor: "#18864b",
        },
        {
          label: "Setor Omset",
          data: dates.map((d) => map[d].setor),
          tension: 0.3,
          borderColor: "#087da5",
        },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false },
  });
}

function createStatusChart(operational, belum) {
  if (statusChart) statusChart.destroy();
  const ctx = document.getElementById("statusChart")?.getContext("2d");
  if (!ctx) return;

  statusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Operasional", "Belum Operasional"],
      datasets: [
        { data: [operational, belum], backgroundColor: ["#18864b", "#d17b00"] },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

function formatRupiah(value) {
  return "Rp " + Number(value || 0).toLocaleString("id-ID");
}
function formatDate(date) {
  if (!date) return "-";
  const parts = String(date).split("-");
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : date;
}
function updateLastUpdate() {
  const el = document.getElementById("lastUpdate");
  if (el) el.textContent = "Update: " + new Date().toLocaleString("id-ID");
}
function showLoading() {
  const tbody = document.getElementById("salesTable");
  if (tbody)
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Memuat data dari Spreadsheet...</td></tr>`;
}

/* =========================
   SIDEBAR NAVIGATION HANDLER
========================= */
function initSidebar() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".page-section");
  const pageTitle = document.getElementById("pageTitle");
  const pageSub = document.getElementById("pageSub");

  const titles = {
    "sec-dashboard": {
      title: "Dashboard Sales",
      sub: "Monitoring operasional dan setoran KDKMP Area Bandung",
    },
    "sec-kdkmp": {
      title: "Data KDKMP",
      sub: "Daftar outlet dan status operasional KDKMP",
    },
    "sec-closeshift": {
      title: "Data Close Shift",
      sub: "Monitoring transaksi harian close shift KDKMP",
    },
    "sec-setoran": {
      title: "Data Setoran",
      sub: "Monitoring khusus transaksi setor omset KDKMP",
    },
    "sec-rekap": {
      title: "Rekap Sales",
      sub: "Rincian seluruh transaksi sales dan perbandingan omset",
    },
  };

  navItems.forEach((button) => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      if (!targetId) return;

      navItems.forEach((item) => item.classList.remove("active"));
      this.classList.add("active");

      sections.forEach((sec) => {
        sec.style.display = "none";
        sec.classList.remove("active-section");
      });

      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = "block";
        targetSection.classList.add("active-section");
      }

      if (titles[targetId]) {
        if (pageTitle) pageTitle.textContent = titles[targetId].title;
        if (pageSub) pageSub.textContent = titles[targetId].sub;
      }
    });
  });
}

document.addEventListener("DOMContentLoaded", function () {
  loadDashboard();
  initSidebar();
});
