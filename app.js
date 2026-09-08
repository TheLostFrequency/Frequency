/* =========================================================
   FREQUENCY
   Personal Music Vault
   V2 CORE
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
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
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

let carouselDragging = false;
let carouselStartX = 0;
let carouselCurrentX = 0;

let searchRenderToken = 0;
let libraryLoadToken = 0;


/* =========================================================
   URL CACHE
   ========================================================= */

const coverUrlCache = new Map();
const audioUrlCache = new Map();

function clearTrackUrlCache(trackId) {
  if (!trackId) {
    return;
  }

  coverUrlCache.delete(trackId);
  audioUrlCache.delete(trackId);
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  const element = $('#toast');

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent = message;
  element.classList.add('show');

  clearTimeout(toast.timeout);

  toast.timeout = setTimeout(() => {
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

  const total = Math.floor(Number(seconds));

  const minutes = Math.floor(total / 60);

  const secondsPart = total % 60;

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


function safeFileName(name) {
  return String(name || 'file')
    .replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
}


function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(/`/g, '&#096;');
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

    toast(
      'Welcome back to Frequency.'
    );

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
      password,
      options: {
        emailRedirectTo:
          window.location.origin
      }
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
        'Account created. Check your email to confirm your account.';

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
  carouselIndex = 0;

  coverUrlCache.clear();
  audioUrlCache.clear();

  stopAudio();

  $('#appView')?.classList.add(
    'hidden'
  );

  $('#authView')?.classList.remove(
    'hidden'
  );

  if ($('#authEmail')) {
    $('#authEmail').value = '';
  }

  if ($('#authPassword')) {
    $('#authPassword').value = '';
  }

  if ($('#authStatus')) {
    $('#authStatus').textContent = '';
  }

  toast('Signed out.');
}


async function showApp() {
  $('#authView')?.classList.add(
    'hidden'
  );

  $('#appView')?.classList.remove(
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

  if (!form || !toggle) {
    return;
  }

  let mode = 'login';

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const email =
        $('#authEmail')?.value.trim();

      const password =
        $('#authPassword')?.value;

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
        $('#authView')?.classList.add(
          'hidden'
        );

        $('#appView')?.classList.remove(
          'hidden'
        );

        await loadLibrary();

        renderCurrentPage();

      } else {
        $('#authView')?.classList.remove(
          'hidden'
        );

        $('#appView')?.classList.add(
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

    toast(
      'Could not load your music.'
    );

    return;
  }

  tracks = data || [];

  if (carouselIndex >= tracks.length) {
    carouselIndex =
      Math.max(
        0,
        tracks.length - 1
      );
  }
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

  const token =
    ++libraryLoadToken;

  await Promise.all([
    loadTracks(),
    loadPlaylists()
  ]);

  if (token !== libraryLoadToken) {
    return;
  }

  updateCounts();
}


/* =========================================================
   STORAGE
   ========================================================= */

async function signedUrl(
  bucket,
  path,
  cache
) {
  if (!sb || !path) {
    return null;
  }

  const cacheKey =
    `${bucket}:${path}`;

  if (cache.has(cacheKey)) {
    return cache.get(cacheKey);
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

  const url =
    data?.signedUrl || null;

  if (url) {
    cache.set(
      cacheKey,
      url
    );
  }

  return url;
}


async function audioUrl(track) {
  if (!track?.audio_path) {
    return null;
  }

  const cacheKey =
    `audio:${track.audio_path}`;

  if (audioUrlCache.has(cacheKey)) {
    return audioUrlCache.get(
      cacheKey
    );
  }

  const url =
    await signedUrl(
      'audio',
      track.audio_path,
      new Map()
    );

  if (url) {
    audioUrlCache.set(
      cacheKey,
      url
    );
  }

  return url;
}


async function coverUrl(track) {
  if (!track?.cover_path) {
    return null;
  }

  const cacheKey =
    `covers:${track.cover_path}`;

  if (coverUrlCache.has(cacheKey)) {
    return coverUrlCache.get(
      cacheKey
    );
  }

  const {
    data,
    error
  } = await sb.storage
    .from('covers')
    .createSignedUrl(
      track.cover_path,
      60 * 60
    );

  if (error) {
    console.error(
      'Cover URL error:',
      error
    );

    return null;
  }

  const url =
    data?.signedUrl || null;

  if (url) {
    coverUrlCache.set(
      cacheKey,
      url
    );
  }

  return url;
}


/* =========================================================
   COUNTS
   ========================================================= */

function updateCounts() {
  const trackCount =
    tracks.length;

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
    playlists: 'Playlists',
    transmissions: 'Transmissions',
    home: 'Home'
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
  $('#emptyLibrary')?.classList.remove(
    'hidden'
  );

  $('#collectionView')?.classList.add(
    'hidden'
  );

  $('#listView')?.classList.add(
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

  $('#emptyLibrary')?.classList.add(
    'hidden'
  );

  if (viewMode === 'collection') {
    $('#collectionView')?.classList.remove(
      'hidden'
    );

    $('#listView')?.classList.add(
      'hidden'
    );

    await renderCarousel();

  } else {
    $('#collectionView')?.classList.add(
      'hidden'
    );

    $('#listView')?.classList.remove(
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

  if (!tracks.length) {
    carousel.innerHTML = '';
    return;
  }

  if (
    carouselIndex < 0 ||
    carouselIndex >= tracks.length
  ) {
    carouselIndex = 0;
  }

  /*
   * Only build the cards when necessary.
   * Once they're built, movement is handled
   * entirely by updateCarouselPosition().
   */

  const existingItems =
    $$('.carousel-card');

  if (
    existingItems.length !==
    tracks.length
  ) {
    carousel.innerHTML = '';

    const fragment =
      document.createDocumentFragment();

    tracks.forEach(
      (track, index) => {
        const card =
          document.createElement(
            'div'
          );

        card.className =
          'carousel-card';

        card.dataset.index =
          index;

        card.innerHTML = `
          <div class="carousel-loading">
            ${escapeHtml(
              (
                track.title ||
                'F'
              ).charAt(0)
            )}
          </div>
        `;

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

        fragment.appendChild(
          card
        );
      }
    );

    carousel.appendChild(
      fragment
    );

    /*
     * Load artwork without blocking
     * the carousel positioning.
     */

    await hydrateCarouselArtwork();
  }

  updateCarouselPosition();
}


async function hydrateCarouselArtwork() {
  const items =
    $$('.carousel-card');

  await Promise.all(
    items.map(
      async (card) => {
        const index =
          Number(
            card.dataset.index
          );

        const track =
          tracks[index];

        if (!track) {
          return;
        }

        const cover =
          await coverUrl(track);

        if (!card.isConnected) {
          return;
        }

        if (cover) {
          card.innerHTML = `
            <img
              src="${escapeAttribute(cover)}"
              alt="${escapeAttribute(
                track.title ||
                'Frequency artwork'
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
      }
    )
  );
}


