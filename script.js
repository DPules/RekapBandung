// GANTI DENGAN URL DEPLOYMENT WEB APP APPS SCRIPT ANDA (Berakhiran /exec)
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

  fetch(API_URL, {
    method: "GET",
    redirect: "follow",
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("HTTP error! Status: " + response.status);
      }
      return response.json();
    })
    .then((data) => {
      console.log("Data berhasil diterima dari Spreadsheet:", data);

      if (data.error) {
        throw new Error(data.error);
      }

      dashboardData = data;
      initializeDashboard(data);
    })
    .catch((error) => {
      console.error("Gagal mengambil data dari Spreadsheet:", error);
      const salesTable = document.getElementById("salesTable");
      if (salesTable) {
        salesTable.innerHTML = `
          <tr>
            <td colspan="8" class="loading" style="color: red;">
              Gagal mengambil data dari Spreadsheet.<br>
              <small>${error.message}</small>
            </td>
          </tr>
        `;
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

  // Render Tabel Menu KDKMP & Setoran
  renderKdkmpTable(data.kdkmpList || [], data.operationalKdkmp || []);
  renderSetoranTable(data.rows || []);

  // Filter & Render Dashboard Utama
  applyFilter();
  updateOperational(data);
  updateLastUpdate();
}

/* =========================
   FILTER DROPDOWN KDKMP
========================= */
function populateKdkmpFilter(list) {
  const select = document.getElementById("kdkmpFilter");
  if (!select) return;

  select.innerHTML = `<option value="ALL">Semua KDKMP</option>`;

  list.forEach(function (name) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = String(name).replaceAll("_", " ");
    select.appendChild(option);
  });
}

/* =========================
   APPLY FILTER
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

  filteredRows = dashboardData.rows.filter(function (row) {
    if (start && row.date && row.date < start) return false;
    if (end && row.date && row.date > end) return false;
    if (kdkmp !== "ALL" && row.kdkmp !== kdkmp) return false;

    if (status !== "ALL") {
      const stClean = String(row.status || "").toLowerCase();
      const statusTarget = status.toLowerCase();
      if (!stClean.includes(statusTarget)) return false;
    }

    return true;
  });

  updateKPI(filteredRows);
  updateTable(filteredRows);
  updateDailyChart(filteredRows);
}

/* =========================
   UPDATE KPI CARDS (FIXED PENJUMLAHAN SETORAN)
========================= */
function updateKPI(rows) {
  let closeShift = 0;
  let setorOmset = 0;

  rows.forEach(function (row) {
    const statusClean = String(row.status || "")
      .toLowerCase()
      .trim();
    const val = Number(row.nominal || 0);

    // Cek kata kunci status setor / omset
    if (statusClean.includes("setor") || statusClean === "setor omset") {
      setorOmset += val;
    } else if (statusClean.includes("close") || statusClean === "close shift") {
      closeShift += val;
    } else {
      // Jika status berisi nama orang atau tidak teridentifikasi, hitung sebagai close shift
      closeShift += val;
    }
  });

  const selisih = closeShift - setorOmset;

  const omsetEl = document.getElementById("totalOmset");
  const setoranEl = document.getElementById("totalSetoran");
  const selisihEl = document.getElementById("totalSelisih");

  if (omsetEl) omsetEl.textContent = formatRupiah(closeShift);
  if (setoranEl) setoranEl.textContent = formatRupiah(setorOmset);
  if (selisihEl) selisihEl.textContent = formatRupiah(selisih);
}

/* =========================
   UPDATE OPERATIONAL KPI
========================= */
function updateOperational(data) {
  const operational = (data.operationalKdkmp || []).length;
  const total = data.totalKdkmp || 34;
  const belum = total - operational;

  const opEl = document.getElementById("operasional");
  const belumEl = document.getElementById("belumOperasional");

  if (opEl) opEl.textContent = operational;
  if (belumEl) belumEl.textContent = belum < 0 ? 0 : belum;

  createStatusChart(operational, belum < 0 ? 0 : belum);
}

/* =========================
   TABEL UTAMA (REKAP SALES)
========================= */
function updateTable(rows) {
  const tbody = document.getElementById("salesTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Tidak ada data transaksi.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  rows.forEach(function (row, index) {
    const tr = document.createElement("tr");

    let proof = "-";
    if (row.bukti && row.bukti.startsWith("http")) {
      proof = `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>`;
    }

    const isSetor = String(row.status || "")
      .toLowerCase()
      .includes("setor");
    const badgeClass = !isSetor ? "badge-success" : "badge-warning";

    const closeShiftVal = !isSetor ? formatRupiah(row.nominal) : "-";
    const setorOmsetVal = isSetor ? formatRupiah(row.nominal) : "-";
    const selisihVal = !isSetor
      ? formatRupiah(row.nominal)
      : "-" + formatRupiah(row.nominal);

    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td>${row.kdkmp}</td>
      <td>${closeShiftVal}</td>
      <td>${setorOmsetVal}</td>
      <td>${selisihVal}</td>
      <td><span class="badge ${badgeClass}">${row.status || "Close Shift"}</span></td>
      <td>${proof}</td>
    `;

    tbody.appendChild(tr);
  });

  const tableInfo = document.getElementById("tableInfo");
  if (tableInfo) tableInfo.textContent = rows.length + " transaksi";
}

/* =========================
   TABEL MENU KDKMP
========================= */
function renderKdkmpTable(kdkmpList, operationalList) {
  const tbody = document.getElementById("kdkmpTableBody");
  if (!tbody) return;

  if (!kdkmpList.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="loading">Tidak ada data KDKMP.</td></tr>`;
    return;
  }

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
   TABEL MENU SETORAN
========================= */
function renderSetoranTable(rows) {
  const tbody = document.getElementById("setoranTableBody");
  if (!tbody) return;

  const setoranRows = rows.filter((row) => {
    const stClean = String(row.status || "")
      .toLowerCase()
      .trim();
    return stClean.includes("setor") || stClean.includes("omset");
  });

  if (!setoranRows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading">Belum ada transaksi setor omset.</td></tr>`;
    return;
  }

  tbody.innerHTML = "";

  setoranRows.forEach((row, index) => {
    let proof = "-";
    if (row.bukti && row.bukti.startsWith("http")) {
      proof = `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>`;
    }

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td>${row.kdkmp}</td>
      <td><strong style="color: #087da5;">${formatRupiah(row.nominal)}</strong></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================
   DAILY CHART
========================= */
function updateDailyChart(rows) {
  const map = {};

  rows.forEach(function (row) {
    const d = row.date || "Lainnya";
    if (!map[d]) {
      map[d] = { close: 0, setor: 0 };
    }
    const isClose = !String(row.status || "")
      .toLowerCase()
      .includes("setor");
    if (isClose) {
      map[d].close += Number(row.nominal || 0);
    } else {
      map[d].setor += Number(row.nominal || 0);
    }
  });

  const dates = Object.keys(map).sort();
  const closeData = dates.map((d) => map[d].close);
  const setorData = dates.map((d) => map[d].setor);

  if (dailyChart) {
    dailyChart.destroy();
  }

  const chartCanvas = document.getElementById("dailyChart");
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext("2d");

  dailyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: dates.map(formatDate),
      datasets: [
        {
          label: "Close Shift",
          data: closeData,
          tension: 0.3,
          borderColor: "#18864b",
        },
        {
          label: "Setor Omset",
          data: setorData,
          tension: 0.3,
          borderColor: "#087da5",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: function (value) {
              return formatShortRupiah(value);
            },
          },
        },
      },
    },
  });
}

/* =========================
   STATUS CHART
========================= */
function createStatusChart(operational, belum) {
  if (statusChart) {
    statusChart.destroy();
  }

  const chartCanvas = document.getElementById("statusChart");
  if (!chartCanvas) return;

  const ctx = chartCanvas.getContext("2d");

  statusChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Operasional", "Belum Operasional"],
      datasets: [
        {
          data: [operational, belum],
          backgroundColor: ["#18864b", "#d17b00"],
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: "bottom" } },
    },
  });
}

/* =========================
   UTILS & FORMATTERS
========================= */
function formatRupiah(value) {
  return "Rp " + Number(value || 0).toLocaleString("id-ID");
}

function formatShortRupiah(value) {
  value = Number(value || 0);
  if (value >= 1000000000)
    return "Rp " + (value / 1000000000).toFixed(1) + " M";
  if (value >= 1000000) return "Rp " + (value / 1000000).toFixed(1) + " Jt";
  if (value >= 1000) return "Rp " + (value / 1000).toFixed(0) + " Rb";
  return "Rp " + value;
}

function formatDate(date) {
  if (!date) return "-";
  const parts = String(date).split("-");
  if (parts.length !== 3) return date;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

function updateLastUpdate() {
  const now = new Date();
  const lastUpdate = document.getElementById("lastUpdate");
  if (lastUpdate) {
    lastUpdate.textContent = "Update: " + now.toLocaleString("id-ID");
  }
}

function showLoading() {
  const tbody = document.getElementById("salesTable");
  if (tbody) {
    tbody.innerHTML = `<tr><td colspan="8" class="loading">Memuat data dari Spreadsheet...</td></tr>`;
  }
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
