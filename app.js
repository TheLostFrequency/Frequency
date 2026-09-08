/* =========================================================
   FREQUENCY
   Personal Music Vault
   ========================================================= */


/* =========================================================
   SUPABASE CONFIG
   ========================================================= */

const SUPABASE_URL =
  'https://nmiodppvxqpzfrideduv.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
  'sb_publishable_S7SpRNfMTiY7SB4Y19LRDQ_WBzH_TPc';


const supabaseReady =
  SUPABASE_URL.startsWith('https://') &&
  SUPABASE_PUBLISHABLE_KEY.startsWith('sb_publishable_');

const sb = supabaseReady
  ? supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY
    )
  : null;


/* =========================================================
   DOM
   ========================================================= */

const $ = (selector) =>
  document.querySelector(selector);

const $$ = (selector) =>
  Array.from(document.querySelectorAll(selector));

const audio = $('#audio');


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let tracks = [];
let playlists = [];

let currentTrackIndex = -1;

let viewMode =
  localStorage.getItem('frequency-view') ||
  'collection';

let shuffled = false;
let repeatMode = 'off';

let currentPage = 'library';

let carouselIndex = 0;


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  const element = $('#toast');

  if (!element) {
    alert(message);
    return;
  }

  element.textContent = message;
  element.classList.add('show');

  clearTimeout(
    toast.timeout
  );

  toast.timeout =
    setTimeout(() => {
      element.classList.remove('show');
    }, 3000);
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}


function show(element) {
  if (element) {
    element.classList.remove('hidden');
  }
}


function hide(element) {
  if (element) {
    element.classList.add('hidden');
  }
}


function setText(selector, value) {
  const element = $(selector);

  if (element) {
    element.textContent = value ?? '';
  }
}


function formatTime(seconds) {
  if (
    !Number.isFinite(Number(seconds)) ||
    Number(seconds) < 0
  ) {
    return '0:00';
  }

  const total =
    Math.floor(Number(seconds));

  const minutes =
    Math.floor(total / 60);

  const secondsPart =
    total % 60;

  return `${minutes}:${String(
    secondsPart
  ).padStart(2, '0')}`;
}


function formatCount(count, singular) {
  return `${count} ${
    count === 1
      ? singular
      : singular + 's'
  }`;
}


/* =========================================================
   AUTH
   ========================================================= */

async function getUser() {
  if (!sb) {
    return null;
  }

  const {
    data,
    error
  } = await sb.auth.getUser();

  if (error) {
    console.error(
      'getUser error:',
      error
    );

    return null;
  }

  return data?.user || null;
}


async function signIn(email, password) {
  if (!sb) {
    $('#authStatus').textContent =
      'Supabase is not configured. Put your current sb_publishable_ key into app.js.';
    return;
  }

  const status =
    $('#authStatus');

  const button =
    $('#authSubmit');

  status.textContent =
    'Signing in...';

  button.disabled = true;

  try {
    const {
      data,
      error
    } = await sb.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    currentUser =
      data.user;

    status.textContent =
      '';

    await showApp();

    toast('Welcome back to Frequency.');

  } catch (error) {
    console.error(
      'Sign in error:',
      error
    );

    status.textContent =
      error.message ||
      'Unable to sign in.';

  } finally {
    button.disabled = false;
  }
}


async function signUp(email, password) {
  if (!sb) {
    $('#authStatus').textContent =
      'Supabase is not configured. Put your current sb_publishable_ key into app.js.';
    return;
  }

  const status =
    $('#authStatus');

  const button =
    $('#authSubmit');

  status.textContent =
    'Creating account...';

  button.disabled = true;

  try {
    const {
      data,
      error
    } = await sb.auth.signUp({
      email,
      password
    });

    if (error) {
      throw error;
    }

    if (data.session) {
      currentUser =
        data.user;

      status.textContent =
        '';

      await showApp();

      toast(
        'Your Frequency account is ready.'
      );

    } else {
      status.textContent =
        'Account created. Check your email to confirm your account, then sign in.';
    }

  } catch (error) {
    console.error(
      'Sign up error:',
      error
    );

    status.textContent =
      error.message ||
      'Unable to create account.';

  } finally {
    button.disabled = false;
  }
}


