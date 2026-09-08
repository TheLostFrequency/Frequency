/* =========================================================
   FREQUENCY
   Main application
   ========================================================= */

const SUPABASE_URL = 'https://nmiodppvxqpzfrideduv.supabase.co';

/*
  IMPORTANT:
  Replace the value below with your CURRENT Supabase
  PUBLISHABLE key.

  It should begin with:
  sb_publishable_

  Do NOT use the secret/service_role key.
*/
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_S7SpRNfMTiY7SB4Y19LRDQ_WBzH_TPc';


/* =========================================================
   SUPABASE
   ========================================================= */

const supabaseConfigured =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

const sb = supabaseConfigured
  ? supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    )
  : null;


/* =========================================================
   HELPERS
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const $$ = (selector) => Array.from(
  document.querySelectorAll(selector)
);

const audio = $('#audio');

let currentUser = null;
let tracks = [];
let playlists = [];

let currentTrackIndex = -1;
let shuffled = false;
let repeatMode = 'off';

let viewMode =
  localStorage.getItem('frequency-view') || 'collection';


/* =========================================================
   DOM HELPERS
   ========================================================= */

function showElement(selector) {
  const element = $(selector);

  if (element) {
    element.classList.remove('hidden');
  }
}


function hideElement(selector) {
  const element = $(selector);

  if (element) {
    element.classList.add('hidden');
  }
}


function setText(selector, text) {
  const element = $(selector);

  if (element) {
    element.textContent = text ?? '';
  }
}


function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


/* =========================================================
   AUTH
   ========================================================= */

async function getCurrentUser() {
  if (!sb) {
    return null;
  }

  const { data, error } = await sb.auth.getUser();

  if (error) {
    console.error('Auth error:', error);
    return null;
  }

  return data.user || null;
}


async function refreshAuthUI() {
  currentUser = await getCurrentUser();

  const authButtons = $$('.auth-button');
  const signOutButtons = $$('.sign-out');

  authButtons.forEach((button) => {
    button.classList.toggle('hidden', !!currentUser);
  });

  signOutButtons.forEach((button) => {
    button.classList.toggle('hidden', !currentUser);
  });

  const userEmail = $('#userEmail');

  if (userEmail && currentUser) {
    userEmail.textContent =
      currentUser.email || 'Signed in';
  }
}


async function signIn(email, password) {
  if (!sb) {
    alert(
      'Supabase is not configured. Add your current sb_publishable_ key to app.js first.'
    );
    return;
  }

  const { data, error } = await sb.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  currentUser = data.user;

  closeAllModals();

  await refreshAuthUI();
  await loadAll();

  alert('Welcome back to Frequency.');
}


async function signUp(email, password) {
  if (!sb) {
    alert(
      'Supabase is not configured. Add your current sb_publishable_ key to app.js first.'
    );
    return;
  }

  const { data, error } = await sb.auth.signUp({
    email,
    password
  });

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  if (data.session) {
    currentUser = data.user;

    closeAllModals();

    await refreshAuthUI();
    await loadAll();

    alert('Your Frequency account is ready.');
  } else {
    alert(
      'Account created. Check your email to confirm your account, then sign in.'
    );
  }
}


async function signOut() {
  if (!sb) {
    return;
  }

  const { error } = await sb.auth.signOut();

  if (error) {
    console.error(error);
    alert(error.message);
    return;
  }

  currentUser = null;
  tracks = [];
  playlists = [];
  currentTrackIndex = -1;

  stopAudio();
  await refreshAuthUI();
  renderAll();
}


/* =========================================================
   AUTH MODAL
   ========================================================= */

function openAuthModal(mode = 'login') {
  const modal = $('#authModal');

  if (!modal) {
    return;
  }

  modal.classList.remove('hidden');

  const loginForm = $('#loginForm');
  const signupForm = $('#signupForm');

  if (mode === 'signup') {
    loginForm?.classList.add('hidden');
    signupForm?.classList.remove('hidden');
  } else {
    signupForm?.classList.add('hidden');
    loginForm?.classList.remove('hidden');
  }
}


function closeAllModals() {
  $$('.modal').forEach((modal) => {
    modal.classList.add('hidden');
  });
}


/* =========================================================
   DATABASE
   ========================================================= */

async function loadTracks() {
  if (!sb || !currentUser) {
    tracks = [];
    return;
  }

  const { data, error } = await sb
    .from('tracks')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', {
      ascending: false
    });

  if (error) {
    console.error('Tracks error:', error);

    tracks = [];

    return;
  }

  tracks = data || [];
}


