require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');
const mime = require('mime-types');
const QRCode = require('qrcode');
const qrcodeTerminal = require('qrcode-terminal');

// Bundled static FFmpeg binary
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;

const app = express();
const PORT = process.env.PORT || 5000;
const FILM_DIR = process.env.FILM_DIR || 'D:\\film';

// Allowed video extensions
const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.ts', '.flv', '.wmv', '.vob'
]);

// Allowed subtitle extensions
const SUBTITLE_EXTENSIONS = new Set(['.srt', '.vtt']);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Detect if a file is real MP4 or disguised Matroska
function isNativePlayable(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.mp4') return false;
  try {
    const fd = fs.openSync(filePath, 'r');
    const buf = Buffer.alloc(16);
    fs.readSync(fd, buf, 0, 16, 0);
    fs.closeSync(fd);
    const hex = buf.toString('hex');
    if (hex.startsWith('1a45dfa3')) return false; // Matroska container
    return true;
  } catch (e) {
    return false;
  }
}

// Dynamic network resolver (re-evaluates live interfaces every time)
function getNetworkDetails() {
  const interfaces = os.networkInterfaces();
  const rawHostname = os.hostname();
  const hostname = rawHostname.toLowerCase();
  const mdnsUrl = `http://${hostname}.local:${PORT}`;
  const winHostUrl = `http://${rawHostname}:${PORT}`;
  const ipList = [];

  for (const name of Object.keys(interfaces)) {
    const isVirtual = /vEthernet|VirtualBox|VMware|WSL|Tailscale|ZeroTier|Loopback|Hyper-V/i.test(name);
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address !== '127.0.0.1') {
        ipList.push({
          interface: name,
          ip: iface.address,
          url: `http://${iface.address}:${PORT}`,
          isVirtual
        });
      }
    }
  }

  ipList.sort((a, b) => (a.isVirtual === b.isVirtual ? 0 : a.isVirtual ? 1 : -1));

  const primaryIP = ipList.length > 0 ? ipList[0].ip : '127.0.0.1';
  const primaryUrl = `http://${primaryIP}:${PORT}`;

  const allUrls = [
    {
      type: 'mdns',
      label: 'Permanent Name (mDNS)',
      url: mdnsUrl,
      badge: 'Idempotent (Never changes)',
      recommended: true,
      description: 'Works across reboots and Wi-Fi changes (iOS, Android, Mac, PC)'
    },
    {
      type: 'ip',
      label: `Current Dynamic IP (${primaryIP})`,
      url: primaryUrl,
      badge: 'Live DHCP IP',
      recommended: false,
      description: 'Direct numeric IP (auto-updated when router assigns new IP)'
    }
  ];

  return {
    rawHostname,
    hostname,
    mdnsUrl,
    winHostUrl,
    primaryIP,
    primaryUrl,
    ipList,
    allUrls
  };
}

// Prevent directory traversal attacks
function safeResolve(baseDir, relativePath) {
  if (!relativePath) return baseDir;
  const resolved = path.resolve(baseDir, relativePath);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    return null;
  }
  return resolved;
}

// Format file size
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Clean movie title from filename
function cleanTitle(filename) {
  let name = path.parse(filename).name;
  name = name.replace(/[._]/g, ' ');
  name = name.replace(/\b(1080p|720p|480p|2160p|4k|uhd|bluray|blu-ray|webrip|web-dl|web|hdtv|x264|x265|hevc|aac|dvdrip|remux|repack|hodl|telly|prime|ddr)\b/gi, '');
  return name.replace(/\s+/g, ' ').trim();
}

// Detect quality badge
function detectQuality(filename) {
  const lower = filename.toLowerCase();
  if (lower.includes('2160p') || lower.includes('4k') || lower.includes('uhd')) return '4K UHD';
  if (lower.includes('1080p') || lower.includes('fhd')) return '1080p FHD';
  if (lower.includes('720p') || lower.includes('hd')) return '720p HD';
  if (lower.includes('bluray') || lower.includes('web-dl')) return 'HD';
  return null;
}