async function signOut() {
  if (!sb) {
    return;
  }

  const {
    error
  } = await sb.auth.signOut();

  if (error) {
    console.error(
      'Sign out error:',
      error
    );

    toast(error.message);
    return;
  }

  currentUser = null;
  tracks = [];
  playlists = [];
  currentTrackIndex = -1;

  stopAudio();

  $('#appView').classList.add(
    'hidden'
  );

  $('#authView').classList.remove(
    'hidden'
  );

  $('#authEmail').value = '';
  $('#authPassword').value = '';
  $('#authStatus').textContent = '';

  toast('Signed out.');
}


async function showApp() {
  $('#authView').classList.add(
    'hidden'
  );

  $('#appView').classList.remove(
    'hidden'
  );

  await loadLibrary();

  renderCurrentPage();
}


function setupAuth() {
  const form =
    $('#authForm');

  const toggle =
    $('#authToggle');

  let mode = 'login';

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const email =
        $('#authEmail').value.trim();

      const password =
        $('#authPassword').value;

      if (!email || !password) {
        $('#authStatus').textContent =
          'Enter your email and password.';
        return;
      }

      if (password.length < 6) {
        $('#authStatus').textContent =
          'Password must be at least 6 characters.';
        return;
      }

      if (mode === 'login') {
        await signIn(
          email,
          password
        );
      } else {
        await signUp(
          email,
          password
        );
      }
    }
  );


  toggle.addEventListener(
    'click',
    () => {
      mode =
        mode === 'login'
          ? 'signup'
          : 'login';

      if (mode === 'signup') {
        $('#authSubmit').textContent =
          'Create account';

        toggle.textContent =
          'Already have an account? Sign in';

        $('#authPassword').setAttribute(
          'autocomplete',
          'new-password'
        );

      } else {
        $('#authSubmit').textContent =
          'Sign in';

        toggle.textContent =
          'Need an account? Sign up';

        $('#authPassword').setAttribute(
          'autocomplete',
          'current-password'
        );
      }

      $('#authStatus').textContent =
        '';
    }
  );
}


/* =========================================================
   AUTH STATE
   ========================================================= */

function setupAuthListener() {
  if (!sb) {
    return;
  }

  sb.auth.onAuthStateChange(
    async (_event, session) => {
      currentUser =
        session?.user || null;

      if (currentUser) {
        $('#authView').classList.add(
          'hidden'
        );

        $('#appView').classList.remove(
          'hidden'
        );

        await loadLibrary();

        renderCurrentPage();

      } else {
        $('#authView').classList.remove(
          'hidden'
        );

        $('#appView').classList.add(
          'hidden'
        );
      }
    }
  );
}


/* =========================================================
   DATABASE
   ========================================================= */

