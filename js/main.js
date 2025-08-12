// js/main.js — client-side invoice storage (localStorage + CSV), and login/session checks
document.addEventListener('DOMContentLoaded', () => {
  // Session: redirect to login if no loggedInUser
  const loggedIn = sessionStorage.getItem('loggedInUser');
  if (!loggedIn) {
    window.location.href = 'index.html';
    return;
  }

  // show username in header
  const userDisplay = document.getElementById('userDisplay');
  userDisplay.textContent = `Signed in as: ${loggedIn}`;

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

  // CSV import/export buttons
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const importCsvBtn = document.getElementById('importCsvBtn');
  const importCsvInput = document.getElementById('importCsv');

  // populate month/year (same as original)
  const months = [
    'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];
  months.forEach((m,i) => {
    const opt = document.createElement('option'); opt.value = i+1; opt.textContent = m;
    monthSelect.appendChild(opt);
  });
  const now = new Date();
  for(let y = now.getFullYear(); y >= now.getFullYear()-5; y--){
    const opt = document.createElement('option'); opt.value = y; opt.textContent = y;
    yearSelect.appendChild(opt);
  }
  monthSelect.value = now.getMonth()+1;
  yearSelect.value = now.getFullYear();

  // open editor
  openBtn.addEventListener('click', () => {
    const cust = customerInput.value.trim();
    if (!cust) return alert('Enter customer name first.');
    openMonthEditor();
  });
  closeModal.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = 'index.html';
  });

  function close(){ modal.classList.remove('show'); tablesContainer.innerHTML = ''; amountWords.value = ''; }

  function openMonthEditor(){
    tablesContainer.innerHTML = '';
    const m = parseInt(monthSelect.value)-1;
    const y = parseInt(yearSelect.value);
    const daysInMonth = new Date(y, m+1, 0).getDate();
    // build two tables
    const table1 = buildTable(1, Math.min(15, daysInMonth));
    const table2 = buildTable(16, daysInMonth);
    tablesContainer.appendChild(table1);
    tablesContainer.appendChild(table2);
    modal.classList.add('show');
    recalcTotals();
  }

  function buildTable(start, end){
    const container = document.createElement('div'); container.className = 'daily-table';
    const title = document.createElement('h4'); title.textContent = `${start} - ${end}`; container.appendChild(title);
    const table = document.createElement('table');
    const thead = document.createElement('thead'); thead.innerHTML = '<tr><th>S.no</th><th>Date</th><th>Amount</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    for(let d = start; d <= end; d++){
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = d;
      const td2 = document.createElement('td');
      const y = parseInt(yearSelect.value);
      const m = parseInt(monthSelect.value)-1;
      const dateObj = new Date(y, m, d);
      const dd = String(dateObj.getDate()).padStart(2, '0');
      const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
      const yyyy = dateObj.getFullYear();
      td2.textContent = `${dd}/${mm}/${yyyy}`;
      const td3 = document.createElement('td');
      const inp = document.createElement('input'); inp.type = 'text'; inp.placeholder = 'amount or -';
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

  function recalcTotals(){
    const inputs = modal.querySelectorAll('input[type="text"]');
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

  // numberToWords same simple version
  function numberToWords(num) {
    if (num === 0) return 'Zero';
    const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    function convert(n) {
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' ' + ones[n%10] : '');
      if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' and ' + convert(n%100) : '');
      if (n < 100000) return convert(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' ' + convert(n%1000) : '');
      if (n < 10000000) return convert(Math.floor(n/100000)) + ' Lakh' + (n%100000 ? ' ' + convert(n%100000) : '');
      return n;
    }
    return convert(num) + ' Only';
  }

  // Save + Print flow (client-side)
  saveBtn.addEventListener('click', async () => {
    const cust = customerInput.value.trim();
    if (!cust) return alert('Enter customer name first.');
    const m = parseInt(monthSelect.value); // 1-based month
    const y = parseInt(yearSelect.value);
    const daysInMonth = new Date(y, m, 0).getDate();
    const monthFirstDay = `${y}-${String(m).padStart(2,'0')}-01`;
    const monthsArr = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const selectedMonthText = `${monthsArr[m-1]} ${y}`;

    // collect daily data
    const inputs = modal.querySelectorAll('input[type="text"]');
    const dailyRows = [];
    inputs.forEach(inp => {
      const day = Number(inp.dataset.day);
      const raw = inp.value.trim();
      if (raw === '-' || raw === '') {
        dailyRows.push({ day_num: day, date: formatISODate(y, m, day), amount: null, is_empty: true });
      } else {
        const num = Number(raw);
        if (isNaN(num)) {
          dailyRows.push({ day_num: day, date: formatISODate(y, m, day), amount: null, is_empty: true });
        } else {
          dailyRows.push({ day_num: day, date: formatISODate(y, m, day), amount: num, is_empty: false });
        }
      }
    });

    // totals
    let t1 = 0, t2 = 0;
    dailyRows.forEach(r => {
      if (!r.is_empty && r.amount !== null) {
        if (r.day_num <= 15) t1 += Number(r.amount); else t2 += Number(r.amount);
      }
    });
    const totalAmount = (t1 + t2).toFixed(2);

    // prepare invoice object
    const invoice = {
      invoiceId: getNextInvoiceId(),
      customerName: cust,
      monthYearISO: monthFirstDay,
      monthText: selectedMonthText,
      daily: dailyRows,
      totals: { t1: Number(t1), t2: Number(t2), grand: Number((t1+t2).toFixed(2)) },
      totalWords: amountWords.value || '',
      createdAt: new Date().toISOString(),
      createdBy: sessionStorage.getItem('loggedInUser') || ''
    };

    // persist to localStorage
    saveInvoiceToStorage(invoice);

    // update CSV cache (we maintain a CSV representation accessible via export)
    updateCsvCache();

    // close modal and print
    modal.classList.remove('show');
    openPrintWindow(invoice);
  });

  // ID helpers using localStorage
  function getNextInvoiceId(){
    let id = Number(localStorage.getItem('nextInvoiceId') || '1');
    localStorage.setItem('nextInvoiceId', String(id + 1));
    return id;
  }

  function saveInvoiceToStorage(inv){
    const raw = localStorage.getItem('invoices');
    let arr = [];
    try { arr = JSON.parse(raw || '[]'); } catch(e) { arr = []; }
    arr.push(inv);
    localStorage.setItem('invoices', JSON.stringify(arr));
  }

  function updateCsvCache(){
    const invoices = loadInvoicesFromStorage();
    // build CSV header and rows (simple, daily is JSON encoded)
    const header = ['invoiceId','customerName','monthYearISO','monthText','total','totalWords','createdAt','createdBy','daily_json'];
    const rows = invoices.map(inv => {
      const dailyJson = JSON.stringify(inv.daily).replace(/"/g,'""'); // escape quotes for CSV field
      return [
        inv.invoiceId,
        inv.customerName.replace(/"/g,'""'),
        inv.monthYearISO,
        inv.monthText.replace(/"/g,'""'),
        (inv.totals && inv.totals.grand) ? inv.totals.grand : (inv.total || ''),
        (inv.totalWords || '').replace(/"/g,'""'),
        inv.createdAt || '',
        (inv.createdBy || '').replace(/"/g,'""'),
        `"${dailyJson}"`
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    localStorage.setItem('invoices_csv', csv);
  }

  function loadInvoicesFromStorage(){
    try {
      return JSON.parse(localStorage.getItem('invoices') || '[]');
    } catch(e) { return []; }
  }

  // Print builder (reuse original visuals but with client-side data)
  function openPrintWindow(inv) {
    const invoice = inv;
    const daily = invoice.daily.map(r => ({ ...r })); // ensure we have day_num,date,amount
    // prepare totals
    const totals = invoice.totals || { t1:0, t2:0, grand:0 };
    const html = buildPrintHTML({
      customer: invoice.customerName,
      monthText: invoice.monthText,
      daily: daily,
      totals: totals,
      words: invoice.totalWords || ''
    });
    const win = window.open('', '_blank');
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      try { win.focus(); win.print(); } catch (e) { console.warn('Print failed', e); }
    }, 600);
  }

  function buildPrintHTML({ customer, monthText, daily, totals, words }) {
    // split into two parts 1-15 and 16-end
    const t1Rows = daily.filter(r => r.day_num <= 15);
    const t2Rows = daily.filter(r => r.day_num > 15);
    const t1Sum = Number(totals.t1 || 0).toFixed(2);
    const t2Sum = Number(totals.t2 || 0).toFixed(2);
    const grand = Number(totals.grand || (Number(t1Sum) + Number(t2Sum))).toFixed(2);

    const tableRowsHTML = (rows) => rows.map(r => {
      const amount = (r.is_empty || r.amount === null) ? '-' : Number(r.amount).toFixed(2);
      return `<tr><td style="border:1px solid #ccc;padding:6px">${r.day_num}</td><td style="border:1px solid #ccc;padding:6px">${r.date}</td><td style="border:1px solid #ccc;padding:6px;text-align:right">${amount}</td></tr>`;
    }).join('');

    function escapeHtml(s) {
      if (!s) return '';
      return String(s).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }

    return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice - ${escapeHtml(customer)} - ${escapeHtml(monthText)}</title>
  <style>
    @page { size: A4; margin: 20mm; }
    body { font-family: Montserrat, Arial, sans-serif; color:#111; padding:24px; background:#fff; }
    .invoice-header { display:flex; align-items:center; justify-content:space-between; border-bottom:2px solid #eee; padding-bottom:12px; margin-bottom:18px; }
    .logo-wrap { width:90px; height:90px; display:flex; align-items:center; justify-content:center; background:linear-gradient(180deg,#FFBF00,#ffd84d); border-radius:16px; box-shadow:0 4px 24px rgba(255,191,0,0.12); }
    .logo-wrap img { width:70px; height:70px; object-fit:contain; border-radius:12px; }
    .company-info { margin-left:18px; }
    .company-info h1 { margin:0; font-size:26px; letter-spacing:1px; }
    .muted { color:#555; font-size:13px; }
    .invoice-title { text-align:right; font-weight:700; font-size:20px; letter-spacing:1px; }
    .invoice-date { text-align:right; color:#888; font-size:14px; }
    .to-section { margin:18px 0 10px 0; font-weight:600; font-size:15px; }
    .tables { display:flex; gap:18px; justify-content:space-between; margin-top:12px; }
    .table { width:48%; background:#fafafa; border-radius:8px; box-shadow:0 2px 8px #eee; }
    table { width:100%; border-collapse:collapse; }
    th,td { padding:8px; border:1px solid #ccc; font-size:13px; text-align:left; }
    th { background:#f5f5f5; font-size:13px; }
    .right { text-align:right; }
    .totals { margin-top:18px; font-size:15px; }
    .totals strong { font-size:16px; color:#222; }
    .words { margin-top:6px; font-size:13px; color:#444; }
    .signature-section { margin-top:40px; text-align:right; }
    .signatory { font-size:15px; font-weight:700; border-top:2px solid #222; display:inline-block; padding-top:8px; margin-top:6px; }
    .auth-label { font-size:13px; color:#555; margin-bottom:8px; }
  </style>
</head>
<body>
  <div class="invoice-header">
    <div style="display:flex;align-items:center;">
      <div class="logo-wrap"><img src="/logo.png" alt="Logo"></div>
      <div class="company-info">
        <h1>SHANKAR SAH</h1>
        <div class="muted">Gamharia market complex - 832108</div>
        <div class="muted">Contact: 8210945932 | Email: shankarvegetableshop7@gmail.com</div>
      </div>
    </div>
    <div>
      <div class="invoice-title">INVOICE</div>
      <div class="invoice-date">${escapeHtml(monthText)}</div>
    </div>
  </div>

  <div class="to-section">To: ${escapeHtml(customer)}</div>

  <div class="tables">
    <div class="table">
      <table>
        <thead><tr><th>S.no</th><th>Date</th><th>Amount</th></tr></thead>
        <tbody>
          ${tableRowsHTML(t1Rows)}
        </tbody>
        <tfoot><tr><th colspan="2">Total 1</th><th class="right">${t1Sum}</th></tr></tfoot>
      </table>
    </div>

    <div class="table">
      <table>
        <thead><tr><th>S.no</th><th>Date</th><th>Amount</th></tr></thead>
        <tbody>
          ${tableRowsHTML(t2Rows)}
        </tbody>
        <tfoot><tr><th colspan="2">Total 2</th><th class="right">${t2Sum}</th></tr></tfoot>
      </table>
    </div>
  </div>

  <div class="totals">
    <div>Total Amount to be Paid: <strong>${grand}</strong></div>
    <div class="words">Total Amount in Words: <span>${escapeHtml(words || '')}</span></div>
  </div>

  <div class="signature-section">
    <div class="signatory">SHANKAR SAH</div>
    <div class="auth-label">Authorized Signatory</div>
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
  viewPreviousBtn.addEventListener('click', () => {
    previousBillsTableBody.innerHTML = "";
    let invoices = loadInvoicesFromStorage();
    if (!invoices || invoices.length === 0) {
      alert('No previous invoices found. Save some invoices first.');
      return;
    }
    invoices = invoices.sort((a,b) => Number(a.invoiceId) - Number(b.invoiceId));
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
      row.addEventListener('click', () => {
        // open and print this invoice
        previousBillsModal.style.display = 'none';
        openPrintWindow(inv);
      });
      previousBillsTableBody.appendChild(row);
    });
    previousBillsModal.style.display = 'block';
  });

  closePreviousModal.addEventListener("click", () => {
    previousBillsModal.style.display = "none";
  });

  // CSV export (downloads invoices_csv)
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

  // CSV import: user chooses a CSV; we parse and merge into storage
  importCsvBtn.addEventListener('click', () => importCsvInput.click());
  importCsvInput.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
      const text = evt.target.result;
      try {
        const parsed = parseInvoicesCsv(text);
        if (parsed.length === 0) { alert('No invoices found in CSV.'); return; }
        // merge — avoid duplicate invoiceId (if id exists, skip)
        const existing = loadInvoicesFromStorage();
        const existingIds = new Set(existing.map(i=>i.invoiceId));
        parsed.forEach(p => {
          if (!existingIds.has(p.invoiceId)) existing.push(p);
        });
        localStorage.setItem('invoices', JSON.stringify(existing));
        // make sure nextInvoiceId is larger than any existing id
        const maxId = existing.reduce((mx, it) => Math.max(mx, Number(it.invoiceId || 0)), 0);
        localStorage.setItem('nextInvoiceId', String(maxId + 1));
        updateCsvCache();
        alert('Imported invoices. You can now view previous bills.');
      } catch(err) {
        console.error(err);
        alert('Failed to parse CSV.');
      }
    };
    reader.readAsText(f);
    // reset input
    importCsvInput.value = '';
  });

  function parseInvoicesCsv(text) {
    // Very straightforward parser expecting the CSV format created by updateCsvCache()
    // Header: invoiceId,customerName,monthYearISO,monthText,total,totalWords,createdAt,createdBy,daily_json
    const lines = text.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const headerParts = lines[0].split(',');
    const res = [];
    for (let i=1;i<lines.length;i++){
      // naive split to get first 8 columns then the final daily_json (which may contain commas/newlines encoded)
      // Since daily_json is quoted, find the first quote after 8 commas
      const line = lines[i];
      // We'll split by comma, but handle quoted last field
      const parts = [];
      let cur = '';
      let inQuotes = false;
      for (let ch of line) {
        if (ch === '"' ) {
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
      const customerName = (parts[1] || '').replace(/""/g,'"').replace(/^"|"$/g,'');
      const monthYearISO = (parts[2] || '');
      const monthText = (parts[3] || '').replace(/""/g,'"').replace(/^"|"$/g,'');
      const total = parts[4] || '';
      const totalWords = (parts[5] || '').replace(/""/g,'"').replace(/^"|"$/g,'');
      const createdAt = parts[6] || '';
      const createdBy = (parts[7] || '').replace(/""/g,'"').replace(/^"|"$/g,'');
      let daily_json = parts.slice(8).join(',') || '';
      // strip surrounding quotes from daily_json and unescape double quotes
      daily_json = daily_json.replace(/^"|"$/g, '').replace(/""/g, '"');
      let daily = [];
      try { daily = JSON.parse(daily_json); } catch(e) { daily = []; }
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

});