// Find companion subtitles for a video file
function findSubtitles(videoPath) {
  try {
    const dir = path.dirname(videoPath);
    const videoBase = path.parse(videoPath).name.toLowerCase();
    const files = fs.readdirSync(dir);
    const subs = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (SUBTITLE_EXTENSIONS.has(ext)) {
        const fileBase = path.parse(file).name.toLowerCase();
        if (fileBase.includes(videoBase) || videoBase.includes(fileBase) || fileBase.startsWith('sub') || files.length <= 4) {
          subs.push({
            name: file,
            ext: ext,
            relativePath: path.relative(FILM_DIR, path.join(dir, file)).replace(/\\/g, '/')
          });
        }
      }
    }
    return subs;
  } catch (e) {
    return [];
  }
}

// Convert SRT format to WebVTT
function srtToVtt(srtText) {
  const vtt = 'WEBVTT\n\n' + srtText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

// Cache for all indexed videos
let indexedVideosCache = null;
let lastIndexTime = 0;
const CACHE_TTL_MS = 60 * 1000;

function scanAllVideosRecursive(dir, relativeTo) {
  let results = [];
  try {
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const fullPath = path.join(dir, item.name);
      const relPath = path.relative(relativeTo, fullPath).replace(/\\/g, '/');

      if (item.isDirectory()) {
        results = results.concat(scanAllVideosRecursive(fullPath, relativeTo));
      } else if (item.isFile()) {
        const ext = path.extname(item.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch (e) {
            continue;
          }
          const subs = findSubtitles(fullPath);
          const isNative = isNativePlayable(fullPath);

          results.push({
            name: item.name,
            cleanTitle: cleanTitle(item.name),
            quality: detectQuality(item.name),
            path: relPath,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            extension: ext.replace('.', '').toUpperCase(),
            isNativeMp4: isNative,
            modified: stat.mtime,
            folder: path.dirname(relPath).replace(/\\/g, '/'),
            hasSubtitles: subs.length > 0,
            subtitles: subs
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error scanning ${dir}:`, err.message);
  }
  return results;
}

function getAllVideos() {
  const now = Date.now();
  if (indexedVideosCache && (now - lastIndexTime) < CACHE_TTL_MS) {
    return indexedVideosCache;
  }
  indexedVideosCache = scanAllVideosRecursive(FILM_DIR, FILM_DIR);
  lastIndexTime = now;
  return indexedVideosCache;
}

// API: System info & dynamic network details
app.get('/api/info', (req, res) => {
  const net = getNetworkDetails();
  const all = getAllVideos();
  const totalBytes = all.reduce((sum, v) => sum + v.size, 0);

  res.json({
    hostname: net.rawHostname,
    mdnsUrl: net.mdnsUrl,
    winHostUrl: net.winHostUrl,
    localIP: net.primaryIP,
    port: PORT,
    localUrl: `http://localhost:${PORT}`,
    networkUrl: net.primaryUrl,
    allUrls: net.allUrls,
    filmDir: FILM_DIR,
    dirExists: fs.existsSync(FILM_DIR),
    totalVideos: all.length,
    totalSizeFormatted: formatBytes(totalBytes)
  });
});

// API: QR code with dynamic URL support
app.get('/api/qrcode', async (req, res) => {
  try {
    const net = getNetworkDetails();
    let target = req.query.url;
    if (!target) {
      target = (req.query.type === 'ip') ? net.primaryUrl : net.mdnsUrl;
    }

    const qrDataUrl = await QRCode.toDataURL(target, {
      margin: 2,
      width: 320,
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    });

    res.json({
      url: target,
      qrDataUrl,
      mdnsUrl: net.mdnsUrl,
      ipUrl: net.primaryUrl,
      allUrls: net.allUrls
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate QR code' });
  }
});

// API: Browse folder contents (directory view)
app.get('/api/browse', (req, res) => {
  const relPath = req.query.dir || '';
  const targetDir = safeResolve(FILM_DIR, relPath);

  if (!targetDir || !fs.existsSync(targetDir)) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  try {
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    const folders = [];
    const videos = [];

    for (const entry of entries) {
      const fullPath = path.join(targetDir, entry.name);
      const entryRelPath = path.relative(FILM_DIR, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        let videoCount = 0;
        try {
          const folderVideos = scanAllVideosRecursive(fullPath, fullPath);
          videoCount = folderVideos.length;
        } catch (e) {}

        folders.push({
          name: entry.name,
          displayName: entry.name.replace(/[._]/g, ' '),
          path: entryRelPath,
          videoCount
        });
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (VIDEO_EXTENSIONS.has(ext)) {
          let stat;
          try {
            stat = fs.statSync(fullPath);
          } catch (e) {
            continue;
          }
          const subs = findSubtitles(fullPath);
          const isNative = isNativePlayable(fullPath);

          videos.push({
            name: entry.name,
            cleanTitle: cleanTitle(entry.name),
            quality: detectQuality(entry.name),
            path: entryRelPath,
            size: stat.size,
            sizeFormatted: formatBytes(stat.size),
            extension: ext.replace('.', '').toUpperCase(),
            isNativeMp4: isNative,
            modified: stat.mtime,
            hasSubtitles: subs.length > 0,
            subtitles: subs
          });
        }
      }
    }

    folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    videos.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

    const parts = relPath.split('/').filter(Boolean);
    const breadcrumbs = [{ name: 'Films Library', path: '' }];
    let accum = '';
    for (const part of parts) {
      accum = accum ? `${accum}/${part}` : part;
      breadcrumbs.push({ name: part.replace(/[._]/g, ' '), path: accum });
    }

    res.json({
      currentPath: relPath,
      breadcrumbs,
      folders,
      videos
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to read directory: ' + err.message });
  }
});

// API: Get all videos flat (with search and filtering)
app.get('/api/videos', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();
  const sort = req.query.sort || 'name';
  let list = getAllVideos();

  if (query) {
    list = list.filter(v =>
      v.name.toLowerCase().includes(query) ||
      v.cleanTitle.toLowerCase().includes(query) ||
      v.folder.toLowerCase().includes(query)
    );
  }

  const sorted = [...list];
  if (sort === 'size') {
    sorted.sort((a, b) => b.size - a.size);
  } else if (sort === 'date') {
    sorted.sort((a, b) => new Date(b.modified) - new Date(a.modified));
  } else {
    sorted.sort((a, b) => a.cleanTitle.localeCompare(b.cleanTitle, undefined, { sensitivity: 'base' }));
  }

  res.json({
    total: sorted.length,
    videos: sorted
  });
});

function formatDuration(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Media probing with in-memory caching
const probeCache = new Map();

function probeMedia(filePath) {
  if (probeCache.has(filePath)) return Promise.resolve(probeCache.get(filePath));
  return new Promise((resolve) => {
    const proc = spawn(ffmpegPath, ['-i', filePath]);
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', () => {
      const dMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.?\d*)/);
      let duration = 0;
      if (dMatch) {
        duration = parseInt(dMatch[1], 10) * 3600 + parseInt(dMatch[2], 10) * 60 + parseFloat(dMatch[3]);
      }
      const vMatch = stderr.match(/Stream #\d+:\d+.*?: Video:\s*([a-zA-Z0-9_-]+)/i);
      const pixMatch = stderr.match(/Stream #\d+:\d+.*?: Video:.*?(yuv\w+|nv\w+|gray\w*)/i);
      const aMatch = stderr.match(/Stream #\d+:\d+.*?: Audio:\s*([a-zA-Z0-9_-]+)/i);

      const subMatches = [];
      const subRegex = /Stream #\d+:(\d+)(?:\(([^)]+)\))?: Subtitle:\s*([a-zA-Z0-9_-]+)/gi;
      let sm;
      while ((sm = subRegex.exec(stderr)) !== null) {
        subMatches.push({
          index: parseInt(sm[1], 10),
          lang: sm[2] || 'und',
          codec: sm[3]
        });
      }

      const videoCodec = vMatch ? vMatch[1].toLowerCase() : 'unknown';
      const pixFmt = pixMatch ? pixMatch[1].toLowerCase() : '';
      const audioCodec = aMatch ? aMatch[1].toLowerCase() : 'unknown';

      const isH264 = (videoCodec === 'h264' || videoCodec === 'avc1');
      const is10Bit = pixFmt.includes('10le') || pixFmt.includes('10bit') || pixFmt.includes('high 10') || stderr.includes('yuv420p10le');
      const canCopyVideo = isH264 && !is10Bit;
      const isAac = (audioCodec === 'aac' || audioCodec === 'mp4a');

      const info = {
        duration: Math.round(duration),
        durationFormatted: formatDuration(Math.round(duration)),
        videoCodec,
        pixFmt,
        audioCodec,
        canCopyVideo,
        isAac,
        embeddedSubtitles: subMatches
      };
      probeCache.set(filePath, info);
      resolve(info);
    });
  });
}

// API: Probe media metadata (duration, codecs, subtitles)
app.get('/api/probe', async (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).json({ error: 'Missing path' });

  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).json({ error: 'Movie file not found' });
  }

  const info = await probeMedia(fullPath);
  res.json(info);
});

// API: Universal Fast Remux / Transcode Endpoint (Plays ANY MKV, AVI, 10-bit HEVC in ALL Mobile Browsers)
app.all('/api/transcode', async (req, res) => {
  const relPath = req.query.path;
  if (!relPath) return res.status(400).send('Missing path parameter');

  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).send('Movie file not found');
  }

  const startTime = Math.max(0, parseFloat(req.query.t || '0'));
  const forceTranscode = req.query.transcode === '1';

  // Probe media details
  const mediaInfo = await probeMedia(fullPath);

  const headers = {
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'none',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Expose-Headers': 'X-Video-Duration, X-Video-Codec, X-Audio-Codec',
    'X-Video-Duration': mediaInfo.duration.toString(),
    'X-Video-Codec': mediaInfo.videoCodec,
    'X-Audio-Codec': mediaInfo.audioCodec,
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Connection': 'keep-alive'
  };

  res.writeHead(200, headers);

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  // Smart video transcoding:
  // If standard 8-bit H.264: copy video directly (0% CPU, instant speed <50ms)
  // If HEVC, 10-bit, VP9, MPEG4, etc.: transcode video with ultrafast libx264 to 8-bit H.264
  const videoArgs = (mediaInfo.canCopyVideo && !forceTranscode)
    ? ['-c:v', 'copy']
    : ['-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency', '-crf', '23', '-pix_fmt', 'yuv420p'];

  // Audio: convert to stereo AAC for 100% universal browser and mobile support
  const audioArgs = ['-c:a', 'aac', '-b:a', '160k', '-ac', '2'];

  const args = [
    '-ss', startTime.toString(),
    '-i', fullPath,
    '-map', '0:v:0',
    '-map', '0:a:0?',
    ...videoArgs,
    ...audioArgs,
    '-sn', // Disable internal subtitles from MP4 container to avoid muxing errors
    '-dn', // Disable data streams
    '-avoid_negative_ts', 'make_zero',
    '-movflags', 'frag_keyframe+empty_moov+default_base_moof',
    '-f', 'mp4',
    'pipe:1'
  ];

  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });

  proc.stdout.pipe(res);

  req.on('close', () => {
    try {
      proc.kill('SIGKILL');
    } catch (e) {}
  });

  proc.on('error', (err) => {
    console.error('Transcode proc error:', err.message);
    if (!res.destroyed) res.end();
  });
});