async function loadPlaylists() {
  if (!sb || !currentUser) {
    playlists = [];
    return;
  }

  const { data, error } = await sb
    .from('playlists')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', {
      ascending: false
    });

  if (error) {
    console.error('Playlists error:', error);

    playlists = [];

    return;
  }

  playlists = data || [];
}


async function loadAll() {
  if (!currentUser) {
    tracks = [];
    playlists = [];

    renderAll();

    return;
  }

  await Promise.all([
    loadTracks(),
    loadPlaylists()
  ]);

  renderAll();
}


/* =========================================================
   STORAGE URLS
   ========================================================= */

async function getSignedUrl(bucket, path) {
  if (!sb || !path) {
    return '';
  }

  const { data, error } = await sb.storage
    .from(bucket)
    .createSignedUrl(path, 60 * 60);

  if (error) {
    console.error(
      `Signed URL error for ${bucket}:`,
      error
    );

    return '';
  }

  return data?.signedUrl || '';
}


async function getAudioUrl(track) {
  if (!track?.audio_path) {
    return '';
  }

  return getSignedUrl('audio', track.audio_path);
}


async function getCoverUrl(track) {
  if (!track?.cover_path) {
    return '';
  }

  return getSignedUrl('covers', track.cover_path);
}


/* =========================================================
   AUDIO DURATION
   ========================================================= */

function getAudioDuration(file) {
  return new Promise((resolve) => {
    const tempAudio = document.createElement('audio');

    tempAudio.preload = 'metadata';

    tempAudio.onloadedmetadata = () => {
      const duration = tempAudio.duration;

      URL.revokeObjectURL(tempAudio.src);

      resolve(
        Number.isFinite(duration)
          ? duration
          : null
      );
    };

    tempAudio.onerror = () => {
      URL.revokeObjectURL(tempAudio.src);
      resolve(null);
    };

    tempAudio.src = URL.createObjectURL(file);
  });
}


/* =========================================================
   FORMATTERS
   ========================================================= */

function formatDuration(seconds) {
  if (!seconds || !Number.isFinite(Number(seconds))) {
    return '--:--';
  }

  seconds = Math.floor(Number(seconds));

  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;

  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}


function formatDate(dateString) {
  if (!dateString) {
    return '';
  }

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }
  );
}


/* =========================================================
   COVER PLACEHOLDER
   ========================================================= */

function coverPlaceholder(track) {
  const title =
    track?.title ||
    'Frequency';

  const firstLetter =
    title.charAt(0).toUpperCase() || 'F';

  return `
    <div class="cover-placeholder">
      <span>${escapeHtml(firstLetter)}</span>
    </div>
  `;
}


/* =========================================================
   COLLECTION VIEW
   ========================================================= */

async function renderCollection() {
  const container =
    $('#collection') ||
    $('#collectionView') ||
    $('#musicCollection');

  if (!container) {
    return;
  }

  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Your Frequency</h2>
        <p>Sign in to access your private music library.</p>
        <button class="primary-button" id="collectionLoginBtn">
          Sign in
        </button>
      </div>
    `;

    $('#collectionLoginBtn')?.addEventListener(
      'click',
      () => openAuthModal('login')
    );

    return;
  }

  if (!tracks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-art">◯</div>

        <h2>Your collection is empty</h2>

        <p>
          Upload your first track and start building
          your personal Frequency.
        </p>

        <button
          class="primary-button"
          id="collectionEmptyUpload"
        >
          ＋ Upload music
        </button>
      </div>
    `;

    $('#collectionEmptyUpload')?.addEventListener(
      'click',
      () => showElement('#uploadModal')
    );

    return;
  }

  const cards = [];

  for (const track of tracks) {
    const cover = await getCoverUrl(track);

    cards.push(`
      <article
        class="track-card"
        data-track-id="${escapeHtml(track.id)}"
      >
        <button
          class="artwork-button"
          data-play-track="${escapeHtml(track.id)}"
          aria-label="Play ${escapeHtml(track.title)}"
        >
          ${
            cover
              ? `<img
                  src="${cover}"
                  alt="${escapeHtml(track.title)} cover"
                  loading="lazy"
                >`
              : coverPlaceholder(track)
          }

          <span class="artwork-play">
            ▶
          </span>
        </button>

        <div class="track-card-info">
          <strong>
            ${escapeHtml(track.title)}
          </strong>

          <span>
            ${escapeHtml(track.artist)}
          </span>
        </div>
      </article>
    `);
  }

  container.innerHTML = `
    <div class="artwork-carousel" id="artworkCarousel">
      ${cards.join('')}
    </div>

    <div class="carousel-caption" id="carouselCaption">
      <span>
        Swipe, drag, or scroll
      </span>
    </div>
  `;

  attachTrackButtons();
  setupCarousel();
}


