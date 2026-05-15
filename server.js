const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'mytube-super-secret-key-change-in-production';

const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const VIDEOS_FILE = path.join(DATA_DIR, 'videos.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const COMMENTS_FILE = path.join(DATA_DIR, 'comments.json');

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function readVideos() { return readJSON(VIDEOS_FILE); }
function writeVideos(v) { writeJSON(VIDEOS_FILE, v); }
function readUsers() { return readJSON(USERS_FILE); }
function writeUsers(u) { writeJSON(USERS_FILE, u); }
function readComments() { return readJSON(COMMENTS_FILE); }
function writeComments(c) { writeJSON(COMMENTS_FILE, c); }

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const VIDEO_MIMES = {
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.ogg': 'video/ogg',
  '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.mkv': 'video/x-matroska',
  '.wmv': 'video/x-ms-wmv', '.flv': 'video/x-flv', '.m4v': 'video/mp4',
  '.3gp': 'video/3gpp', '.ts': 'video/mp2t', '.mpeg': 'video/mpeg',
  '.mpg': 'video/mpeg', '.mts': 'video/mp2t', '.m2ts': 'video/mp2t',
  '.divx': 'video/x-msvideo', '.f4v': 'video/mp4'
};

const upload = multer({
  storage,
  limits: { fileSize: 1000 * 1024 * 1024 }
});

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '50mb' }));
app.use(cookieParser());

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

function optionalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1] || req.cookies?.token;
  if (token) {
    try { req.user = jwt.verify(token, JWT_SECRET); }
    catch { req.user = null; }
  }
  next();
}

// ─── Auth ─────────────────────────────────────────────
app.post('/api/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password)
      return res.status(400).json({ error: 'All fields required' });
    if (password.length < 4)
      return res.status(400).json({ error: 'Password too short' });

    const users = readUsers();
    if (users.find(u => u.username === username || u.email === email))
      return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = { id: uuidv4(), username, email, password: hashed, createdAt: new Date().toISOString() };
    users.push(user);
    writeUsers(users);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) { next(err); }
});

app.post('/api/login', async (req, res, next) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) return res.status(400).json({ error: 'All fields required' });

    const users = readUsers();
    const user = users.find(u => u.username === login || u.email === login);
    if (!user) return res.status(400).json({ error: 'User not found' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: 'Wrong password' });

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user: { id: user.id, username: user.username, email: user.email } });
  } catch (err) { next(err); }
});

app.get('/api/me', optionalAuth, (req, res) => {
  if (!req.user) return res.json(null);
  const users = readUsers();
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.json(null);
  res.json({ id: user.id, username: user.username, email: user.email });
});

// ─── Videos ───────────────────────────────────────────
app.get('/api/videos', optionalAuth, (req, res) => {
  let videos = readVideos();
  const { search, authorId, subscribed } = req.query;

  if (search) {
    const q = search.toLowerCase();
    videos = videos.filter(v =>
      v.title.toLowerCase().includes(q) ||
      v.description.toLowerCase().includes(q) ||
      (v.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }
  if (authorId) videos = videos.filter(v => v.authorId === authorId);
  if (subscribed === 'true' && req.user) {
    const subs = readJSON(path.join(DATA_DIR, 'subscriptions.json'));
    const authorIds = subs.filter(s => s.userId === req.user.id).map(s => s.authorId);
    videos = videos.filter(v => authorIds.includes(v.authorId));
  }

  res.json(videos);
});

app.get('/api/videos/:id', optionalAuth, (req, res) => {
  const videos = readVideos();
  const video = videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  video.views = (video.views || 0) + 1;
  writeVideos(videos);

  if (req.user) {
    const history = readJSON(path.join(DATA_DIR, 'history.json'));
    history.push({ userId: req.user.id, videoId: video.id, watchedAt: new Date().toISOString(), tags: video.tags || [], authorId: video.authorId });
    if (history.length > 500) history.splice(0, history.length - 500);
    writeJSON(path.join(DATA_DIR, 'history.json'), history);
  }

  res.json({ ...video, views: video.views });
});

app.post('/api/upload', authMiddleware, (req, res) => {
  upload.single('video')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No video file' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const videoId = path.parse(req.file.filename).name;

    const getVideoDuration = (filePath) => {
      return new Promise((resolve) => {
        try {
          const spawn = require('child_process').spawn;
          const ffprobe = spawn('ffprobe', [
            '-v', 'error',
            '-show_entries', 'format=duration',
            '-of', 'default=noprint_wrappers=1:nokey=1',
            filePath
          ]);
          let output = '';
          ffprobe.stdout.on('data', (d) => { output += d.toString(); });
          ffprobe.on('close', () => resolve(isNaN(parseFloat(output.trim())) ? 0 : Math.round(parseFloat(output.trim()))));
          ffprobe.on('error', () => resolve(0));
        } catch { resolve(0); }
      });
    };

    const filePath = req.file.path;
    getVideoDuration(filePath).then(duration => {
      const video = {
        id: videoId,
        title: req.body.title || req.file.originalname.replace(ext, ''),
        description: req.body.description || '',
        tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        filename: req.file.filename,
        originalname: req.file.originalname,
        duration,
        size: req.file.size,
        views: 0,
        uploaded: new Date().toISOString(),
        format: ext.slice(1),
        authorId: req.user.id,
        authorName: req.user.username
      };

      const videos = readVideos();
      videos.unshift(video);
      writeVideos(videos);
      res.json({ success: true, video });
    });
  });
});