function updateCarouselPosition() {
  const items =
    $$('.carousel-card');

  if (!items.length) {
    return;
  }

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
        index === carouselIndex
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

  carousel.addEventListener(
    'pointerdown',
    (event) => {
      if (
        event.pointerType ===
        'mouse' &&
        event.button !== 0
      ) {
        return;
      }

      carouselDragging = true;

      carouselStartX =
        event.clientX;

      carouselCurrentX =
        event.clientX;

      carousel.setPointerCapture?.(
        event.pointerId
      );
    }
  );


  carousel.addEventListener(
    'pointermove',
    (event) => {
      if (!carouselDragging) {
        return;
      }

      carouselCurrentX =
        event.clientX;
    }
  );


  carousel.addEventListener(
    'pointerup',
    (event) => {
      if (!carouselDragging) {
        return;
      }

      carouselDragging = false;

      const distance =
        event.clientX -
        carouselStartX;

      if (
        Math.abs(distance) <
        40
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
      carouselDragging = false;
    }
  );


  carousel.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();

      if (
        Math.abs(event.deltaY) <
        5 &&
        Math.abs(event.deltaX) <
        5
      ) {
        return;
      }

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
        class="track-art-button"
        data-list-index="${index}"
        aria-label="Play ${escapeAttribute(
          track.title ||
          'track'
        )}"
      >
        ${
          cover
            ? `
              <img
                class="track-art"
                src="${escapeAttribute(cover)}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="track-art list-placeholder">
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

      <div class="track-info">
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

      <div class="row-actions">
        <button
          class="small-btn"
          data-list-play="${index}"
        >
          Play
        </button>

        <button
          class="small-btn"
          data-edit-track="${index}"
        >
          Edit
        </button>

        <button
          class="small-btn"
          data-delete-track="${index}"
        >
          Delete
        </button>
      </div>
    `;

    container.appendChild(
      row
    );
  }


  $$('.track-art-button').forEach(
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


  $$('[data-list-play]').forEach(
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


  $$('[data-edit-track]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          editTrack(
            Number(
              button.dataset.editTrack
            )
          );
        }
      );
    }
  );


  $$('[data-delete-track]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          deleteTrack(
            Number(
              button.dataset.deleteTrack
            )
          );
        }
      );
    }
  );
}


