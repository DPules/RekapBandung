// ⚠️ GANTI DENGAN URL DEPLOYMENT WEB APP APPS SCRIPT ANDA (Berakhiran /exec)
const API_URL = "https://script.google.com/macros/s/AKfycbyBs-njA5p7SukhDamHQ3hCg4-N4BqGFiY5T5-HfSKm2Xz3sQvDL9Yg7mZUhBsQb2B_/exec";

let dashboardData = null;
let dailyChart = null;
let statusChart = null;
let filteredRows = [];

// KONFIGURASI PAGINASI
const ROWS_PER_PAGE = 10;
let currentPageSales = 1;
let currentPageClose = 1;
let currentPageSetor = 1;
let currentPageRanking = 1;

/* =========================================================
   MAPPING WILAYAH KDKMP (BANDUNG BARAT VS KAB. BANDUNG)
========================================================= */
const AREA_MAPPING = {
  BANDUNG_BARAT: [
    "Lembang", "Parongpong", "Cisarua", "Cikalongwetan", "Cipeundeuy",
    "Ngamprah", "Cipatat", "Padalarang", "Batujajar", "Cihampelas",
    "Cililin", "Cipongkor", "Rongga", "Sindangkerta", "Gununghalu", "Saguling",
    "Cihanjuang", "Gadobangkong", "Cibodas", "Laksana", "Mekarsari", "Kertamulya",
    "Karyawangi", "Cijenuk", "Cikahuripan", "Cipangeran", "Ciharashas", "Bongas", "Sukatani"
  ],
  KAB_BANDUNG: [
    "Nagreg", "Cicalengka", "Rancaekek", "Majalaya", "Cikancung",
    "Paseh", "Ibun", "Soreang", "Katapang", "Banjaran", "Arjasari",
    "Pameungpeuk", "Pangalengan", "Kertasari", "Pacet", "Ciparay",
    "Baleendah", "Dayeuhkolot", "Bojongsoang", "Margahayu", "Margaasih",
    "Ciwidey", "Rancabali", "Pasirjambu", "Cimaung", "Cileunyi", "Cilengkrang", "Cimenyan",
    "Cipeujeuh", "Citaman", "Bojongloa", "Sukamaju", "Jelekong", "Andir",
    "Pulosari", "Babakan", "Rahayu", "Cangkuang", "Mandalawangi", "Mekarjaya", "Tangsimekar"
  ]
};

function getKdkmpArea(kdkmpName) {
  const clean = String(kdkmpName || '').toLowerCase().replace(/_/g, ' ');

  const isKBB = AREA_MAPPING.BANDUNG_BARAT.some(key => clean.includes(key.toLowerCase()));
  if (isKBB) return "BANDUNG_BARAT";

  const isKabBandung = AREA_MAPPING.KAB_BANDUNG.some(key => clean.includes(key.toLowerCase()));
  if (isKabBandung) return "KAB_BANDUNG";

  return "KAB_BANDUNG";
}

function getAreaBadge(areaCode) {
  if (areaCode === "BANDUNG_BARAT") {
    return `<span class="area-badge area-kbb">Bandung Barat</span>`;
  }
  return `<span class="area-badge area-kab">Kab. Bandung</span>`;
}

/* =========================================================
   HELPER FORMAT TANGGAL (DD-MM-YYYY <-> YYYY-MM-DD)
========================================================= */
function toISODate(dateVal) {
  if (!dateVal) return "";
  let str = String(dateVal).trim();

  if (str.includes("-") || str.includes("/")) {
    const delimiter = str.includes("-") ? "-" : "/";
    const parts = str.split(delimiter);

    if (parts.length === 3) {
      if (parts[0].length <= 2 && parts[2].length === 4) {
        const dd = parts[0].padStart(2, '0');
        const mm = parts[1].padStart(2, '0');
        const yyyy = parts[2];
        return `${yyyy}-${mm}-${dd}`;
      }
      if (parts[0].length === 4 && parts[2].length <= 2) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
    }
  }

  const d = new Date(dateVal);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  return str;
}

