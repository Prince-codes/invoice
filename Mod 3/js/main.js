// js/main.js — client-side invoice storage (localStorage + CSV), and login/session checks
document.addEventListener('DOMContentLoaded', () => {
  const loggedIn = sessionStorage.getItem('loggedInUser');

  // show username in header when available
  const userDisplay = document.getElementById('userDisplay');
  if (userDisplay) {
    userDisplay.textContent = loggedIn ? `Signed in as: ${loggedIn}` : 'Signed in as: Guest';
  }

  // Element refs
  const monthSelect = document.getElementById('month');
  const yearSelect = document.getElementById('year');
  const openBtn = document.getElementById('openBtn');
  const modal = document.getElementById('modal');
  const closeModal = document.getElementById('closeModal');
  const tablesContainer = document.getElementById('tablesContainer');
  const saveBtn = document.getElementById('saveBtn');
  const cancelBtn = document.getElementById('cancelBtn');
  const total1El = document.getElementById('total1');
  const total2El = document.getElementById('total2');
  const totalAllEl = document.getElementById('totalAll');
  const amountWords = document.getElementById('amountWords');
  const customerInput = document.getElementById('customer');
  const logoutBtn = document.getElementById('logoutBtn');

  const viewPreviousBtn = document.getElementById('viewPreviousBtn');
  const previousBillsModal = document.getElementById('previousBillsModal');
  const closePreviousModal = document.getElementById('closePreviousModal');
  const previousBillsTableBody = document.querySelector("#previousBillsTable tbody");

  // Editor controls
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const updateBtn = document.getElementById('updateBtn');
  const printEditedBtn = document.getElementById('printEditedBtn');

  // editing state
  let editingInvoiceId = null;
  let saveInProgress = false;

  // CSV import/export buttons
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const importCsvInput = document.getElementById('importCsv');

  // populate month/year
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (monthSelect) {
    monthSelect.innerHTML = '';
    monthNames.forEach((m, i) => {
      const opt = document.createElement('option');
      opt.value = i + 1;
      opt.textContent = m;
      monthSelect.appendChild(opt);
    });
  }

  if (yearSelect) {
    yearSelect.innerHTML = '';
    const now = new Date();
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
      const opt = document.createElement('option');
      opt.value = y;
      opt.textContent = y;
      yearSelect.appendChild(opt);
    }
  }

  if (monthSelect && yearSelect) {
    const now = new Date();
    monthSelect.value = now.getMonth() + 1;
    yearSelect.value = now.getFullYear();
  }

  // open editor
  if (openBtn) {
    openBtn.addEventListener('click', () => {
      const cust = customerInput && customerInput.value.trim();
      if (!cust) return alert('Enter customer name first.');
      openMonthEditor();
    });
  }

  if (closeModal) closeModal.addEventListener('click', close);
  if (cancelBtn) cancelBtn.addEventListener('click', close);

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('loggedInUser');
      window.location.href = '../index.html';
    });
  }

  function close() {
    if (modal) modal.classList.remove('show');
    if (tablesContainer) tablesContainer.innerHTML = '';
    if (amountWords) amountWords.value = '';
    resetEditorState();
  }

  function setEditorButtonMode(isEditMode) {
    if (saveBtn) {
      saveBtn.style.display = isEditMode ? 'none' : '';
      saveBtn.classList.toggle('is-hidden', isEditMode);
    }
    if (saveDraftBtn) {
      saveDraftBtn.style.display = isEditMode ? 'none' : '';
      saveDraftBtn.classList.toggle('is-hidden', isEditMode);
    }
    if (updateBtn) {
      updateBtn.style.display = isEditMode ? '' : 'none';
      updateBtn.classList.toggle('is-hidden', !isEditMode);
    }
    if (printEditedBtn) {
      printEditedBtn.style.display = isEditMode ? '' : 'none';
      printEditedBtn.classList.toggle('is-hidden', !isEditMode);
    }
  }
  
  // ensure modal closed resets editing state/buttons
  function resetEditorState() {
    editingInvoiceId = null;
    saveInProgress = false;
    setEditorButtonMode(false);
  }

  function openMonthEditor() {
    if (!tablesContainer || !monthSelect || !yearSelect || !modal) return;
    tablesContainer.innerHTML = '';
    const m = parseInt(monthSelect.value) - 1;
    const y = parseInt(yearSelect.value);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    // build two tables
    const table1 = buildTable(1, Math.min(15, daysInMonth));
    const table2 = buildTable(16, daysInMonth);
    tablesContainer.appendChild(table1);
    tablesContainer.appendChild(table2);
    // new invoice — clear editing state and show create buttons
    editingInvoiceId = null;
    setEditorButtonMode(false);
    modal.classList.add('show');
    recalcTotals();
  }

  function buildTable(start, end) {
    const container = document.createElement('div'); container.className = 'daily-table';
    const title = document.createElement('h4'); title.textContent = `${start} - ${end}`; container.appendChild(title);
    const table = document.createElement('table');
    const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>S.no</th><th>Date</th><th>Amount</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for (let d = start; d <= end; d++) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = d;
      const td2 = document.createElement('td');
      const y = parseInt(yearSelect.value);
      const m = parseInt(monthSelect.value) - 1;
      const dateObj = new Date(y, m, d);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      td2.textContent = `${dd}/${mm}/${yyyy}`;
      const td3 = document.createElement('td');
      const inp = document.createElement('input');
      inp.type = 'number';
      inp.inputMode = 'decimal';
      inp.placeholder = 'amount or -';
      inp.dataset.day = d;
      inp.addEventListener('input', recalcTotals);
      td3.appendChild(inp);
      tr.appendChild(td1); tr.appendChild(td2); tr.appendChild(td3);
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    container.appendChild(table);
    return container;
  }

  function recalcTotals() {
    if (!modal || !total1El || !total2El || !totalAllEl || !amountWords) return;
    const inputs = modal.querySelectorAll('input[type="number"]');
    let t1 = 0, t2 = 0;
    inputs.forEach(inp => {
      const val = inp.value.trim();
      const day = Number(inp.dataset.day);
      if (val === '-' || val === '') return;
      const num = Number(val);
      if (isNaN(num)) return;
      if (day <= 15) t1 += num; else t2 += num;
    });
    total1El.textContent = t1.toFixed(2);
    total2El.textContent = t2.toFixed(2);
    totalAllEl.textContent = (t1 + t2).toFixed(2);
    amountWords.value = numberToWords(Math.round(t1 + t2));
  }

  function numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function convert(n) {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
      if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
      return n;
    }
    return convert(num) + ' Only';
  }

  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      handleSave({ asDraft: false });
    });
  }

  // ID helpers using localStorage
  function getNextInvoiceId() {
    let id = Number(localStorage.getItem('nextInvoiceId') || '1');
    localStorage.setItem('nextInvoiceId', String(id + 1));
    return id;
  }

  function saveInvoiceToStorage(inv) {
    const raw = localStorage.getItem('invoices');
    let arr = [];
    try { arr = JSON.parse(raw || '[]'); } catch (e) { arr = []; }
    arr.push(inv);
    localStorage.setItem('invoices', JSON.stringify(arr));
  }

  function updateCsvCache() {
    const invoices = loadInvoicesFromStorage();
    // build CSV header and rows (simple, daily is JSON encoded)
    const header = ['invoiceId', 'customerName', 'monthYearISO', 'monthText', 'total', 'totalWords', 'createdAt', 'createdBy', 'daily_json'];
    const rows = invoices.map(inv => {
      const dailyJson = JSON.stringify(inv.daily).replace(/"/g, '""'); // escape quotes for CSV field
      return [
        inv.invoiceId,
        inv.customerName.replace(/"/g, '""'),
        inv.monthYearISO,
        inv.monthText.replace(/"/g, '""'),
        (inv.totals && inv.totals.grand) ? inv.totals.grand : (inv.total || ''),
        (inv.totalWords || '').replace(/"/g, '""'),
        inv.createdAt || '',
        (inv.createdBy || '').replace(/"/g, '""'),
        `"${dailyJson}"`
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    localStorage.setItem('invoices_csv', csv);
  }

  function loadInvoicesFromStorage() {
    try {
      return JSON.parse(localStorage.getItem('invoices') || '[]');
    } catch (e) { return []; }
  }

  // Print builder
  function openPrintWindow(inv) {
    const daily = inv.daily.map(r => ({ ...r }));
    const totals = inv.totals || { t1: 0, t2: 0, grand: 0 };
    const invoiceDate = inv.createdAt
      ? new Date(inv.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-IN');

    const html = buildPrintHTML({
      customer: inv.customerName,
      monthText: inv.monthText,
      daily,
      totals,
      words: inv.totalWords || '',
      invoiceId: inv.invoiceId,
      invoiceDate
    });

    const win = window.open('', '_blank');
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (e) { console.warn('Print failed', e); }
    }, 600);
  }

  function buildPrintHTML({ customer, monthText, daily, totals, words, invoiceId, invoiceDate }) {
    const t1Rows = daily.filter(r => r.day_num <= 15);
    const t2Rows = daily.filter(r => r.day_num > 15);
    const t1Sum = Number(totals.t1 || 0).toFixed(2);
    const t2Sum = Number(totals.t2 || 0).toFixed(2);
    const grand = Number(totals.grand || (Number(t1Sum) + Number(t2Sum))).toFixed(2);

    const tableRowsHTML = (rows) => rows.map(r => {
      const amount = (r.is_empty || r.amount === null) ? '-' : Number(r.amount).toFixed(2);
      return `<tr><td>${r.day_num}</td><td>${r.date}</td><td class="amount-cell">${amount}</td></tr>`;
    }).join('');

    function escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(customer)} - ${escapeHtml(monthText)}</title>
  <style>
  @page { size: A4; margin: 10mm; }
  body {
    margin: 0;
    padding: 0;
    font-family: 'Montserrat', 'Segoe UI', Arial, sans-serif;
    color: #111827;
    background: #f8fafc;
    font-size: 13px;
  }
  .invoice-shell {
    width: calc(100% - 9mm);
    max-width: 201mm;
    margin: 0 auto;
    background: #fff;
    box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    padding: 18px 22px 24px;
    border-radius: 14px;
    box-sizing: border-box;
    page-break-after: always;
  }
  .invoice-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #cbd5e1;
    flex-wrap: wrap;
  }
  .brand-block {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-wrap {
    width: 68px;
    height: 68px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 14px;
    background: linear-gradient(135deg, #f59e0b, #fcd34d);
    box-shadow: 0 6px 20px rgba(245, 158, 11, 0.16);
  }
  .logo-wrap img { width: 54px; height: 54px; object-fit: contain; border-radius: 10px; }
  .company-info h1 { margin: 0 0 4px; font-size: 20px; letter-spacing: 1px; color: #111827; }
  .company-info p { margin: 2px 0; color: #6b7280; font-size: 12px; }
  .invoice-meta { min-width: 180px; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .meta-pill {
    margin-bottom: 6px;
    padding: 5px 8px;
    border-radius: 999px;
    background: #f3f4f6;
    color: #374151;
    font-size: 11px;
    display: inline-block;
    border: 1px solid #cbd5e1;
  }
  .bill-to {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 16px 0 12px;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
  }
  .bill-to span { display: block; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
  .bill-to strong { font-size: 15px; color: #111827; }
  .status-tag {
    background: #ecfeff;
    color: #0f766e;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .table-grid { display: flex; gap: 12px; margin-top: 8px; flex-wrap: wrap; }
  .table-card {
    flex: 1 1 48%;
    min-width: 260px;
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    overflow: hidden;
    page-break-inside: avoid;
  }
  .table-card h3 {
    margin: 0;
    padding: 8px 10px;
    font-size: 13px;
    background: #f9fafb;
    color: #374151;
    border-bottom: 1px solid #cbd5e1;
  }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 7px 8px; border-bottom: 1px solid #cbd5e1; font-size: 12px; text-align: left; }
  th { background: #f9fafb; color: #374151; }
  .amount-cell { text-align: center; font-variant-numeric: tabular-nums; }
  tfoot th { background: #f3f4f6; font-weight: 700; }
  .summary-card {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
    margin-top: 16px;
    padding: 12px 14px;
    background: linear-gradient(135deg, #f8fafc, #f3f4f6);
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    page-break-inside: avoid;
  }
  .summary-list { flex: 1; }
  .summary-row {
    display: flex;
    justify-content: space-between;
    padding: 5px 0;
    color: #374151;
    font-size: 12px;
  }
  .summary-row.total {
    margin-top: 6px;
    padding-top: 8px;
    border-top: 1px dashed #d1d5db;
    font-size: 14px;
    font-weight: 700;
    color: #111827;
  }
  .words-block {
    min-width: 230px;
    padding-left: 16px;
    border-left: 2px solid #d1d5db;
  }
  .words-block span { display: block; color: #6b7280; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 4px; font-weight: 700; }
  .words-block p { margin: 0; font-size: 12px; color: #111827; line-height: 1.5; }
  .signature-section { margin-top: 36px; text-align: right; }
  .signatory { display: inline-block; padding-top: 7px; border-top: 2px solid #111827; font-size: 13px; font-weight: 700; }
  .auth-label { margin-top: 4px; color: #6b7280; font-size: 11px; }
  .footer-note { margin-top: 18px; text-align: center; color: #6b7280; font-size: 11px; }
  @media print {
    body { background: #fff; margin: 0; padding: 0; }
    .invoice-shell { box-shadow: none; border-radius: 0; padding: 0; width: 100%; max-width: none; }
    .invoice-header, .table-grid, .summary-card, .bill-to {
      page-break-inside: avoid;
    }
    .table-card { break-inside: avoid; }
    .invoice-shell * { box-sizing: border-box; }
  }
  </style>
</head>
<body>
  <div class="invoice-shell">
    <div class="invoice-header">
      <div class="brand-block">
        <div class="logo-wrap"><img src="./logo.png" alt="Logo"></div>
        <div class="company-info">
          <h1>SHANKAR SAH</h1>
          <p>Gamharia Market Complex • 832108</p>
          <p>Phone: 8210945932</p>
          <p>Email: shankarvegetableshop7@gmail.com</p>
        </div>
      </div>
      <div class="invoice-meta">
        <div class="meta-pill">Invoice No. #${escapeHtml(invoiceId || '')}</div>
        <div class="meta-pill">Date: ${escapeHtml(invoiceDate)}</div>
        <div class="meta-pill" style="font-size: 12px; font-weight: 700;">Bill of Month: ${escapeHtml(monthText)}</div>
      </div>
    </div>

    <div class="bill-to">
      <div>
        <span>Bill To</span>
        <strong>${escapeHtml(customer || 'Customer')}</strong>
      </div>
      <div class="status-tag">Monthly Billing</div>
    </div>

    <div class="table-grid">
      <div class="table-card">
        <h3>1–15 Days</h3>
        <table>
          <thead><tr><th>S.no</th><th>Date</th><th>Amount</th></tr></thead>
          <tbody>${tableRowsHTML(t1Rows)}</tbody>
          <tfoot><tr><th colspan="2">Total 1</th><th class="amount-cell">${t1Sum}</th></tr></tfoot>
        </table>
      </div>

      <div class="table-card">
        <h3>16–End Days</h3>
        <table>
          <thead><tr><th>S.no</th><th>Date</th><th>Amount</th></tr></thead>
          <tbody>${tableRowsHTML(t2Rows)}</tbody>
          <tfoot><tr><th colspan="2">Total 2</th><th class="amount-cell">${t2Sum}</th></tr></tfoot>
        </table>
      </div>
    </div>

    <div class="summary-card">
      <div class="summary-list">
        <div class="summary-row"><span>Total 1 (1–15)</span><strong>₹ ${t1Sum}</strong></div>
        <div class="summary-row"><span>Total 2 (16–end)</span><strong>₹ ${t2Sum}</strong></div>
        <div class="summary-row total"><span>Total Amount</span><strong>₹ ${grand}</strong></div>
      </div>
      <div class="words-block">
        <span>Total Amount in Words</span>
        <p>${escapeHtml(words || '')}</p>
      </div>
    </div>

    <div class="signature-section">
      <div class="signatory">SHANKAR SAH</div>
      <div class="auth-label">Authorized Signatory</div>
    </div>

    <div class="footer-note">Thank You • Visit Us Again.</div>
  </div>
</body>
</html>
    `;
  }

  function formatISODate(year, monthZeroBased, day) {
    const d = new Date(year, monthZeroBased, day);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }

  // Previous bills modal logic (client-side)
  if (viewPreviousBtn) {
    viewPreviousBtn.addEventListener('click', () => {
    previousBillsTableBody.innerHTML = "";
    let invoices = loadInvoicesFromStorage();
    if (!invoices || invoices.length === 0) {
      alert('No previous invoices found. Save some invoices first.');
      return;
    }
    invoices = invoices.sort((a, b) => Number(a.invoiceId) - Number(b.invoiceId));
    invoices.forEach(inv => {
      const row = document.createElement('tr');
      let monthText = inv.monthText || inv.monthYearISO;
      row.innerHTML = `
        <td style="text-align:center;">${inv.invoiceId}</td>
        <td style="text-align:center;">${inv.customerName}</td>
        <td style="text-align:center;">${monthText}</td>
        <td style="text-align:center;">${(inv.totals && inv.totals.grand) ? Number(inv.totals.grand).toFixed(2) : ''}</td>
      `;
      row.style.cursor = 'pointer';

      const printCell = document.createElement('td');
      printCell.style.textAlign = 'center';
      const printBtn = document.createElement('button');
      printBtn.textContent = 'Print';
      printBtn.className = 'btn';
      printBtn.style.padding = '8px 10px';
      printBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        previousBillsModal.style.display = 'none';
        openPrintWindow(inv);
      });
      printCell.appendChild(printBtn);
      row.appendChild(printCell);

      row.addEventListener('click', () => {
        previousBillsModal.style.display = 'none';
        openInvoiceInEditor(inv);
      });
      previousBillsTableBody.appendChild(row);
    });
    previousBillsModal.style.display = 'block';
    });
  }

  if (closePreviousModal) {
    closePreviousModal.addEventListener("click", () => {
      previousBillsModal.style.display = "none";
    });
  }

  // CSV export (downloads invoices_csv)
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
    updateCsvCache();
    const csv = localStorage.getItem('invoices_csv') || '';
    if (!csv) return alert('No invoices to export.');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'invoices_export.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    });
  }

  // CSV import: user chooses a CSV; we parse and merge into storage
  if (importCsvBtn && importCsvInput) {
    importCsvBtn.addEventListener('click', () => importCsvInput.click());
    importCsvInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function (evt) {
      const text = evt.target.result;
      try {
        const parsed = parseInvoicesCsv(text);
        if (parsed.length === 0) { alert('No invoices found in CSV.'); return; }
        // merge — avoid duplicate invoiceId (if id exists, skip)
        const existing = loadInvoicesFromStorage();
        const existingIds = new Set(existing.map(i => i.invoiceId));
        parsed.forEach(p => {
          if (!existingIds.has(p.invoiceId)) existing.push(p);
        });
        localStorage.setItem('invoices', JSON.stringify(existing));
        // make sure nextInvoiceId is larger than any existing id
        const maxId = existing.reduce((mx, it) => Math.max(mx, Number(it.invoiceId || 0)), 0);
        localStorage.setItem('nextInvoiceId', String(maxId + 1));
        updateCsvCache();
        alert('Imported invoices. You can now view previous bills.');
      } catch (err) {
        console.error(err);
        alert('Failed to parse CSV.');
      }
    };
      reader.readAsText(f);
      // reset input
      importCsvInput.value = '';
    });
  }

  function parseInvoicesCsv(text) {
    // Very straightforward parser expecting the CSV format created by updateCsvCache()
    // Header: invoiceId,customerName,monthYearISO,monthText,total,totalWords,createdAt,createdBy,daily_json
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const res = [];
    for (let i = 1; i < lines.length; i++) {
      // naive split to get first 8 columns then the final daily_json (which may contain commas/newlines encoded)
      // Since daily_json is quoted, find the first quote after 8 commas
      const line = lines[i];
      // We'll split by comma, but handle quoted last field
      const parts = [];
      let cur = '';
      let inQuotes = false;
      for (let ch of line) {
        if (ch === '"') {
          inQuotes = !inQuotes;
          cur += ch;
        } else if (ch === ',' && !inQuotes) {
          parts.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      if (cur !== '') parts.push(cur);
      // normalize parts length
      while (parts.length < 9) parts.push('');
      // map
      const invoiceId = Number(parts[0]) || undefined;
      const customerName = (parts[1] || '').replace(/""/g, '"').replace(/^"|"$/g, '');
      const monthYearISO = (parts[2] || '');
      const monthText = (parts[3] || '').replace(/""/g, '"').replace(/^"|"$/g, '');
      const total = parts[4] || '';
      const totalWords = (parts[5] || '').replace(/""/g, '"').replace(/^"|"$/g, '');
      const createdAt = parts[6] || '';
      const createdBy = (parts[7] || '').replace(/""/g, '"').replace(/^"|"$/g, '');
      let daily_json = parts.slice(8).join(',') || '';
      // strip surrounding quotes from daily_json and unescape double quotes
      daily_json = daily_json.replace(/^"|"$/g, '').replace(/""/g, '"');
      let daily = [];
      try { daily = JSON.parse(daily_json); } catch (e) { daily = []; }
      const invoice = {
        invoiceId,
        customerName,
        monthYearISO,
        monthText,
        totals: { grand: Number(total || 0) },
        totalWords,
        createdAt,
        createdBy,
        daily
      };
      res.push(invoice);
    }
    return res;
  }

  // initially ensure CSV cache exists
  if (!localStorage.getItem('invoices_csv')) updateCsvCache();

  // Draft/edit UI wiring
  function openInvoiceInEditor(inv) {
    if (!modal || !tablesContainer || !monthSelect || !yearSelect) return;
    // populate fields
    editingInvoiceId = inv.invoiceId;
    customerInput.value = inv.customerName || '';
    // set month/year selects from monthYearISO if available
    try {
      const iso = inv.monthYearISO; // e.g., 2025-02-01
      if (iso) {
        const parts = iso.split('-');
        yearSelect.value = parts[0];
        monthSelect.value = Number(parts[1]);
      }
    } catch (e) {}
    // build editor tables
    tablesContainer.innerHTML = '';
    const daysInMonth = new Date(Number(yearSelect.value), Number(monthSelect.value), 0).getDate();
    const table1 = buildTable(1, Math.min(15, daysInMonth));
    const table2 = buildTable(16, daysInMonth);
    tablesContainer.appendChild(table1);
    tablesContainer.appendChild(table2);
    // fill values
    const inputs = modal.querySelectorAll('input[type="number"]');
    inv.daily.forEach(d => {
      const matching = Array.from(inputs).find(i => Number(i.dataset.day) === Number(d.day_num));
      if (matching) matching.value = (d.is_empty || d.amount === null) ? '' : d.amount;
    });
    amountWords.value = inv.totalWords || '';
    // show modal and adjust buttons
    modal.classList.add('show');
    setEditorButtonMode(true);
    recalcTotals();
  }

  if (printEditedBtn) {
    printEditedBtn.addEventListener('click', () => {
      const invoiceData = buildInvoiceData();
      if (invoiceData) openPrintWindow(invoiceData);
    });
  }

  // Save draft handler
  if (saveDraftBtn) {
    saveDraftBtn.addEventListener('click', () => {
      handleSave({ asDraft: true });
    });
  }

  // Update existing invoice
  if (updateBtn) {
    updateBtn.addEventListener('click', () => {
      if (!editingInvoiceId) return alert('No invoice selected to update.');
      handleSave({ updateExisting: true });
    });
  }

  function buildInvoiceData() {
    const cust = customerInput.value.trim();
    if (!cust) {
      alert('Enter customer name first.');
      return null;
    }

    const m = parseInt(monthSelect.value); // 1-based
    const y = parseInt(yearSelect.value);
    const inputs = modal.querySelectorAll('input[type="number"]');
    const dailyRows = [];
    let hasInvalidValue = false;

    inputs.forEach(inp => {
      const day = Number(inp.dataset.day);
      const raw = inp.value.trim();
      if (raw === '' || raw === '-') {
        dailyRows.push({ day_num: day, date: formatISODate(y, m - 1, day), amount: null, is_empty: true });
      } else {
        const num = Number(raw);
        if (isNaN(num) || num < 0) {
          hasInvalidValue = true;
          dailyRows.push({ day_num: day, date: formatISODate(y, m - 1, day), amount: null, is_empty: true });
        } else {
          dailyRows.push({ day_num: day, date: formatISODate(y, m - 1, day), amount: num, is_empty: false });
        }
      }
    });

    if (hasInvalidValue) {
      alert('Please enter only valid non-negative amounts.');
      return null;
    }

    let t1 = 0, t2 = 0;
    dailyRows.forEach(r => { if (!r.is_empty && r.amount !== null) { if (r.day_num <= 15) t1 += Number(r.amount); else t2 += Number(r.amount); } });
    return {
      invoiceId: editingInvoiceId || getNextInvoiceId(),
      customerName: cust,
      monthYearISO: `${y}-${String(m).padStart(2,'0')}-01`,
      monthText: `${monthNames[m - 1]} ${y}`,
      daily: dailyRows,
      totals: { t1: Number(t1), t2: Number(t2), grand: Number((t1 + t2).toFixed(2)) },
      totalWords: amountWords.value || '',
      createdAt: new Date().toISOString(),
      createdBy: sessionStorage.getItem('loggedInUser') || ''
    };
  }

  // central save routine for create/update/draft
  function handleSave({ asDraft = false, updateExisting = false } = {}) {
    if (saveInProgress) return;
    saveInProgress = true;

    const invoiceObj = buildInvoiceData();
    if (!invoiceObj) {
      saveInProgress = false;
      return;
    }

    if (updateExisting) {
      const shouldOverwrite = window.confirm('This will overwrite the existing invoice. Continue?');
      if (!shouldOverwrite) {
        saveInProgress = false;
        return;
      }

      const arr = loadInvoicesFromStorage();
      const idx = arr.findIndex(i => Number(i.invoiceId) === Number(editingInvoiceId));
      if (idx >= 0) arr[idx] = { ...invoiceObj, invoiceId: editingInvoiceId };
      localStorage.setItem('invoices', JSON.stringify(arr));
      updateCsvCache();
      editingInvoiceId = null;
      modal.classList.remove('show');
      saveBtn.style.display = '';
      saveDraftBtn.style.display = '';
      updateBtn.style.display = 'none';
      printEditedBtn.style.display = 'none';
      alert('Invoice updated.');
      saveInProgress = false;
      return;
    }

    saveInvoiceToStorage(invoiceObj);
    updateCsvCache();
    modal.classList.remove('show');
    if (!asDraft) openPrintWindow(invoiceObj);
    saveInProgress = false;
  }

});
