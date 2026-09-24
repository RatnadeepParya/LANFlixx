// State
const state = {
  currentView: 'folders', // 'folders', 'all', 'recent'
  currentDir: '',
  searchQuery: '',
  sortBy: 'name',
  systemInfo: null,
  activeMovie: null,
  recentWatches: JSON.parse(localStorage.getItem('cinema_recent_watches') || '[]'),
  playbackProgress: JSON.parse(localStorage.getItem('cinema_playback_progress') || '{}'),
};

// DOM Elements
const brandHome = document.getElementById('brand-home');
const searchInput = document.getElementById('search-input');
const clearSearch = document.getElementById('clear-search');
const tabFolders = document.getElementById('tab-folders');
const tabAll = document.getElementById('tab-all');
const tabRecent = document.getElementById('tab-recent');
const btnShowQr = document.getElementById('btn-show-qr');
const btnRefresh = document.getElementById('btn-refresh');

const viewFoldersContainer = document.getElementById('view-folders-container');
const viewAllContainer = document.getElementById('view-all-container');
const viewRecentContainer = document.getElementById('view-recent-container');
const noResults = document.getElementById('no-results');

const breadcrumbsEl = document.getElementById('breadcrumbs');
const itemsCountBadge = document.getElementById('items-count-badge');
const sortSelect = document.getElementById('sort-select');
const sortWrapper = document.getElementById('sort-wrapper');

const foldersGrid = document.getElementById('folders-grid');
const folderMoviesGrid = document.getElementById('folder-movies-grid');
const allMoviesGrid = document.getElementById('all-movies-grid');
const recentMoviesGrid = document.getElementById('recent-movies-grid');
const noRecentMessage = document.getElementById('no-recent-message');
const btnClearHistory = document.getElementById('btn-clear-history');

// Player Elements
const playerModal = document.getElementById('player-modal');
const playerCloseBtn = document.getElementById('player-close-btn');
const playerBackBtn = document.getElementById('player-back-btn');
const videoEl = document.getElementById('video-element');
const playerTitle = document.getElementById('player-title');
const playerFolder = document.getElementById('player-folder');
const playerVlcBtn = document.getElementById('player-vlc-btn');
const playerCopyLinkBtn = document.getElementById('player-copy-link-btn');
const playerDownloadBtn = document.getElementById('player-download-btn');
const resumePrompt = document.getElementById('resume-prompt');
const resumeTimeText = document.getElementById('resume-time-text');
const resumeBtn = document.getElementById('resume-btn');
const restartBtn = document.getElementById('restart-btn');
const subSelect = document.getElementById('sub-select');
const customSubInput = document.getElementById('custom-sub-input');
const playerModeToggle = document.getElementById('player-mode-toggle');
const playerModeIcon = document.getElementById('player-mode-icon');
const playerModeLabel = document.getElementById('player-mode-label');

// Custom Touch Controls Elements
const playerTouchControls = document.getElementById('player-touch-controls');
const btnTouchPlay = document.getElementById('btn-touch-play');
const btnTouchRewind = document.getElementById('btn-touch-rewind');
const btnTouchForward = document.getElementById('btn-touch-forward');
const btnMiniPlay = document.getElementById('btn-mini-play');
const btnMiniMute = document.getElementById('btn-mini-mute');
const btnFullscreen = document.getElementById('btn-fullscreen');
const timeCurrent = document.getElementById('time-current');
const timeTotal = document.getElementById('time-total');
const timelineContainer = document.getElementById('timeline-container');
const timelineProgress = document.getElementById('timeline-progress');
const timelineBuffered = document.getElementById('timeline-buffered');
const timelineThumb = document.getElementById('timeline-thumb');

// Touch Controls & Seeking State
let currentMovieDuration = 0;
let universalSeekOffset = 0;
let controlsTimeout = null;

// In-Player Overlays & Error Handlers
const playerSpinner = document.getElementById('player-spinner');
const playerTapOverlay = document.getElementById('player-tap-to-play');
const playerErrorOverlay = document.getElementById('player-error-overlay');
const errorReasonText = document.getElementById('error-reason-text');
const btnFallbackVlc = document.getElementById('btn-fallback-vlc');
const btnFallbackCopy = document.getElementById('btn-fallback-copy');
const btnFallbackDownload = document.getElementById('btn-fallback-download');

// Mobile Bottom Nav Elements
const mobNavFolders = document.getElementById('mob-nav-folders');
const mobNavAll = document.getElementById('mob-nav-all');
const mobNavRecent = document.getElementById('mob-nav-recent');
const mobNavQr = document.getElementById('mob-nav-qr');

