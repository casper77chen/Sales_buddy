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
  document.getElementById('quickCreateClient').style.display = 'none';

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
    document.getElementById('quickCreateClient').style.display = 'none';
    return;
  }

  searchTimeout = setTimeout(async () => {
    const res = await fetch(`/api/clients/search?q=${encodeURIComponent(q)}`);
    const clients = await res.json();

    if (clients.length === 0) {
      resultsDiv.innerHTML = `
        <button type="button" class="list-group-item list-group-item-action text-primary fw-bold" onclick="showQuickCreate()">
          <i class="bi bi-plus-circle"></i> 找不到「${q}」，點此新增客戶
        </button>`;
      return;
    }
    document.getElementById('quickCreateClient').style.display = 'none';

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

// 快速新增客戶
function showQuickCreate() {
  const searchVal = document.getElementById('clientSearch').value.trim();
  document.getElementById('qcName').value = searchVal;
  document.getElementById('qcPhone').value = '';
  document.getElementById('qcAddress').value = '';
  document.getElementById('quickCreateClient').style.display = 'block';
  document.getElementById('clientResults').innerHTML = '';
  document.getElementById('qcName').focus();
}

async function quickCreateClient() {
  const name = document.getElementById('qcName').value.trim();
  const phone = document.getElementById('qcPhone').value.trim();
  const address = document.getElementById('qcAddress').value.trim();

  if (!name) {
    alert('請填寫診所名稱');
    return;
  }

  const btn = document.getElementById('qcSubmitBtn');
  btn.disabled = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> 建立中...';

  try {
    const res = await fetch('/api/clients/quick-create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address }),
    });
    const client = await res.json();
    if (client.error) {
      alert(client.error);
      return;
    }
    selectClient(client._id, client.name, client.phone, client.address);
    document.getElementById('quickCreateClient').style.display = 'none';
  } catch (err) {
    alert('建立失敗，請稍後再試');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg"></i> 建立並選擇此客戶';
  }
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
  document.getElementById('editDuration').value = visit.duration || 1;
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
