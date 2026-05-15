document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  if (!videoId) {
    document.getElementById('videoTitle').textContent = 'Видео не найдено';
    return;
  }

  const player = document.getElementById('videoPlayer');
  const adOverlay = document.getElementById('adOverlay');
  const adTimer = document.getElementById('adTimer');
  const adSkipBtn = document.getElementById('adSkipBtn');
  const titleEl = document.getElementById('videoTitle');
  const statsEl = document.getElementById('videoStats');
  const descEl = document.getElementById('videoDescription');
  const tagsEl = document.getElementById('videoTags');
  const downloadBtn = document.getElementById('downloadBtn');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const content = document.querySelector('.content');
  const authorSection = document.getElementById('authorSection');
  const authorName = document.getElementById('authorName');
  const subBtn = document.getElementById('subBtn');
  const commentInput = document.getElementById('commentInput');
  const commentSubmit = document.getElementById('commentSubmit');
  const commentsList = document.getElementById('commentsList');
  const commentsTitle = document.getElementById('commentsTitle');
  const recommendationsList = document.getElementById('recommendationsList');

  let videoData = null;
  let adShown = false;
  let adCountdown = null;
  let adTimerInterval = null;
  let isSubscribed = false;

  await checkAuth();
  updateAuthUI();
  initAuthUI();

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = `/?search=${encodeURIComponent(searchInput.value.trim())}`;
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

  function createRecCard(video) {
    const div = document.createElement('div');
    div.className = 'rec-card';
    div.onclick = () => window.location.href = `/watch.html?id=${video.id}`;
    const mimeType = getFileType(video.filename);
    div.innerHTML = `
      <div class="rec-thumb">
        <video preload="metadata" muted playsinline>
          <source src="/video/${video.filename}#t=0.1" type="${mimeType}">
        </video>
        <span class="video-duration">${formatDuration(video.duration)}</span>
      </div>
      <div class="rec-info">
        <div class="rec-title">${video.title || 'Без названия'}</div>
        <div class="video-meta">${video.authorName || ''} • ${formatViews(video.views)}</div>
      </div>
    `;
    return div;
  }

  async function loadVideo() {
    try {
      const res = await fetch(`/api/videos/${videoId}`);
      if (!res.ok) throw new Error('Not found');
      videoData = await res.json();

      document.title = `${videoData.title} - MyTube`;
      titleEl.textContent = videoData.title;
      statsEl.textContent = `${formatViews(videoData.views)} • ${formatDate(videoData.uploaded)}`;
      descEl.textContent = videoData.description || 'Описание отсутствует';

      if (videoData.tags && videoData.tags.length > 0) {
        tagsEl.innerHTML = videoData.tags.map(t => `<span class="video-tag">#${t}</span>`).join('');
      }

      const ext = videoData.filename.split('.').pop().toLowerCase();
      const mimeType = getFileType(videoData.filename);

      player.innerHTML = `<source src="/video/${videoData.filename}" type="${mimeType}">`;
      player.load();

      downloadBtn.href = `/api/download/${videoData.id}`;

      // Author section
      if (videoData.authorId) {
        authorSection.style.display = 'flex';
        authorName.textContent = videoData.authorName || 'Автор';
        if (currentUser) {
          if (currentUser.id === videoData.authorId) {
            subBtn.style.display = 'none';
          } else {
            checkSubscription();
            subBtn.addEventListener('click', toggleSubscription);
          }
        } else {
          subBtn.addEventListener('click', () => showAuthModal());
        }
      }

      const MINUTES_30 = 1800;
      const needsAd = videoData.duration >= MINUTES_30;
      if (needsAd) {
        const adKey = `ad_shown_${videoData.id}`;
        adShown = sessionStorage.getItem(adKey) === 'true';
        if (!adShown) setupAdSystem(adKey);
      }
    } catch (err) {
      titleEl.textContent = 'Видео не найдено';
      statsEl.textContent = '';
    }
  }

  async function checkSubscription() {
    try {
      const res = await fetch(`/api/subscriptions/check/${videoData.authorId}`, {
        headers: authHeaders()
      });
      const data = await res.json();
      isSubscribed = data.subscribed;
      subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
      subBtn.classList.toggle('subscribed', isSubscribed);
    } catch {}
  }

  async function toggleSubscription() {
    try {
      if (isSubscribed) {
        await fetch(`/api/subscriptions/${videoData.authorId}`, {
          method: 'DELETE', headers: authHeaders()
        });
        isSubscribed = false;
      } else {
        await fetch(`/api/subscriptions/${videoData.authorId}`, {
          method: 'POST', headers: authHeaders()
        });
        isSubscribed = true;
      }
      subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
      subBtn.classList.toggle('subscribed', isSubscribed);
    } catch {}
  }

  function setupAdSystem(adKey) {
    player.addEventListener('play', () => {
      if (adShown) return;
      adShown = true;

      player.pause();
      adOverlay.classList.add('active');

      let countdown = 5;
      adTimer.textContent = countdown;
      adSkipBtn.classList.remove('active');

      if (adTimerInterval) clearInterval(adTimerInterval);
      adTimerInterval = setInterval(() => {
        countdown--;
        adTimer.textContent = countdown;
        if (countdown <= 0) {
          clearInterval(adTimerInterval);
          adSkipBtn.classList.add('active');
        }
      }, 1000);

      if (adCountdown) clearTimeout(adCountdown);
      adCountdown = setTimeout(() => {
        if (!adSkipBtn.classList.contains('active')) adSkipBtn.classList.add('active');
      }, 5000);
    });

    function dismissAd() {
      adOverlay.classList.remove('active');
      if (adTimerInterval) clearInterval(adTimerInterval);
      if (adCountdown) clearTimeout(adCountdown);
      sessionStorage.setItem(adKey, 'true');
      player.play().catch(() => {});
    }

    adSkipBtn.addEventListener('click', dismissAd);
    adOverlay.addEventListener('click', (e) => {
      if (e.target === adOverlay && adSkipBtn.classList.contains('active')) dismissAd();
    });
  }

  // ─── Comments ──────────────────────────────────
  async function loadComments() {
    try {
      const res = await fetch(`/api/comments/${videoId}`);
      const comments = await res.json();
      if (comments.length === 0) {
        commentsList.innerHTML = '<div class="loading" style="padding:20px 0">Нет комментариев</div>';
        commentsTitle.textContent = 'Комментарии';
        return;
      }
      commentsTitle.textContent = `Комментарии (${comments.length})`;
      commentsList.innerHTML = comments.map(c => `
        <div class="comment">
          <div class="comment-header">
            <span class="comment-author">${c.username}</span>
            <span class="comment-date">${formatDate(c.createdAt)}</span>
          </div>
          <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
      `).join('');
    } catch {
      commentsList.innerHTML = '<div class="loading">Ошибка загрузки</div>';
    }
  }

  function escapeHtml(text) {
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
  }

  commentSubmit.addEventListener('click', async () => {
    const text = commentInput.value.trim();
    if (!text) return;

    if (!currentUser) {
      showAuthModal();
      return;
    }

    try {
      const res = await fetch(`/api/comments/${videoId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ text })
      });
      if (!res.ok) throw new Error('Failed');
      commentInput.value = '';
      loadComments();
    } catch {}
  });

  // ─── Recommendations ────────────────────────────
  async function loadRecommendations() {
    try {
      const res = await fetch(`/api/recommendations?videoId=${videoId}`);
      const videos = await res.json();
      if (videos.length === 0) {
        recommendationsList.innerHTML = '<div class="loading" style="padding:10px 0">Нет рекомендаций</div>';
        return;
      }
      recommendationsList.innerHTML = '';
      videos.slice(0, 10).forEach(v => recommendationsList.appendChild(createRecCard(v)));
    } catch {
      recommendationsList.innerHTML = '<div class="loading">Ошибка</div>';
    }
  }

  loadVideo();
  loadComments();
  loadRecommendations();
});
