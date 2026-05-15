(function() {
  const params = new URLSearchParams(window.location.search);
  const videoId = params.get('id');
  if (!videoId) { document.getElementById('videoTitle').textContent = 'Видео не найдено'; return; }

  const player = document.getElementById('videoPlayer');
  const titleEl = document.getElementById('videoTitle');
  const statsEl = document.getElementById('videoStats');
  const descEl = document.getElementById('videoDescription');
  const tagsEl = document.getElementById('videoTags');
  const downloadBtn = document.getElementById('downloadBtn');
  const authorSection = document.getElementById('authorSection');
  const authorName = document.getElementById('authorName');
  const subBtn = document.getElementById('subBtn');
  const commentInput = document.getElementById('commentInput');
  const commentSubmit = document.getElementById('commentSubmit');
  const commentsList = document.getElementById('commentsList');
  const commentsTitle = document.getElementById('commentsTitle');
  const recList = document.getElementById('recommendationsList');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const content = document.querySelector('.content');

  let videoData = null;
  let isSubscribed = false;

  menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    window.location.href = '/?search=' + encodeURIComponent(searchInput.value.trim());
  });

  function fmtDur(s) {
    if (!s) return '--:--';
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    return m + ':' + String(sec).padStart(2,'0');
  }

  function fmtViews(v) {
    if (!v) return '0 просмотров';
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M просмотров';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K просмотров';
    return v + ' просмотров';
  }

  function fmtDate(d) {
    const date = new Date(d), now = new Date();
    const diff = Math.floor((now - date) / 86400000);
    if (diff === 0) return 'сегодня';
    if (diff === 1) return 'вчера';
    if (diff < 7) return diff + ' дней назад';
    if (diff < 30) return Math.floor(diff / 7) + ' нед. назад';
    if (diff < 365) return Math.floor(diff / 30) + ' мес. назад';
    return Math.floor(diff / 365) + ' лет назад';
  }

  function escHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  async function loadVideo() {
    try {
      var res = await fetch('/api/videos/' + videoId);
      if (!res.ok) throw Error('Not found');
      videoData = await res.json();

      document.title = videoData.title + ' - MyTube';
      titleEl.textContent = videoData.title;
      statsEl.textContent = fmtViews(videoData.views) + ' • ' + fmtDate(videoData.uploaded);
      descEl.textContent = videoData.description || '';

      if (videoData.tags && videoData.tags.length) {
        tagsEl.innerHTML = videoData.tags.map(function(t) { return '<span class="video-tag">#' + escHtml(t) + '</span>'; }).join('');
      }

      player.src = '/video/' + videoData.filename;
      player.load();

      downloadBtn.href = '/api/download/' + videoData.id;
      downloadBtn.style.display = 'inline-flex';

      if (videoData.authorId) {
        authorSection.style.display = 'flex';
        authorName.textContent = videoData.authorName || 'Автор';
        setupSubscription();
      }
    } catch (e) {
      titleEl.textContent = 'Видео не найдено';
    }
  }

  async function setupSubscription() {
    try {
      await checkAuth();
      updateAuthUI();
      initAuthUI();
      if (currentUser) {
        if (currentUser.id === videoData.authorId) { subBtn.style.display = 'none'; return; }
        var r = await fetch('/api/subscriptions/check/' + videoData.authorId, { headers: authHeaders() });
        var d = await r.json();
        isSubscribed = d.subscribed;
        subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
        subBtn.classList.toggle('subscribed', isSubscribed);
        subBtn.onclick = toggleSubscription;
      } else {
        subBtn.onclick = showAuthModal;
      }
    } catch(e) {}
  }

  async function toggleSubscription() {
    try {
      if (isSubscribed) {
        await fetch('/api/subscriptions/' + videoData.authorId, { method: 'DELETE', headers: authHeaders() });
        isSubscribed = false;
      } else {
        await fetch('/api/subscriptions/' + videoData.authorId, { method: 'POST', headers: authHeaders() });
        isSubscribed = true;
      }
      subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
      subBtn.classList.toggle('subscribed', isSubscribed);
    } catch(e) {}
  }

  async function loadComments() {
    try {
      var res = await fetch('/api/comments/' + videoId);
      var comments = await res.json();
      if (!comments.length) {
        commentsList.innerHTML = '<div class="loading" style="padding:20px 0">Нет комментариев</div>';
        commentsTitle.textContent = 'Комментарии';
        return;
      }
      commentsTitle.textContent = 'Комментарии (' + comments.length + ')';
      commentsList.innerHTML = comments.map(function(c) {
        return '<div class="comment"><div class="comment-header"><span class="comment-author">' + escHtml(c.username) + '</span><span class="comment-date">' + fmtDate(c.createdAt) + '</span></div><div class="comment-text">' + escHtml(c.text) + '</div></div>';
      }).join('');
    } catch(e) { commentsList.innerHTML = '<div class="loading">Ошибка</div>'; }
  }

  commentSubmit.addEventListener('click', async function() {
    var text = commentInput.value.trim();
    if (!text) return;
    if (!currentUser) { showAuthModal(); return; }
    try {
      var r = await fetch('/api/comments/' + videoId, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
        body: JSON.stringify({ text: text })
      });
      if (!r.ok) throw Error();
      commentInput.value = '';
      loadComments();
    } catch(e) {}
  });

  async function loadRecs() {
    try {
      var res = await fetch('/api/recommendations?videoId=' + videoId);
      var videos = await res.json();
      if (!videos.length) { recList.innerHTML = '<div class="loading">Нет рекомендаций</div>'; return; }
      recList.innerHTML = '';
      videos.slice(0, 10).forEach(function(v) {
        var div = document.createElement('div');
        div.className = 'rec-card';
        div.onclick = function() { window.location.href = '/watch.html?id=' + v.id; };
        div.innerHTML = '<div class="rec-thumb"><video preload="metadata" muted playsinline src="/video/' + v.filename + '"></video><span class="video-duration">' + fmtDur(v.duration) + '</span></div><div class="rec-info"><div class="rec-title">' + escHtml(v.title || '') + '</div><div class="video-meta">' + (v.authorName || '') + ' • ' + fmtViews(v.views) + '</div></div>';
        recList.appendChild(div);
      });
    } catch(e) { recList.innerHTML = '<div class="loading">Ошибка</div>'; }
  }

  checkAuth().then(function() {
    updateAuthUI();
    initAuthUI();
  }).catch(function() {});

  loadVideo();
  loadComments();
  loadRecs();
})();