function formatDate(dateVal) {
  const iso = toISODate(dateVal);
  if (!iso) return "-";
  const parts = iso.split("-");
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : iso;
}

/* =========================================================
   LOAD DASHBOARD (FETCH API)
========================================================= */
function loadDashboard() {
  showLoading();

  fetch(API_URL, { method: "GET", redirect: "follow" })
    .then(res => res.json())
    .then(data => {
      if (data.error) throw new Error(data.error);
      dashboardData = data;
      initializeDashboard(data);
    })
    .catch(error => {
      console.error("Gagal mengambil data dari Spreadsheet:", error);
      const tbody = document.getElementById("salesTable");
      if (tbody) {
        tbody.innerHTML = `<tr><td colspan="9" class="loading" style="color:red;">Gagal mengambil data dari Spreadsheet.<br><small>${error.message}</small></td></tr>`;
      }
    });
}

function initializeDashboard(data) {
  setDefaultDates();
  onAreaChange();
  updateLastUpdate();
}

function setDefaultDates() {
  const startDateInput = document.getElementById("startDate");
  const endDateInput = document.getElementById("endDate");

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');

  const firstDayStr = `${yyyy}-${mm}-01`;
  const lastDay = new Date(yyyy, today.getMonth() + 1, 0).getDate();
  const lastDayStr = `${yyyy}-${mm}-${String(lastDay).padStart(2, '0')}`;

  if (startDateInput && !startDateInput.value) startDateInput.value = firstDayStr;
  if (endDateInput && !endDateInput.value) endDateInput.value = lastDayStr;
}

/* =========================================================
   HANDLER PERUBAHAN FILTER AREA
========================================================= */
function onAreaChange() {
  if (!dashboardData) return;
  const selectedArea = document.getElementById("areaFilter")?.value || "ALL";

  const sidebarSub = document.getElementById("sidebarAreaSubtitle");
  const chartSub = document.getElementById("chartStatusSub");
  if (selectedArea === "BANDUNG_BARAT") {
    if (sidebarSub) sidebarSub.textContent = "Area Bandung Barat";
    if (chartSub) chartSub.textContent = "Operasional Area Bandung Barat";
  } else if (selectedArea === "KAB_BANDUNG") {
    if (sidebarSub) sidebarSub.textContent = "Area Kab. Bandung";
    if (chartSub) chartSub.textContent = "Operasional Area Kab. Bandung";
  } else {
    if (sidebarSub) sidebarSub.textContent = "Bandung Area";
    if (chartSub) chartSub.textContent = "Operasional Seluruh Area";
  }

  const filteredKdkmpList = (dashboardData.kdkmpList || []).filter(name => {
    if (selectedArea === "ALL") return true;
    return getKdkmpArea(name) === selectedArea;
  });

  populateKdkmpFilter(filteredKdkmpList);
  applyFilter();
}

function populateKdkmpFilter(list) {
  const select = document.getElementById("kdkmpFilter");
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = `<option value="ALL">Semua KDKMP</option>`;
  list.forEach(name => {
    select.innerHTML += `<option value="${name}">${name.replaceAll("_", " ")}</option>`;
  });

  if (list.includes(currentVal)) {
    select.value = currentVal;
  }
}

