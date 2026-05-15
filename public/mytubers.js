(function() {
  var grid = document.getElementById('mytubersGrid');
  var searchForm = document.getElementById('searchForm');
  var searchInput = document.getElementById('searchInput');
  var menuBtn = document.getElementById('menuBtn');
  var sidebar = document.getElementById('sidebar');
  var content = document.querySelector('.content');

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

  function escHtml(t) {
    var d = document.createElement('div');
    d.textContent = t;
    return d.innerHTML;
  }

  function createMytuberCard(m) {
    var card = document.createElement('div');
    card.className = 'mytuber-card';
    card.onclick = function() { window.location.href = '/profile.html?id=' + m.id; };

    card.innerHTML = '<div class="mytuber-avatar">' + escHtml(m.username.charAt(0).toUpperCase()) + '</div>' +
      '<div class="mytuber-name">' + escHtml(m.username) + '</div>' +
      '<div class="mytuber-stats">' + fmtViews(m.subscriberCount) + ' подписчиков • ' + m.videoCount + ' видео</div>' +
      '<div class="mytuber-views">' + fmtViews(m.totalViews) + ' просмотров всего</div>';

    return card;
  }

  checkAuth().then(function() {
    updateAuthUI();
    initAuthUI();
  }).catch(function() {});

  fetch('/api/mytubers').then(function(r) { return r.json(); }).then(function(mytubers) {
    if (!mytubers.length) {
      grid.innerHTML = '<div class="loading">Пока нет создателей контента</div>';
      return;
    }
    grid.innerHTML = '';
    for (var i = 0; i < mytubers.length; i++) {
      grid.appendChild(createMytuberCard(mytubers[i]));
    }
  }).catch(function() {
    grid.innerHTML = '<div class="loading">Ошибка загрузки</div>';
  });
})();