async function loadTracks() {
  if (!sb || !currentUser) {
    tracks = [];
    return;
  }

  const {
    data,
    error
  } = await sb
    .from('tracks')
    .select('*')
    .eq(
      'user_id',
      currentUser.id
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    );

  if (error) {
    console.error(
      'Load tracks error:',
      error
    );

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

  const {
    data,
    error
  } = await sb
    .from('playlists')
    .select('*')
    .eq(
      'user_id',
      currentUser.id
    )
    .order(
      'created_at',
      {
        ascending: false
      }
    );

  if (error) {
    console.error(
      'Load playlists error:',
      error
    );

    playlists = [];

    return;
  }

  playlists = data || [];
}


async function loadLibrary() {
  if (!currentUser) {
    tracks = [];
    playlists = [];
    return;
  }

  await Promise.all([
    loadTracks(),
    loadPlaylists()
  ]);

  updateCounts();
}


/* =========================================================
   STORAGE
   ========================================================= */

async function signedUrl(
  bucket,
  path
) {
  if (!sb || !path) {
    return null;
  }

  const {
    data,
    error
  } = await sb.storage
    .from(bucket)
    .createSignedUrl(
      path,
      60 * 60
    );

  if (error) {
    console.error(
      'Storage URL error:',
      error
    );

    return null;
  }

  return data?.signedUrl || null;
}


async function audioUrl(track) {
  return signedUrl(
    'audio',
    track.audio_path
  );
}


async function coverUrl(track) {
  return signedUrl(
    'covers',
    track.cover_path
  );
}


/* =========================================================
   COUNTS
   ========================================================= */

function updateCounts() {
  const trackCount =
    tracks.length;

  const albums =
    new Set(
      tracks.map(
        (track) =>
          track.album?.trim() ||
          'Singles'
      )
    );

  setText(
    '#trackCount',
    formatCount(
      trackCount,
      'track'
    )
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function switchPage(page) {
  currentPage = page;

  $$('.nav-item').forEach(
    (button) => {
      button.classList.toggle(
        'active',
        button.dataset.page === page
      );
    }
  );

  $$('.page').forEach(
    (section) => {
      section.classList.toggle(
        'active-page',
        section.id ===
          `page-${page}`
      );
    }
  );

  const titles = {
    library: 'Library',
    search: 'Search',
    albums: 'Albums',
    playlists: 'Playlists'
  };

  setText(
    '#pageTitle',
    titles[page] || 'Library'
  );

  if (page === 'library') {
    renderLibrary();
  }

  if (page === 'search') {
    renderSearch();
  }

  if (page === 'albums') {
    renderAlbums();
  }

  if (page === 'playlists') {
    renderPlaylists();
  }
}


/* =========================================================
   VIEW MODE
   ========================================================= */

function setView(mode) {
  viewMode = mode;

  localStorage.setItem(
    'frequency-view',
    mode
  );

  $('#viewCollection')
    ?.classList.toggle(
      'active',
      mode === 'collection'
    );

  $('#viewList')
    ?.classList.toggle(
      'active',
      mode === 'list'
    );

  renderLibrary();
}


/* =========================================================
   EMPTY LIBRARY
   ========================================================= */

function renderEmptyLibrary() {
  $('#emptyLibrary').classList.remove(
    'hidden'
  );

  $('#collectionView').classList.add(
    'hidden'
  );

  $('#listView').classList.add(
    'hidden'
  );
}


/* =========================================================
   LIBRARY
   ========================================================= */

async function renderLibrary() {
  if (!currentUser) {
    return;
  }

  if (!tracks.length) {
    renderEmptyLibrary();
    return;
  }

  $('#emptyLibrary').classList.add(
    'hidden'
  );

  if (viewMode === 'collection') {
    $('#collectionView').classList.remove(
      'hidden'
    );

    $('#listView').classList.add(
      'hidden'
    );

    await renderCarousel();

  } else {
    $('#collectionView').classList.add(
      'hidden'
    );

    $('#listView').classList.remove(
      'hidden'
    );

    await renderList();
  }
}


/* =========================================================
   COLLECTION CAROUSEL
   ========================================================= */

async function renderCarousel() {
  const carousel =
    $('#carousel');

  if (!carousel) {
    return;
  }

  if (
    carouselIndex >= tracks.length
  ) {
    carouselIndex = 0;
  }

  carousel.innerHTML = '';

  const fragment =
    document.createDocumentFragment();

  for (
    let index = 0;
    index < tracks.length;
    index++
  ) {
    const track =
      tracks[index];

    const card =
      document.createElement(
        'div'
      );

    card.className =
      'carousel-item';

    card.dataset.index =
      index;

    const cover =
      await coverUrl(track);

    if (cover) {
      card.innerHTML = `
        <img
          src="${cover}"
          alt="${escapeHtml(
            track.title
          )}"
          draggable="false"
        >
      `;
    } else {
      card.innerHTML = `
        <div class="carousel-placeholder">
          <span>
            ${escapeHtml(
              (
                track.title ||
                'F'
              ).charAt(0)
            )}
          </span>
        </div>
      `;
    }

    card.addEventListener(
      'click',
      () => {
        const clickedIndex =
          Number(
            card.dataset.index
          );

        if (
          clickedIndex ===
          carouselIndex
        ) {
          playTrack(
            clickedIndex
          );
        } else {
          carouselIndex =
            clickedIndex;

          updateCarouselPosition();
        }
      }
    );

    fragment.appendChild(card);
  }

  carousel.appendChild(
    fragment
  );

  updateCarouselPosition();
}


function updateCarouselPosition() {
  const items =
    $$('.carousel-item');

  items.forEach(
    (item, index) => {
      let offset =
        index -
        carouselIndex;

      const total =
        items.length;

      if (
        offset >
        total / 2
      ) {
        offset -= total;
      }

      if (
        offset <
        -total / 2
      ) {
        offset += total;
      }

      const distance =
        Math.abs(offset);

      const x =
        offset * 235;

      const scale =
        Math.max(
          0.58,
          1 -
            distance * 0.12
        );

      const opacity =
        Math.max(
          0.28,
          1 -
            distance * 0.2
        );

      const rotate =
        offset * -8;

      const z =
        100 -
        distance;

      item.style.transform =
        `translateX(${x}px) scale(${scale}) rotateY(${rotate}deg)`;

      item.style.opacity =
        opacity;

      item.style.zIndex =
        z;

      item.classList.toggle(
        'active',
        index ===
          carouselIndex
      );
    }
  );

  const active =
    tracks[carouselIndex];

  if (!active) {
    return;
  }

  setText(
    '#activeArtist',
    active.artist ||
      'Unknown artist'
  );

  setText(
    '#activeTitle',
    active.title ||
      'Untitled'
  );

  setText(
    '#activeAlbum',
    active.album ||
      'Single'
  );
}


function carouselNext() {
  if (!tracks.length) {
    return;
  }

  carouselIndex =
    (
      carouselIndex + 1
    ) % tracks.length;

  updateCarouselPosition();
}


function carouselPrevious() {
  if (!tracks.length) {
    return;
  }

  carouselIndex =
    (
      carouselIndex -
      1 +
      tracks.length
    ) % tracks.length;

  updateCarouselPosition();
}


/* =========================================================
   CAROUSEL TOUCH / DRAG
   ========================================================= */

function setupCarouselGestures() {
  const carousel =
    $('#carousel');

  if (!carousel) {
    return;
  }

  let startX = 0;
  let dragging = false;

  carousel.addEventListener(
    'pointerdown',
    (event) => {
      startX =
        event.clientX;

      dragging = true;

      carousel.setPointerCapture(
        event.pointerId
      );
    }
  );

  carousel.addEventListener(
    'pointerup',
    (event) => {
      if (!dragging) {
        return;
      }

      dragging = false;

      const distance =
        event.clientX -
        startX;

      if (
        Math.abs(distance) <
        35
      ) {
        return;
      }

      if (distance < 0) {
        carouselNext();
      } else {
        carouselPrevious();
      }
    }
  );

  carousel.addEventListener(
    'pointercancel',
    () => {
      dragging = false;
    }
  );

  carousel.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      if (
        event.deltaY > 0 ||
        event.deltaX > 0
      ) {
        carouselNext();
      } else {
        carouselPrevious();
      }
    },
    {
      passive: false
    }
  );

  carousel.addEventListener(
    'keydown',
    (event) => {
      if (
        event.key ===
        'ArrowRight'
      ) {
        carouselNext();
      }

      if (
        event.key ===
        'ArrowLeft'
      ) {
        carouselPrevious();
      }

      if (
        event.key ===
        'Enter'
      ) {
        playTrack(
          carouselIndex
        );
      }
    }
  );
}


/* =========================================================
   LIST VIEW
   ========================================================= */

async function renderList() {
  const container =
    $('#listView');

  if (!container) {
    return;
  }

  container.innerHTML = '';

  for (
    let index = 0;
    index < tracks.length;
    index++
  ) {
    const track =
      tracks[index];

    const cover =
      await coverUrl(track);

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'track-row';

    row.innerHTML = `
      <button
        class="list-art"
        data-list-index="${index}"
      >
        ${
          cover
            ? `
              <img
                src="${cover}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="list-placeholder">
                ${
                  escapeHtml(
                    (
                      track.title ||
                      'F'
                    ).charAt(0)
                  )
                }
              </div>
            `
        }
      </button>

      <div class="list-info">
        <strong>
          ${escapeHtml(
            track.title ||
            'Untitled'
          )}
        </strong>

        <span>
          ${escapeHtml(
            track.artist ||
            'Unknown artist'
          )}
        </span>
      </div>

      <div class="list-album">
        ${escapeHtml(
          track.album ||
          'Single'
        )}
      </div>

      <div class="list-duration">
        ${formatTime(
          track.duration
        )}
      </div>

      <button
        class="list-play"
        data-list-play="${index}"
      >
        ▶
      </button>
    `;

    container.appendChild(
      row
    );
  }

  $$('.list-art').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          playTrack(
            Number(
              button.dataset.listIndex
            )
          );
        }
      );
    }
  );

  $$('.list-play').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          playTrack(
            Number(
              button.dataset.listPlay
            )
          );
        }
      );
    }
  );
}