/* =========================================================
   APPLY FILTER & RENDER SEMUA KOMPONEN
========================================================= */
function applyFilter() {
  if (!dashboardData || !dashboardData.rows) return;

  const start = document.getElementById("startDate")?.value || "";
  const end = document.getElementById("endDate")?.value || "";
  const area = document.getElementById("areaFilter")?.value || "ALL";
  const kdkmp = document.getElementById("kdkmpFilter")?.value || "ALL";
  const status = document.getElementById("statusFilter")?.value || "ALL";

  filteredRows = dashboardData.rows.filter(row => {
    const rowDateISO = toISODate(row.date);
    if (start && rowDateISO && rowDateISO < start) return false;
    if (end && rowDateISO && rowDateISO > end) return false;

    if (area !== "ALL" && getKdkmpArea(row.kdkmp) !== area) return false;
    if (kdkmp !== "ALL" && row.kdkmp !== kdkmp) return false;

    if (status !== "ALL") {
      const stClean = String(row.status || '').toLowerCase();
      if (!stClean.includes(status.toLowerCase())) return false;
    }

    return true;
  });

  filteredRows.sort((a, b) => new Date(toISODate(b.date) || 0) - new Date(toISODate(a.date) || 0));

  currentPageSales = 1;
  currentPageClose = 1;
  currentPageSetor = 1;
  currentPageRanking = 1;

  updateKPI(filteredRows);
  updateDailyChart(filteredRows);
  updateOperationalByArea(area);

  renderKdkmpTableByArea(area);
  updateTable(filteredRows);
  renderCloseShiftTable(filteredRows);
  renderSetoranTable(filteredRows);
  renderRankingTable(filteredRows, area);

  checkSystemAlerts(filteredRows, area);
}

