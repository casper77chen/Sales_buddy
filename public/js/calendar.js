// 新增拜訪 Modal
function openAddModal(date, slot) {
  document.getElementById('addDate').value = date;
  document.getElementById('addTimeSlot').value = slot;
  document.getElementById('addDateTimeDisplay').textContent = `${date} ${slot}`;
  document.getElementById('clientSearch').value = '';
  document.getElementById('addClientId').value = '';
  document.getElementById('clientResults').innerHTML = '';
  document.getElementById('clientInfo').style.display = 'none';
  document.getElementById('addSubmitBtn').disabled = true;

  new bootstrap.Modal(document.getElementById('addVisitModal')).show();
}

// 客戶搜尋 autocomplete
let searchTimeout;
document.getElementById('clientSearch').addEventListener('input', function () {
  clearTimeout(searchTimeout);
  const q = this.value.trim();
  const resultsDiv = document.getElementById('clientResults');

  if (q.length < 1) {
    resultsDiv.innerHTML = '';
    return;
  }

  searchTimeout = setTimeout(async () => {
    const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
    const clients = await res.json();

    if (clients.length === 0) {
      resultsDiv.innerHTML = '<div class="list-group-item text-muted">找不到符合的客戶</div>';
      return;
    }

    resultsDiv.innerHTML = clients.map(c => `
      <button type="button" class="list-group-item list-group-item-action"
        onclick="selectClient('${c._id}', '${c.name.replace(/'/g, "\\'")}', '${(c.phone || '').replace(/'/g, "\\'")}', '${(c.address || '').replace(/'/g, "\\'")}')">
        <strong>${c.name}</strong>
        ${c.address ? '<br><small class="text-muted">' + c.address + '</small>' : ''}
      </button>
    `).join('');
  }, 300);
});

function selectClient(id, name, phone, address) {
  document.getElementById('addClientId').value = id;
  document.getElementById('clientSearch').value = name;
  document.getElementById('clientResults').innerHTML = '';
  document.getElementById('addSubmitBtn').disabled = false;

  document.getElementById('ciName').textContent = name;
  document.getElementById('ciPhone').textContent = phone || '-';
  document.getElementById('ciAddress').textContent = address || '-';
  document.getElementById('clientInfo').style.display = 'block';
}

// 編輯拜訪 Modal
async function openEditModal(visitId) {
  const res = await fetch(`/visits/${visitId}/json`);
  if (!res.ok) return alert('無法載入拜訪資料');
  const visit = await res.json();

  document.getElementById('editVisitForm').action = `/visits/${visitId}?_method=PUT`;
  document.getElementById('editClientName').textContent = visit.client ? visit.client.name : '未知';
  document.getElementById('editClientPhone').textContent = visit.client ? (visit.client.phone || '-') : '-';
  document.getElementById('editClientAddress').textContent = visit.client ? (visit.client.address || '-') : '-';
  document.getElementById('editStatus').value = visit.status;
  document.getElementById('editContactPerson').value = visit.contactPerson || '';
  document.getElementById('editContent').value = visit.content || '';
  document.getElementById('editFollowUp').value = visit.followUp || '';

  // 刪除按鈕
  document.getElementById('deleteVisitBtn').onclick = function () {
    if (confirm('確定要刪除此拜訪行程嗎？')) {
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `/visits/${visitId}?_method=DELETE`;
      document.body.appendChild(form);
      form.submit();
    }
  };

  new bootstrap.Modal(document.getElementById('editVisitModal')).show();
}

// 點擊外部關閉搜尋結果
document.addEventListener('click', function (e) {
  if (!e.target.closest('#clientSearch') && !e.target.closest('#clientResults')) {
    document.getElementById('clientResults').innerHTML = '';
  }
});