/* =========================================================
   SEARCH
   ========================================================= */

async function renderSearch(
  query = ''
) {
  const container =
    $('#searchResults');

  if (!container) {
    return;
  }

  const search =
    query
      .trim()
      .toLowerCase();

  const results =
    tracks.filter(
      (track) => {
        if (!search) {
          return true;
        }

        return [
          track.title,
          track.artist,
          track.album,
          track.genre,
          track.year
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(search);
      }
    );

  container.innerHTML = '';

  if (!results.length) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No results</h3>
        <p class="muted">
          Nothing in your library matches that search.
        </p>
      </div>
    `;

    return;
  }

  for (
    const track of results
  ) {
    const originalIndex =
      tracks.findIndex(
        (item) =>
          item.id === track.id
      );

    const cover =
      await coverUrl(track);

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'track-row';

    row.innerHTML = `
      <button
        class="list-art"
        data-search-index="${originalIndex}"
      >
        ${
          cover
            ? `
              <img
                src="${cover}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="list-placeholder">
                ${escapeHtml(
                  (
                    track.title ||
                    'F'
                  ).charAt(0)
                )}
              </div>
            `
        }
      </button>

      <div class="list-info">
        <strong>
          ${escapeHtml(
            track.title
          )}
        </strong>

        <span>
          ${escapeHtml(
            track.artist
          )}
        </span>
      </div>

      <div class="list-album">
        ${escapeHtml(
          track.album ||
          'Single'
        )}
      </div>

      <div class="list-duration">
        ${formatTime(
          track.duration
        )}
      </div>

      <button
        class="list-play"
        data-search-play="${originalIndex}"
      >
        ▶
      </button>
    `;

    container.appendChild(
      row
    );
  }

  $$('[data-search-index]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          playTrack(
            Number(
              button.dataset.searchIndex
            )
          );
        }
      );
    }
  );

  $$('[data-search-play]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          playTrack(
            Number(
              button.dataset.searchPlay
            )
          );
        }
      );
    }
  );
}


/* =========================================================
   ALBUMS
   ========================================================= */

async function renderAlbums() {
  const grid =
    $('#albumsGrid');

  if (!grid) {
    return;
  }

  grid.innerHTML = '';

  if (!tracks.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No albums yet</h3>
        <p class="muted">
          Upload music to start building your albums.
        </p>
      </div>
    `;

    return;
  }

  const albumMap =
    new Map();

  tracks.forEach(
    (track) => {
      const album =
        track.album?.trim() ||
        'Singles';

      if (!albumMap.has(album)) {
        albumMap.set(
          album,
          []
        );
      }

      albumMap
        .get(album)
        .push(track);
    }
  );

  for (
    const [
      albumName,
      albumTracks
    ] of albumMap
  ) {
    const cover =
      await coverUrl(
        albumTracks[0]
      );

    const card =
      document.createElement(
        'div'
      );

    card.className =
      'album-card';

    card.innerHTML = `
      <div class="album-art">
        ${
          cover
            ? `
              <img
                src="${cover}"
                alt="${escapeHtml(
                  albumName
                )}"
              >
            `
            : `
              <div class="album-placeholder">
                ${escapeHtml(
                  albumName.charAt(0)
                )}
              </div>
            `
        }
      </div>

      <strong>
        ${escapeHtml(
          albumName
        )}
      </strong>

      <span>
        ${formatCount(
          albumTracks.length,
          'track'
        )}
      </span>
    `;

    card.addEventListener(
      'click',
      () => {
        const firstIndex =
          tracks.findIndex(
            (track) =>
              track.id ===
              albumTracks[0].id
          );

        if (
          firstIndex !== -1
        ) {
          playTrack(
            firstIndex
          );
        }
      }
    );

    grid.appendChild(
      card
    );
  }
}