/* =========================================================
   DETEKSI DOUBLE INPUT (PATOKAN KOLOM O) & KDKMP BELUM MENGISI
========================================================= */
function checkSystemAlerts(rows, selectedArea = "ALL") {
  const alertContainer = document.getElementById("alertContainer");
  if (!alertContainer) return;

  alertContainer.innerHTML = "";

  // 1. DETEKSI DOUBLE INPUT BERDASARKAN KOLOM O SPREADSHEET (row.flagDouble)
  const duplicates = [];
  const seenDupKeys = new Set();

  rows.forEach(row => {
    const flag = String(row.flagDouble || '').trim().toUpperCase();
    if (!flag.includes("DOUBLE")) return;

    const rowDateISO = toISODate(row.date);
    if (!rowDateISO || !row.kdkmp) return;

    const isSetor = String(row.status || '').toLowerCase().includes("setor");
    const typeKey = isSetor ? "Setor Omset" : "Close Shift";
    const dupKey = `${rowDateISO}_${row.kdkmp.trim().toLowerCase()}_${typeKey}`;

    if (!seenDupKeys.has(dupKey)) {
      seenDupKeys.add(dupKey);
      duplicates.push({
        date: rowDateISO,
        kdkmp: row.kdkmp,
        type: typeKey,
        rawFlag: flag
      });
    }
  });

  if (duplicates.length > 0) {
    let dupHtml = `<div style="background: #fcebea; border: 1px solid #f5c6cb; color: #721c24; padding: 14px; border-radius: 10px; font-size: 13px;">`;
    dupHtml += `<strong><i class="fa-solid fa-triangle-exclamation"></i> Terdeteksi Pengisian Ganda (Kolom O):</strong><ul style="margin: 8px 0 0 18px; padding: 0; max-height: 180px; overflow-y: auto;">`;

    duplicates.forEach(dup => {
      const badge = getAreaBadge(getKdkmpArea(dup.kdkmp));
      dupHtml += `<li><strong>${dup.kdkmp.replaceAll("_", " ")}</strong> ${badge} — <u>${dup.type}</u> (${dup.rawFlag}) pada tanggal <strong>${formatDate(dup.date)}</strong></li>`;
    });

    dupHtml += `</ul></div>`;
    alertContainer.innerHTML += dupHtml;
  }

  // 2. PETAKAN TANGGAL OPERASIONAL PERTAMA MASING-MASING KDKMP
  const kdkmpFirstDateMap = {};
  (dashboardData.rows || []).forEach(row => {
    const rowDateISO = toISODate(row.date);
    if (row.kdkmp && rowDateISO) {
      const cleanName = row.kdkmp.trim().toLowerCase();
      if (!kdkmpFirstDateMap[cleanName] || rowDateISO < kdkmpFirstDateMap[cleanName]) {
        kdkmpFirstDateMap[cleanName] = rowDateISO;
      }
    }
  });

  const now = new Date();
  const currentHour = now.getHours();
  const todayStr = toISODate(now);

  const activeKdkmp = (dashboardData.operationalKdkmp || []).filter(k => {
    if (selectedArea === "ALL") return true;
    return getKdkmpArea(k) === selectedArea;
  });

  if (!activeKdkmp.length) return;

  const datesMonthToYesterday = [];
  const yyyy = now.getFullYear();
  const mm = now.getMonth();
  const currentDateNum = now.getDate();

  for (let d = 1; d < currentDateNum; d++) {
    const dateObj = new Date(yyyy, mm, d);
    datesMonthToYesterday.push(toISODate(dateObj));
  }

  const allRowsInArea = (dashboardData.rows || []).filter(r =>
    selectedArea === "ALL" || getKdkmpArea(r.kdkmp) === selectedArea
  );

  // A. LOGIKA CLOSE SHIFT (Hari Ini >= 17:00 & Bulan Ini)
  const checkDatesClose = [...datesMonthToYesterday];
  if (currentHour >= 17) {
    checkDatesClose.push(todayStr);
  }

  const missingCloseDetails = [];
  checkDatesClose.reverse().forEach(tgl => {
    const filledCloseOnDate = new Set();
    allRowsInArea.forEach(row => {
      const rowDateISO = toISODate(row.date);
      const isSetor = String(row.status || '').toLowerCase().includes("setor");
      if (!isSetor && rowDateISO === tgl && row.kdkmp) {
        filledCloseOnDate.add(row.kdkmp.trim().toLowerCase());
      }
    });

    const unsubmitted = activeKdkmp.filter(k => {
      const cleanK = k.trim().toLowerCase();
      const firstDate = kdkmpFirstDateMap[cleanK];
      return firstDate && firstDate <= tgl && !filledCloseOnDate.has(cleanK);
    });

    if (unsubmitted.length > 0) {
      missingCloseDetails.push({
        date: tgl,
        isToday: (tgl === todayStr),
        outlets: unsubmitted
      });
    }
  });

  // B. LOGIKA SETOR OMSET (Seluruh Hari di Bulan Ini s/d Kemarin)
  const checkDatesSetor = [...datesMonthToYesterday];
  const missingSetorDetails = [];

  checkDatesSetor.reverse().forEach(tgl => {
    const filledSetorOnDate = new Set();
    allRowsInArea.forEach(row => {
      const rowDateISO = toISODate(row.date);
      const isSetor = String(row.status || '').toLowerCase().includes("setor");
      if (isSetor && rowDateISO === tgl && row.kdkmp) {
        filledSetorOnDate.add(row.kdkmp.trim().toLowerCase());
      }
    });

    const unsubmitted = activeKdkmp.filter(k => {
      const cleanK = k.trim().toLowerCase();
      const firstDate = kdkmpFirstDateMap[cleanK];
      return firstDate && firstDate <= tgl && !filledSetorOnDate.has(cleanK);
    });

    if (unsubmitted.length > 0) {
      missingSetorDetails.push({
        date: tgl,
        outlets: unsubmitted
      });
    }
  });

  // RENDER PERINGATAN KETERLAMBATAN
  if (missingCloseDetails.length > 0 || missingSetorDetails.length > 0) {
    const areaTitle = selectedArea === "BANDUNG_BARAT" ? "Area Bandung Barat" : (selectedArea === "KAB_BANDUNG" ? "Area Kab. Bandung" : "Semua Area");
    let missingHtml = `<div style="background: #fff3df; border: 1px solid #ffeeba; color: #856404; padding: 14px; border-radius: 10px; font-size: 13px;">`;
    missingHtml += `<strong><i class="fa-solid fa-circle-exclamation"></i> Monitoring Keterlambatan Pengisian (${areaTitle}):</strong><div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-top: 10px;">`;

    if (missingCloseDetails.length > 0) {
      missingHtml += `<div style="background: rgba(255,255,255,0.75); padding: 10px; border-radius: 8px;">`;
      missingHtml += `<strong style="color: #a71d2a;"><i class="fa-solid fa-clock"></i> Belum Close Shift (Bulan Ini):</strong><ul style="margin: 6px 0 0 16px; padding: 0; max-height: 220px; overflow-y: auto;">`;

      missingCloseDetails.forEach(item => {
        const labelHari = item.isToday ? " <strong>(Hari Ini)</strong>" : "";
        item.outlets.forEach(name => {
          const badge = selectedArea === "ALL" ? getAreaBadge(getKdkmpArea(name)) : "";
          missingHtml += `<li><strong>${name.replaceAll("_", " ")}</strong>${badge} — Belum Close Shift pertanggal <u>${formatDate(item.date)}</u>${labelHari}</li>`;
        });
      });

      missingHtml += `</ul></div>`;
    }

    if (missingSetorDetails.length > 0) {
      missingHtml += `<div style="background: rgba(255,255,255,0.75); padding: 10px; border-radius: 8px;">`;
      missingHtml += `<strong style="color: #a71d2a;"><i class="fa-solid fa-triangle-exclamation"></i> Belum Setor Omset (Bulan Ini):</strong><ul style="margin: 6px 0 0 16px; padding: 0; max-height: 220px; overflow-y: auto;">`;

      missingSetorDetails.forEach(item => {
        item.outlets.forEach(name => {
          const badge = selectedArea === "ALL" ? getAreaBadge(getKdkmpArea(name)) : "";
          missingHtml += `<li><strong>${name.replaceAll("_", " ")}</strong>${badge} — Belum Setor pertanggal <u>${formatDate(item.date)}</u></li>`;
        });
      });

      missingHtml += `</ul></div>`;
    }

    missingHtml += `</div></div>`;
    alertContainer.innerHTML += missingHtml;
  }
}