// API: Stream embedded subtitle as WebVTT on the fly
app.get('/api/subtitles/embedded', (req, res) => {
  const relPath = req.query.path;
  const streamIndex = req.query.index || '0';
  if (!relPath) return res.status(400).send('Missing path');

  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).send('Movie file not found');
  }

  res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const args = ['-i', fullPath, '-map', `0:${streamIndex}`, '-f', 'webvtt', 'pipe:1'];
  const proc = spawn(ffmpegPath, args, { stdio: ['ignore', 'pipe', 'ignore'] });
  proc.stdout.pipe(res);

  req.on('close', () => {
    try { proc.kill('SIGKILL'); } catch (e) {}
  });
});

// API: Direct video streaming with HTTP 206 Range Request support
app.all('/api/stream', (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return res.status(405).send('Method not allowed');
  }

  const relPath = req.query.path;
  if (!relPath) return res.status(400).send('Missing path parameter');

  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).send('Movie file not found');
  }

  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (err) {
    return res.status(500).send('Error accessing file');
  }

  const fileSize = stat.size;
  const range = req.headers.range;
  const ext = path.extname(fullPath).toLowerCase();
  let contentType = mime.lookup(fullPath) || 'video/mp4';

  if (ext === '.mkv') {
    contentType = 'video/webm';
  }

  if (range) {
    const rangeMatch = range.match(/bytes\s*=\s*(\d*)\s*-\s*(\d*)/i);
    let start = 0;
    let end = fileSize - 1;

    if (rangeMatch) {
      if (rangeMatch[1] === '' && rangeMatch[2] !== '') {
        start = Math.max(0, fileSize - parseInt(rangeMatch[2], 10));
        end = fileSize - 1;
      } else {
        start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0;
        end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
      }
    } else {
      const cleanRange = range.replace(/^.*bytes\s*=\s*/i, '');
      const parts = cleanRange.split('-');
      start = parts[0] ? parseInt(parts[0], 10) : 0;
      end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    }

    if (isNaN(start) || isNaN(end) || start >= fileSize || start < 0 || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }

    if (end >= fileSize) {
      end = fileSize - 1;
    }

    const chunksize = end - start + 1;

    const headers = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
    };

    res.writeHead(206, headers);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const fileStream = fs.createReadStream(fullPath, { start, end });
    fileStream.on('error', () => {
      if (!res.destroyed) res.end();
    });
    fileStream.pipe(res);
  } else {
    const headers = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length'
    };

    res.writeHead(200, headers);

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const fileStream = fs.createReadStream(fullPath);
    fileStream.on('error', () => {
      if (!res.destroyed) res.end();
    });
    fileStream.pipe(res);
  }
});