app.get('/api/download/:id', (req, res) => {
  const videos = readVideos();
  const video = videos.find(v => v.id === req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  const filePath = path.join(UPLOADS_DIR, video.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath, video.originalname);
});

app.get('/video/:filename', (req, res) => {
  const filePath = path.join(UPLOADS_DIR, req.params.filename);
  if (!fs.existsSync(filePath)) return res.status(404).send('File not found');

  const ext = path.extname(filePath).toLowerCase();
  const contentType = VIDEO_MIMES[ext] || 'video/mp4';

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filePath, { start, end });
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    });
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// ─── Comments ─────────────────────────────────────────
app.get('/api/comments/:videoId', (req, res) => {
  const comments = readComments().filter(c => c.videoId === req.params.videoId);
  res.json(comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

app.post('/api/comments/:videoId', authMiddleware, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });

  const videos = readVideos();
  if (!videos.find(v => v.id === req.params.videoId))
    return res.status(404).json({ error: 'Video not found' });

  const comment = {
    id: uuidv4(),
    videoId: req.params.videoId,
    userId: req.user.id,
    username: req.user.username,
    text: text.trim(),
    createdAt: new Date().toISOString()
  };

  const comments = readComments();
  comments.push(comment);
  writeComments(comments);
  res.json(comment);
});

app.delete('/api/comments/:id', authMiddleware, (req, res) => {
  let comments = readComments();
  const idx = comments.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
  if (comments[idx].userId !== req.user.id) return res.status(403).json({ error: 'Not your comment' });
  comments.splice(idx, 1);
  writeComments(comments);
  res.json({ success: true });
});

// ─── Subscriptions ────────────────────────────────────
const SUBS_FILE = path.join(DATA_DIR, 'subscriptions.json');

app.get('/api/subscriptions', authMiddleware, (req, res) => {
  const subs = readJSON(SUBS_FILE).filter(s => s.userId === req.user.id);
  res.json(subs);
});

app.get('/api/subscriptions/check/:authorId', authMiddleware, (req, res) => {
  const subs = readJSON(SUBS_FILE);
  const sub = subs.find(s => s.userId === req.user.id && s.authorId === req.params.authorId);
  res.json({ subscribed: !!sub });
});

app.post('/api/subscriptions/:authorId', authMiddleware, (req, res) => {
  const subs = readJSON(SUBS_FILE);
  if (subs.find(s => s.userId === req.user.id && s.authorId === req.params.authorId))
    return res.json({ success: true });

  const users = readUsers();
  const author = users.find(u => u.id === req.params.authorId);
  if (!author) return res.status(404).json({ error: 'Author not found' });

  subs.push({ userId: req.user.id, authorId: req.params.authorId, authorName: author.username, createdAt: new Date().toISOString() });
  writeJSON(SUBS_FILE, subs);
  res.json({ success: true });
});

app.delete('/api/subscriptions/:authorId', authMiddleware, (req, res) => {
  let subs = readJSON(SUBS_FILE);
  subs = subs.filter(s => !(s.userId === req.user.id && s.authorId === req.params.authorId));
  writeJSON(SUBS_FILE, subs);
  res.json({ success: true });
});

// ─── Recommendations ──────────────────────────────────
app.get('/api/recommendations', optionalAuth, (req, res) => {
  const videos = readVideos();
  const { videoId } = req.query;
  const current = videos.find(v => v.id === videoId);

  let tagScores = {};
  let authorScores = {};

  if (req.user) {
    const history = readJSON(path.join(DATA_DIR, 'history.json'))
      .filter(h => h.userId === req.user.id);
    history.forEach(h => {
      (h.tags || []).forEach(t => { tagScores[t] = (tagScores[t] || 0) + 1; });
      if (h.authorId) authorScores[h.authorId] = (authorScores[h.authorId] || 0) + 1;
    });
  }

  if (current) {
    (current.tags || []).forEach(t => { tagScores[t] = (tagScores[t] || 0) + 3; });
    if (current.authorId) authorScores[current.authorId] = (authorScores[current.authorId] || 0) + 5;
  }

  const scored = videos
    .filter(v => v.id !== videoId)
    .map(v => {
      let score = 0;
      score += ((v.tags || []).reduce((s, t) => s + (tagScores[t] || 0), 0)) * 2;
      score += (authorScores[v.authorId] || 0) * 5;
      score += (v.views || 0) / 1000;
      score += new Date(v.uploaded).getTime() / 100000000000;
      return { ...v, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);

  res.json(scored);
});

// ─── Serve SPA ────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.message, err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`MyTube running on http://localhost:${PORT}`);
});