// QR Modal Elements
const qrModal = document.getElementById('qr-modal');
const qrCloseBtn = document.getElementById('qr-close-btn');
const qrBackdrop = document.getElementById('qr-backdrop');
const qrImage = document.getElementById('qr-image');
const qrUrlDisplay = document.getElementById('qr-url-display');
const btnCopyNetworkUrl = document.getElementById('btn-copy-network-url');

const toast = document.getElementById('toast');
const libraryStatsShort = document.getElementById('library-stats-short');

// Color palette for movie cards
const CARD_PALETTES = [
  'linear-gradient(135deg, #1e1b4b 0%, #0f172a 100%)',
  'linear-gradient(135deg, #31102b 0%, #111420 100%)',
  'linear-gradient(135deg, #064e3b 0%, #061922 100%)',
  'linear-gradient(135deg, #3b0764 0%, #150d26 100%)',
  'linear-gradient(135deg, #1f2937 0%, #111827 100%)',
  'linear-gradient(135deg, #7c2d12 0%, #1f120e 100%)',
];

function getPaletteForName(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % CARD_PALETTES.length;
  return CARD_PALETTES[index];
}

// Helpers
function formatSeconds(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

// Fetch System Info
async function fetchSystemInfo() {
  try {
    const res = await fetch('/api/info');
    const data = await res.json();
    state.systemInfo = data;
    if (data.totalVideos) {
      libraryStatsShort.textContent = `${data.totalVideos} Films • ${data.totalSizeFormatted}`;
    }
  } catch (e) {
    console.error('Failed to get system info:', e);
  }
}

// Load Folder View
async function loadFolderView(dir = '') {
  state.currentDir = dir;
  state.currentView = 'folders';
  updateViewTabs();

  try {
    const res = await fetch(`/api/browse?dir=${encodeURIComponent(dir)}`);
    if (!res.ok) throw new Error('Directory browse error');
    const data = await res.json();

    renderBreadcrumbs(data.breadcrumbs);
    renderFolders(data.folders);
    renderVideos(data.videos, folderMoviesGrid);

    const totalItems = data.folders.length + data.videos.length;
    itemsCountBadge.textContent = `${totalItems} ${totalItems === 1 ? 'item' : 'items'}`;

    document.getElementById('folders-group').style.display = data.folders.length > 0 ? 'block' : 'none';
    document.getElementById('folder-videos-group').style.display = data.videos.length > 0 ? 'block' : 'none';
    noResults.classList.add('hidden');
  } catch (err) {
    console.error('Error loading folder:', err);
    showToast('Failed to load folder');
  }
}

// Load All Movies Flat View
async function loadAllMovies() {
  try {
    const res = await fetch(`/api/videos?q=${encodeURIComponent(state.searchQuery)}&sort=${state.sortBy}`);
    const data = await res.json();

    document.getElementById('all-movies-subtitle').textContent = `${data.total} films found in library`;
    itemsCountBadge.textContent = `${data.total} films`;
    renderVideos(data.videos, allMoviesGrid);

    if (data.total === 0) {
      noResults.classList.remove('hidden');
    } else {
      noResults.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error loading all movies:', err);
  }
}

// Load Recent History View
function loadRecentView() {
  state.currentView = 'recent';
  updateViewTabs();

  const history = state.recentWatches;
  itemsCountBadge.textContent = `${history.length} films`;

  if (history.length === 0) {
    recentMoviesGrid.innerHTML = '';
    noRecentMessage.classList.remove('hidden');
  } else {
    noRecentMessage.classList.add('hidden');
    renderVideos(history, recentMoviesGrid);
  }
}

// Breadcrumbs Rendering
function renderBreadcrumbs(crumbs) {
  breadcrumbsEl.innerHTML = '';
  crumbs.forEach((crumb, idx) => {
    if (idx > 0) {
      const sep = document.createElement('span');
      sep.className = 'breadcrumb-separator';
      sep.textContent = '›';
      breadcrumbsEl.appendChild(sep);
    }

    const item = document.createElement('span');
    item.className = `breadcrumb-item ${idx === crumbs.length - 1 ? 'active' : ''}`;
    item.textContent = crumb.name;
    if (idx < crumbs.length - 1) {
      item.addEventListener('click', () => loadFolderView(crumb.path));
    }
    breadcrumbsEl.appendChild(item);
  });
}

// Folder Rendering
function renderFolders(folders) {
  foldersGrid.innerHTML = '';
  folders.forEach(f => {
    const card = document.createElement('div');
    card.className = 'folder-card';
    card.innerHTML = `
      <div class="folder-icon-wrapper">📁</div>
      <div class="folder-details">
        <div class="folder-name" title="${f.displayName}">${f.displayName}</div>
        <div class="folder-count">${f.videoCount} ${f.videoCount === 1 ? 'film/episode' : 'films/episodes'}</div>
      </div>
    `;
    card.addEventListener('click', () => loadFolderView(f.path));
    foldersGrid.appendChild(card);
  });
}

// Videos Rendering
function renderVideos(videos, container) {
  container.innerHTML = '';
  videos.forEach(v => {
    const card = document.createElement('div');
    card.className = 'movie-card';

    const bgGradient = getPaletteForName(v.name);
    const progress = state.playbackProgress[v.path];
    let progressPercent = 0;
    if (progress && progress.duration > 0) {
      progressPercent = Math.min(100, Math.round((progress.currentTime / progress.duration) * 100));
    }

    // Badges HTML
    let qualityBadgeHtml = v.quality ? `<span class="badge badge-quality">${v.quality}</span>` : '';
    let extBadgeHtml = `<span class="badge badge-ext">${v.extension}</span>`;
    let subBadgeHtml = v.hasSubtitles ? `<span class="badge badge-subs">CC</span>` : '';

    card.innerHTML = `
      <div class="movie-poster" style="background: ${bgGradient}">
        <div class="poster-badges-top">
          ${qualityBadgeHtml}
          ${extBadgeHtml}
          ${subBadgeHtml}
        </div>
        <div class="poster-art-wrapper">
          <div class="poster-icon">🎬</div>
          <div class="poster-initials">${v.cleanTitle}</div>
        </div>
        <div class="poster-badges-bottom">
          <span class="badge badge-size">${v.sizeFormatted}</span>
        </div>
        <div class="play-overlay">
          <div class="play-circle-btn">
            <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
        </div>
        ${progressPercent > 0 ? `
          <div class="card-progress-bar">
            <div class="card-progress-fill" style="width: ${progressPercent}%"></div>
          </div>
        ` : ''}
      </div>
      <div class="movie-info">
        <div class="movie-title" title="${v.cleanTitle}">${v.cleanTitle}</div>
        ${v.folder ? `<div class="movie-folder-tag" title="${v.folder}">📁 ${v.folder}</div>` : ''}
        <div class="movie-actions-footer">
          <button class="card-play-btn" title="Watch in Browser">
            <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
            <span>Play</span>
          </button>
          <div class="card-actions-right">
            <button class="quick-action-btn btn-vlc" title="Play in VLC Player">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L3 19h18L12 2zm0 3.8L17.5 17h-11L12 5.8z"/></svg>
            </button>
            <button class="quick-action-btn btn-copy-stream" title="Copy Stream Link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <button class="quick-action-btn btn-download" title="Download Movie">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            </button>
          </div>
        </div>
      </div>
    `;

    // Click anywhere on card (except action buttons) plays the movie
    card.addEventListener('click', (e) => {
      if (e.target.closest('.quick-action-btn')) return;
      openPlayer(v);
    });

    // Quick Action: VLC
    const vlcBtn = card.querySelector('.btn-vlc');
    vlcBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openInVLC(v);
    });

    // Quick Action: Copy Stream URL
    const copyBtn = card.querySelector('.btn-copy-stream');
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyStreamUrl(v);
    });

    // Quick Action: Download
    const dlBtn = card.querySelector('.btn-download');
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.location.href = `/api/download?path=${encodeURIComponent(v.path)}`;
    });

    container.appendChild(card);
  });
}

