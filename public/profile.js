(function() {
  var params = new URLSearchParams(window.location.search);
  var userId = params.get('id');
  if (!userId) { document.getElementById('profileName').textContent = 'Пользователь не указан'; return; }

  var avatarEl = document.getElementById('profileAvatar');
  var nameEl = document.getElementById('profileName');
  var statsEl = document.getElementById('profileStats');
  var subBtn = document.getElementById('profileSubBtn');
  var grid = document.getElementById('profileVideosGrid');
  var searchForm = document.getElementById('searchForm');
  var searchInput = document.getElementById('searchInput');
  var menuBtn = document.getElementById('menuBtn');
  var sidebar = document.getElementById('sidebar');
  var content = document.querySelector('.content');

  var isSubscribed = false;
  var profileData = null;

  menuBtn.addEventListener('click', function() {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    window.location.href = '/?search=' + encodeURIComponent(searchInput.value.trim());
  });

  function fmtViews(v) {
    if (!v) return '0';
    if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
    if (v >= 1000) return (v / 1000).toFixed(1) + 'K';
    return '' + v;
  }

  function fmtDate(d) {
    var date = new Date(d), now = new Date();
    var diff = Math.floor((now - date) / 86400000);
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

  function fmtDur(s) {
    if (!s) return '--:--';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    if (h > 0) return h + ':' + String(m).padStart(2,'0') + ':' + String(sec).padStart(2,'0');
    return m + ':' + String(sec).padStart(2,'0');
  }

  function createVideoCard(video) {
    var card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = function() { window.location.href = '/watch.html?id=' + video.id; };
    card.innerHTML = '<div class="video-thumbnail"><video preload="metadata" muted playsinline src="/video/' + video.filename + '"></video><span class="video-duration">' + fmtDur(video.duration) + '</span></div><div class="video-info"><div style="flex:1;min-width:0"><div class="video-title">' + escHtml(video.title || 'Без названия') + '</div><div class="video-meta">' + fmtViews(video.views) + ' просмотров • ' + fmtDate(video.uploaded) + '</div></div></div>';
    return card;
  }

  async function loadProfile() {
    try {
      var r = await fetch('/api/users/' + userId + '/profile');
      if (!r.ok) throw Error();
      profileData = await r.json();

      nameEl.textContent = profileData.username;
      avatarEl.textContent = profileData.username.charAt(0).toUpperCase();
      statsEl.textContent = fmtViews(profileData.totalViews) + ' просмотров • ' + profileData.videoCount + ' видео • ' + fmtViews(profileData.subscriberCount) + ' подписчиков';

      document.title = profileData.username + ' - MyTube';

      loadVideos();
      setupSubButton();
    } catch(e) {
      nameEl.textContent = 'Пользователь не найден';
    }
  }

  async function setupSubButton() {
    checkAuth().then(function() {
      updateAuthUI();
      initAuthUI();
      if (currentUser) {
        if (currentUser.id === userId) { subBtn.style.display = 'none'; return; }
        fetch('/api/subscriptions/check/' + userId, { headers: authHeaders() }).then(function(r) { return r.json(); }).then(function(d) {
          isSubscribed = d.subscribed;
          subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
          subBtn.classList.toggle('subscribed', isSubscribed);
          subBtn.onclick = toggleSub;
        });
      } else {
        subBtn.onclick = showAuthModal;
      }
    });
  }

  async function toggleSub() {
    try {
      if (isSubscribed) {
        await fetch('/api/subscriptions/' + userId, { method: 'DELETE', headers: authHeaders() });
        isSubscribed = false;
      } else {
        await fetch('/api/subscriptions/' + userId, { method: 'POST', headers: authHeaders() });
        isSubscribed = true;
      }
      subBtn.textContent = isSubscribed ? '✓ Подписан' : 'Подписаться';
      subBtn.classList.toggle('subscribed', isSubscribed);
    } catch(e) {}
  }

  async function loadVideos() {
    try {
      var r = await fetch('/api/videos?authorId=' + userId);
      var videos = await r.json();
      if (!videos.length) { grid.innerHTML = '<div class="loading">У автора пока нет видео</div>'; return; }
      grid.innerHTML = '';
      for (var i = 0; i < videos.length; i++) grid.appendChild(createVideoCard(videos[i]));
    } catch(e) { grid.innerHTML = '<div class="loading">Ошибка загрузки</div>'; }
  }

  loadProfile();
})();
