// Client-side invoice storage, item editor, CSV transfer, and printing.
document.addEventListener('DOMContentLoaded', () => {
  const userDisplay = document.getElementById('userDisplay');
  const customerInput = document.getElementById('customer');
  const billingDateInput = document.getElementById('billingDate');
  const openBtn = document.getElementById('openBtn');
  const modal = document.getElementById('modal');
  const tablesContainer = document.getElementById('tablesContainer');
  const amountWords = document.getElementById('amountWords');
  const previousDuesInput = document.getElementById('previousDues');
  const totalAllEl = document.getElementById('totalAll');
  const saveBtn = document.getElementById('saveBtn');
  const saveImageBtn = document.getElementById('saveImageBtn');
  const saveDraftBtn = document.getElementById('saveDraftBtn');
  const updateBtn = document.getElementById('updateBtn');
  const printEditedBtn = document.getElementById('printEditedBtn');
  const previousBillsModal = document.getElementById('previousBillsModal');
  const previousBillsTableBody = document.querySelector('#previousBillsTable tbody');
  const loggedIn = sessionStorage.getItem('loggedInUser');
  let editingInvoiceId = null;
  let saveInProgress = false;

  userDisplay.textContent = loggedIn ? `Signed in as: ${loggedIn}` : 'Signed in as: Guest';
  billingDateInput.value = new Date().toISOString().slice(0, 10);

  openBtn.addEventListener('click', () => {
    if (!customerInput.value.trim()) return alert('Enter customer name first.');
    if (!billingDateInput.value) return alert('Select a billing date first.');
    openNewEditor();
  });
  document.getElementById('closeModal').addEventListener('click', closeEditor);
  document.getElementById('cancelBtn').addEventListener('click', closeEditor);
  document.getElementById('logoutBtn').addEventListener('click', () => {
    sessionStorage.removeItem('loggedInUser');
    window.location.href = '../index.html';
  });

  function setEditorButtonMode(editMode) {
    saveBtn.classList.toggle('is-hidden', editMode);
    saveDraftBtn.classList.toggle('is-hidden', editMode);
    updateBtn.classList.toggle('is-hidden', !editMode);
    printEditedBtn.classList.toggle('is-hidden', !editMode);
  }
  function closeEditor() {
    modal.classList.remove('show');
    tablesContainer.innerHTML = '';
    amountWords.value = '';
    previousDuesInput.value = '';
    editingInvoiceId = null;
    saveInProgress = false;
    setEditorButtonMode(false);
  }
  function openNewEditor() {
    editingInvoiceId = null;
    tablesContainer.innerHTML = '';
    addItemRow();
    setEditorButtonMode(false);
    modal.classList.add('show');
    recalcTotal();
  }
  previousDuesInput.addEventListener('input', recalcTotal);
  function addItemRow(item = {}) {
    const row = document.createElement('div');
    row.className = 'item-row';
    row.innerHTML = `<span class="item-number"></span><input class="item-name" placeholder="Item name" value="${escapeAttribute(item.name || '')}"><div class="item-quantity-wrap"><input class="item-quantity" type="number" min="0" step="any" placeholder="Qty" value="${item.quantity ?? ''}"><select class="item-unit" aria-label="Unit of quantity"><option value="Kg" ${((item.unit || 'Kg') === 'Kg') ? 'selected' : ''}>Kg</option><option value="Pkgs" ${((item.unit || 'Kg') === 'Pkgs') ? 'selected' : ''}>Pkgs</option></select></div><input class="item-quote" type="number" min="0" step="any" placeholder="Quote price" value="${item.quotePrice ?? ''}"><input class="item-price" type="number" readonly placeholder="0.00"><span class="item-actions"><button type="button" class="remove-item" title="Remove item" aria-label="Remove item">&times;</button></span>`;
    row.querySelectorAll('input, select').forEach(control => {
      control.addEventListener('input', recalcTotal);
      control.addEventListener('change', recalcTotal);
    });
    row.querySelector('.remove-item').addEventListener('click', () => {
      if (tablesContainer.children.length > 1) row.remove();
      renumberRows();
      updateAddItemButton();
      recalcTotal();
    });
    tablesContainer.appendChild(row);
    renumberRows();
    updateAddItemButton();
    recalcTotal();
  }
  function updateAddItemButton() {
    tablesContainer.querySelectorAll('.add-item-row').forEach(button => button.remove());
    const lastRow = tablesContainer.querySelector('.item-row:last-child');
    if (!lastRow) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'add-item-row';
    button.title = 'Add item';
    button.setAttribute('aria-label', 'Add item');
    button.textContent = '+';
    button.addEventListener('click', () => addItemRow());
    lastRow.querySelector('.item-actions').prepend(button);
  }
  function renumberRows() {
    tablesContainer.querySelectorAll('.item-row').forEach((row, index) => { row.querySelector('.item-number').textContent = index + 1; });
  }
  function recalcTotal() {
    let total = 0;
    tablesContainer.querySelectorAll('.item-row').forEach(row => {
      const quantity = Number(row.querySelector('.item-quantity').value);
      const quotePrice = Number(row.querySelector('.item-quote').value);
      const price = Number.isFinite(quantity) && Number.isFinite(quotePrice) && quantity >= 0 && quotePrice >= 0 ? quantity * quotePrice : 0;
      row.querySelector('.item-price').value = price.toFixed(2);
      total += price;
    });
    const previousDues = Number(previousDuesInput.value);
    total += Number.isFinite(previousDues) && previousDues >= 0 ? previousDues : 0;
    totalAllEl.textContent = total.toFixed(2);
    amountWords.value = numberToWords(Math.round(total));
  }
  function readItems() {
    const items = [];
    let invalid = false;
    tablesContainer.querySelectorAll('.item-row').forEach((row, index) => {
      const name = row.querySelector('.item-name').value.trim();
      const quantityRaw = row.querySelector('.item-quantity').value.trim();
      const quantityUnit = row.querySelector('.item-unit')?.value || 'Kg';
      const quoteRaw = row.querySelector('.item-quote').value.trim();
      if (!name && !quantityRaw && !quoteRaw) return;
      const quantity = Number(quantityRaw);
      const quotePrice = Number(quoteRaw);
      if (!name || !quantityRaw || !quoteRaw || !Number.isFinite(quantity) || !Number.isFinite(quotePrice) || quantity < 0 || quotePrice < 0) invalid = true;
      items.push({ sNo: index + 1, name, quantity, unit: quantityUnit, quotePrice, price: quantity * quotePrice });
    });
    if (invalid || items.length === 0) { alert('Add at least one item with a name, quantity, and valid non-negative quote price.'); return null; }
    return items;
  }
  function buildInvoiceData() {
    const items = readItems();
    if (!items) return null;
    const previousDues = Number(previousDuesInput.value || 0);
    const itemTotal = items.reduce((sum, item) => sum + item.price, 0);
    const total = itemTotal + (Number.isFinite(previousDues) && previousDues >= 0 ? previousDues : 0);
    const customerName = customerInput.value.trim();
    const invoiceNumber = editingInvoiceId || getNextInvoiceId();
    return { invoiceId: editingInvoiceId || invoiceNumber, invoiceNumber, customerName, billingDate: billingDateInput.value, dateText: formatDate(billingDateInput.value), items, previousDues: Number(previousDues.toFixed(2)), total: Number(total.toFixed(2)), totals: { grand: Number(total.toFixed(2)) }, totalWords: amountWords.value || numberToWords(Math.round(total)), createdAt: new Date().toISOString(), createdBy: loggedIn || '' };
  }

  saveBtn.addEventListener('click', () => handleSave(false, false));
  saveDraftBtn.addEventListener('click', () => handleSave(true, false));
  updateBtn.addEventListener('click', () => handleSave(false, true));
  printEditedBtn.addEventListener('click', () => { const invoice = buildInvoiceData(); if (invoice) openPrintWindow(invoice); });
  saveImageBtn.addEventListener('click', () => { const invoice = buildInvoiceData(); if (invoice) downloadInvoiceImage(invoice); });
  function handleSave(asDraft, updateExisting) {
    if (saveInProgress) return;
    saveInProgress = true;
    const invoice = buildInvoiceData();
    if (!invoice) { saveInProgress = false; return; }
    const invoices = loadInvoices();
    if (updateExisting) {
      if (!window.confirm('This will overwrite the existing invoice. Continue?')) { saveInProgress = false; return; }
      const index = invoices.findIndex(item => String(item.invoiceId) === String(editingInvoiceId));
      if (index >= 0) invoices[index] = invoice;
    } else invoices.push(invoice);
    localStorage.setItem('invoices', JSON.stringify(invoices));
    updateCsvCache();
    closeEditor();
    if (!asDraft && !updateExisting) openPrintWindow(invoice);
    if (updateExisting) alert('Invoice updated.');
  }
  function loadInvoices() { try { return JSON.parse(localStorage.getItem('invoices') || '[]'); } catch (error) { return []; } }
  function csvValue(value) { return `"${String(value).replace(/"/g, '""')}"`; }
  function updateCsvCache() {
    const header = ['invoiceId', 'invoiceNumber', 'customerName', 'billingDate', 'dateText', 'previousDues', 'total', 'totalWords', 'createdAt', 'createdBy', 'items_json'];
    const rows = loadInvoices().map(invoice => [invoice.invoiceId, csvValue(invoice.invoiceNumber || invoice.invoiceId || ''), csvValue(invoice.customerName), invoice.billingDate || '', csvValue(invoice.dateText || ''), Number(invoice.previousDues || 0), invoice.total || 0, csvValue(invoice.totalWords || ''), invoice.createdAt || '', csvValue(invoice.createdBy || ''), csvValue(JSON.stringify(invoice.items || []))].join(','));
    localStorage.setItem('invoices_csv', [header.join(','), ...rows].join('\n'));
  }
  function showPreviousBills() {
    const invoices = loadInvoices().sort((a, b) => Number(a.invoiceId) - Number(b.invoiceId));
    if (!invoices.length) return alert('No previous invoices found. Save some invoices first.');
    previousBillsTableBody.innerHTML = '';
    invoices.forEach(invoice => {
      const row = document.createElement('tr');
      row.innerHTML = `<td>${invoice.invoiceId}</td><td>${escapeHtml(invoice.customerName)}</td><td>${escapeHtml(invoice.dateText || invoice.billingDate || '')}</td><td>${Number(invoice.total || invoice.totals?.grand || 0).toFixed(2)}</td><td><button type="button" class="btn">Print</button></td>`;
      row.querySelector('button').addEventListener('click', event => { event.stopPropagation(); openPrintWindow(invoice); });
      row.addEventListener('click', () => openInvoiceInEditor(invoice));
      previousBillsTableBody.appendChild(row);
    });
    previousBillsModal.classList.add('show');
  }
  document.getElementById('viewPreviousBtn').addEventListener('click', showPreviousBills);
  document.getElementById('closePreviousModal').addEventListener('click', () => previousBillsModal.classList.remove('show'));
  function openInvoiceInEditor(invoice) {
    editingInvoiceId = invoice.invoiceId;
    customerInput.value = invoice.customerName || '';
    billingDateInput.value = invoice.billingDate || (invoice.monthYearISO ? invoice.monthYearISO.slice(0, 10) : '');
    previousDuesInput.value = invoice.previousDues ?? '';
    tablesContainer.innerHTML = '';
    (invoice.items || []).forEach(item => addItemRow(item));
    if (!tablesContainer.children.length) addItemRow();
    amountWords.value = invoice.totalWords || '';
    previousBillsModal.classList.remove('show');
    modal.classList.add('show');
    setEditorButtonMode(true);
    recalcTotal();
  }
  function openPrintWindow(invoice) {
    const win = window.open('', '_blank');
    if (!win) return alert('Please allow pop-ups to print the invoice.');
    win.document.open();
    let printHtml = buildPrintHTML(invoice)
      .replace('<th class="number">Quantity</th>', '<th class="number">Quantity (Pkgs. / Kgs)</th>')
      .replace('<tfoot><tr><td colspan="4">Total Amount</td>', '<tfoot><tr><td colspan="4">Previous Dues</td><td class="number">₹ ' + Number(invoice.previousDues || 0).toFixed(2) + '</td></tr><tr><td colspan="4">Total Amount</td>')
      .replace('<section class="summary"><div class="grand">Total Amount:', '<section class="summary"><div class="grand"><span class="dues">Previous Dues: ₹ ' + Number(invoice.previousDues || 0).toFixed(2) + '</span><strong>Total Amount:');
    const stampPath = new URL('../Assets/stamp.png', window.location.href).href;
    printHtml = printHtml.replace('<section class="summary"><div class="grand"><span class="dues">', '<section class="summary"><img class="total-stamp" src="' + stampPath + '" alt="Authorised signatory stamp"><div class="grand"><span class="dues">')
      .replace('<div class="signature"><span>SHANKAR SAH</span>', '<div class="signature"><img class="signature-stamp" src="' + stampPath + '" alt="Authorised signatory stamp"><span>Shankar Vegetable Shop</span>');
    printHtml = printHtml.replace('</div><div class="words">', '</strong></div><div class="words">');
    printHtml = printHtml.replace('</head>', '<style>.summary{position:relative}.total-stamp{position:absolute;left:8px;top:18px;width:108px;height:108px;object-fit:contain;z-index:2}.grand{position:relative;z-index:1}.signature{position:relative}.signature-stamp{display:block;width:108px;height:108px;object-fit:contain;margin:0 0 -20px auto;position:relative;z-index:1}</style></head>');
    win.document.write(printHtml.replace('src="./logo.png"', `src="${new URL('../Assets/logo.png', window.location.href).href}"`));
    win.document.close();
    setTimeout(() => { try { win.focus(); win.print(); } catch (error) { console.warn('Print failed', error); } }, 600);
  }

  function downloadInvoiceImage(invoice) {
    let html = buildPrintHTML(invoice)
      .replace('src="./logo.png"', `src="${new URL('../Assets/logo.png', window.location.href).href}"`)
      .replace('<main class="invoice">', '<main id="invoice-image" class="invoice">')
      .replace('<th class="number">Quantity</th>', '<th class="number">Quantity (Pkgs. / Kgs)</th>')
      .replace('<tfoot><tr><td colspan="4">Total Amount</td>', '<tfoot><tr><td colspan="4">Previous Dues</td><td class="number">₹ ' + Number(invoice.previousDues || 0).toFixed(2) + '</td></tr><tr><td colspan="4">Total Amount</td>')
      .replace('<section class="summary"><div class="grand">Total Amount:', '<section class="summary"><div class="grand"><span class="dues">Previous Dues: ₹ ' + Number(invoice.previousDues || 0).toFixed(2) + '</span><strong>Total Amount:');
    const stampPath = new URL('../Assets/stamp.png', window.location.href).href;
    html = html.replace('<section class="summary"><div class="grand"><span class="dues">', '<section class="summary"><img class="total-stamp" src="' + stampPath + '" alt="Authorised signatory stamp"><div class="grand"><span class="dues">')
      .replace('<div class="signature"><span>SHANKAR SAH</span>', '<div class="signature"><img class="signature-stamp" src="' + stampPath + '" alt="Authorised signatory stamp"><span>Shankar Vegetable Shop</span>');
    html = html.replace('</div><div class="words">', '</strong></div><div class="words">');
    html = html.replace(/SHANKAR SAH/g, 'Shankar Vegetable Shop').replace('</head>', '<style>html,body{margin:0;background:#fff!important}#invoice-page{width:794px;min-height:1123px;padding:45px;box-sizing:border-box;background:#fff}.invoice{width:100%!important;max-width:none!important;margin:0!important}.summary,.items{break-inside:avoid}.summary{position:relative}.total-stamp{position:absolute;left:8px;top:18px;width:108px;height:108px;object-fit:contain;z-index:2}.grand{position:relative;z-index:1}.signature{position:relative}.signature-stamp{display:block;width:108px;height:108px;object-fit:contain;margin:0 0 -20px auto;position:relative;z-index:1}</style></head>');
    const win = window.open('', '_blank');
    if (!win) return alert('Please allow pop-ups to save the invoice image.');
    const fileName = `${String(invoice.invoiceId || invoice.invoiceNumber || 'invoice').replace(/[^a-z0-9_-]+/gi, '-')}.png`;
    win.document.open();
    win.document.write(html.replace('</body>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"><\/script><script>window.addEventListener('load', async function () { try { if (typeof html2canvas !== 'function') throw new Error('Image renderer could not be loaded.'); const invoice = document.getElementById('invoice-image'); const page = document.createElement('div'); page.id = 'invoice-page'; invoice.parentNode.insertBefore(page, invoice); page.appendChild(invoice); if (document.fonts) await document.fonts.ready; const canvas = await html2canvas(page, { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 794, height: 1123 }); const link = document.createElement('a'); link.download = ${JSON.stringify(fileName)}; link.href = canvas.toDataURL('image/png'); document.body.appendChild(link); link.click(); setTimeout(function () { window.close(); }, 500); } catch (error) { document.body.insertAdjacentHTML('afterbegin', '<p>Unable to create invoice image. Check your internet connection and try again.</p>'); } });<\/script></body>`));
    win.document.close();
  }

  function buildPrintHTML(invoice) {
    const items = invoice.items || [];
    const total = Number(invoice.total || invoice.totals?.grand || 0).toFixed(2);
    const invoiceNumber = invoice.invoiceNumber || invoice.invoiceId || '';
    const rows = items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td class="number">${Number(item.quantity).toFixed(2)} ${escapeHtml(item.unit || 'Kg')}</td><td class="number">₹ ${Number(item.quotePrice).toFixed(2)}</td><td class="number">₹ ${Number(item.price).toFixed(2)}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(invoiceNumber)}</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172033;font:13px Montserrat,'Segoe UI',sans-serif}.invoice{max-width:190mm;margin:auto}.header{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #d9902f;padding-bottom:14px}.brand{display:flex;gap:12px;align-items:center}.logo{width:64px;height:64px;border-radius:50%;object-fit:cover}.company h1{margin:0 0 4px;font-size:20px;letter-spacing:1px}.company p{margin:3px 0;color:#657083;font-size:11px}.meta{text-align:right;color:#657083}.meta strong{display:block;color:#172033;font-size:15px;margin-bottom:8px}.bill-to{display:flex;justify-content:space-between;margin:22px 0 16px;padding:12px;background:#f5f7f9;border-left:4px solid #d9902f}.bill-to span{display:block;color:#657083;font-size:10px;text-transform:uppercase}.bill-to strong{font-size:16px}.items{width:100%;border-collapse:collapse}.items th{background:#172033;color:#fff}.items th,.items td{padding:10px 9px;border-bottom:1px solid #dce1e8;text-align:left}.items .number{text-align:right;font-variant-numeric:tabular-nums}.items tfoot td{font-weight:700;background:#f5f7f9}.summary{display:flex;justify-content:space-between;gap:20px;margin-top:22px;padding:14px;background:#f5f7f9}.grand{font-size:17px;font-weight:700}.grand .dues{display:block;font-size:13px;font-weight:600;color:#657083;margin-bottom:5px}.grand strong{display:block;font-size:21px}.words{max-width:55%;color:#657083}.words strong{display:block;color:#172033;margin-bottom:5px}.signature{text-align:right;margin-top:48px;font-weight:700}.signature span{display:block;border-top:2px solid #172033;padding-top:7px}.footer{text-align:center;color:#657083;margin-top:28px;font-size:15px;font-weight:600}@media print{.invoice{max-width:none}.items{break-inside:avoid}.summary{break-inside:avoid}}</style></head><body><main class="invoice"><header class="header"><div class="brand"><img class="logo" src="./logo.png" alt="Logo"><div class="company"><h1>Shankar Vegetable Shop</h1><p>Gamharia Market Complex - 832108</p><p>Phone: 8210945932</p><p>Email: shankarvegetableshop7@gmail.com</p></div></div><div class="meta"><strong>Invoice ${escapeHtml(invoiceNumber)}</strong><div>Bill of Date: ${escapeHtml(invoice.dateText || invoice.billingDate || '')}</div></div></header><section class="bill-to"><div><span>Bill To</span><strong>${escapeHtml(invoice.customerName)}</strong></div></section><table class="items"><thead><tr><th>Sr. No.</th><th>Item Name</th><th class="number">Quantity</th><th class="number">Quote Price</th><th class="number">Price</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="4">Total Amount</td><td class="number">₹ ${total}</td></tr></tfoot></table><section class="summary"><div class="grand">Total Amount: ₹ ${total}</div><div class="words"><strong>Total Amount in Words</strong>${escapeHtml(invoice.totalWords || '')}</div></section><div class="signature"><span>SHANKAR SAH</span>Authorized Signatory</div><div class="footer">Thank You - Visit Us Again.</div></main></body></html>`;
  }
  document.getElementById('exportCsvBtn').addEventListener('click', () => {
    updateCsvCache();
    const blob = new Blob([localStorage.getItem('invoices_csv') || ''], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'invoices_export.csv'; link.click(); URL.revokeObjectURL(link.href);
  });
  function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : ''; }
  function getNextInvoiceId() {
    let id = Number(localStorage.getItem('nextInvoiceId') || '1');
    localStorage.setItem('nextInvoiceId', String(id + 1));
    return id;
  }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char])); }
  function escapeAttribute(value) { return escapeHtml(value); }
  function numberToWords(num) { if (num === 0) return 'Zero Only'; const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']; const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']; const convert = n => n < 20 ? ones[n] : n < 100 ? tens[Math.floor(n / 10)] + (n % 10 ? ` ${ones[n % 10]}` : '') : n < 1000 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` and ${convert(n % 100)}` : ''}` : n < 100000 ? `${convert(Math.floor(n / 1000))} Thousand${n % 1000 ? ` ${convert(n % 1000)}` : ''}` : `${convert(Math.floor(n / 100000))} Lakh${n % 100000 ? ` ${convert(n % 100000)}` : ''}`; return `${convert(num)} Only`; }
  if (!localStorage.getItem('invoices_csv')) updateCsvCache();
});