// Stream URL builders
function getAbsoluteStreamUrl(movie) {
  const origin = window.location.origin;
  return `${origin}/api/stream?path=${encodeURIComponent(movie.path)}`;
}

function getStreamUrlForMode(movie, mode = 'universal', startTime = 0) {
  const origin = window.location.origin;
  if (mode === 'universal') {
    return `${origin}/api/transcode?path=${encodeURIComponent(movie.path)}&t=${Math.floor(startTime)}`;
  }
  return `${origin}/api/stream?path=${encodeURIComponent(movie.path)}`;
}

// Current stream mode state: 'universal' (remuxed MP4) or 'direct' (range request)
let currentStreamMode = 'universal';

function updateStreamModeUI(mode) {
  currentStreamMode = mode;
  if (playerModeLabel && playerModeIcon) {
    if (mode === 'universal') {
      playerModeIcon.textContent = '⚡';
      playerModeLabel.textContent = 'Universal Mode';
      if (playerModeToggle) playerModeToggle.title = 'Universal Mode (FFmpeg Remux): Plays 100% of MKV, 4K & AC3 in all mobile browsers. Tap to try Direct Stream.';
    } else {
      playerModeIcon.textContent = '🚀';
      playerModeLabel.textContent = 'Direct Stream';
      if (playerModeToggle) playerModeToggle.title = 'Direct Stream: Native playback with HTTP 206 range seeking. Tap to switch to Universal Mode.';
    }
  }
}

