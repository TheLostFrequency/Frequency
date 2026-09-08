/* =========================================================
   FREQUENCY — REAL SUPABASE MUSIC APP
   ========================================================= */

const SUPABASE_URL = 'https://nmiodppvxqpzfrideduv.supabase.co';
const SUPABASE_ANON_KEY = 'Yb_publishable_REPLACE_WITH_YOUR_KEY';

const configured =
  !SUPABASE_URL.startsWith('YOUR_') &&
  !SUPABASE_ANON_KEY.startsWith('YOUR_') &&
  SUPABASE_ANON_KEY.includes('publishable_');

const sb = configured
  ? supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;


/* =========================================================
   GLOBAL STATE
   ========================================================= */

const $ = (selector) => document.querySelector(selector);

const audio = $('#audio');

let tracks = [];
let playlists = [];
let currentIndex = -1;

let shuffle = false;
let repeat = false;

let authMode = 'signin';

let viewMode =
  localStorage.getItem('frequency-view') || 'collection';

let dragStartX = null;
let dragMoved = false;


/* =========================================================
   HELPERS
   ========================================================= */

function toast(message) {
  const t = $('#toast');

  if (!t) return;

  t.textContent = message;
  t.classList.add('show');

  clearTimeout(window.__toast);

  window.__toast = setTimeout(() => {
    t.classList.remove('show');
  }, 2600);
}