/* =========================================================
   PLAYLISTS
   ========================================================= */

async function renderPlaylists() {
  const grid =
    $('#playlistsGrid');

  if (!grid) {
    return;
  }

  grid.innerHTML = '';

  if (!playlists.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No playlists yet</h3>
        <p class="muted">
          Create your first playlist.
        </p>
      </div>
    `;

    return;
  }

  for (
    const playlist of playlists
  ) {
    const cover =
      playlist.cover_path
        ? await signedUrl(
            'covers',
            playlist.cover_path
          )
        : null;

    const card =
      document.createElement(
        'div'
      );

    card.className =
      'playlist-card';

    card.innerHTML = `
      <div class="playlist-art">
        ${
          cover
            ? `
              <img
                src="${cover}"
                alt="${escapeHtml(
                  playlist.name
                )}"
              >
            `
            : `
              <div class="playlist-placeholder">
                F
              </div>
            `
        }
      </div>

      <strong>
        ${escapeHtml(
          playlist.name
        )}
      </strong>

      ${
        playlist.description
          ? `
            <span>
              ${escapeHtml(
                playlist.description
              )}
            </span>
          `
          : ''
      }
    `;

    grid.appendChild(
      card
    );
  }
}


/* =========================================================
   PLAYBACK
   ========================================================= */

async function playTrack(index) {
  if (
    index < 0 ||
    index >= tracks.length
  ) {
    return;
  }

  const track =
    tracks[index];

  const url =
    await audioUrl(track);

  if (!url) {
    toast(
      'Could not load this track.'
    );

    return;
  }

  currentTrackIndex =
    index;

  audio.src =
    url;

  audio.load();

  await updatePlayer(
    track
  );

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


async function updatePlayer(
  track
) {
  if (!track) {
    return;
  }

  setText(
    '#playerTitle',
    track.title ||
      'Nothing playing'
  );

  setText(
    '#playerArtist',
    track.artist ||
      'Choose a track'
  );

  const cover =
    await coverUrl(track);

  const playerCover =
    $('#playerCover');

  if (!playerCover) {
    return;
  }

  if (cover) {
    playerCover.innerHTML = `
      <img
        src="${cover}"
        alt=""
      >
    `;
  } else {
    playerCover.textContent =
      (
        track.title ||
        'F'
      ).charAt(0);
  }
}


function togglePlayback() {
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


function updatePlayButton() {
  const button =
    $('#playBtn');

  if (!button) {
    return;
  }

  button.textContent =
    audio &&
    !audio.paused
      ? '❚❚'
      : '▶';
}


function stopAudio() {
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;

  audio.removeAttribute(
    'src'
  );

  audio.load();

  setText(
    '#currentTime',
    '0:00'
  );

  setText(
    '#duration',
    '0:00'
  );

  updatePlayButton();
}


async function nextTrack() {
  if (!tracks.length) {
    return;
  }

  let nextIndex;

  if (shuffled) {
    if (tracks.length === 1) {
      nextIndex = 0;
    } else {
      do {
        nextIndex =
          Math.floor(
            Math.random() *
            tracks.length
          );
      } while (
        nextIndex ===
        currentTrackIndex
      );
    }

  } else {
    nextIndex =
      currentTrackIndex + 1;

    if (
      nextIndex >=
      tracks.length
    ) {
      if (
        repeatMode === 'all'
      ) {
        nextIndex = 0;
      } else {
        stopAudio();
        return;
      }
    }
  }

  await playTrack(
    nextIndex
  );
}


async function previousTrack() {
  if (!tracks.length) {
    return;
  }

  if (
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

  await playTrack(
    previousIndex
  );
}


/* =========================================================
   UPLOAD
   ========================================================= */

function getAudioDuration(file) {
  return new Promise(
    (resolve) => {
      const temp =
        document.createElement(
          'audio'
        );

      temp.preload =
        'metadata';

      temp.onloadedmetadata =
        () => {
          const duration =
            temp.duration;

          URL.revokeObjectURL(
            temp.src
          );

          resolve(
            Number.isFinite(
              duration
            )
              ? duration
              : null
          );
        };

      temp.onerror = () => {
        URL.revokeObjectURL(
          temp.src
        );

        resolve(null);
      };

      temp.src =
        URL.createObjectURL(
          file
        );
    }
  );
}


async function uploadTrack() {
  if (!currentUser) {
    toast(
      'Please sign in first.'
    );

    return;
  }

  const audioFile =
    $('#trackFile').files[0];

  const coverFile =
    $('#coverFile').files[0];

  const title =
    $('#trackTitle').value.trim();

  const artist =
    $('#trackArtist').value.trim();

  const album =
    $('#trackAlbum').value.trim();

  const genre =
    $('#trackGenre').value.trim();

  const yearValue =
    $('#trackYear').value.trim();

  const status =
    $('#uploadStatus');

  if (!audioFile) {
    status.textContent =
      'Choose an audio file.';
    return;
  }

  if (!title) {
    status.textContent =
      'Enter a title.';
    return;
  }

  if (!artist) {
    status.textContent =
      'Enter an artist.';
    return;
  }

  status.textContent =
    'Reading track...';

  const duration =
    await getAudioDuration(
      audioFile
    );

  const audioName =
    audioFile.name
      .replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      );

  const audioPath =
    `${currentUser.id}/${crypto.randomUUID()}-${audioName}`;

  try {

    status.textContent =
      'Uploading audio...';

    const {
      error: audioError
    } = await sb.storage
      .from('audio')
      .upload(
        audioPath,
        audioFile,
        {
          cacheControl:
            '3600',
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

    if (coverFile) {
      status.textContent =
        'Uploading artwork...';

      const coverName =
        coverFile.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      coverPath =
        `${currentUser.id}/${crypto.randomUUID()}-${coverName}`;

      const {
        error: coverError
      } = await sb.storage
        .from('covers')
        .upload(
          coverPath,
          coverFile,
          {
            cacheControl:
              '3600',
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


    status.textContent =
      'Adding track to Frequency...';

    const year =
      yearValue
        ? Number(yearValue)
        : null;

    const {
      error: databaseError
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

    if (databaseError) {
      throw databaseError;
    }


    $('#uploadForm').reset();

    $('#uploadModal').classList.add(
      'hidden'
    );

    status.textContent = '';

    await loadLibrary();

    renderCurrentPage();

    toast(
      'Track added to Frequency.'
    );

  } catch (error) {
    console.error(
      'Upload error:',
      error
    );

    status.textContent =
      error.message ||
      'Upload failed.';
  }
}


/* =========================================================
   PLAYLIST CREATION
   ========================================================= */

async function createPlaylist() {
  if (!currentUser) {
    toast(
      'Please sign in first.'
    );

    return;
  }

  const name =
    $('#playlistName').value.trim();

  const description =
    $('#playlistDescription')
      .value.trim();

  const coverFile =
    $('#playlistCover').files[0];

  const status =
    $('#playlistStatus');

  if (!name) {
    status.textContent =
      'Enter a playlist name.';
    return;
  }

  status.textContent =
    'Creating playlist...';

  try {

    let coverPath = null;

    if (coverFile) {
      const coverName =
        coverFile.name
          .replace(
            /[^a-zA-Z0-9._-]/g,
            '_'
          );

      coverPath =
        `${currentUser.id}/playlists/${crypto.randomUUID()}-${coverName}`;

      const {
        error
      } = await sb.storage
        .from('covers')
        .upload(
          coverPath,
          coverFile,
          {
            cacheControl:
              '3600',
            upsert: false,
            contentType:
              coverFile.type ||
              'image/jpeg'
          }
        );

      if (error) {
        throw error;
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


    $('#playlistForm').reset();

    $('#playlistModal').classList.add(
      'hidden'
    );

    status.textContent = '';

    await loadLibrary();

    renderPlaylists();

    toast(
      'Playlist created.'
    );

  } catch (error) {
    console.error(
      'Playlist error:',
      error
    );

    status.textContent =
      error.message ||
      'Unable to create playlist.';
  }
}


/* =========================================================
   MODALS
   ========================================================= */

function closeModals() {
  $$('.modal').forEach(
    (modal) => {
      modal.classList.add(
        'hidden'
      );
    }
  );
}


function setupModals() {
  $$('[data-close]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          const id =
            button.dataset.close;

          $(`#${id}`)?.classList.add(
            'hidden'
          );
        }
      );
    }
  );

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
}