// Stream mode toggle click handler
if (playerModeToggle) {
  playerModeToggle.addEventListener('click', () => {
    if (!state.activeMovie) return;
    const newMode = (currentStreamMode === 'universal') ? 'direct' : 'universal';
    const currentTime = videoEl.currentTime || 0;
    updateStreamModeUI(newMode);
    showToast(`Switched to ${newMode === 'universal' ? '⚡ Universal Mode' : '🚀 Direct Stream'}`);

    videoEl.pause();
    playerSpinner.classList.remove('hidden');
    videoEl.src = getStreamUrlForMode(state.activeMovie, newMode, currentTime);
    videoEl.load();
    videoEl.currentTime = (newMode === 'direct') ? currentTime : 0;
    videoEl.play().catch(() => {});
  });
}

// Open in VLC with cross-platform protocol handling
function openInVLC(movie) {
  const streamUrl = getAbsoluteStreamUrl(movie);
  const ua = navigator.userAgent || '';
  const isAndroid = /Android/i.test(ua);
  const isIOS = /iPhone|iPad|iPod/i.test(ua);

  // Copy URL as fallback
  navigator.clipboard?.writeText(streamUrl).catch(() => {});

  if (isAndroid) {
    const noProto = streamUrl.replace(/^https?:\/\//i, '');
    const intentUrl = `intent://${noProto}#Intent;package=org.videolan.vlc;type=video/*;scheme=http;end`;
    window.location.href = intentUrl;
    setTimeout(() => {
      window.location.href = `vlc://${streamUrl}`;
    }, 400);
  } else if (isIOS) {
    window.location.href = `vlc-x-callback://x-callback-url/stream?url=${encodeURIComponent(streamUrl)}`;
    setTimeout(() => {
      window.location.href = `vlc://${streamUrl}`;
    }, 400);
  } else {
    window.location.href = `vlc://${streamUrl}`;
  }

  showToast('Opening in VLC... (Link also copied to clipboard)');
}

// Copy Stream URL
function copyStreamUrl(movie) {
  const streamUrl = getAbsoluteStreamUrl(movie);
  if (navigator.clipboard) {
    navigator.clipboard.writeText(streamUrl).then(() => {
      showToast('Stream URL copied! Paste into VLC or TV browser.');
    }).catch(() => {
      showToast(streamUrl);
    });
  } else {
    showToast(streamUrl);
  }
}

// Save recent watch
function addToRecent(movie) {
  const filtered = state.recentWatches.filter(m => m.path !== movie.path);
  filtered.unshift(movie);
  state.recentWatches = filtered.slice(0, 30);
  localStorage.setItem('cinema_recent_watches', JSON.stringify(state.recentWatches));
}

// Touch Controls & Seeking Functions
function getActualCurrentTime() {
  if (currentStreamMode === 'universal') {
    return universalSeekOffset + (videoEl.currentTime || 0);
  }
  return videoEl.currentTime || 0;
}

function updateTimelineUI() {
  const cur = getActualCurrentTime();
  const dur = currentMovieDuration || videoEl.duration || 0;

  if (timeCurrent) timeCurrent.textContent = formatSeconds(Math.floor(cur));
  if (timeTotal && dur > 0) {
    timeTotal.textContent = formatSeconds(Math.floor(dur));
    const pct = Math.min(100, Math.max(0, (cur / dur) * 100));
    if (timelineProgress) timelineProgress.style.width = `${pct}%`;
    if (timelineThumb) timelineThumb.style.left = `${pct}%`;
  }
}

function showTouchControls() {
  if (!playerTouchControls) return;
  playerTouchControls.classList.remove('controls-hidden');
  clearTimeout(controlsTimeout);
  if (!videoEl.paused) {
    controlsTimeout = setTimeout(() => {
      playerTouchControls.classList.add('controls-hidden');
    }, 3500);
  }
}

function updatePlayPauseIcons() {
  const isPaused = videoEl.paused;
  if (btnTouchPlay) {
    const iconPlay = btnTouchPlay.querySelector('.icon-play');
    const iconPause = btnTouchPlay.querySelector('.icon-pause');
    if (iconPlay && iconPause) {
      iconPlay.classList.toggle('hidden', !isPaused);
      iconPause.classList.toggle('hidden', isPaused);
    }
  }
  if (btnMiniPlay) {
    const iconPlayMini = btnMiniPlay.querySelector('.icon-play-mini');
    const iconPauseMini = btnMiniPlay.querySelector('.icon-pause-mini');
    if (iconPlayMini && iconPauseMini) {
      iconPlayMini.classList.toggle('hidden', !isPaused);
      iconPauseMini.classList.toggle('hidden', isPaused);
    }
  }
}

function togglePlayPause() {
  if (videoEl.paused) {
    videoEl.play().catch(() => {});
  } else {
    videoEl.pause();
  }
  updatePlayPauseIcons();
  showTouchControls();
}

function seekToTime(targetSeconds) {
  const dur = currentMovieDuration || videoEl.duration || 0;
  const clamped = Math.max(0, dur > 0 ? Math.min(dur, targetSeconds) : targetSeconds);

  if (currentStreamMode === 'universal') {
    universalSeekOffset = clamped;
    playerSpinner.classList.remove('hidden');
    videoEl.src = getStreamUrlForMode(state.activeMovie, 'universal', clamped);
    videoEl.load();
    videoEl.play().catch(() => {});
  } else {
    videoEl.currentTime = clamped;
    videoEl.play().catch(() => {});
  }
  updateTimelineUI();
}

// Touch & Click Event Listeners for Controls
if (btnTouchPlay) btnTouchPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });
if (btnMiniPlay) btnMiniPlay.addEventListener('click', (e) => { e.stopPropagation(); togglePlayPause(); });