/* =========================================================
   EDIT SONG
   ========================================================= */

async function editTrack(index) {
  if (!sb || !currentUser) {
    return;
  }

  const track =
    tracks[index];

  if (!track) {
    return;
  }

  const title =
    window.prompt(
      'Song title:',
      track.title || ''
    );

  if (title === null) {
    return;
  }

  const artist =
    window.prompt(
      'Artist:',
      track.artist || ''
    );

  if (artist === null) {
    return;
  }

  const album =
    window.prompt(
      'Album:',
      track.album || ''
    );

  if (album === null) {
    return;
  }

  const genre =
    window.prompt(
      'Genre:',
      track.genre || ''
    );

  if (genre === null) {
    return;
  }

  const yearInput =
    window.prompt(
      'Year:',
      track.year || ''
    );

  if (yearInput === null) {
    return;
  }

  const year =
    yearInput.trim()
      ? Number(yearInput)
      : null;

  if (
    yearInput.trim() &&
    !Number.isFinite(year)
  ) {
    toast(
      'Year must be a number.'
    );

    return;
  }

  try {
    const {
      error
    } = await sb
      .from('tracks')
      .update({
        title:
          title.trim() ||
          'Untitled',

        artist:
          artist.trim() ||
          'Unknown artist',

        album:
          album.trim() ||
          null,

        genre:
          genre.trim() ||
          null,

        year
      })
      .eq(
        'id',
        track.id
      )
      .eq(
        'user_id',
        currentUser.id
      );

    if (error) {
      throw error;
    }

    await loadLibrary();

    renderCurrentPage();

    toast(
      'Track information updated.'
    );

  } catch (error) {
    console.error(
      'Edit track error:',
      error
    );

    toast(
      error.message ||
      'Could not update track.'
    );
  }
}


/* =========================================================
   DELETE SONG
   ========================================================= */

