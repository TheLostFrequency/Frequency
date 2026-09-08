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


/* =========================================================
   AUTH STORAGE
   ========================================================= */

const authStorage = {
  getItem(key) {
    const remember =
      localStorage.getItem(
        'frequency-keep-logged-in'
      ) !== 'false';

    return remember
      ? localStorage.getItem(key)
      : sessionStorage.getItem(key);
  },

  setItem(key, value) {
    const remember =
      localStorage.getItem(
        'frequency-keep-logged-in'
      ) !== 'false';

    if (remember) {
      localStorage.setItem(
        key,
        value
      );

      sessionStorage.removeItem(
        key
      );
    } else {
      sessionStorage.setItem(
        key,
        value
      );

      localStorage.removeItem(
        key
      );
    }
  },

  removeItem(key) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
};


const sb = supabaseReady
  ? supabase.createClient(
      SUPABASE_URL,
      SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: authStorage
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
  Array.from(
    document.querySelectorAll(selector)
  );

const audio = $('#audio');


/* =========================================================
   STATE
   ========================================================= */

let currentUser = null;

let tracks = [];
let playlists = [];

let currentTrackIndex = -1;

let viewMode =
  localStorage.getItem(
    'frequency-view'
  ) || 'collection';

let shuffled = false;

let repeatMode = 'off';

let currentPage = 'library';

let carouselIndex = 0;

let carouselDragging = false;
let carouselStartX = 0;

let searchRenderToken = 0;
let libraryLoadToken = 0;

let carouselRenderToken = 0;


/* =========================================================
   URL CACHE
   ========================================================= */

const coverUrlCache = new Map();
const audioUrlCache = new Map();

const URL_CACHE_TIME =
  55 * 60 * 1000;

function getCachedUrl(
  cache,
  key
) {
  const cached =
    cache.get(key);

  if (!cached) {
    return null;
  }

  if (
    Date.now() >
    cached.expiresAt
  ) {
    cache.delete(key);
    return null;
  }

  return cached.url;
}


function setCachedUrl(
  cache,
  key,
  url
) {
  cache.set(
    key,
    {
      url,
      expiresAt:
        Date.now() +
        URL_CACHE_TIME
    }
  );
}


function clearTrackUrlCache(track) {
  if (!track) {
    return;
  }

  if (track.id) {
    coverUrlCache.delete(
      track.id
    );

    audioUrlCache.delete(
      track.id
    );
  }

  if (track.cover_path) {
    coverUrlCache.delete(
      `covers:${track.cover_path}`
    );
  }

  if (track.audio_path) {
    audioUrlCache.delete(
      `audio:${track.audio_path}`
    );
  }
}


/* =========================================================
   TOAST
   ========================================================= */

function toast(message) {
  const element =
    $('#toast');

  if (!element) {
    console.log(message);
    return;
  }

  element.textContent =
    message;

  element.classList.add(
    'show'
  );

  clearTimeout(
    toast.timeout
  );

  toast.timeout =
    setTimeout(
      () => {
        element.classList.remove(
          'show'
        );
      },
      3000
    );
}


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(
    value ?? ''
  )
    .replace(
      /&/g,
      '&amp;'
    )
    .replace(
      /</g,
      '&lt;'
    )
    .replace(
      />/g,
      '&gt;'
    )
    .replace(
      /"/g,
      '&quot;'
    )
    .replace(
      /'/g,
      '&#039;'
    );
}


