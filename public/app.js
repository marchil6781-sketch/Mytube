(function() {
  const grid = document.getElementById('videosGrid');
  const searchForm = document.getElementById('searchForm');
  const searchInput = document.getElementById('searchInput');
  const menuBtn = document.getElementById('menuBtn');
  const sidebar = document.getElementById('sidebar');
  const content = document.querySelector('.content');
  const navSubs = document.getElementById('navSubs');
  const homeTabs = document.getElementById('homeTabs');

  let currentFilter = 'all';

  menuBtn.addEventListener('click', function() {
    sidebar.classList.toggle('closed');
    content.classList.toggle('expanded');
  });

  checkAuth().then(function() {
    updateAuthUI();
    initAuthUI();
    if (currentUser) {
      navSubs.style.display = 'flex';
      homeTabs.style.display = 'flex';
    }
  }).catch(function() {});

  if (homeTabs) {
    homeTabs.addEventListener('click', function(e) {
      if (e.target.classList.contains('tab')) {
        var tabs = homeTabs.querySelectorAll('.tab');
        for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
        e.target.classList.add('active');
        currentFilter = e.target.dataset.filter;
        loadVideos();
      }
    });
  }

  if (navSubs) {
    navSubs.addEventListener('click', function(e) {
      e.preventDefault();
      currentFilter = 'subscribed';
      var tabs = homeTabs.querySelectorAll('.tab');
      for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
      var subTab = homeTabs.querySelector('[data-filter="subscribed"]');
      if (subTab) subTab.classList.add('active');
      loadVideos();
    });
  }

  function fmtDur(s) {
    if (!s) return '--:--';
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
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

  function createVideoCard(video) {
    var card = document.createElement('div');
    card.className = 'video-card';
    card.onclick = function() { window.location.href = '/watch.html?id=' + video.id; };

    var authorHtml = video.authorName ? '<span style="color:#aaa">' + escHtml(video.authorName) + '</span> • ' : '';

    card.innerHTML = '<div class="video-thumbnail">' +
      '<video preload="metadata" muted playsinline src="/video/' + video.filename + '"></video>' +
      '<span class="video-duration">' + fmtDur(video.duration) + '</span></div>' +
      '<div class="video-info"><div style="flex:1;min-width:0">' +
      '<div class="video-title">' + escHtml(video.title || 'Без названия') + '</div>' +
      '<div class="video-meta">' + authorHtml + fmtViews(video.views) + ' • ' + fmtDate(video.uploaded) + '</div></div></div>';

    return card;
  }

  function loadVideos() {
    grid.innerHTML = '<div class="loading">Загрузка видео...</div>';
    var url;
    if (currentFilter === 'subscribed' && currentUser) {
      url = '/api/videos?subscribed=true';
    } else if (searchInput.value.trim()) {
      url = '/api/videos?search=' + encodeURIComponent(searchInput.value.trim());
    } else {
      url = '/api/videos';
    }

    fetch(url).then(function(r) { return r.json(); }).then(function(videos) {
      if (!videos || videos.length === 0) {
        grid.innerHTML = '<div class="loading">Видео не найдено</div>';
        return;
      }
      grid.innerHTML = '';
      for (var i = 0; i < videos.length; i++) {
        grid.appendChild(createVideoCard(videos[i]));
      }
    }).catch(function() {
      grid.innerHTML = '<div class="loading">Ошибка загрузки видео</div>';
    });
  }

  searchForm.addEventListener('submit', function(e) {
    e.preventDefault();
    currentFilter = 'all';
    var tabs = homeTabs.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.remove('active');
    var allTab = homeTabs.querySelector('[data-filter="all"]');
    if (allTab) allTab.classList.add('active');
    loadVideos();
  });

  loadVideos();
})();
