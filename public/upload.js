document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('uploadForm');
  const fileInput = document.getElementById('videoFile');
  const fileArea = document.getElementById('fileUploadArea');
  const fileText = document.getElementById('fileUploadText');
  const fileName = document.getElementById('fileUploadName');
  const titleInput = document.getElementById('title');
  const descriptionInput = document.getElementById('description');
  const tagsInput = document.getElementById('tags');
  const submitBtn = document.getElementById('submitBtn');
  const progress = document.getElementById('uploadProgress');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const content = document.querySelector('.content');

  await checkAuth();
  updateAuthUI();
  initAuthUI();

  if (!currentUser) {
    submitBtn.textContent = 'Войдите чтобы загружать';
    submitBtn.disabled = true;
  }

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = `/?search=${encodeURIComponent(searchInput.value.trim())}`;
  });

  fileArea.addEventListener('click', () => fileInput.click());

  fileArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    fileArea.style.borderColor = '#ff0000';
  });

  fileArea.addEventListener('dragleave', () => {
    fileArea.style.borderColor = '#303030';
  });

  fileArea.addEventListener('drop', (e) => {
    e.preventDefault();
    fileArea.style.borderColor = '#303030';
    if (e.dataTransfer.files.length) {
      fileInput.files = e.dataTransfer.files;
      updateFileInfo();
    }
  });

  fileInput.addEventListener('change', updateFileInfo);

  function updateFileInfo() {
    if (fileInput.files.length > 0) {
      const f = fileInput.files[0];
      fileArea.classList.add('has-file');
      fileText.style.display = 'none';
      fileName.style.display = 'block';
      fileName.textContent = `✅ ${f.name} (${(f.size / (1024*1024)).toFixed(1)} MB)`;
      if (!titleInput.value) {
        titleInput.value = f.name.replace(/\.[^/.]+$/, '');
      }
    } else {
      fileArea.classList.remove('has-file');
      fileText.style.display = 'block';
      fileName.style.display = 'none';
    }
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (!currentUser) { showAuthModal(); return; }
    if (!fileInput.files.length) { alert('Пожалуйста, выберите видео файл'); return; }

    const formData = new FormData();
    formData.append('video', fileInput.files[0]);
    formData.append('title', titleInput.value.trim() || 'Без названия');
    formData.append('description', descriptionInput.value.trim());
    formData.append('tags', tagsInput.value.trim());

    submitBtn.disabled = true;
    submitBtn.textContent = 'Загрузка...';
    progress.classList.add('active');

    try {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/upload');
      xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressFill.style.width = pct + '%';
          progressText.textContent = `Загрузка... ${pct}%`;
        }
      };

      const result = await new Promise((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
          else reject(new Error(xhr.responseText));
        };
        xhr.onerror = () => reject(new Error('Network error'));
        xhr.send(formData);
      });

      if (result.success) {
        progressFill.style.width = '100%';
        progressText.textContent = '✅ Загружено! Перенаправление...';
        setTimeout(() => window.location.href = `/watch.html?id=${result.video.id}`, 1000);
      }
    } catch (err) {
      alert('Ошибка загрузки: ' + err.message);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Загрузить видео';
      progress.classList.remove('active');
    }
  });
});
