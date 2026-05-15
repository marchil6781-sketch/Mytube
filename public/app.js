document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('videosGrid');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const content = document.querySelector('.content');
  const navSubs = document.getElementById('navSubs');
  const homeTabs = document.getElementById('homeTabs');

  let currentFilter = 'all';

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  await checkAuth();
  updateAuthUI();
  initAuthUI();

  if (currentUser) {
    navSubs.style.display = 'flex';
    homeTabs.style.display = 'flex';
  }

  homeTabs?.addEventListener('click', (e) => {
    if (e.target.classList.contains('tab')) {
      homeTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      loadVideos();
    }
  });

  navSubs?.addEventListener('click', (e) => {
    e.preventDefault();
    currentFilter = 'subscribed';
    homeTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    homeTabs.querySelector('[data-filter="subscribed"]')?.classList.add('active');
    loadVideos();
  });

  function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '--:--';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  function formatViews(views) {
    if (!views) return '0 просмотров';
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M просмотров`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K просмотров`;
    return `${views} просмотров`;
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'вчера';
    if (diff < 7) return `${diff} дней назад`;
    if (diff < 30) return `${Math.floor(diff / 7)} нед. назад`;
    if (diff < 365) return `${Math.floor(diff / 30)} мес. назад`;
    return `${Math.floor(diff / 365)} лет назад`;
  }

  function getFileType(filename) {
    const map = {
      mp4:'video/mp4', webm:'video/webm', ogg:'video/ogg',
      avi:'video/x-msvideo', mov:'video/quicktime', mkv:'video/x-matroska',
      wmv:'video/x-ms-wmv', flv:'video/x-flv', m4v:'video/mp4',
      3gp:'video/3gpp', mpeg:'video/mpeg', mpg:'video/mpeg',
      ts:'video/mp2t', mts:'video/mp2t', m2ts:'video/mp2t'
    };
    const ext = filename.split('.').pop().toLowerCase();
    return map[ext] || 'video/mp4';
  }

  function createVideoCard(video) {
    const card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = () => window.location.href = `/watch.html?id=${video.id}`;

    const mimeType = getFileType(video.filename);
    const authorHtml = video.authorName ? `<span style="color:#aaa">${video.authorName}</span> • ` : '';

    card.innerHTML = `
      <div class="video-thumbnail">
        <video preload="metadata" muted playsinline src="/video/${video.filename}"></video>
        <span class="video-duration">${formatDuration(video.duration)}</span>
      </div>
      <div class="video-info">
        <div style="flex:1;min-width:0">
          <div class="video-title">${video.title || 'Без названия'}</div>
          <div class="video-meta">${authorHtml}${formatViews(video.views)} • ${formatDate(video.uploaded)}</div>
        </div>
      </div>
    `;
    return card;
  }

  async function loadVideos() {
    grid.innerHTML = '<div class="loading">Загрузка видео...</div>';
    try {
      let url;
      if (currentFilter === 'subscribed' && currentUser) {
        url = '/api/videos?subscribed=true';
      } else if (searchInput.value.trim()) {
        url = `/api/videos?search=${encodeURIComponent(searchInput.value.trim())}`;
      } else {
        url = '/api/videos';
      }
      const res = await fetch(url);
      const videos = await res.json();
      if (videos.length === 0) {
        grid.innerHTML = '<div class="loading">Видео не найдено</div>';
        return;
      }
      grid.innerHTML = '';
      videos.forEach(v => grid.appendChild(createVideoCard(v)));
    } catch (err) {
      grid.innerHTML = '<div class="loading">Ошибка загрузки видео</div>';
    }
  }

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    currentFilter = 'all';
    homeTabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    homeTabs.querySelector('[data-filter="all"]')?.classList.add('active');
    loadVideos();
  });

  loadVideos();
});