async function deleteTrack(index) {
  if (!sb || !currentUser) {
    return;
  }

  const track =
    tracks[index];

  if (!track) {
    return;
  }

  const confirmed =
    window.confirm(
      `Delete "${track.title || 'this song'}" from Frequency?\n\nThis will remove the song from your Library.`
    );

  if (!confirmed) {
    return;
  }

  try {
    /*
     * Stop the player first if this is
     * currently playing.
     */

    if (
      currentTrackIndex ===
      index
    ) {
      stopAudio();

      currentTrackIndex =
        -1;
    }


    /*
     * Delete database record first.
     */

    const {
      error: databaseError
    } = await sb
      .from('tracks')
      .delete()
      .eq(
        'id',
        track.id
      )
      .eq(
        'user_id',
        currentUser.id
      );

    if (databaseError) {
      throw databaseError;
    }


    /*
     * Remove audio file.
     */

    if (track.audio_path) {
      const {
        error
      } = await sb.storage
        .from('audio')
        .remove([
          track.audio_path
        ]);

      if (error) {
        console.warn(
          'Audio cleanup warning:',
          error
        );
      }
    }


    /*
     * Remove artwork.
     */

    if (track.cover_path) {
      const {
        error
      } = await sb.storage
        .from('covers')
        .remove([
          track.cover_path
        ]);

      if (error) {
        console.warn(
          'Artwork cleanup warning:',
          error
        );
      }
    }


    clearTrackUrlCache(
      track.id
    );

    if (
      track.audio_path
    ) {
      audioUrlCache.delete(
        `audio:${track.audio_path}`
      );
    }

    if (
      track.cover_path
    ) {
      coverUrlCache.delete(
        `covers:${track.cover_path}`
      );
    }


    await loadLibrary();

    renderCurrentPage();

    toast(
      'Track deleted from Frequency.'
    );

  } catch (error) {
    console.error(
      'Delete track error:',
      error
    );

    toast(
      error.message ||
      'Could not delete track.'
    );
  }
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

  const token =
    ++searchRenderToken;

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
    if (
      token !== searchRenderToken
    ) {
      return;
    }

    const originalIndex =
      tracks.findIndex(
        (item) =>
          item.id === track.id
      );

    const cover =
      await coverUrl(track);

    if (
      token !== searchRenderToken
    ) {
      return;
    }

    const row =
      document.createElement(
        'div'
      );

    row.className =
      'track-row';

    row.innerHTML = `
      <button
        class="track-art-button"
        data-search-index="${originalIndex}"
      >
        ${
          cover
            ? `
              <img
                class="track-art"
                src="${escapeAttribute(cover)}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="track-art list-placeholder">
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

      <div class="track-info">
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

      <div class="row-actions">
        <button
          class="small-btn"
          data-search-play="${originalIndex}"
        >
          Play
        </button>

        <button
          class="small-btn"
          data-search-edit="${originalIndex}"
        >
          Edit
        </button>
      </div>
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


  $$('[data-search-edit]').forEach(
    (button) => {
      button.addEventListener(
        'click',
        () => {
          editTrack(
            Number(
              button.dataset.searchEdit
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
      'grid-card';

    card.innerHTML = `
      <div class="grid-art">
        ${
          cover
            ? `
              <img
                class="grid-art"
                src="${escapeAttribute(cover)}"
                alt="${escapeAttribute(
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
            playlist.cover_path,
            new Map()
          )
        : null;

    const card =
      document.createElement(
        'div'
      );

    card.className =
      'grid-card';

    card.innerHTML = `
      <div class="grid-art">
        ${
          cover
            ? `
              <img
                class="grid-art"
                src="${escapeAttribute(cover)}"
                alt="${escapeAttribute(
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

  updateCarouselForTrack(
    index
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


function updateCarouselForTrack(
  index
) {
  if (
    index < 0 ||
    index >= tracks.length
  ) {
    return;
  }

  carouselIndex =
    index;

  if (
    viewMode ===
    'collection'
  ) {
    updateCarouselPosition();
  }
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
        src="${escapeAttribute(cover)}"
        alt=""
        draggable="false"
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
  if (!audio) {
    return;
  }

  if (!audio.src) {
    if (tracks.length) {
      playTrack(
        carouselIndex >= 0
          ? carouselIndex
          : 0
      );
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

  try {
    audio.currentTime = 0;
  } catch (error) {
    console.warn(error);
  }

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

  const progress =
    $('#progress');

  if (progress) {
    progress.value = 0;
  }

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
      currentTrackIndex === -1
    ) {
      nextIndex = 0;
    }

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
    currentTrackIndex === -1
  ) {
    previousIndex =
      tracks.length - 1;
  }

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
    $('#trackFile')?.files[0];

  const coverFile =
    $('#coverFile')?.files[0];

  const title =
    $('#trackTitle')?.value.trim();

  const artist =
    $('#trackArtist')?.value.trim();

  const album =
    $('#trackAlbum')?.value.trim();

  const genre =
    $('#trackGenre')?.value.trim();

  const yearValue =
    $('#trackYear')?.value.trim();

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
    safeFileName(
      audioFile.name
    );

  const audioPath =
    `${currentUser.id}/${crypto.randomUUID()}-${audioName}`;

  let uploadedAudioPath =
    null;

  let uploadedCoverPath =
    null;

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

    uploadedAudioPath =
      audioPath;


    let coverPath = null;

    if (coverFile) {
      status.textContent =
        'Uploading artwork...';

      const coverName =
        safeFileName(
          coverFile.name
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

      uploadedCoverPath =
        coverPath;
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


    $('#uploadForm')?.reset();

    $('#uploadModal')?.classList.add(
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

    /*
     * IMPORTANT:
     * If something fails after a file was uploaded,
     * clean up the storage so we don't leave
     * orphaned files behind.
     */

    if (uploadedCoverPath) {
      await sb.storage
        .from('covers')
        .remove([
          uploadedCoverPath
        ]);
    }

    if (uploadedAudioPath) {
      await sb.storage
        .from('audio')
        .remove([
          uploadedAudioPath
        ]);
    }

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
    $('#playlistName')
      ?.value.trim();

  const description =
    $('#playlistDescription')
      ?.value.trim();

  const coverFile =
    $('#playlistCover')
      ?.files[0];

  const status =
    $('#playlistStatus');

  if (!name) {
    status.textContent =
      'Enter a playlist name.';

    return;
  }

  status.textContent =
    'Creating playlist...';

  let uploadedCoverPath =
    null;

  try {
    let coverPath = null;

    if (coverFile) {
      const coverName =
        safeFileName(
          coverFile.name
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

      uploadedCoverPath =
        coverPath;
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


    $('#playlistForm')?.reset();

    $('#playlistModal')?.classList.add(
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

    if (uploadedCoverPath) {
      await sb.storage
        .from('covers')
        .remove([
          uploadedCoverPath
        ]);
    }

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
          ?.classList.remove(
            'hidden'
          );
      }
    );


  $('#emptyUploadBtn')
    ?.addEventListener(
      'click',
      () => {
        $('#uploadModal')
          ?.classList.remove(
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
          ?.classList.remove(
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
          !audio ||
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
        if (!audio) {
          return;
        }

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
  if (!audio) {
    return;
  }

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

      const progress =
        $('#progress');

      if (progress) {
        progress.value =
          percentage;
      }

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
    'loadedmetadata',
    () => {
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


      /*
       * Escape closes any open modal.
       */

      if (
        event.key ===
        'Escape'
      ) {
        closeModals();
        return;
      }


      /*
       * Space = play / pause.
       */

      if (
        event.code ===
        'Space'
      ) {
        event.preventDefault();

        togglePlayback();

        return;
      }


      /*
       * When looking at the Collection,
       * arrow keys move through the artwork.
       *
       * Everywhere else, arrows control
       * music playback.
       */

      if (
        event.key ===
        'ArrowRight'
      ) {
        if (
          currentPage ===
            'library' &&
          viewMode ===
            'collection'
        ) {
          event.preventDefault();

          carouselNext();

        } else {
          nextTrack();
        }

        return;
      }


      if (
        event.key ===
        'ArrowLeft'
      ) {
        if (
          currentPage ===
            'library' &&
          viewMode ===
            'collection'
        ) {
          event.preventDefault();

          carouselPrevious();

        } else {
          previousTrack();
        }

        return;
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
    'Frequency V2 initializing...'
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
        ?.classList.remove(
          'hidden'
        );

      $('#appView')
        ?.classList.add(
          'hidden'
        );
    }

    setupAuthListener();

  } else {

    $('#authView')
      ?.classList.remove(
        'hidden'
      );

    $('#appView')
      ?.classList.add(
        'hidden'
      );
  }


  setView(
    viewMode
  );


  console.log(
    'Frequency V2 ready.'
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