if (btnTouchRewind) {
  btnTouchRewind.addEventListener('click', (e) => {
    e.stopPropagation();
    seekToTime(getActualCurrentTime() - 10);
    showTouchControls();
  });
}

if (btnTouchForward) {
  btnTouchForward.addEventListener('click', (e) => {
    e.stopPropagation();
    seekToTime(getActualCurrentTime() + 10);
    showTouchControls();
  });
}

if (timelineContainer) {
  timelineContainer.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = timelineContainer.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const dur = currentMovieDuration || videoEl.duration || 0;
    if (dur > 0) {
      seekToTime(ratio * dur);
    }
    showTouchControls();
  });
}

if (btnMiniMute) {
  btnMiniMute.addEventListener('click', (e) => {
    e.stopPropagation();
    videoEl.muted = !videoEl.muted;
    const isMuted = videoEl.muted;
    btnMiniMute.querySelector('.icon-vol')?.classList.toggle('hidden', isMuted);
    btnMiniMute.querySelector('.icon-muted')?.classList.toggle('hidden', !isMuted);
    showTouchControls();
  });
}

if (btnFullscreen) {
  btnFullscreen.addEventListener('click', (e) => {
    e.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      if (playerModal.requestFullscreen) playerModal.requestFullscreen().catch(() => {});
      else if (videoEl.webkitEnterFullscreen) videoEl.webkitEnterFullscreen();
    }
    showTouchControls();
  });
}

if (playerBackBtn) {
  playerBackBtn.addEventListener('click', () => closePlayer());
}

// Tap on player background to toggle controls overlay
if (playerTouchControls) {
  playerTouchControls.addEventListener('click', (e) => {
    if (e.target.closest('button') || e.target.closest('#timeline-container')) return;
    if (playerTouchControls.classList.contains('controls-hidden')) {
      showTouchControls();
    } else {
      playerTouchControls.classList.add('controls-hidden');
    }
  });
}