// API: Download video directly
app.get('/api/download', (req, res) => {
  const relPath = req.query.path;
  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).send('File not found');
  }
  res.download(fullPath, path.basename(fullPath));
});

// API: Subtitles endpoint (SRT converted to WebVTT on-the-fly)
app.get('/api/subtitles', (req, res) => {
  const relPath = req.query.path;
  const fullPath = safeResolve(FILM_DIR, relPath);
  if (!fullPath || !fs.existsSync(fullPath)) {
    return res.status(404).send('Subtitle not found');
  }

  try {
    const ext = path.extname(fullPath).toLowerCase();
    const content = fs.readFileSync(fullPath, 'utf8');

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (ext === '.srt') {
      res.send(srtToVtt(content));
    } else {
      res.send(content);
    }
  } catch (err) {
    res.status(500).send('Error reading subtitle file');
  }
});

// API: Refresh library index
app.post('/api/refresh', (req, res) => {
  indexedVideosCache = null;
  const all = getAllVideos();
  res.json({ success: true, count: all.length });
});

// Start Server
const server = app.listen(PORT, '0.0.0.0', () => {
  const net = getNetworkDetails();
  const localUrl = `http://localhost:${PORT}`;

  console.log('\n======================================================');
  console.log('   🍿  LANFlixx SERVER IS READY TO STREAM!');
  console.log('======================================================');
  console.log(`📁 Library Path:     ${FILM_DIR}`);
  console.log(`💻 This Computer:    ${localUrl}`);
  console.log('------------------------------------------------------');
  console.log('🌐 PERMANENT HOSTNAME (IDEMPOTENT - NEVER CHANGES):');
  console.log(`   👉 ${net.mdnsUrl}  (iPhone, Android, Mac, PC)`);
  console.log(`   👉 ${net.winHostUrl}  (Windows network name)`);
  console.log('------------------------------------------------------');
  console.log('📱 CURRENT LOCAL IP (Dynamic DHCP):');
  console.log(`   👉 ${net.primaryUrl}`);
  if (net.ipList.length > 1) {
    for (let i = 1; i < net.ipList.length; i++) {
      console.log(`   👉 ${net.ipList[i].url} (${net.ipList[i].interface})`);
    }
  }
  console.log('------------------------------------------------------');
  console.log('⚡ UNIVERSAL COMPATIBILITY: FFmpeg Remuxer Active');
  console.log('   100% of MKVs, 4K & AC3 Dolby audio play in all browsers!');
  console.log('======================================================');
  console.log('📱 Scan with your phone on Wi-Fi (Permanent mDNS Link):\n');

  qrcodeTerminal.generate(net.mdnsUrl, { small: true });

  console.log('======================================================');
  console.log('💡 TIP: Bookmark http://' + net.hostname + '.local:' + PORT);
  console.log('It will always work, even if your router assigns a new IP!\n');
  console.log('Press Ctrl+C to stop the server anytime.\n');
});

// Graceful Port Conflict Handling
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n⚠️  Port ${PORT} is currently busy.`);
    console.error(`   Run 'start-stream.bat' to automatically release it and restart.\n`);
    process.exit(1);
  } else {
    throw err;
  }
});