/* =========================================================
   UPDATE KPI CARDS & OPERATIONAL PER AREA
========================================================= */
function updateKPI(rows) {
  let closeShift = 0;
  let setorOmset = 0;

  rows.forEach(row => {
    const statusClean = String(row.status || '').toLowerCase().trim();
    const val = Number(row.nominal || 0);

    if (statusClean.includes("setor") || statusClean.includes("omset")) {
      setorOmset += val;
    } else {
      closeShift += val;
    }
  });

  const selisih = closeShift - setorOmset;

  if (document.getElementById("totalOmset")) document.getElementById("totalOmset").textContent = formatRupiah(closeShift);
  if (document.getElementById("totalSetoran")) document.getElementById("totalSetoran").textContent = formatRupiah(setorOmset);
  if (document.getElementById("totalSelisih")) document.getElementById("totalSelisih").textContent = formatRupiah(selisih);
}

function updateOperationalByArea(selectedArea) {
  if (!dashboardData) return;

  const allList = (dashboardData.kdkmpList || []).filter(k =>
    selectedArea === "ALL" || getKdkmpArea(k) === selectedArea
  );
  const opList = (dashboardData.operationalKdkmp || []).filter(k =>
    selectedArea === "ALL" || getKdkmpArea(k) === selectedArea
  );

  const total = selectedArea === "ALL" ? (dashboardData.totalKdkmp || allList.length) : allList.length;
  const operational = opList.length;
  const belum = Math.max(0, total - operational);

  if (document.getElementById("totalKdkmp")) document.getElementById("totalKdkmp").textContent = total;
  if (document.getElementById("operasional")) document.getElementById("operasional").textContent = operational;
  if (document.getElementById("belumOperasional")) document.getElementById("belumOperasional").textContent = belum;

  createStatusChart(operational, belum);
}