// Cinema Video Player
function openPlayer(movie) {
  state.activeMovie = movie;
  addToRecent(movie);

  playerTitle.textContent = movie.cleanTitle;
  playerFolder.textContent = movie.folder ? `📁 ${movie.folder}` : 'Root Library';

  // Reset controls state
  universalSeekOffset = 0;
  currentMovieDuration = 0;
  if (timeCurrent) timeCurrent.textContent = '00:00';
  if (timeTotal) timeTotal.textContent = '--:--';
  if (timelineProgress) timelineProgress.style.width = '0%';
  if (timelineThumb) timelineThumb.style.left = '0%';
  showTouchControls();

  // Smart Stream Selection:
  // If the movie is real MP4 (H.264 + AAC), use Direct Stream.
  // If it's MKV, AVI, or disguised container, default to Universal Mode so it plays instantly on mobile!
  const initialMode = movie.isNativeMp4 ? 'direct' : 'universal';
  updateStreamModeUI(initialMode);
  const streamUrl = getStreamUrlForMode(movie, initialMode, 0);

  // Reset overlays & state
  playerErrorOverlay.classList.add('hidden');
  playerTapOverlay.classList.add('hidden');
  resumePrompt.classList.add('hidden');
  playerSpinner.classList.remove('hidden');

  // Setup header actions
  playerVlcBtn.onclick = () => openInVLC(movie);
  playerCopyLinkBtn.onclick = () => copyStreamUrl(movie);
  playerDownloadBtn.onclick = () => {
    window.location.href = `/api/download?path=${encodeURIComponent(movie.path)}`;
  };

  // Setup error card action buttons
  btnFallbackVlc.onclick = () => openInVLC(movie);
  btnFallbackCopy.onclick = () => copyStreamUrl(movie);
  btnFallbackDownload.onclick = () => {
    window.location.href = `/api/download?path=${encodeURIComponent(movie.path)}`;
  };

  // Clear previous subtitles
  while (videoEl.querySelectorAll('track').length > 0) {
    videoEl.querySelector('track').remove();
  }
  subSelect.innerHTML = '<option value="none">Off</option>';

  // Setup Subtitles (External files)
  if (movie.subtitles && movie.subtitles.length > 0) {
    movie.subtitles.forEach((sub, i) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.label = sub.name;
      track.srclang = 'en';
      track.src = `/api/subtitles?path=${encodeURIComponent(sub.relativePath)}`;
      if (i === 0) track.default = true;
      videoEl.appendChild(track);

      const opt = document.createElement('option');
      opt.value = i.toString();
      opt.textContent = sub.name;
      subSelect.appendChild(opt);
    });
    subSelect.value = '0';
  }

  // Fetch probe metadata in background for exact duration & embedded subtitles
  fetch(`/api/probe?path=${encodeURIComponent(movie.path)}`)
    .then(r => r.json())
    .then(probe => {
      if (probe && probe.duration > 0) {
        currentMovieDuration = probe.duration;
        if (timeTotal) timeTotal.textContent = probe.durationFormatted || formatSeconds(probe.duration);
        updateTimelineUI();
      }
      // Populate embedded subtitles from container
      if (probe && probe.embeddedSubtitles && probe.embeddedSubtitles.length > 0) {
        probe.embeddedSubtitles.forEach((sub) => {
          const track = document.createElement('track');
          track.kind = 'subtitles';
          track.label = `${sub.lang.toUpperCase()} (Embedded #${sub.index})`;
          track.srclang = sub.lang;
          track.src = `/api/subtitles/embedded?path=${encodeURIComponent(movie.path)}&index=${sub.index}`;
          videoEl.appendChild(track);

          const opt = document.createElement('option');
          opt.value = (videoEl.textTracks.length - 1).toString();
          opt.textContent = `${sub.lang.toUpperCase()} (Embedded #${sub.index})`;
          subSelect.appendChild(opt);
        });
      }
    })
    .catch(() => {});

  // Media event handlers
  videoEl.onplaying = () => {
    playerSpinner.classList.add('hidden');
    playerTapOverlay.classList.add('hidden');
    updatePlayPauseIcons();
    showTouchControls();
  };

  videoEl.onpause = () => {
    updatePlayPauseIcons();
    showTouchControls();
  };

  videoEl.onwaiting = () => {
    playerSpinner.classList.remove('hidden');
  };

  videoEl.oncanplay = () => {
    playerSpinner.classList.add('hidden');
    updateTimelineUI();
  };

  // Auto-Recovery on Browser Decode Error
  videoEl.onerror = () => {
    // If direct stream failed, auto-switch to Universal Remux!
    if (currentStreamMode === 'direct') {
      console.warn('Direct stream format not supported by browser. Auto-recovering via Universal Remux...');
      updateStreamModeUI('universal');
      showToast('⚡ Auto-switched to Universal Mode for browser compatibility');
      const curTime = videoEl.currentTime || 0;
      universalSeekOffset = curTime;
      videoEl.src = getStreamUrlForMode(movie, 'universal', curTime);
      videoEl.load();
      videoEl.play().catch(() => {});
      return;
    }

    playerSpinner.classList.add('hidden');
    playerTapOverlay.classList.add('hidden');
    playerErrorOverlay.classList.remove('hidden');
    const ext = movie.extension || 'MKV';
    errorReasonText.innerHTML = `This video uses <strong>${ext} container or AC3/DTS Dolby audio</strong> which this browser cannot decode directly. Tap the button below to stream in VLC with full sound and hardware acceleration!`;
  };

  playerTapOverlay.onclick = () => {
    playerTapOverlay.classList.add('hidden');
    videoEl.play().catch(() => {});
  };

  // Load video source
  videoEl.src = streamUrl;
  videoEl.load();
  playerModal.classList.remove('hidden');

  // Check saved progress
  const saved = state.playbackProgress[movie.path];
  if (saved && saved.currentTime > 15 && (saved.duration - saved.currentTime) > 30) {
    resumeTimeText.textContent = formatSeconds(saved.currentTime);
    resumePrompt.classList.remove('hidden');

    const handleResume = () => {
      resumePrompt.classList.add('hidden');
      seekToTime(saved.currentTime);
    };

    const handleRestart = () => {
      resumePrompt.classList.add('hidden');
      seekToTime(0);
    };

    resumeBtn.onclick = handleResume;
    restartBtn.onclick = handleRestart;
  } else {
    resumePrompt.classList.add('hidden');
    attemptPlay();
  }

  function attemptPlay() {
    const playPromise = videoEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        playerSpinner.classList.add('hidden');
        playerTapOverlay.classList.add('hidden');
      }).catch((err) => {
        console.warn('Autoplay prevented by browser policy:', err);
        playerSpinner.classList.add('hidden');
        if (!videoEl.error) {
          playerTapOverlay.classList.remove('hidden');
        }
      });
    }
  }
}