/* =========================================================
   LIST VIEW
   ========================================================= */

async function renderList() {
  const container =
    $('#list') ||
    $('#listView') ||
    $('#musicList');

  if (!container) {
    return;
  }

  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Your Frequency</h2>
        <p>Sign in to see your music.</p>
      </div>
    `;

    return;
  }

  if (!tracks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No music yet</h2>
        <p>Upload a track to begin.</p>
      </div>
    `;

    return;
  }

  const rows = [];

  for (const track of tracks) {
    const cover = await getCoverUrl(track);

    rows.push(`
      <div
        class="track-row"
        data-track-id="${escapeHtml(track.id)}"
      >
        <button
          class="list-play"
          data-play-track="${escapeHtml(track.id)}"
        >
          ${
            cover
              ? `<img
                  src="${cover}"
                  alt=""
                  loading="lazy"
                >`
              : coverPlaceholder(track)
          }

          <span>▶</span>
        </button>

        <div class="track-row-main">
          <strong>
            ${escapeHtml(track.title)}
          </strong>

          <span>
            ${escapeHtml(track.artist)}
          </span>
        </div>

        <div class="track-row-album">
          ${escapeHtml(track.album || '—')}
        </div>

        <div class="track-row-duration">
          ${formatDuration(track.duration)}
        </div>
      </div>
    `);
  }

  container.innerHTML = `
    <div class="track-list">
      ${rows.join('')}
    </div>
  `;

  attachTrackButtons();
}


/* =========================================================
   ALBUMS
   ========================================================= */