/* =========================================================
   TABEL MENU KDKMP
========================================================= */
function renderKdkmpTableByArea(selectedArea) {
  const tbody = document.getElementById("kdkmpTableBody");
  if (!tbody || !dashboardData) return;
  tbody.innerHTML = "";

  const firstDateMap = {};
  (dashboardData.rows || []).forEach(r => {
    const iso = toISODate(r.date);
    if (r.kdkmp && iso) {
      if (!firstDateMap[r.kdkmp] || iso < firstDateMap[r.kdkmp]) {
        firstDateMap[r.kdkmp] = iso;
      }
    }
  });

  const kdkmpList = (dashboardData.kdkmpList || []).filter(k =>
    selectedArea === "ALL" || getKdkmpArea(k) === selectedArea
  );
  const operationalList = dashboardData.operationalKdkmp || [];

  kdkmpList.forEach((name, index) => {
    const isOperational = operationalList.includes(name);
    const badgeClass = isOperational ? "badge-success" : "badge-warning";
    const statusText = isOperational ? "Operasional" : "Belum Operasional";
    const areaBadge = getAreaBadge(getKdkmpArea(name));
    const startOpDate = firstDateMap[name] ? formatDate(firstDateMap[name]) : "-";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td><strong>${name.replaceAll("_", " ")}</strong></td>
      <td>${areaBadge}</td>
      <td>${startOpDate}</td>
      <td><span class="badge ${badgeClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/* =========================================================
   TABEL PERINGKAT OMSET
========================================================= */
function renderRankingTable(rows, selectedArea = "ALL") {
  const tbody = document.getElementById("rankingTableBody");
  if (!tbody) return;

  const mapKdkmp = {};
  (dashboardData.kdkmpList || []).forEach(kdkmp => {
    if (selectedArea === "ALL" || getKdkmpArea(kdkmp) === selectedArea) {
      mapKdkmp[kdkmp] = { close: 0, setor: 0 };
    }
  });

  rows.forEach(row => {
    if (!row.kdkmp) return;
    if (!mapKdkmp[row.kdkmp]) mapKdkmp[row.kdkmp] = { close: 0, setor: 0 };

    const isSetor = String(row.status || '').toLowerCase().includes("setor");
    if (isSetor) {
      mapKdkmp[row.kdkmp].setor += Number(row.nominal || 0);
    } else {
      mapKdkmp[row.kdkmp].close += Number(row.nominal || 0);
    }
  });

  const rankingList = Object.keys(mapKdkmp).map(kdkmp => ({
    kdkmp: kdkmp,
    area: getKdkmpArea(kdkmp),
    close: mapKdkmp[kdkmp].close,
    setor: mapKdkmp[kdkmp].setor,
    selisih: mapKdkmp[kdkmp].close - mapKdkmp[kdkmp].setor
  })).sort((a, b) => b.close - a.close);

  if (!rankingList.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Tidak ada data peringkat.</td></tr>`;
    renderPaginationControls("rankingPagination", 0, 1, () => {});
    return;
  }

  const startIdx = (currentPageRanking - 1) * ROWS_PER_PAGE;
  const pageRows = rankingList.slice(startIdx, startIdx + ROWS_PER_PAGE);

  tbody.innerHTML = "";
  pageRows.forEach((item, index) => {
    const rank = startIdx + index + 1;
    let rankBadge = `<strong>#${rank}</strong>`;

    if (rank === 1) rankBadge = `<span style="color: #d4af37; font-size: 16px;"><i class="fa-solid fa-trophy"></i> #1</span>`;
    else if (rank === 2) rankBadge = `<span style="color: #a8a8a8; font-size: 15px;"><i class="fa-solid fa-trophy"></i> #2</span>`;
    else if (rank === 3) rankBadge = `<span style="color: #b08d57; font-size: 14px;"><i class="fa-solid fa-trophy"></i> #3</span>`;

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${rankBadge}</td>
      <td><strong>${item.kdkmp.replaceAll("_", " ")}</strong></td>
      <td>${getAreaBadge(item.area)}</td>
      <td><strong style="color: #18864b;">${formatRupiah(item.close)}</strong></td>
      <td><strong style="color: #087da5;">${formatRupiah(item.setor)}</strong></td>
      <td><strong>${formatRupiah(item.selisih)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginationControls("rankingPagination", rankingList.length, currentPageRanking, (newPage) => {
    currentPageRanking = newPage;
    renderRankingTable(rows, selectedArea);
  });
}

/* =========================================================
   TABEL REKAP SALES
========================================================= */
function updateTable(rows) {
  const tbody = document.getElementById("salesTable");
  if (!tbody) return;

  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="loading">Tidak ada data transaksi.</td></tr>`;
    renderPaginationControls("salesPagination", 0, 1, () => {});
    return;
  }

  const startIdx = (currentPageSales - 1) * ROWS_PER_PAGE;
  const pageRows = rows.slice(startIdx, startIdx + ROWS_PER_PAGE);

  tbody.innerHTML = "";
  pageRows.forEach((row, index) => {
    const proof = (row.bukti && row.bukti.startsWith("http")) ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>` : "-";
    const isSetor = String(row.status || '').toLowerCase().includes("setor");
    const badgeClass = !isSetor ? "badge-success" : "badge-warning";
    const areaBadge = getAreaBadge(getKdkmpArea(row.kdkmp));

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${startIdx + index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</td>
      <td>${areaBadge}</td>
      <td>${!isSetor ? formatRupiah(row.nominal) : "-"}</td>
      <td>${isSetor ? formatRupiah(row.nominal) : "-"}</td>
      <td>${!isSetor ? formatRupiah(row.nominal) : "-" + formatRupiah(row.nominal)}</td>
      <td><span class="badge ${badgeClass}">${row.status || 'Close Shift'}</span></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });

  if (document.getElementById("tableInfo")) {
    document.getElementById("tableInfo").textContent = `${rows.length} transaksi (${currentPageSales}/${Math.ceil(rows.length / ROWS_PER_PAGE)} hal)`;
  }

  renderPaginationControls("salesPagination", rows.length, currentPageSales, (newPage) => {
    currentPageSales = newPage;
    updateTable(rows);
  });
}

/* =========================================================
   TABEL CLOSE SHIFT & SETORAN
========================================================= */
function renderCloseShiftTable(rows) {
  const tbody = document.getElementById("closeShiftTableBody");
  if (!tbody) return;

  const closeRows = rows.filter(row => !String(row.status || '').toLowerCase().includes("setor"));
  if (!closeRows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Belum ada transaksi close shift.</td></tr>`;
    renderPaginationControls("closeShiftPagination", 0, 1, () => {});
    return;
  }

  const startIdx = (currentPageClose - 1) * ROWS_PER_PAGE;
  const pageRows = closeRows.slice(startIdx, startIdx + ROWS_PER_PAGE);

  tbody.innerHTML = "";
  pageRows.forEach((row, index) => {
    const proof = (row.bukti && row.bukti.startsWith("http")) ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>` : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${startIdx + index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td><strong>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</strong></td>
      <td>${getAreaBadge(getKdkmpArea(row.kdkmp))}</td>
      <td><strong style="color: #18864b;">${formatRupiah(row.nominal)}</strong></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginationControls("closeShiftPagination", closeRows.length, currentPageClose, (newPage) => {
    currentPageClose = newPage;
    renderCloseShiftTable(rows);
  });
}

function renderSetoranTable(rows) {
  const tbody = document.getElementById("setoranTableBody");
  if (!tbody) return;

  const setoranRows = rows.filter(row => String(row.status || '').toLowerCase().includes("setor"));
  if (!setoranRows.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">Belum ada transaksi setor omset.</td></tr>`;
    renderPaginationControls("setoranPagination", 0, 1, () => {});
    return;
  }

  const startIdx = (currentPageSetor - 1) * ROWS_PER_PAGE;
  const pageRows = setoranRows.slice(startIdx, startIdx + ROWS_PER_PAGE);

  tbody.innerHTML = "";
  pageRows.forEach((row, index) => {
    const proof = (row.bukti && row.bukti.startsWith("http")) ? `<a class="proof-btn" href="${row.bukti}" target="_blank">Bukti</a>` : "-";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${startIdx + index + 1}</td>
      <td>${formatDate(row.date)}</td>
      <td><strong>${row.kdkmp ? row.kdkmp.replaceAll("_", " ") : "-"}</strong></td>
      <td>${getAreaBadge(getKdkmpArea(row.kdkmp))}</td>
      <td><strong style="color: #087da5;">${formatRupiah(row.nominal)}</strong></td>
      <td>${proof}</td>
    `;
    tbody.appendChild(tr);
  });

  renderPaginationControls("setoranPagination", setoranRows.length, currentPageSetor, (newPage) => {
    currentPageSetor = newPage;
    renderSetoranTable(rows);
  });
}

/* =========================================================
   HELPER PAGINASI, CHARTS & SIDEBAR
========================================================= */
function renderPaginationControls(containerId, totalRows, currentPage, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);
  if (totalPages <= 1) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 15px; padding-top: 10px; border-top: 1px solid #eee;">
      <button class="apply-btn" style="height: 32px; padding: 0 12px; font-size: 12px;" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} id="${containerId}-prev">
        &laquo; Prev
      </button>
      <span style="font-size: 12px; color: #666;">Halaman <strong>${currentPage}</strong> dari <strong>${totalPages}</strong></span>
      <button class="apply-btn" style="height: 32px; padding: 0 12px; font-size: 12px;" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} id="${containerId}-next">
        Next &raquo;
      </button>
    </div>
  `;

  document.getElementById(`${containerId}-prev`)?.addEventListener("click", () => {
    if (currentPage > 1) onPageChange(currentPage - 1);
  });

  document.getElementById(`${containerId}-next`)?.addEventListener("click", () => {
    if (currentPage < totalPages) onPageChange(currentPage + 1);
  });
}

function updateDailyChart(rows) {
  const map = {};
  rows.forEach(row => {
    const d = toISODate(row.date) || 'Lainnya';
    if (!map[d]) map[d] = { close: 0, setor: 0 };
    const isClose = !String(row.status || '').toLowerCase().includes("setor");
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
        { label: "Close Shift", data: dates.map(d => map[d].close), tension: 0.3, borderColor: "#18864b" },
        { label: "Setor Omset", data: dates.map(d => map[d].setor), tension: 0.3, borderColor: "#087da5" }
      ]
    },
    options: { responsive: true, maintainAspectRatio: false }
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
      datasets: [{ data: [operational, belum], backgroundColor: ["#18864b", "#d17b00"] }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } }
  });
}

function formatRupiah(value) { return "Rp " + Number(value || 0).toLocaleString("id-ID"); }
function updateLastUpdate() {
  const el = document.getElementById("lastUpdate");
  if (el) el.textContent = "Update: " + new Date().toLocaleString("id-ID");
}
function showLoading() {
  const tbody = document.getElementById("salesTable");
  if (tbody) tbody.innerHTML = `<tr><td colspan="9" class="loading">Memuat data dari Spreadsheet...</td></tr>`;
}

function initSidebar() {
  const navItems = document.querySelectorAll(".nav-item");
  const sections = document.querySelectorAll(".page-section");
  const pageTitle = document.getElementById("pageTitle");
  const pageSub = document.getElementById("pageSub");

  const titles = {
    "sec-dashboard": { title: "Dashboard Sales", sub: "Monitoring operasional dan setoran KDKMP Area Bandung" },
    "sec-kdkmp": { title: "Data KDKMP", sub: "Daftar outlet dan status operasional KDKMP" },
    "sec-ranking": { title: "Peringkat Omset", sub: "Perbandingan omset KDKMP dari tertinggi ke terendah" },
    "sec-closeshift": { title: "Data Close Shift", sub: "Monitoring transaksi harian close shift KDKMP" },
    "sec-setoran": { title: "Data Setoran", sub: "Monitoring khusus transaksi setor omset KDKMP" },
    "sec-rekap": { title: "Rekap Sales", sub: "Rincian seluruh transaksi sales dan perbandingan omset" }
  };

  navItems.forEach(button => {
    button.addEventListener("click", function () {
      const targetId = this.getAttribute("data-target");
      if (!targetId) return;

      navItems.forEach(item => item.classList.remove("active"));
      this.classList.add("active");

      sections.forEach(sec => {
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

/* =========================================================
   INITIALIZATION & AUTO-REFRESH (1 MENIT)
========================================================= */
document.addEventListener("DOMContentLoaded", function() {
  loadDashboard();
  initSidebar();

  setInterval(function() {
    console.log("Auto-refreshing dashboard data...");
    loadDashboard();
  }, 60000);
});