function closePlayer() {
  if (!playerModal.classList.contains('hidden')) {
    videoEl.pause();
    videoEl.src = '';
    playerModal.classList.add('hidden');
    playerSpinner.classList.add('hidden');
    playerErrorOverlay.classList.add('hidden');
    playerTapOverlay.classList.add('hidden');
    state.activeMovie = null;
    resumePrompt.classList.add('hidden');
    clearTimeout(controlsTimeout);

    if (state.currentView === 'folders') {
      loadFolderView(state.currentDir);
    } else if (state.currentView === 'all') {
      loadAllMovies();
    } else if (state.currentView === 'recent') {
      loadRecentView();
    }
  }
}

// Track playback progress
videoEl.addEventListener('timeupdate', () => {
  if (!state.activeMovie) return;
  const cur = getActualCurrentTime();
  const dur = currentMovieDuration || videoEl.duration || 0;
  updateTimelineUI();

  if (Math.abs(cur - (videoEl._lastSavedTime || 0)) > 3 && dur > 0) {
    videoEl._lastSavedTime = cur;
    state.playbackProgress[state.activeMovie.path] = {
      currentTime: cur,
      duration: dur,
      updatedAt: Date.now()
    };
    localStorage.setItem('cinema_playback_progress', JSON.stringify(state.playbackProgress));
  }
});

// Custom Subtitle Input
customSubInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = file.name;
  track.srclang = 'en';
  track.src = objectUrl;
  track.default = true;

  videoEl.appendChild(track);

  const opt = document.createElement('option');
  opt.value = (videoEl.textTracks.length - 1).toString();
  opt.textContent = `Custom: ${file.name}`;
  subSelect.appendChild(opt);
  subSelect.value = opt.value;

  showToast(`Loaded custom subtitle: ${file.name}`);
});

// Subtitle selector change
subSelect.addEventListener('change', () => {
  const val = subSelect.value;
  for (let i = 0; i < videoEl.textTracks.length; i++) {
    videoEl.textTracks[i].mode = (val !== 'none' && parseInt(val) === i) ? 'showing' : 'disabled';
  }
});

// QR Code Modal & Idempotent URL Switcher
let currentQrMode = 'mdns'; // 'mdns' or 'ip'
const qrTabMdns = document.getElementById('qr-tab-mdns');
const qrTabIp = document.getElementById('qr-tab-ip');
const qrInstructionsText = document.getElementById('qr-instructions-text');

async function updateQrCode(mode = 'mdns') {
  currentQrMode = mode;
  if (qrTabMdns && qrTabIp) {
    qrTabMdns.classList.toggle('active', mode === 'mdns');
    qrTabIp.classList.toggle('active', mode === 'ip');
  }

  try {
    const res = await fetch(`/api/qrcode?type=${mode}`);
    const data = await res.json();
    qrImage.src = data.qrDataUrl;
    qrUrlDisplay.textContent = data.url;

    if (qrInstructionsText) {
      if (mode === 'mdns') {
        qrInstructionsText.innerHTML = `✨ <strong>Permanent URL:</strong> Never changes even when your PC reboots or Wi-Fi reconnects! Works on iPhone, Android, Mac, and PC.`;
      } else {
        qrInstructionsText.innerHTML = `📱 <strong>Direct Local IP:</strong> Automatically updated to your PC's live IP. Use if an older smart TV does not support .local hostnames.`;
      }
    }
  } catch (err) {
    showToast('Failed to generate connection QR code');
  }
}

async function openQrModal() {
  qrModal.classList.remove('hidden');
  updateQrCode(currentQrMode);
}

if (qrTabMdns) qrTabMdns.addEventListener('click', () => updateQrCode('mdns'));
if (qrTabIp) qrTabIp.addEventListener('click', () => updateQrCode('ip'));

function closeQrModal() {
  qrModal.classList.add('hidden');
}

btnCopyNetworkUrl.addEventListener('click', () => {
  navigator.clipboard.writeText(qrUrlDisplay.textContent).then(() => {
    showToast('Network URL copied!');
  });
});

// View Tabs Navigation
function updateViewTabs() {
  tabFolders.classList.toggle('active', state.currentView === 'folders');
  tabAll.classList.toggle('active', state.currentView === 'all');
  tabRecent.classList.toggle('active', state.currentView === 'recent');

  if (mobNavFolders) mobNavFolders.classList.toggle('active', state.currentView === 'folders');
  if (mobNavAll) mobNavAll.classList.toggle('active', state.currentView === 'all');
  if (mobNavRecent) mobNavRecent.classList.toggle('active', state.currentView === 'recent');

  viewFoldersContainer.classList.toggle('hidden', state.currentView !== 'folders');
  viewAllContainer.classList.toggle('hidden', state.currentView !== 'all');
  viewRecentContainer.classList.toggle('hidden', state.currentView !== 'recent');

  sortWrapper.style.display = (state.currentView === 'all') ? 'flex' : 'none';
}