function escapeAttribute(value) {
  return escapeHtml(value)
    .replace(
      /`/g,
      '&#096;'
    );
}


function setText(
  selector,
  value
) {
  const element =
    $(selector);

  if (element) {
    element.textContent =
      value ?? '';
  }
}


function formatTime(seconds) {
  if (
    !Number.isFinite(
      Number(seconds)
    ) ||
    Number(seconds) < 0
  ) {
    return '0:00';
  }

  const total =
    Math.floor(
      Number(seconds)
    );

  const minutes =
    Math.floor(
      total / 60
    );

  const secondsPart =
    total % 60;

  return `${minutes}:${String(
    secondsPart
  ).padStart(
    2,
    '0'
  )}`;
}


function formatCount(
  count,
  singular
) {
  return `${count} ${
    count === 1
      ? singular
      : singular + 's'
  }`;
}


function safeFileName(name) {
  return String(
    name || 'file'
  )
    .replace(
      /[^a-zA-Z0-9._-]/g,
      '_'
    );
}


function getTrackDisplayTitle(
  track
) {
  return (
    track?.title ||
    'Untitled'
  );
}


function getTrackDisplayArtist(
  track
) {
  return (
    track?.artist ||
    'Unknown artist'
  );
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

  return (
    data?.user ||
    null
  );
}


function getKeepLoggedInPreference() {
  const checkbox =
    $('#keepLoggedIn');

  if (!checkbox) {
    return true;
  }

  return checkbox.checked;
}


function saveKeepLoggedInPreference() {
  const remember =
    getKeepLoggedInPreference();

  localStorage.setItem(
    'frequency-keep-logged-in',
    remember
      ? 'true'
      : 'false'
  );
}


async function signIn(
  email,
  password
) {
  if (!sb) {
    $('#authStatus').textContent =
      'Supabase is not configured.';

    return;
  }

  const status =
    $('#authStatus');

  const button =
    $('#authSubmit');

  saveKeepLoggedInPreference();

  status.textContent =
    'Signing in...';

  button.disabled = true;

  try {
    const {
      data,
      error
    } =
      await sb.auth.signInWithPassword({
        email,
        password
      });

    if (error) {
      throw error;
    }

    currentUser =
      data?.user ||
      null;

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


async function signUp(
  email,
  password
) {
  if (!sb) {
    $('#authStatus').textContent =
      'Supabase is not configured.';

    return;
  }

  const status =
    $('#authStatus');

  const button =
    $('#authSubmit');

  saveKeepLoggedInPreference();

  status.textContent =
    'Creating account...';

  button.disabled = true;

  try {
    const {
      data,
      error
    } =
      await sb.auth.signUp({
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

    if (data?.session) {
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
  } =
    await sb.auth.signOut();

  if (error) {
    console.error(
      'Sign out error:',
      error
    );

    toast(
      error.message
    );

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

  $('#appView')
    ?.classList.add(
      'hidden'
    );

  $('#authView')
    ?.classList.remove(
      'hidden'
    );

  if ($('#authEmail')) {
    $('#authEmail').value =
      '';
  }

  if ($('#authPassword')) {
    $('#authPassword').value =
      '';
  }

  if ($('#authStatus')) {
    $('#authStatus').textContent =
      '';
  }

  toast(
    'Signed out.'
  );
}


async function showApp() {
  $('#authView')
    ?.classList.add(
      'hidden'
    );

  $('#appView')
    ?.classList.remove(
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

  const keepLoggedIn =
    $('#keepLoggedIn');

  if (
    keepLoggedIn
  ) {
    const saved =
      localStorage.getItem(
        'frequency-keep-logged-in'
      );

    if (
      saved === 'false'
    ) {
      keepLoggedIn.checked =
        false;
    }
  }

  if (!form || !toggle) {
    return;
  }

  let mode = 'login';

  form.addEventListener(
    'submit',
    async (event) => {
      event.preventDefault();

      const email =
        $('#authEmail')
          ?.value.trim();

      const password =
        $('#authPassword')
          ?.value;

      if (!email || !password) {
        $('#authStatus').textContent =
          'Enter your email and password.';

        return;
      }

      if (
        password.length < 6
      ) {
        $('#authStatus').textContent =
          'Password must be at least 6 characters.';

        return;
      }

      saveKeepLoggedInPreference();

      if (
        mode === 'login'
      ) {
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

      if (
        mode === 'signup'
      ) {
        $('#authSubmit').textContent =
          'Create account';

        toggle.textContent =
          'Already have an account? Sign in';

        $('#authPassword')
          ?.setAttribute(
            'autocomplete',
            'new-password'
          );

      } else {
        $('#authSubmit').textContent =
          'Sign in';

        toggle.textContent =
          'Need an account? Sign up';

        $('#authPassword')
          ?.setAttribute(
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
    async (
      event,
      session
    ) => {

      currentUser =
        session?.user ||
        null;

      if (
        currentUser
      ) {

        $('#authView')
          ?.classList.add(
            'hidden'
          );

        $('#appView')
          ?.classList.remove(
            'hidden'
          );

        /*
         * Don't reload the entire library
         * on token refreshes.
         */

        if (
          event ===
            'SIGNED_IN' ||
          event ===
            'INITIAL_SESSION'
        ) {
          await loadLibrary();

          renderCurrentPage();
        }

      } else {

        tracks = [];

        playlists = [];

        currentTrackIndex = -1;

        $('#authView')
          ?.classList.remove(
            'hidden'
          );

        $('#appView')
          ?.classList.add(
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
  if (
    !sb ||
    !currentUser
  ) {
    tracks = [];
    return;
  }

  const {
    data,
    error
  } =
    await sb
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

  tracks =
    data || [];

  if (
    carouselIndex >=
    tracks.length
  ) {
    carouselIndex =
      Math.max(
        0,
        tracks.length - 1
      );
  }

  if (
    currentTrackIndex >=
    tracks.length
  ) {
    currentTrackIndex =
      -1;
  }
}


async function loadPlaylists() {
  if (
    !sb ||
    !currentUser
  ) {
    playlists = [];
    return;
  }

  const {
    data,
    error
  } =
    await sb
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

  playlists =
    data || [];
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

  if (
    token !==
    libraryLoadToken
  ) {
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
  if (
    !sb ||
    !path
  ) {
    return null;
  }

  const cacheKey =
    `${bucket}:${path}`;

  const cached =
    getCachedUrl(
      cache,
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const {
    data,
    error
  } =
    await sb.storage
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
    data?.signedUrl ||
    null;

  if (url) {
    setCachedUrl(
      cache,
      cacheKey,
      url
    );
  }

  return url;
}


async function audioUrl(
  track
) {
  if (
    !track?.audio_path
  ) {
    return null;
  }

  const cacheKey =
    `audio:${track.audio_path}`;

  const cached =
    getCachedUrl(
      audioUrlCache,
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const url =
    await signedUrl(
      'audio',
      track.audio_path,
      audioUrlCache
    );

  return url;
}


async function coverUrl(
  track
) {
  if (
    !track?.cover_path
  ) {
    return null;
  }

  const cacheKey =
    `covers:${track.cover_path}`;

  const cached =
    getCachedUrl(
      coverUrlCache,
      cacheKey
    );

  if (cached) {
    return cached;
  }

  const {
    data,
    error
  } =
    await sb.storage
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
    data?.signedUrl ||
    null;

  if (url) {
    setCachedUrl(
      coverUrlCache,
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
  setText(
    '#trackCount',
    formatCount(
      tracks.length,
      'track'
    )
  );
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function switchPage(
  page
) {
  currentPage =
    page;

  $$('.nav-item')
    .forEach(
      (button) => {
        button.classList.toggle(
          'active',
          button.dataset.page ===
            page
        );
      }
    );

  $$('.page')
    .forEach(
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
    transmissions:
      'Transmissions',
    home: 'Home'
  };

  setText(
    '#pageTitle',
    titles[page] ||
      'Library'
  );

  if (
    page ===
    'library'
  ) {
    renderLibrary();
  }

  if (
    page ===
    'search'
  ) {
    renderSearch(
      $('#searchInput')
        ?.value || ''
    );
  }

  if (
    page ===
    'albums'
  ) {
    renderAlbums();
  }

  if (
    page ===
    'playlists'
  ) {
    renderPlaylists();
  }
}


/* =========================================================
   VIEW MODE
   ========================================================= */

function setView(
  mode
) {
  viewMode =
    mode;

  localStorage.setItem(
    'frequency-view',
    mode
  );

  $('#viewCollection')
    ?.classList.toggle(
      'active',
      mode ===
        'collection'
    );

  $('#viewList')
    ?.classList.toggle(
      'active',
      mode ===
        'list'
    );

  renderLibrary();
}


/* =========================================================
   EMPTY LIBRARY
   ========================================================= */

function renderEmptyLibrary() {
  $('#emptyLibrary')
    ?.classList.remove(
      'hidden'
    );

  $('#collectionView')
    ?.classList.add(
      'hidden'
    );

  $('#listView')
    ?.classList.add(
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

  $('#emptyLibrary')
    ?.classList.add(
      'hidden'
    );

  if (
    viewMode ===
    'collection'
  ) {

    $('#collectionView')
      ?.classList.remove(
        'hidden'
      );

    $('#listView')
      ?.classList.add(
        'hidden'
      );

    await renderCarousel();

  } else {

    $('#collectionView')
      ?.classList.add(
        'hidden'
      );

    $('#listView')
      ?.classList.remove(
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
    carousel.innerHTML =
      '';

    return;
  }

  if (
    carouselIndex < 0 ||
    carouselIndex >=
      tracks.length
  ) {
    carouselIndex = 0;
  }

  const token =
    ++carouselRenderToken;

  const existing =
    $$('.carousel-card');

  /*
   * Only create DOM cards when the
   * track count changes.
   */

  if (
    existing.length !==
    tracks.length
  ) {

    carousel.innerHTML =
      '';

    const fragment =
      document.createDocumentFragment();

    tracks.forEach(
      (
        track,
        index
      ) => {

        const card =
          document.createElement(
            'div'
          );

        card.className =
          'carousel-card';

        card.dataset.index =
          index;

        card.innerHTML = `
          <div class="carousel-placeholder">
            ${escapeHtml(
              (
                track.title ||
                'F'
              )
                .charAt(0)
                .toUpperCase()
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

    await hydrateCarouselArtwork(
      token
    );
  }

  updateCarouselPosition();
}


async function hydrateCarouselArtwork(
  token
) {
  const items =
    $$('.carousel-card');

  await Promise.all(
    items.map(
      async (
        card
      ) => {

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
          await coverUrl(
            track
          );

        if (
          token !==
          carouselRenderToken
        ) {
          return;
        }

        if (
          !card.isConnected
        ) {
          return;
        }

        if (cover) {

          card.innerHTML = `
            <img
              src="${escapeAttribute(
                cover
              )}"
              alt="${escapeAttribute(
                getTrackDisplayTitle(
                  track
                )
              )}"
              draggable="false"
            >
          `;

        } else {

          card.innerHTML = `
            <div class="carousel-placeholder">
              ${escapeHtml(
                getTrackDisplayTitle(
                  track
                )
                  .charAt(0)
                  .toUpperCase()
              )}
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
    (
      item,
      index
    ) => {

      let offset =
        index -
        carouselIndex;

      const total =
        items.length;

      if (
        offset >
        total / 2
      ) {
        offset -=
          total;
      }

      if (
        offset <
        -total / 2
      ) {
        offset +=
          total;
      }

      const distance =
        Math.abs(
          offset
        );

      const x =
        offset * 235;

      const scale =
        Math.max(
          0.58,
          1 -
            distance *
              0.12
        );

      const opacity =
        Math.max(
          0.28,
          1 -
            distance *
              0.2
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
    tracks[
      carouselIndex
    ];

  if (!active) {
    return;
  }

  setText(
    '#activeArtist',
    getTrackDisplayArtist(
      active
    )
  );

  setText(
    '#activeTitle',
    getTrackDisplayTitle(
      active
    )
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
      carouselIndex +
      1
    ) %
    tracks.length;

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
    ) %
    tracks.length;

  updateCarouselPosition();
}


/* =========================================================
   CAROUSEL GESTURES
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

      carouselDragging =
        true;

      carouselStartX =
        event.clientX;

      carousel.setPointerCapture?.(
        event.pointerId
      );
    }
  );


  carousel.addEventListener(
    'pointerup',
    (event) => {

      if (
        !carouselDragging
      ) {
        return;
      }

      carouselDragging =
        false;

      const distance =
        event.clientX -
        carouselStartX;

      if (
        Math.abs(
          distance
        ) < 40
      ) {
        return;
      }

      if (
        distance < 0
      ) {
        carouselNext();
      } else {
        carouselPrevious();
      }
    }
  );


  carousel.addEventListener(
    'pointercancel',
    () => {
      carouselDragging =
        false;
    }
  );


  carousel.addEventListener(
    'wheel',
    (event) => {

      event.preventDefault();

      if (
        Math.abs(
          event.deltaY
        ) < 5 &&
        Math.abs(
          event.deltaX
        ) < 5
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

  container.innerHTML =
    '';

  for (
    let index = 0;
    index <
      tracks.length;
    index++
  ) {

    const track =
      tracks[index];

    const cover =
      await coverUrl(
        track
      );

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
          getTrackDisplayTitle(
            track
          )
        )}"
      >
        ${
          cover
            ? `
              <img
                class="track-art"
                src="${escapeAttribute(
                  cover
                )}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="track-art list-placeholder">
                ${escapeHtml(
                  getTrackDisplayTitle(
                    track
                  )
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>
            `
        }
      </button>

      <div class="track-info">
        <strong>
          ${escapeHtml(
            getTrackDisplayTitle(
              track
            )
          )}
        </strong>

        <span>
          ${escapeHtml(
            getTrackDisplayArtist(
              track
            )
          )}
        </span>

        ${
          track.album
            ? `
              <small>
                ${escapeHtml(
                  track.album
                )}
              </small>
            `
            : ''
        }
      </div>

      <div class="row-actions">
        <button
          class="small-btn"
          data-list-play="${index}"
          type="button"
        >
          Play
        </button>

        <button
          class="small-btn"
          data-edit-track="${index}"
          type="button"
        >
          Edit
        </button>

        <button
          class="small-btn"
          data-delete-track="${index}"
          type="button"
        >
          Delete
        </button>
      </div>
    `;

    container.appendChild(
      row
    );
  }


  $$('.track-art-button')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            playTrack(
              Number(
                button.dataset
                  .listIndex
              )
            );
          }
        );
      }
    );


  $$('[data-list-play]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            playTrack(
              Number(
                button.dataset
                  .listPlay
              )
            );
          }
        );
      }
    );


  $$('[data-edit-track]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          (event) => {
            event.stopPropagation();

            editTrack(
              Number(
                button.dataset
                  .editTrack
              )
            );
          }
        );
      }
    );


  $$('[data-delete-track]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          (event) => {
            event.stopPropagation();

            deleteTrack(
              Number(
                button.dataset
                  .deleteTrack
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

async function editTrack(
  index
) {
  if (
    !sb ||
    !currentUser
  ) {
    toast(
      'Please sign in first.'
    );

    return;
  }

  const track =
    tracks[index];

  if (!track) {
    toast(
      'Track not found.'
    );

    return;
  }


  const title =
    window.prompt(
      'Song title:',
      track.title || ''
    );

  if (
    title === null
  ) {
    return;
  }


  const artist =
    window.prompt(
      'Artist:',
      track.artist || ''
    );

  if (
    artist === null
  ) {
    return;
  }


  const album =
    window.prompt(
      'Album:',
      track.album || ''
    );

  if (
    album === null
  ) {
    return;
  }


  const genre =
    window.prompt(
      'Genre:',
      track.genre || ''
    );

  if (
    genre === null
  ) {
    return;
  }


  const yearInput =
    window.prompt(
      'Year:',
      track.year ?? ''
    );

  if (
    yearInput === null
  ) {
    return;
  }


  const cleanedTitle =
    title.trim() ||
    'Untitled';

  const cleanedArtist =
    artist.trim() ||
    'Unknown artist';

  const cleanedAlbum =
    album.trim() ||
    null;

  const cleanedGenre =
    genre.trim() ||
    null;


  let cleanedYear =
    null;

  if (
    yearInput.trim()
  ) {

    cleanedYear =
      Number(
        yearInput.trim()
      );

    if (
      !Number.isInteger(
        cleanedYear
      ) ||
      cleanedYear < 0 ||
      cleanedYear > 9999
    ) {

      toast(
        'Year must be a valid number.'
      );

      return;
    }
  }


  try {

    toast(
      'Saving changes...'
    );


    const {
      data,
      error
    } =
      await sb
        .from('tracks')
        .update({
          title:
            cleanedTitle,

          artist:
            cleanedArtist,

          album:
            cleanedAlbum,

          genre:
            cleanedGenre,

          year:
            cleanedYear
        })
        .eq(
          'id',
          track.id
        )
        .eq(
          'user_id',
          currentUser.id
        )
        .select()
        .single();


    if (error) {

      console.error(
        'Supabase edit error:',
        error
      );

      throw error;
    }


    /*
     * This catches a very common
     * RLS/update-policy problem.
     */

    if (!data) {
      throw new Error(
        'The song was not updated. Your Supabase tracks table may need an UPDATE policy.'
      );
    }


    /*
     * Update the local track immediately.
     */

    tracks[index] = {
      ...tracks[index],
      ...data
    };


    /*
     * Update active carousel information.
     */

    if (
      carouselIndex ===
      index
    ) {

      setText(
        '#activeArtist',
        data.artist ||
          'Unknown artist'
      );

      setText(
        '#activeTitle',
        data.title ||
          'Untitled'
      );

      setText(
        '#activeAlbum',
        data.album ||
          'Single'
      );
    }


    /*
     * Update player if this song
     * is currently playing.
     */

    if (
      currentTrackIndex ===
      index
    ) {

      setText(
        '#playerTitle',
        data.title ||
          'Untitled'
      );

      setText(
        '#playerArtist',
        data.artist ||
          'Unknown artist'
      );
    }


    /*
     * Re-render the current page.
     */

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

async function deleteTrack(
  index
) {
  if (
    !sb ||
    !currentUser
  ) {
    return;
  }

  const track =
    tracks[index];

  if (!track) {
    return;
  }


  const confirmed =
    window.confirm(
      `Delete "${getTrackDisplayTitle(
        track
      )}" from Frequency?\n\nThis removes the song from your Library and deletes its stored files.`
    );

  if (!confirmed) {
    return;
  }


  try {

    /*
     * Stop playback if deleting
     * the current song.
     */

    if (
      currentTrackIndex ===
      index
    ) {

      stopAudio();

      currentTrackIndex =
        -1;
    }


    toast(
      'Deleting track...'
    );


    /*
     * Remove database record.
     */

    const {
      error:
        databaseError
    } =
      await sb
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


    if (
      databaseError
    ) {
      throw databaseError;
    }


    /*
     * Remove audio.
     */

    if (
      track.audio_path
    ) {

      const {
        error
      } =
        await sb.storage
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

    if (
      track.cover_path
    ) {

      const {
        error
      } =
        await sb.storage
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
      track
    );


    /*
     * If we deleted the currently
     * selected track, reset the index.
     */

    if (
      currentTrackIndex ===
      index
    ) {
      currentTrackIndex =
        -1;
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
          .includes(
            search
          );
      }
    );


  container.innerHTML =
    '';


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
      token !==
      searchRenderToken
    ) {
      return;
    }


    const originalIndex =
      tracks.findIndex(
        (item) =>
          item.id ===
          track.id
      );


    const cover =
      await coverUrl(
        track
      );


    if (
      token !==
      searchRenderToken
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
        type="button"
      >
        ${
          cover
            ? `
              <img
                class="track-art"
                src="${escapeAttribute(
                  cover
                )}"
                alt=""
                draggable="false"
              >
            `
            : `
              <div class="track-art list-placeholder">
                ${escapeHtml(
                  getTrackDisplayTitle(
                    track
                  )
                    .charAt(0)
                    .toUpperCase()
                )}
              </div>
            `
        }
      </button>

      <div class="track-info">
        <strong>
          ${escapeHtml(
            getTrackDisplayTitle(
              track
            )
          )}
        </strong>

        <span>
          ${escapeHtml(
            getTrackDisplayArtist(
              track
            )
          )}
        </span>

        ${
          track.album
            ? `
              <small>
                ${escapeHtml(
                  track.album
                )}
              </small>
            `
            : ''
        }
      </div>

      <div class="row-actions">

        <button
          class="small-btn"
          data-search-play="${originalIndex}"
          type="button"
        >
          Play
        </button>

        <button
          class="small-btn"
          data-search-edit="${originalIndex}"
          type="button"
        >
          Edit
        </button>

        <button
          class="small-btn"
          data-search-delete="${originalIndex}"
          type="button"
        >
          Delete
        </button>

      </div>
    `;


    container.appendChild(
      row
    );
  }


  $$('[data-search-index]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            playTrack(
              Number(
                button.dataset
                  .searchIndex
              )
            );
          }
        );
      }
    );


  $$('[data-search-play]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            playTrack(
              Number(
                button.dataset
                  .searchPlay
              )
            );
          }
        );
      }
    );


  $$('[data-search-edit]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            editTrack(
              Number(
                button.dataset
                  .searchEdit
              )
            );
          }
        );
      }
    );


  $$('[data-search-delete]')
    .forEach(
      (button) => {
        button.addEventListener(
          'click',
          () => {
            deleteTrack(
              Number(
                button.dataset
                  .searchDelete
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

  grid.innerHTML =
    '';


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

      if (
        !albumMap.has(
          album
        )
      ) {
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
                src="${escapeAttribute(
                  cover
                )}"
                alt="${escapeAttribute(
                  albumName
                )}"
              >
            `
            : `
              <div class="album-placeholder">
                ${escapeHtml(
                  albumName
                    .charAt(0)
                    .toUpperCase()
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
          firstIndex !==
          -1
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

  grid.innerHTML =
    '';


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
            coverUrlCache
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
                src="${escapeAttribute(
                  cover
                )}"
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

async function playTrack(
  index
) {
  if (
    index < 0 ||
    index >=
      tracks.length
  ) {
    return;
  }

  const track =
    tracks[index];


  const url =
    await audioUrl(
      track
    );


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
    index >=
      tracks.length
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
    getTrackDisplayTitle(
      track
    )
  );


  setText(
    '#playerArtist',
    getTrackDisplayArtist(
      track
    )
  );


  const cover =
    await coverUrl(
      track
    );


  const playerCover =
    $('#playerCover');


  if (!playerCover) {
    return;
  }


  if (cover) {

    playerCover.innerHTML = `
      <img
        src="${escapeAttribute(
          cover
        )}"
        alt=""
        draggable="false"
      >
    `;

  } else {

    playerCover.textContent =
      getTrackDisplayTitle(
        track
      )
        .charAt(0)
        .toUpperCase();
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


  if (
    audio.paused
  ) {
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
    audio.currentTime =
      0;
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
    progress.value =
      0;
  }

  updatePlayButton();
}


async function nextTrack() {
  if (!tracks.length) {
    return;
  }


  let nextIndex;


  if (shuffled) {

    if (
      tracks.length ===
      1
    ) {

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
      currentTrackIndex +
      1;


    if (
      currentTrackIndex ===
      -1
    ) {
      nextIndex = 0;
    }


    if (
      nextIndex >=
      tracks.length
    ) {

      if (
        repeatMode ===
        'all'
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
    audio.currentTime >
    3
  ) {

    audio.currentTime =
      0;

    return;
  }


  let previousIndex =
    currentTrackIndex -
    1;


  if (
    currentTrackIndex ===
    -1
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

function getAudioDuration(
  file
) {
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


      temp.onerror =
        () => {

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
    $('#trackFile')
      ?.files[0];

  const coverFile =
    $('#coverFile')
      ?.files[0];

  const title =
    $('#trackTitle')
      ?.value.trim();

  const artist =
    $('#trackArtist')
      ?.value.trim();

  const album =
    $('#trackAlbum')
      ?.value.trim();

  const genre =
    $('#trackGenre')
      ?.value.trim();

  const yearValue =
    $('#trackYear')
      ?.value.trim();

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
      error:
        audioError
    } =
      await sb.storage
        .from('audio')
        .upload(
          audioPath,
          audioFile,
          {
            cacheControl:
              '3600',
            upsert:
              false,
            contentType:
              audioFile.type ||
              'audio/mpeg'
          }
        );


    if (
      audioError
    ) {
      throw audioError;
    }


    uploadedAudioPath =
      audioPath;


    let coverPath =
      null;


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
        error:
          coverError
      } =
        await sb.storage
          .from('covers')
          .upload(
            coverPath,
            coverFile,
            {
              cacheControl:
                '3600',
              upsert:
                false,
              contentType:
                coverFile.type ||
                'image/jpeg'
            }
          );


      if (
        coverError
      ) {
        throw coverError;
      }


      uploadedCoverPath =
        coverPath;
    }


    status.textContent =
      'Adding track to Frequency...';


    let year =
      yearValue
        ? Number(
            yearValue
          )
        : null;


    if (
      year !== null &&
      (
        !Number.isInteger(
          year
        ) ||
        year < 0 ||
        year > 9999
      )
    ) {
      year = null;
    }


    const {
      error:
        databaseError
    } =
      await sb
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

          year,

          duration,

          audio_path:
            audioPath,

          cover_path:
            coverPath
        });


    if (
      databaseError
    ) {
      throw databaseError;
    }


    $('#uploadForm')
      ?.reset();


    $('#uploadModal')
      ?.classList.add(
        'hidden'
      );


    status.textContent =
      '';


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
     * Clean up anything that was
     * successfully uploaded before
     * the failure happened.
     */

    if (
      uploadedCoverPath
    ) {

      await sb.storage
        .from('covers')
        .remove([
          uploadedCoverPath
        ]);
    }


    if (
      uploadedAudioPath
    ) {

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

    let coverPath =
      null;


    if (coverFile) {

      const coverName =
        safeFileName(
          coverFile.name
        );


      coverPath =
        `${currentUser.id}/playlists/${crypto.randomUUID()}-${coverName}`;


      const {
        error
      } =
        await sb.storage
          .from('covers')
          .upload(
            coverPath,
            coverFile,
            {
              cacheControl:
                '3600',
              upsert:
                false,
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
    } =
      await sb
        .from('playlists')
        .insert({
          user_id:
            currentUser.id,

          name,

          description:
            description ||
            null,

          cover_path:
            coverPath
        });


    if (error) {
      throw error;
    }


    $('#playlistForm')
      ?.reset();


    $('#playlistModal')
      ?.classList.add(
        'hidden'
      );


    status.textContent =
      '';


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


    if (
      uploadedCoverPath
    ) {

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
  $$('.modal')
    .forEach(
      (modal) => {
        modal.classList.add(
          'hidden'
        );
      }
    );
}


function setupModals() {

  $$('[data-close]')
    .forEach(
      (button) => {

        button.addEventListener(
          'click',
          () => {

            const id =
              button.dataset.close;

            $(`#${id}`)
              ?.classList.add(
                'hidden'
              );
          }
        );
      }
    );


  $$('.modal')
    .forEach(
      (modal) => {

        modal.addEventListener(
          'click',
          (event) => {

            if (
              event.target ===
              modal
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

  $$('.nav-item')
    .forEach(
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
          ?.classList.toggle(
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
          repeatMode ===
          'off'
        ) {

          repeatMode =
            'all';

        } else if (
          repeatMode ===
          'all'
        ) {

          repeatMode =
            'one';

        } else {

          repeatMode =
            'off';
        }


        $('#repeatBtn')
          ?.classList.toggle(
            'active',
            repeatMode !==
              'off'
          );


        const messages = {
          off:
            'Repeat off',

          all:
            'Repeat all',

          one:
            'Repeat one'
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
            ) /
            100
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


  /* Keep logged in */

  $('#keepLoggedIn')
    ?.addEventListener(
      'change',
      () => {
        saveKeepLoggedInPreference();
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


  audio.volume =
    0.8;


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
        ) *
        100;


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
        repeatMode ===
        'one'
      ) {

        audio.currentTime =
          0;

        await audio.play();

        return;
      }


      await nextTrack();
    }
  );


  audio.addEventListener(
    'error',
    () => {

      console.error(
        'Audio element error:',
        audio.error
      );

      toast(
        'There was a problem playing this track.'
      );
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


      /* Escape */

      if (
        event.key ===
        'Escape'
      ) {

        closeModals();

        return;
      }


      /* Space */

      if (
        event.code ===
        'Space'
      ) {

        event.preventDefault();

        togglePlayback();

        return;
      }


      /* Right */

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


      /* Left */

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


  /*
   * Set the saved view without
   * losing the current library.
   */

  $('#viewCollection')
    ?.classList.toggle(
      'active',
      viewMode ===
        'collection'
    );

  $('#viewList')
    ?.classList.toggle(
      'active',
      viewMode ===
        'list'
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