/* =========================================================
   MAIN EVENTS
   ========================================================= */

function setupEvents() {

  /* Navigation */

  $$('.nav-item').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          switchPage(
            button.dataset.page
          );
        }
      );
    }
  );


  /* View */

  $('#viewCollection')
    ?.addEventListener(
      'click',
      () => {
        setView(
          'collection'
        );
      }
    );

  $('#viewList')
    ?.addEventListener(
      'click',
      () => {
        setView(
          'list'
        );
      }
    );


  /* Upload */

  $('#uploadBtn')
    ?.addEventListener(
      'click',
      () => {
        $('#uploadModal')
          .classList.remove(
            'hidden'
          );
      }
    );

  $('#emptyUploadBtn')
    ?.addEventListener(
      'click',
      () => {
        $('#uploadModal')
          .classList.remove(
            'hidden'
          );
      }
    );


  /* Playlist */

  $('#newPlaylistBtn')
    ?.addEventListener(
      'click',
      () => {
        $('#playlistModal')
          .classList.remove(
            'hidden'
          );
      }
    );


  /* Sign out */

  $('#signOutBtn')
    ?.addEventListener(
      'click',
      signOut
    );


  /* Upload form */

  $('#uploadForm')
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        await uploadTrack();
      }
    );


  /* Playlist form */

  $('#playlistForm')
    ?.addEventListener(
      'submit',
      async (event) => {
        event.preventDefault();

        await createPlaylist();
      }
    );


  /* Active carousel track */

  $('#playActive')
    ?.addEventListener(
      'click',
      () => {
        playTrack(
          carouselIndex
        );
      }
    );


  /* Player */

  $('#playBtn')
    ?.addEventListener(
      'click',
      togglePlayback
    );

  $('#prevBtn')
    ?.addEventListener(
      'click',
      previousTrack
    );

  $('#nextBtn')
    ?.addEventListener(
      'click',
      nextTrack
    );


  /* Shuffle */

  $('#shuffleBtn')
    ?.addEventListener(
      'click',
      () => {
        shuffled =
          !shuffled;

        $('#shuffleBtn')
          .classList.toggle(
            'active',
            shuffled
          );

        toast(
          shuffled
            ? 'Shuffle on'
            : 'Shuffle off'
        );
      }
    );


  /* Repeat */

  $('#repeatBtn')
    ?.addEventListener(
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

        $('#repeatBtn')
          .classList.toggle(
            'active',
            repeatMode !== 'off'
          );

        const messages = {
          off: 'Repeat off',
          all: 'Repeat all',
          one: 'Repeat one'
        };

        toast(
          messages[
            repeatMode
          ]
        );
      }
    );


  /* Search */

  $('#searchInput')
    ?.addEventListener(
      'input',
      (event) => {
        renderSearch(
          event.target.value
        );
      }
    );


  /* Progress */

  $('#progress')
    ?.addEventListener(
      'input',
      (event) => {
        if (
          !audio.duration
        ) {
          return;
        }

        audio.currentTime =
          (
            Number(
              event.target.value
            ) / 100
          ) *
          audio.duration;
      }
    );


  /* Volume */

  $('#volume')
    ?.addEventListener(
      'input',
      (event) => {
        audio.volume =
          Number(
            event.target.value
          );
      }
    );
}