function handleFoldersTabClick() {
  state.searchQuery = '';
  searchInput.value = '';
  clearSearch.classList.add('hidden');
  loadFolderView(state.currentDir || '');
}

function handleAllFilmsTabClick() {
  state.currentView = 'all';
  updateViewTabs();
  loadAllMovies();
}

function handleRecentTabClick() {
  loadRecentView();
}

tabFolders.addEventListener('click', handleFoldersTabClick);
tabAll.addEventListener('click', handleAllFilmsTabClick);
tabRecent.addEventListener('click', handleRecentTabClick);

if (mobNavFolders) mobNavFolders.addEventListener('click', handleFoldersTabClick);
if (mobNavAll) mobNavAll.addEventListener('click', handleAllFilmsTabClick);
if (mobNavRecent) mobNavRecent.addEventListener('click', handleRecentTabClick);
if (mobNavQr) mobNavQr.addEventListener('click', openQrModal);

brandHome.addEventListener('click', () => {
  state.searchQuery = '';
  searchInput.value = '';
  clearSearch.classList.add('hidden');
  loadFolderView('');
});

// Search functionality
let searchTimer = null;
searchInput.addEventListener('input', (e) => {
  state.searchQuery = e.target.value.trim();
  clearSearch.classList.toggle('hidden', !state.searchQuery);

  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (state.searchQuery) {
      state.currentView = 'all';
      updateViewTabs();
      loadAllMovies();
    } else {
      loadFolderView(state.currentDir);
    }
  }, 250);
});

clearSearch.addEventListener('click', () => {
  searchInput.value = '';
  state.searchQuery = '';
  clearSearch.classList.add('hidden');
  loadFolderView(state.currentDir);
});

// Sort Selector
sortSelect.addEventListener('change', (e) => {
  state.sortBy = e.target.value;
  if (state.currentView === 'all') {
    loadAllMovies();
  }
});

// Refresh Button
btnRefresh.addEventListener('click', async () => {
  showToast('Rescanning D:\\film library...');
  try {
    const res = await fetch('/api/refresh', { method: 'POST' });
    const data = await res.json();
    showToast(`Updated! ${data.count} films found.`);
    fetchSystemInfo();
    if (state.currentView === 'folders') loadFolderView(state.currentDir);
    else if (state.currentView === 'all') loadAllMovies();
  } catch (err) {
    showToast('Failed to refresh library');
  }
});

// Clear History Button
btnClearHistory.addEventListener('click', () => {
  state.recentWatches = [];
  localStorage.removeItem('cinema_recent_watches');
  loadRecentView();
  showToast('Watch history cleared');
});

// UI Event Listeners
btnShowQr.addEventListener('click', openQrModal);
qrCloseBtn.addEventListener('click', closeQrModal);
qrBackdrop.addEventListener('click', closeQrModal);
playerCloseBtn.addEventListener('click', closePlayer);

// Global Keyboard Shortcuts
document.addEventListener('keydown', (e) => {
  // If user is typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
    if (e.key === 'Escape') {
      e.target.blur();
    }
    return;
  }

  // Player open shortcuts
  if (!playerModal.classList.contains('hidden')) {
    if (e.key === 'Escape') {
      closePlayer();
    } else if (e.code === 'Space') {
      e.preventDefault();
      if (videoEl.paused) videoEl.play();
      else videoEl.pause();
    } else if (e.key === 'ArrowRight') {
      videoEl.currentTime = Math.min(videoEl.duration, videoEl.currentTime + 10);
    } else if (e.key === 'ArrowLeft') {
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
    } else if (e.key === 'ArrowUp') {
      videoEl.volume = Math.min(1, videoEl.volume + 0.1);
    } else if (e.key === 'ArrowDown') {
      videoEl.volume = Math.max(0, videoEl.volume - 0.1);
    } else if (e.key.toLowerCase() === 'f') {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        videoEl.requestFullscreen?.() || videoEl.webkitEnterFullscreen?.();
      }
    } else if (e.key.toLowerCase() === 'm') {
      videoEl.muted = !videoEl.muted;
    }
    return;
  }

  // General shortcuts
  if (e.key === '/' && searchInput !== document.activeElement) {
    e.preventDefault();
    searchInput.focus();
  } else if (e.key === 'Escape' && !qrModal.classList.contains('hidden')) {
    closeQrModal();
  }
});

// Initialization
fetchSystemInfo();
loadFolderView('');