async function renderAlbums() {
  const container = $('#albums');

  if (!container) {
    return;
  }

  if (!tracks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No albums yet</h2>
      </div>
    `;

    return;
  }

  const albumMap = new Map();

  tracks.forEach((track) => {
    const albumName =
      track.album?.trim() ||
      'Singles';

    if (!albumMap.has(albumName)) {
      albumMap.set(albumName, []);
    }

    albumMap.get(albumName).push(track);
  });

  const albums = [];

  for (const [name, albumTracks] of albumMap) {
    const cover =
      await getCoverUrl(albumTracks[0]);

    albums.push(`
      <article
        class="album-card"
        data-album="${escapeHtml(name)}"
      >
        ${
          cover
            ? `<img
                src="${cover}"
                alt="${escapeHtml(name)}"
                loading="lazy"
              >`
            : coverPlaceholder({
                title: name
              })
        }

        <div>
          <strong>
            ${escapeHtml(name)}
          </strong>

          <span>
            ${albumTracks.length}
            ${albumTracks.length === 1
              ? 'track'
              : 'tracks'}
          </span>
        </div>
      </article>
    `);
  }

  container.innerHTML = albums.join('');
}


/* =========================================================
   PLAYLISTS
   ========================================================= */

async function renderPlaylists() {
  const container = $('#playlists');

  if (!container) {
    return;
  }

  if (!currentUser) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>Your playlists</h2>
        <p>Sign in to create playlists.</p>
      </div>
    `;

    return;
  }

  if (!playlists.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h2>No playlists yet</h2>

        <p>
          Create your first playlist.
        </p>

        <button
          class="primary-button"
          id="emptyPlaylistBtn"
        >
          ＋ New playlist
        </button>
      </div>
    `;

    $('#emptyPlaylistBtn')?.addEventListener(
      'click',
      () => showElement('#playlistModal')
    );

    return;
  }

  const cards = [];

  for (const playlist of playlists) {
    let cover = '';

    if (playlist.cover_path) {
      cover = await getSignedUrl(
        'covers',
        playlist.cover_path
      );
    }

    cards.push(`
      <article class="playlist-card">
        ${
          cover
            ? `<img
                src="${cover}"
                alt="${escapeHtml(playlist.name)}"
                loading="lazy"
              >`
            : `
              <div class="playlist-placeholder">
                ♫
              </div>
            `
        }

        <div>
          <strong>
            ${escapeHtml(playlist.name)}
          </strong>

          ${
            playlist.description
              ? `<span>
                  ${escapeHtml(
                    playlist.description
                  )}
                </span>`
              : ''
          }
        </div>
      </article>
    `);
  }

  container.innerHTML = cards.join('');
}


/* =========================================================
   RENDER ALL
   ========================================================= */

async function renderAll() {
  const collection =
    $('#collection') ||
    $('#collectionView') ||
    $('#musicCollection');

  const list =
    $('#list') ||
    $('#listView') ||
    $('#musicList');

  if (collection) {
    collection.classList.toggle(
      'hidden',
      viewMode !== 'collection'
    );
  }

  if (list) {
    list.classList.toggle(
      'hidden',
      viewMode !== 'list'
    );
  }

  await renderCollection();
  await renderList();
  await renderAlbums();
  await renderPlaylists();

  updateLibraryCounts();
}


/* =========================================================
   COUNTS
   ========================================================= */

function updateLibraryCounts() {
  const trackCount =
    tracks.length;

  const albumCount =
    new Set(
      tracks.map(
        (track) =>
          track.album?.trim() || 'Singles'
      )
    ).size;

  setText(
    '#trackCount',
    String(trackCount)
  );

  setText(
    '#albumCount',
    String(albumCount)
  );

  setText(
    '#playlistCount',
    String(playlists.length)
  );
}


/* =========================================================
   PLAY TRACK
   ========================================================= */

async function playTrackById(trackId) {
  const index =
    tracks.findIndex(
      (track) =>
        String(track.id) === String(trackId)
    );

  if (index === -1) {
    return;
  }

  await playTrack(index);
}


async function playTrack(index) {
  if (
    index < 0 ||
    index >= tracks.length
  ) {
    return;
  }

  const track = tracks[index];

  const audioUrl =
    await getAudioUrl(track);

  if (!audioUrl) {
    alert(
      'Unable to load this track. Check that the audio file exists in Supabase Storage.'
    );

    return;
  }

  currentTrackIndex = index;

  audio.src = audioUrl;

  audio.dataset.trackId =
    track.id;

  updatePlayer(track);

  try {
    await audio.play();
  } catch (error) {
    console.error(
      'Playback error:',
      error
    );
  }

  updatePlayButton();
}


function stopAudio() {
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
  audio.removeAttribute('src');
  audio.load();

  updatePlayButton();
}


/* =========================================================
   PLAYER
   ========================================================= */

async function updatePlayer(track) {
  if (!track) {
    return;
  }

  setText(
    '#playerTitle',
    track.title
  );

  setText(
    '#playerArtist',
    track.artist
  );

  setText(
    '#nowPlayingTitle',
    track.title
  );

  setText(
    '#nowPlayingArtist',
    track.artist
  );

  const cover =
    await getCoverUrl(track);

  const images = [
    $('#playerCover'),
    $('#nowPlayingCover')
  ];

  images.forEach((image) => {
    if (!image) {
      return;
    }

    if (cover) {
      image.src = cover;
      image.classList.remove(
        'hidden'
      );
    }
  });
}


function updatePlayButton() {
  const playing =
    audio &&
    !audio.paused;

  $$('.play-toggle').forEach(
    (button) => {
      button.textContent =
        playing
          ? '❚❚'
          : '▶';
    }
  );

  const player =
    $('#player');

  if (player) {
    player.classList.toggle(
      'is-playing',
      playing
    );
  }
}


function togglePlayback() {
  if (!audio) {
    return;
  }

  if (!audio.src) {
    if (tracks.length) {
      playTrack(0);
    }

    return;
  }

  if (audio.paused) {
    audio.play();
  } else {
    audio.pause();
  }

  updatePlayButton();
}


async function playNext() {
  if (!tracks.length) {
    return;
  }

  let nextIndex;

  if (shuffled) {
    nextIndex =
      Math.floor(
        Math.random() *
        tracks.length
      );
  } else {
    nextIndex =
      currentTrackIndex + 1;

    if (
      nextIndex >= tracks.length
    ) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        stopAudio();
        return;
      }
    }
  }

  await playTrack(nextIndex);
}


async function playPrevious() {
  if (!tracks.length) {
    return;
  }

  if (
    audio &&
    audio.currentTime > 3
  ) {
    audio.currentTime = 0;
    return;
  }

  let previousIndex =
    currentTrackIndex - 1;

  if (
    previousIndex < 0
  ) {
    previousIndex =
      tracks.length - 1;
  }

  await playTrack(previousIndex);
}


/* =========================================================
   SEARCH
   ========================================================= */

function performSearch(value) {
  const query =
    String(value || '')
      .trim()
      .toLowerCase();

  if (!query) {
    tracks.forEach(
      (track) => {
        document
          .querySelectorAll(
            `[data-track-id="${track.id}"]`
          )
          .forEach(
            (element) => {
              element.classList.remove(
                'search-hidden'
              );
            }
          );
      }
    );

    return;
  }

  tracks.forEach((track) => {
    const searchable = [
      track.title,
      track.artist,
      track.album,
      track.genre,
      track.year
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const match =
      searchable.includes(query);

    document
      .querySelectorAll(
        `[data-track-id="${track.id}"]`
      )
      .forEach((element) => {
        element.classList.toggle(
          'search-hidden',
          !match
        );
      });
  });
}


/* =========================================================
   TRACK BUTTONS
   ========================================================= */

function attachTrackButtons() {
  $$('[data-play-track]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        async (event) => {
          event.stopPropagation();

          const trackId =
            button.dataset.playTrack;

          await playTrackById(
            trackId
          );
        }
      );
    }
  );
}


/* =========================================================
   CAROUSEL
   ========================================================= */

function setupCarousel() {
  const carousel =
    $('#artworkCarousel');

  if (!carousel) {
    return;
  }

  const cards =
    Array.from(
      carousel.querySelectorAll(
        '.track-card'
      )
    );

  let activeIndex = 0;
  let pointerStartX = null;
  let pointerDown = false;

  function updateCarousel() {
    cards.forEach(
      (card, index) => {
        const offset =
          index - activeIndex;

        const distance =
          Math.abs(offset);

        const scale =
          Math.max(
            0.72,
            1 - distance * 0.08
          );

        const opacity =
          Math.max(
            0.35,
            1 - distance * 0.18
          );

        const rotate =
          offset * -4;

        const translate =
          offset * 42;

        card.style.setProperty(
          '--carousel-x',
          `${translate}%`
        );

        card.style.setProperty(
          '--carousel-scale',
          scale
        );

        card.style.setProperty(
          '--carousel-opacity',
          opacity
        );

        card.style.setProperty(
          '--carousel-rotate',
          `${rotate}deg`
        );

        card.classList.toggle(
          'is-active',
          index === activeIndex
        );
      }
    );

    const activeTrack =
      tracks[activeIndex];

    if (activeTrack) {
      setText(
        '#carouselTitle',
        activeTrack.title
      );

      setText(
        '#carouselArtist',
        activeTrack.artist
      );

      setText(
        '#carouselAlbum',
        activeTrack.album || ''
      );
    }
  }

  function move(direction) {
    if (!cards.length) {
      return;
    }

    activeIndex += direction;

    if (activeIndex < 0) {
      activeIndex =
        cards.length - 1;
    }

    if (
      activeIndex >= cards.length
    ) {
      activeIndex = 0;
    }

    updateCarousel();
  }

  carousel.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      if (
        Math.abs(event.deltaX) >
        Math.abs(event.deltaY)
      ) {
        move(
          event.deltaX > 0
            ? 1
            : -1
        );
      } else {
        move(
          event.deltaY > 0
            ? 1
            : -1
        );
      }
    },
    {
      passive: false
    }
  );

  carousel.addEventListener(
    'pointerdown',
    (event) => {
      pointerDown = true;
      pointerStartX =
        event.clientX;

      carousel.setPointerCapture(
        event.pointerId
      );
    }
  );

  carousel.addEventListener(
    'pointerup',
    (event) => {
      if (!pointerDown) {
        return;
      }

      pointerDown = false;

      const difference =
        event.clientX -
        pointerStartX;

      if (
        Math.abs(difference) > 35
      ) {
        move(
          difference < 0
            ? 1
            : -1
        );
      }
    }
  );

  carousel.addEventListener(
    'pointercancel',
    () => {
      pointerDown = false;
    }
  );

  carousel.addEventListener(
    'dblclick',
    () => {
      if (tracks[activeIndex]) {
        playTrack(activeIndex);
      }
    }
  );

  updateCarousel();
}


/* =========================================================
   UPLOAD TRACK
   ========================================================= */

async function uploadTrack(form) {
  if (!currentUser) {
    alert(
      'Please sign in before uploading music.'
    );

    openAuthModal('login');

    return;
  }

  if (!sb) {
    alert(
      'Supabase is not configured. Add your current publishable key first.'
    );

    return;
  }

  const formData =
    new FormData(form);

  const audioFile =
    formData.get('audio');

  const coverFile =
    formData.get('cover');

  const title =
    String(
      formData.get('title') || ''
    ).trim();

  const artist =
    String(
      formData.get('artist') || ''
    ).trim();

  const album =
    String(
      formData.get('album') || ''
    ).trim();

  const genre =
    String(
      formData.get('genre') || ''
    ).trim();

  const yearValue =
    String(
      formData.get('year') || ''
    ).trim();

  if (
    !audioFile ||
    !audioFile.name
  ) {
    alert(
      'Please choose an audio file.'
    );

    return;
  }

  if (!title) {
    alert(
      'Please enter a song title.'
    );

    return;
  }

  if (!artist) {
    alert(
      'Please enter an artist name.'
    );

    return;
  }

  const submitButton =
    form.querySelector(
      '[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      'Uploading...';
  }

  try {
    const duration =
      await getAudioDuration(
        audioFile
      );

    const safeAudioName =
      audioFile.name
        .replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        );

    const audioPath =
      `${currentUser.id}/${crypto.randomUUID()}-${safeAudioName}`;

    const {
      error: audioError
    } = await sb.storage
      .from('audio')
      .upload(
        audioPath,
        audioFile,
        {
          cacheControl: '3600',
          upsert: false,
          contentType:
            audioFile.type ||
            'audio/mpeg'
        }
      );

    if (audioError) {
      throw audioError;
    }

    let coverPath = null;

    if (
      coverFile &&
      coverFile.name
    ) {
      const safeCoverName =
        coverFile.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      coverPath =
        `${currentUser.id}/${crypto.randomUUID()}-${safeCoverName}`;

      const {
        error: coverError
      } = await sb.storage
        .from('covers')
        .upload(
          coverPath,
          coverFile,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              coverFile.type ||
              'image/jpeg'
          }
        );

      if (coverError) {
        throw coverError;
      }
    }

    const year =
      yearValue
        ? Number(yearValue)
        : null;

    const {
      error: insertError
    } = await sb
      .from('tracks')
      .insert({
        user_id:
          currentUser.id,

        title,

        artist,

        album:
          album || null,

        genre:
          genre || null,

        year:
          Number.isFinite(year)
            ? year
            : null,

        duration,

        audio_path:
          audioPath,

        cover_path:
          coverPath
      });

    if (insertError) {
      throw insertError;
    }

    form.reset();

    closeAllModals();

    await loadAll();

    alert(
      'Track uploaded successfully.'
    );

  } catch (error) {
    console.error(
      'Upload error:',
      error
    );

    alert(
      error.message ||
      'Something went wrong while uploading the track.'
    );

  } finally {
    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        'Upload track';
    }
  }
}


/* =========================================================
   CREATE PLAYLIST
   ========================================================= */

async function createPlaylist(form) {
  if (!currentUser) {
    alert(
      'Please sign in first.'
    );

    return;
  }

  if (!sb) {
    return;
  }

  const formData =
    new FormData(form);

  const name =
    String(
      formData.get('name') || ''
    ).trim();

  const description =
    String(
      formData.get('description') || ''
    ).trim();

  const coverFile =
    formData.get('cover');

  if (!name) {
    alert(
      'Please enter a playlist name.'
    );

    return;
  }

  const submitButton =
    form.querySelector(
      '[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      'Creating...';
  }

  try {
    let coverPath = null;

    if (
      coverFile &&
      coverFile.name
    ) {
      const safeName =
        coverFile.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      coverPath =
        `${currentUser.id}/playlists/${crypto.randomUUID()}-${safeName}`;

      const {
        error: coverError
      } = await sb.storage
        .from('covers')
        .upload(
          coverPath,
          coverFile,
          {
            cacheControl: '3600',
            upsert: false,
            contentType:
              coverFile.type ||
              'image/jpeg'
          }
        );

      if (coverError) {
        throw coverError;
      }
    }

    const {
      error
    } = await sb
      .from('playlists')
      .insert({
        user_id:
          currentUser.id,

        name,

        description:
          description || null,

        cover_path:
          coverPath
      });

    if (error) {
      throw error;
    }

    form.reset();

    closeAllModals();

    await loadAll();

    alert(
      'Playlist created.'
    );

  } catch (error) {
    console.error(
      'Playlist error:',
      error
    );

    alert(
      error.message ||
      'Unable to create playlist.'
    );

  } finally {
    if (submitButton) {
      submitButton.disabled =
        false;

      submitButton.textContent =
        'Create playlist';
    }
  }
}


/* =========================================================
   VIEW SWITCHING
   ========================================================= */

function setView(mode) {
  if (
    mode !== 'collection' &&
    mode !== 'list'
  ) {
    return;
  }

  viewMode = mode;

  localStorage.setItem(
    'frequency-view',
    viewMode
  );

  renderAll();

  const collectionButton =
    $('#viewCollection');

  const listButton =
    $('#viewList');

  collectionButton?.classList.toggle(
    'active',
    viewMode === 'collection'
  );

  listButton?.classList.toggle(
    'active',
    viewMode === 'list'
  );
}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

  /* -------------------------
     Upload buttons
     ------------------------- */

  const uploadBtn =
    $('#uploadBtn');

  const emptyUploadBtn =
    $('#emptyUploadBtn');

  const emptyCollectionUpload =
    $('#collectionEmptyUpload');

  uploadBtn?.addEventListener(
    'click',
    () => {
      showElement(
        '#uploadModal'
      );
    }
  );

  emptyUploadBtn?.addEventListener(
    'click',
    () => {
      showElement(
        '#uploadModal'
      );
    }
  );

  emptyCollectionUpload?.addEventListener(
    'click',
    () => {
      showElement(
        '#uploadModal'
      );
    }
  );


  /* -------------------------
     Playlist button
     ------------------------- */

  const newPlaylistBtn =
    $('#newPlaylistBtn');

  newPlaylistBtn?.addEventListener(
    'click',
    () => {
      showElement(
        '#playlistModal'
      );
    }
  );


  /* -------------------------
     View buttons
     ------------------------- */

  $('#viewCollection')?.addEventListener(
    'click',
    () => setView('collection')
  );

  $('#viewList')?.addEventListener(
    'click',
    () => setView('list')
  );


  /* -------------------------
     Close buttons
     ------------------------- */

  $$('[data-close]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          const modalId =
            button.dataset.close;

          if (modalId) {
            hideElement(
              `#${modalId}`
            );
          }
        }
      );
    }
  );


  /* -------------------------
     Modal background
     ------------------------- */

  $$('.modal').forEach(
    (modal) => {
      modal.addEventListener(
        'click',
        (event) => {
          if (
            event.target === modal
          ) {
            modal.classList.add(
              'hidden'
            );
          }
        }
      );
    }
  );


  /* -------------------------
     Auth forms
     ------------------------- */

  $('#loginForm')?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const form =
        event.currentTarget;

      const email =
        form.querySelector(
          '[name="email"]'
        )?.value.trim();

      const password =
        form.querySelector(
          '[name="password"]'
        )?.value;

      if (!email || !password) {
        alert(
          'Enter your email and password.'
        );

        return;
      }

      await signIn(
        email,
        password
      );
    }
  );


  $('#signupForm')?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const form =
        event.currentTarget;

      const email =
        form.querySelector(
          '[name="email"]'
        )?.value.trim();

      const password =
        form.querySelector(
          '[name="password"]'
        )?.value;

      if (!email || !password) {
        alert(
          'Enter an email and password.'
        );

        return;
      }

      if (password.length < 6) {
        alert(
          'Password must be at least 6 characters.'
        );

        return;
      }

      await signUp(
        email,
        password
      );
    }
  );


  /* -------------------------
     Auth open buttons
     ------------------------- */

  $$('[data-auth="login"]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => openAuthModal('login')
      );
    }
  );


  $$('[data-auth="signup"]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => openAuthModal('signup')
      );
    }
  );


  /* -------------------------
     Sign out
     ------------------------- */

  $$('.sign-out').forEach(
    (button) => {
      button.addEventListener(
        'click',
        signOut
      );
    }
  );


  /* -------------------------
     Switch login/signup
     ------------------------- */

  $('#showSignup')?.addEventListener(
    'click',
    () => openAuthModal('signup')
  );

  $('#showLogin')?.addEventListener(
    'click',
    () => openAuthModal('login')
  );


  /* -------------------------
     Upload form
     ------------------------- */

  $('#uploadForm')?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      await uploadTrack(
        event.currentTarget
      );
    }
  );


  /* -------------------------
     Playlist form
     ------------------------- */

  $('#playlistForm')?.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      await createPlaylist(
        event.currentTarget
      );
    }
  );


  /* -------------------------
     Player
     ------------------------- */

  $$('.play-toggle').forEach(
    (button) => {
      button.addEventListener(
        'click',
        togglePlayback
      );
    }
  );


  $$('.next-button').forEach(
    (button) => {
      button.addEventListener(
        'click',
        playNext
      );
    }
  );


  $$('.previous-button').forEach(
    (button) => {
      button.addEventListener(
        'click',
        playPrevious
      );
    }
  );


  /* -------------------------
     Shuffle
     ------------------------- */

  $$('.shuffle-button').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          shuffled =
            !shuffled;

          button.classList.toggle(
            'active',
            shuffled
          );
        }
      );
    }
  );


  /* -------------------------
     Repeat
     ------------------------- */

  $$('.repeat-button').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          if (
            repeatMode === 'off'
          ) {
            repeatMode = 'all';
          } else if (
            repeatMode === 'all'
          ) {
            repeatMode = 'one';
          } else {
            repeatMode = 'off';
          }

          button.classList.toggle(
            'active',
            repeatMode !== 'off'
          );

          button.dataset.mode =
            repeatMode;
        }
      );
    }
  );


  /* -------------------------
     Progress bar
     ------------------------- */

  const progress =
    $('#progress');

  progress?.addEventListener(
    'input',
    () => {
      if (
        !audio ||
        !audio.duration
      ) {
        return;
      }

      audio.currentTime =
        (
          Number(progress.value) /
          100
        ) *
        audio.duration;
    }
  );


  /* -------------------------
     Volume
     ------------------------- */

  const volume =
    $('#volume');

  volume?.addEventListener(
    'input',
    () => {
      if (!audio) {
        return;
      }

      audio.volume =
        Number(volume.value);
    }
  );


  /* -------------------------
     Search
     ------------------------- */

  $$('.search-input').forEach(
    (input) => {
      input.addEventListener(
        'input',
        () => {
          performSearch(
            input.value
          );
        }
      );
    }
  );


  /* -------------------------
     Audio events
     ------------------------- */

  audio?.addEventListener(
    'play',
    updatePlayButton
  );

  audio?.addEventListener(
    'pause',
    updatePlayButton
  );

  audio?.addEventListener(
    'timeupdate',
    () => {
      if (
        !audio ||
        !audio.duration
      ) {
        return;
      }

      const percent =
        (
          audio.currentTime /
          audio.duration
        ) * 100;

      if (progress) {
        progress.value =
          percent;
      }

      setText(
        '#currentTime',
        formatDuration(
          audio.currentTime
        )
      );

      setText(
        '#totalTime',
        formatDuration(
          audio.duration
        )
      );
    }
  );

  audio?.addEventListener(
    'ended',
    async () => {
      if (
        repeatMode === 'one'
      ) {
        audio.currentTime = 0;

        await audio.play();

        return;
      }

      await playNext();
    }
  );


  /* -------------------------
     Keyboard shortcuts
     ------------------------- */

  document.addEventListener(
    'keydown',
    (event) => {
      const tag =
        document.activeElement?.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }

      if (
        event.code === 'Space'
      ) {
        event.preventDefault();

        togglePlayback();
      }

      if (
        event.code === 'ArrowRight'
      ) {
        playNext();
      }

      if (
        event.code === 'ArrowLeft'
      ) {
        playPrevious();
      }

      if (
        event.code === 'Escape'
      ) {
        closeAllModals();
      }
    }
  );
}


/* =========================================================
   SUPABASE AUTH STATE
   ========================================================= */

function setupAuthListener() {
  if (!sb) {
    return;
  }

  sb.auth.onAuthStateChange(
    async (_event, session) => {
      currentUser =
        session?.user || null;

      await refreshAuthUI();
      await loadAll();
    }
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {
  console.log(
    'Frequency starting...'
  );

  if (!supabaseConfigured) {
    console.warn(
      'Frequency: Supabase publishable key has not been configured.'
    );
  }

  setupEvents();

  setupAuthListener();

  if (sb) {
    currentUser =
      await getCurrentUser();
  }

  await refreshAuthUI();

  await loadAll();

  setView(viewMode);

  console.log(
    'Frequency ready.'
  );
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState === 'loading'
) {
  document.addEventListener(
    'DOMContentLoaded',
    init
  );
} else {
  init();
}