/* =========================================================
   AUDIO EVENTS
   ========================================================= */

function setupAudio() {

  audio.volume = 0.8;

  audio.addEventListener(
    'play',
    updatePlayButton
  );

  audio.addEventListener(
    'pause',
    updatePlayButton
  );


  audio.addEventListener(
    'timeupdate',
    () => {

      if (
        !audio.duration
      ) {
        return;
      }

      const percentage =
        (
          audio.currentTime /
          audio.duration
        ) * 100;

      $('#progress').value =
        percentage;

      setText(
        '#currentTime',
        formatTime(
          audio.currentTime
        )
      );

      setText(
        '#duration',
        formatTime(
          audio.duration
        )
      );
    }
  );


  audio.addEventListener(
    'ended',
    async () => {

      if (
        repeatMode === 'one'
      ) {
        audio.currentTime =
          0;

        await audio.play();

        return;
      }

      await nextTrack();
    }
  );
}


/* =========================================================
   KEYBOARD
   ========================================================= */

function setupKeyboard() {
  document.addEventListener(
    'keydown',
    (event) => {

      const tag =
        document.activeElement
          ?.tagName;

      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT'
      ) {
        return;
      }

      if (
        event.code ===
        'Space'
      ) {
        event.preventDefault();

        togglePlayback();
      }

      if (
        event.key ===
        'ArrowRight'
      ) {
        nextTrack();
      }

      if (
        event.key ===
        'ArrowLeft'
      ) {
        previousTrack();
      }

      if (
        event.key ===
        'Escape'
      ) {
        closeModals();
      }
    }
  );
}