function escapeHtml(value = '') {
  return String(value).replace(
    /[&<>'"]/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      })[char]
  );
}


function fmt(seconds) {
  if (!Number.isFinite(seconds)) {
    return '0:00';
  }

  seconds = Math.floor(seconds);

  return `${Math.floor(seconds / 60)}:${String(
    seconds % 60
  ).padStart(2, '0')}`;
}


function placeholder(label = 'F') {
  const letter = escapeHtml(
    String(label).charAt(0).toUpperCase() || 'F'
  );

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
      <rect width="600" height="600" fill="#111216"/>
      <circle
        cx="300"
        cy="300"
        r="220"
        fill="none"
        stroke="#343842"
        stroke-width="2"
      />
      <circle
        cx="300"
        cy="300"
        r="160"
        fill="none"
        stroke="#22242b"
        stroke-width="1"
      />
      <text
        x="50%"
        y="52%"
        text-anchor="middle"
        fill="#f2f3f5"
        font-family="Arial"
        font-size="90"
        font-weight="700"
      >${letter}</text>
    </svg>
  `)}`;
}


/* =========================================================
   SUPABASE STORAGE
   ========================================================= */

async function signed(bucket, path) {
  if (!path || !configured || !sb) {
    return null;
  }

  const { data, error } =
    await sb.storage
      .from(bucket)
      .createSignedUrl(path, 3600);

  if (error) {
    console.error(error);
    return null;
  }

  return data?.signedUrl || null;
}


async function coverFor(track) {
  if (!track?.cover_path) {
    return null;
  }

  return signed('covers', track.cover_path);
}


/* =========================================================
   AUTH
   ========================================================= */

function setAuthVisible(loggedIn) {
  const authView = $('#authView');
  const appView = $('#appView');

  if (authView) {
    authView.classList.toggle('hidden', loggedIn);
  }

  if (appView) {
    appView.classList.toggle('hidden', !loggedIn);
  }
}


function authMessage(message = '') {
  const status = $('#authStatus');

  if (status) {
    status.textContent = message;
  }
}


async function boot() {

  if (!configured) {

    setAuthVisible(false);

    authMessage(
      'Supabase is not configured. Add your publishable key in app.js.'
    );

    return;
  }

  const {
    data: { session }
  } = await sb.auth.getSession();

  setAuthVisible(!!session);

  if (session) {
    await loadAll();
  }

  sb.auth.onAuthStateChange(
    async (_event, session) => {

      setAuthVisible(!!session);

      if (session) {
        await loadAll();
      }
    }
  );
}


/* =========================================================
   SIGN IN / SIGN UP
   ========================================================= */

const authToggle = $('#authToggle');

if (authToggle) {

  authToggle.onclick = () => {

    authMode =
      authMode === 'signin'
        ? 'signup'
        : 'signin';

    const submit = $('#authSubmit');

    if (submit) {
      submit.textContent =
        authMode === 'signin'
          ? 'Sign in'
          : 'Create account';
    }

    authToggle.textContent =
      authMode === 'signin'
        ? 'Need an account? Sign up'
        : 'Already have an account? Sign in';

    authMessage('');
  };
}


const authForm = $('#authForm');

if (authForm) {

  authForm.onsubmit = async (event) => {

    event.preventDefault();

    if (!sb) {
      authMessage('Supabase is not connected.');
      return;
    }

    const email =
      $('#authEmail')?.value.trim();

    const password =
      $('#authPassword')?.value;

    if (!email || !password) {
      authMessage(
        'Enter your email and password.'
      );
      return;
    }

    authMessage('Working…');

    let result;

    if (authMode === 'signin') {

      result =
        await sb.auth.signInWithPassword({
          email,
          password
        });

    } else {

      result =
        await sb.auth.signUp({
          email,
          password
        });
    }

    if (result.error) {

      authMessage(
        result.error.message
      );

      return;
    }

    authMessage(
      authMode === 'signup'
        ? 'Account created. Check your email if confirmation is enabled.'
        : 'Signed in.'
    );
  };
}


const signOutBtn = $('#signOutBtn');

if (signOutBtn) {

  signOutBtn.onclick = async () => {

    if (sb) {
      await sb.auth.signOut();
    }
  };
}


/* =========================================================
   LOAD DATABASE
   ========================================================= */

async function loadAll() {

  if (!sb) return;

  const [
    tracksResult,
    playlistsResult
  ] = await Promise.all([

    sb
      .from('tracks')
      .select('*')
      .order('created_at', {
        ascending: false
      }),

    sb
      .from('playlists')
      .select('*')
      .order('created_at', {
        ascending: false
      })
  ]);


  if (tracksResult.error) {

    console.error(tracksResult.error);

    toast(
      tracksResult.error.message
    );

    return;
  }


  if (playlistsResult.error) {

    console.error(
      playlistsResult.error
    );

    toast(
      playlistsResult.error.message
    );

    return;
  }


  tracks =
    tracksResult.data || [];

  playlists =
    playlistsResult.data || [];


  renderAll();
}


/* =========================================================
   MAIN RENDER
   ========================================================= */

function renderAll() {

  const trackCount = $('#trackCount');

  if (trackCount) {

    trackCount.textContent =
      `${tracks.length} track${
        tracks.length === 1
          ? ''
          : 's'
      }`;
  }


  const emptyLibrary =
    $('#emptyLibrary');

  const collectionView =
    $('#collectionView');

  const listView =
    $('#listView');


  if (emptyLibrary) {

    emptyLibrary.classList.toggle(
      'hidden',
      tracks.length > 0
    );
  }


  if (collectionView) {

    collectionView.classList.toggle(
      'hidden',
      tracks.length === 0 ||
      viewMode !== 'collection'
    );
  }


  if (listView) {

    listView.classList.toggle(
      'hidden',
      tracks.length === 0 ||
      viewMode !== 'list'
    );
  }


  const viewCollection =
    $('#viewCollection');

  const viewList =
    $('#viewList');


  if (viewCollection) {

    viewCollection.classList.toggle(
      'active',
      viewMode === 'collection'
    );
  }


  if (viewList) {

    viewList.classList.toggle(
      'active',
      viewMode === 'list'
    );
  }


  renderCarousel();

  renderList(
    tracks,
    $('#listView')
  );

  renderAlbums();

  renderPlaylists();
}


/* =========================================================
   CIRCULAR COLLECTION
   ========================================================= */

async function renderCarousel() {

  const carousel = $('#carousel');

  if (!carousel) return;

  carousel.innerHTML = '';

  if (!tracks.length) {
    return;
  }


  if (
    currentIndex < 0 ||
    currentIndex >= tracks.length
  ) {
    currentIndex = 0;
  }


  const center = currentIndex;

  const visible =
    Math.min(tracks.length, 7);

  const half =
    Math.floor(visible / 2);


  for (
    let offset = -half;
    offset <= half;
    offset++
  ) {

    const index =
      (center + offset + tracks.length) %
      tracks.length;

    const track =
      tracks[index];


    const card =
      document.createElement('button');

    card.className =
      'carousel-card ' +
      (offset === 0
        ? 'active'
        : '');

    card.dataset.index =
      index;


    const img =
      document.createElement('img');

    img.alt =
      `${track.title} artwork`;

    img.src =
      placeholder(track.title);


    const cover =
      await coverFor(track);

    if (cover) {
      img.src = cover;
    }


    card.appendChild(img);


    const x =
      offset * 235;

    const y =
      Math.abs(offset) * 18;

    const z =
      10 - Math.abs(offset);


    const scale =
      offset === 0
        ? 1
        : Math.max(
            0.58,
            0.78 -
            Math.abs(offset) * 0.04
          );


    card.style.transform =
      `translateX(${x}px)
       translateY(${y}px)
       scale(${scale})`;

    card.style.zIndex = z;

    card.style.opacity =
      offset === 0
        ? 1
        : Math.max(
            0.22,
            1 -
            Math.abs(offset) * 0.18
          );

    card.style.filter =
      offset === 0
        ? 'none'
        : 'brightness(.65)';


    card.onclick = () => {

      if (dragMoved) {
        return;
      }

      currentIndex = index;

      renderCarousel();

      playTrack(index);
    };


    carousel.appendChild(card);
  }
}


/* =========================================================
   LIST VIEW
   ========================================================= */

function renderList(items, target) {

  if (!target) return;


  if (!items.length) {

    target.innerHTML =
      '<p class="muted">No results.</p>';

    return;
  }


  target.innerHTML =
    items
      .map(
        (track) => `

        <div class="track-row">

          <img
            class="track-art"
            data-cover="${escapeHtml(track.id)}"
            src="${placeholder(track.title)}"
            alt=""
          >

          <div class="track-info">

            <strong>
              ${escapeHtml(track.title)}
            </strong>

            <span>
              ${escapeHtml(track.artist)}
              ${
                track.album
                  ? ' · ' +
                    escapeHtml(track.album)
                  : ''
              }
            </span>

          </div>

          <div class="row-actions">

            <button
              class="small-btn"
              data-play="${escapeHtml(track.id)}"
            >
              Play
            </button>

          </div>

        </div>
      `
      )
      .join('');


  target
    .querySelectorAll('[data-play]')
    .forEach((button) => {

      button.onclick = () => {

        const index =
          tracks.findIndex(
            (track) =>
              track.id ===
              button.dataset.play
          );

        if (index >= 0) {

          currentIndex = index;

          renderCarousel();

          playTrack(index);
        }
      };
    });


  target
    .querySelectorAll('[data-cover]')
    .forEach(async (img) => {

      const track =
        tracks.find(
          (item) =>
            item.id ===
            img.dataset.cover
        );

      const url =
        await coverFor(track);

      if (url) {
        img.src = url;
      }
    });
}


/* =========================================================
   ALBUMS
   ========================================================= */

async function renderAlbums() {

  const grid =
    $('#albumsGrid');

  if (!grid) return;


  const albums =
    new Map();


  tracks.forEach((track) => {

    const name =
      track.album ||
      'Singles';

    if (!albums.has(name)) {
      albums.set(name, track);
    }
  });


  if (!albums.size) {

    grid.innerHTML =
      '<p class="muted">Albums will appear here after you upload music.</p>';

    return;
  }


  grid.innerHTML =
    [...albums.entries()]
      .map(
        ([name, track]) => `

        <div class="grid-card">

          <img
            class="grid-art"
            data-album-cover="${escapeHtml(track.id)}"
            src="${placeholder(name)}"
            alt=""
          >

          <strong>
            ${escapeHtml(name)}
          </strong>

          <span>
            ${escapeHtml(track.artist)}
          </span>

        </div>
      `
      )
      .join('');


  grid
    .querySelectorAll(
      '[data-album-cover]'
    )
    .forEach(async (img) => {

      const track =
        tracks.find(
          (item) =>
            item.id ===
            img.dataset.albumCover
        );

      const url =
        await coverFor(track);

      if (url) {
        img.src = url;
      }
    });
}


/* =========================================================
   PLAYLISTS
   ========================================================= */

async function renderPlaylists() {

  const grid =
    $('#playlistsGrid');

  if (!grid) return;


  if (!playlists.length) {

    grid.innerHTML =
      '<p class="muted">No playlists yet.</p>';

    return;
  }


  grid.innerHTML =
    playlists
      .map(
        (playlist) => `

        <div class="grid-card">

          <img
            class="grid-art"
            data-playlist-cover="${escapeHtml(
              playlist.id
            )}"
            src="${placeholder(
              playlist.name
            )}"
            alt=""
          >

          <strong>
            ${escapeHtml(
              playlist.name
            )}
          </strong>

          <span>
            ${escapeHtml(
              playlist.description ||
              'Playlist'
            )}
          </span>

        </div>
      `
      )
      .join('');


  grid
    .querySelectorAll(
      '[data-playlist-cover]'
    )
    .forEach(async (img) => {

      const playlist =
        playlists.find(
          (item) =>
            item.id ===
            img.dataset.playlistCover
        );

      if (!playlist) return;

      const url =
        await signed(
          'covers',
          playlist.cover_path
        );

      if (url) {
        img.src = url;
      }
    });
}


/* =========================================================
   MUSIC PLAYER
   ========================================================= */

async function playTrack(index) {

  if (!tracks[index]) {
    return;
  }

  if (!sb) {
    toast(
      'Connect Supabase before playing music.'
    );
    return;
  }


  currentIndex = index;

  const track =
    tracks[index];


  const url =
    await signed(
      'audio',
      track.audio_path
    );


  if (!url) {

    toast(
      'Could not access this audio file.'
    );

    return;
  }


  audio.src = url;

  audio.currentTime = 0;


  try {

    await audio.play();

  } catch (error) {

    console.error(error);

    toast(
      'Press play to start the track.'
    );
  }


  const playerTitle =
    $('#playerTitle');

  const playerArtist =
    $('#playerArtist');

  const playerCover =
    $('#playerCover');


  if (playerTitle) {
    playerTitle.textContent =
      track.title;
  }

  if (playerArtist) {
    playerArtist.textContent =
      track.artist;
  }


  if (playerCover) {

    const cover =
      await coverFor(track);

    if (cover) {

      playerCover.style.backgroundImage =
        `url("${cover}")`;

      playerCover.style.backgroundSize =
        'cover';

      playerCover.textContent = '';

    } else {

      playerCover.style.backgroundImage =
        '';

      playerCover.textContent =
        String(
          track.title || 'F'
        ).charAt(0).toUpperCase();
    }
  }
}


function next() {

  if (!tracks.length) {
    return;
  }


  let index;


  if (shuffle) {

    index =
      Math.floor(
        Math.random() *
        tracks.length
      );

  } else {

    index =
      (currentIndex + 1) %
      tracks.length;
  }


  if (
    !repeat &&
    !shuffle &&
    currentIndex ===
      tracks.length - 1
  ) {

    audio.pause();

    return;
  }


  playTrack(index);
}


function prev() {

  if (!tracks.length) {
    return;
  }


  if (audio.currentTime > 4) {

    audio.currentTime = 0;

    return;
  }


  const index =
    (
      currentIndex -
      1 +
      tracks.length
    ) %
    tracks.length;


  playTrack(index);
}


/* =========================================================
   PLAYER CONTROLS
   ========================================================= */

const playBtn = $('#playBtn');

if (playBtn) {

  playBtn.onclick = () => {

    if (
      !audio.src &&
      tracks.length
    ) {

      playTrack(
        currentIndex >= 0
          ? currentIndex
          : 0
      );

      return;
    }


    if (audio.paused) {

      audio.play();

    } else {

      audio.pause();
    }
  };
}


const nextBtn = $('#nextBtn');

if (nextBtn) {
  nextBtn.onclick = next;
}


const prevBtn = $('#prevBtn');

if (prevBtn) {
  prevBtn.onclick = prev;
}


const shuffleBtn =
  $('#shuffleBtn');

if (shuffleBtn) {

  shuffleBtn.onclick = () => {

    shuffle = !shuffle;

    shuffleBtn.classList.toggle(
      'active',
      shuffle
    );
  };
}


const repeatBtn =
  $('#repeatBtn');

if (repeatBtn) {

  repeatBtn.onclick = () => {

    repeat = !repeat;

    repeatBtn.classList.toggle(
      'active',
      repeat
    );
  };
}


if (audio) {

  audio.onplay = () => {

    if (playBtn) {
      playBtn.textContent = '❚❚';
    }
  };


  audio.onpause = () => {

    if (playBtn) {
      playBtn.textContent = '▶';
    }
  };


  audio.onended = next;


  audio.ontimeupdate = () => {

    const currentTime =
      $('#currentTime');

    const progress =
      $('#progress');


    if (currentTime) {

      currentTime.textContent =
        fmt(audio.currentTime);
    }


    if (progress) {

      progress.value =
        audio.duration
          ? (
              audio.currentTime /
              audio.duration *
              100
            )
          : 0;
    }
  };


  audio.onloadedmetadata = () => {

    const duration =
      $('#duration');

    if (duration) {

      duration.textContent =
        fmt(audio.duration);
    }
  };
}


const progress =
  $('#progress');

if (progress && audio) {

  progress.oninput = (event) => {

    if (audio.duration) {

      audio.currentTime =
        (
          Number(event.target.value) /
          100
        ) *
        audio.duration;
    }
  };
}


const volume =
  $('#volume');

if (volume && audio) {

  volume.oninput = (event) => {

    audio.volume =
      Number(event.target.value);
  };

  audio.volume = 0.8;
}


/* =========================================================
   NAVIGATION
   ========================================================= */

function switchPage(page) {

  document
    .querySelectorAll('.nav-item')
    .forEach((button) => {

      button.classList.toggle(
        'active',
        button.dataset.page === page
      );
    });


  document
    .querySelectorAll('.page')
    .forEach((section) => {

      section.classList.remove(
        'active-page'
      );
    });


  const pageElement =
    $(`#page-${page}`);

  if (pageElement) {

    pageElement.classList.add(
      'active-page'
    );
  }


  const title =
    $('#pageTitle');

  if (title) {

    title.textContent =
      page.charAt(0).toUpperCase() +
      page.slice(1);
  }
}


document
  .querySelectorAll('.nav-item')
  .forEach((button) => {

    button.onclick = () => {

      switchPage(
        button.dataset.page
      );
    };
  });


/* =========================================================
   COLLECTION / LIST TOGGLE
   ========================================================= */

const viewCollection =
  $('#viewCollection');

if (viewCollection) {

  viewCollection.onclick = () => {

    viewMode = 'collection';

    localStorage.setItem(
      'frequency-view',
      viewMode
    );

    renderAll();
  };
}


const viewList =
  $('#viewList');

if (viewList) {

  viewList.onclick = () => {

    viewMode = 'list';

    localStorage.setItem(
      'frequency-view',
      viewMode
    );

    renderAll();
  };
}


/* =========================================================
   UPLOAD BUTTONS
   ========================================================= */

const uploadBtn =
  $('#uploadBtn');

const emptyUploadBtn =
  $('#emptyUploadBtn');


if (uploadBtn) {

  uploadBtn.onclick = () => {

    const modal =
      $('#uploadModal');

    if (modal) {

      modal.classList.remove(
        'hidden'
      );
    }
  };
}


if (emptyUploadBtn) {

  emptyUploadBtn.onclick = () => {

    const modal =
      $('#uploadModal');

    if (modal) {

      modal.classList.remove(
        'hidden'
      );
    }
  };
}


/* =========================================================
   PLAYLIST BUTTON
   ========================================================= */

const newPlaylistBtn =
  $('#newPlaylistBtn');

if (newPlaylistBtn) {

  newPlaylistBtn.onclick = () => {

    const modal =
      $('#playlistModal');

    if (modal) {

      modal.classList.remove(
        'hidden'
      );
    }
  };
}


/* =========================================================
   CLOSE MODALS
   ========================================================= */

document
  .querySelectorAll('[data-close]')
  .forEach((button) => {

    button.onclick = () => {

      const id =
        button.dataset.close;

      const modal =
        $(`#${id}`);

      if (modal) {

        modal.classList.add(
          'hidden'
        );
      }
    };
  });


/* =========================================================
   COLLECTION DRAG / SWIPE
   ========================================================= */

const carousel =
  $('#carousel');

if (carousel) {

  carousel.addEventListener(
    'pointerdown',
    (event) => {

      dragStartX =
        event.clientX;

      dragMoved = false;

      carousel.setPointerCapture?.(
        event.pointerId
      );
    }
  );


  carousel.addEventListener(
    'pointermove',
    (event) => {

      if (
        dragStartX !== null &&
        Math.abs(
          event.clientX -
          dragStartX
        ) > 12
      ) {

        dragMoved = true;
      }
    }
  );


  carousel.addEventListener(
    'pointerup',
    (event) => {

      if (dragStartX === null) {
        return;
      }


      const distance =
        event.clientX -
        dragStartX;


      if (
        Math.abs(distance) >
        50 &&
        tracks.length
      ) {

        currentIndex =
          (
            currentIndex +
            (
              distance < 0
                ? 1
                : -1
            ) +
            tracks.length
          ) %
          tracks.length;


        renderCarousel();
      }


      dragStartX = null;


      setTimeout(() => {

        dragMoved = false;

      }, 80);
    }
  );


  carousel.addEventListener(
    'pointercancel',
    () => {

      dragStartX = null;

      dragMoved = false;
    }
  );


  carousel.addEventListener(
    'wheel',
    (event) => {

      if (!tracks.length) {
        return;
      }

      event.preventDefault();


      currentIndex =
        (
          currentIndex +
          (
            event.deltaY +
            event.deltaX >
            0
              ? 1
              : -1
          ) +
          tracks.length
        ) %
        tracks.length;


      renderCarousel();
    },
    {
      passive: false
    }
  );
}


/* =========================================================
   SEARCH
   ========================================================= */

const searchInput =
  $('#searchInput');

if (searchInput) {

  searchInput.oninput = () => {

    const query =
      searchInput.value
        .toLowerCase()
        .trim();


    const results =
      tracks.filter((track) => {

        return `
          ${track.title}
          ${track.artist}
          ${track.album || ''}
          ${track.genre || ''}
        `
          .toLowerCase()
          .includes(query);
      });


    renderList(
      results,
      $('#searchResults')
    );
  };
}


/* =========================================================
   REAL MUSIC UPLOAD
   ========================================================= */

const uploadForm =
  $('#uploadForm');


if (uploadForm) {

  uploadForm.onsubmit =
    async (event) => {

      event.preventDefault();


      if (!sb) {

        const status =
          $('#uploadStatus');

        if (status) {

          status.textContent =
            'Supabase is not connected.';
        }

        return;
      }


      const {
        data: {
          user
        }
      } =
        await sb.auth.getUser();


      if (!user) {

        toast(
          'You must be signed in.'
        );

        return;
      }


      const audioFile =
        $('#trackFile')
          ?.files?.[0];


      const coverFile =
        $('#coverFile')
          ?.files?.[0];


      const status =
        $('#uploadStatus');


      if (!audioFile) {

        if (status) {

          status.textContent =
            'Please choose an audio file.';
        }

        return;
      }


      if (status) {

        status.textContent =
          'Uploading audio…';
      }


      try {

        /* -----------------------------------------
           AUDIO PATH
           ----------------------------------------- */

        const cleanAudioName =
          audioFile.name
            .replace(
              /[^a-zA-Z0-9._-]/g,
              '_'
            );


        const audioPath =
          `${user.id}/${crypto.randomUUID()}-${cleanAudioName}`;


        let result =
          await sb.storage
            .from('audio')
            .upload(
              audioPath,
              audioFile,
              {
                upsert: false,
                contentType:
                  audioFile.type ||
                  'audio/mpeg'
              }
            );


        if (result.error) {
          throw result.error;
        }


        /* -----------------------------------------
           COVER PATH
           ----------------------------------------- */

        let coverPath = null;


        if (coverFile) {

          if (status) {

            status.textContent =
              'Uploading artwork…';
          }


          const cleanCoverName =
            coverFile.name
              .replace(
                /[^a-zA-Z0-9._-]/g,
                '_'
              );


          coverPath =
            `${user.id}/${crypto.randomUUID()}-${cleanCoverName}`;


          result =
            await sb.storage
              .from('covers')
              .upload(
                coverPath,
                coverFile,
                {
                  upsert: false,
                  contentType:
                    coverFile.type ||
                    'image/jpeg'
                }
              );


          if (result.error) {
            throw result.error;
          }
        }


        /* -----------------------------------------
           AUDIO DURATION
           ----------------------------------------- */

        let duration = null;


        try {

          const temporaryUrl =
            URL.createObjectURL(
              audioFile
            );


          const tempAudio =
            document.createElement(
              'audio'
            );


          tempAudio.preload =
            'metadata';


          duration =
            await new Promise(
              (resolve) => {

                tempAudio.onloadedmetadata =
                  () => {

                    const value =
                      Number.isFinite(
                        tempAudio.duration
                      )
                        ? tempAudio.duration
                        : null;

                    URL.revokeObjectURL(
                      temporaryUrl
                    );

                    resolve(value);
                  };


                tempAudio.onerror =
                  () => {

                    URL.revokeObjectURL(
                      temporaryUrl
                    );

                    resolve(null);
                  };


                tempAudio.src =
                  temporaryUrl;
              }
            );

        } catch (error) {

          console.warn(
            'Could not read duration.',
            error
          );
        }


        /* -----------------------------------------
           DATABASE RECORD
           ----------------------------------------- */

        if (status) {

          status.textContent =
            'Saving track…';
        }


        const metadata = {

          user_id: user.id,

          title:
            $('#trackTitle')
              ?.value
              .trim() ||
            audioFile.name
              .replace(
                /\.[^/.]+$/,
                ''
              ),

          artist:
            $('#trackArtist')
              ?.value
              .trim() ||
            'Unknown Artist',

          album:
            $('#trackAlbum')
              ?.value
              .trim() ||
            null,

          genre:
            $('#trackGenre')
              ?.value
              .trim() ||
            null,

          year:
            $('#trackYear')
              ?.value
              ? Number(
                  $('#trackYear').value
                )
              : null,

          duration,

          audio_path:
            audioPath,

          cover_path:
            coverPath
        };


        result =
          await sb
            .from('tracks')
            .insert(
              metadata
            );


        if (result.error) {
          throw result.error;
        }


        if (status) {

          status.textContent =
            'Uploaded successfully.';
        }


        uploadForm.reset();


        await loadAll();


        setTimeout(() => {

          const modal =
            $('#uploadModal');

          if (modal) {

            modal.classList.add(
              'hidden'
            );
          }

          if (status) {

            status.textContent =
              '';
          }

        }, 700);


        toast(
          'Track added to Frequency.'
        );


      } catch (error) {

        console.error(
          'Frequency upload error:',
          error
        );


        if (status) {

          status.textContent =
            error?.message ||
            'Upload failed.';
        }


        toast(
          error?.message ||
          'Upload failed.'
        );
      }
    };
}


/* =========================================================
   PLAYLIST CREATION
   ========================================================= */

const playlistForm =
  $('#playlistForm');


if (playlistForm) {

  playlistForm.onsubmit =
    async (event) => {

      event.preventDefault();


      if (!sb) {
        return;
      }


      const {
        data: {
          user
        }
      } =
        await sb.auth.getUser();


      if (!user) {

        toast(
          'You must be signed in.'
        );

        return;
      }


      const file =
        $('#playlistCover')
          ?.files?.[0];


      const status =
        $('#playlistStatus');


      if (status) {

        status.textContent =
          'Creating…';
      }


      try {

        let coverPath = null;


        if (file) {

          const cleanName =
            file.name
              .replace(
                /[^a-zA-Z0-9._-]/g,
                '_'
              );


          coverPath =
            `${user.id}/playlist-${crypto.randomUUID()}-${cleanName}`;


          const upload =
            await sb.storage
              .from('covers')
              .upload(
                coverPath,
                file,
                {
                  upsert: false,
                  contentType:
                    file.type ||
                    'image/jpeg'
                }
              );


          if (upload.error) {
            throw upload.error;
          }
        }


        const name =
          $('#playlistName')
            ?.value
            .trim();


        if (!name) {

          if (status) {

            status.textContent =
              'Give your playlist a name.';
          }

          return;
        }


        const result =
          await sb
            .from('playlists')
            .insert({

              user_id:
                user.id,

              name,

              description:
                $('#playlistDescription')
                  ?.value
                  .trim() ||
                null,

              cover_path:
                coverPath
            });


        if (result.error) {
          throw result.error;
        }


        playlistForm.reset();


        if (status) {

          status.textContent =
            'Created.';
        }


        await loadAll();


        setTimeout(() => {

          const modal =
            $('#playlistModal');

          if (modal) {

            modal.classList.add(
              'hidden'
            );
          }

          if (status) {

            status.textContent =
              '';
          }

        }, 700);


        toast(
          'Playlist created.'
        );


      } catch (error) {

        console.error(
          error
        );


        if (status) {

          status.textContent =
            error?.message ||
            'Could not create playlist.';
        }
      }
    };
}


/* =========================================================
   PLAY ACTIVE
   ========================================================= */

const playActive =
  $('#playActive');

if (playActive) {

  playActive.onclick = () => {

    if (!tracks.length) {
      return;
    }


    if (currentIndex < 0) {
      currentIndex = 0;
    }


    playTrack(
      currentIndex
    );
  };
}


/* =========================================================
   START FREQUENCY
   ========================================================= */

boot();