/* =========================================================
   RENDER CURRENT PAGE
   ========================================================= */

function renderCurrentPage() {
  switchPage(
    currentPage
  );
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function init() {

  console.log(
    'Frequency initializing...'
  );


  if (!supabaseReady) {

    console.warn(
      'Frequency: Supabase publishable key is missing or invalid.'
    );

    $('#authStatus').textContent =
      'Add your current Supabase sb_publishable_ key to app.js.';

  } else {

    console.log(
      'Frequency: Supabase configured.'
    );
  }


  setupAuth();

  setupEvents();

  setupModals();

  setupAudio();

  setupKeyboard();

  setupCarouselGestures();


  if (sb) {

    currentUser =
      await getUser();

    if (currentUser) {

      await showApp();

    } else {

      $('#authView')
        .classList.remove(
          'hidden'
        );

      $('#appView')
        .classList.add(
          'hidden'
        );
    }

    setupAuthListener();

  } else {

    $('#authView')
      .classList.remove(
        'hidden'
      );

    $('#appView')
      .classList.add(
        'hidden'
      );
  }


  setView(
    viewMode
  );


  console.log(
    'Frequency ready.'
  );
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  'loading'
) {

  document.addEventListener(
    'DOMContentLoaded',
    init
  );

} else {

  init();
}
