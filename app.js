const SUPABASE_URL =
'https://nmiodppvxqpzfrideduv.supabase.co';

const SUPABASE_PUBLISHABLE_KEY =
'sb_publishable_S7SpRNfMTiY7SB4Y19LRDQ_WBzH_TPc';

/* =========================================================
SUPABASE
========================================================= */

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
DOM HELPERS
========================================================= */

const $ = (selector) =>
document.querySelector(selector);

const $$ = (selector) =>
[...document.querySelectorAll(selector)];

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

let repeatMode = false;

let currentPage = 'library';

let carouselIndex = 0;

let isDragging = false;
let dragStartX = 0;
let dragCurrentX = 0;

let renderToken = 0;

let editingTrackIndex = -1;

let activePlaylist = null;

/* =========================================================
URL CACHE
========================================================= */

const audioUrlCache = new Map();
const coverUrlCache = new Map();

async function signedUrl(bucket, path, cache) {

if (!path) return null;

const cached = cache.get(path);

if (
cached &&
cached.expiresAt > Date.now() + 30000
) {
return cached.url;
}

const { data, error } =
await sb.storage
.from(bucket)
.createSignedUrl(path, 3600);

if (error) {
console.error(
`Signed URL error for ${bucket}:`,
error
);

```
return null;
```

}

const entry = {
url: data.signedUrl,
expiresAt:
Date.now() + 55 * 60 * 1000
};

cache.set(path, entry);

return entry.url;
}

async function audioUrl(track) {

if (!track?.audio_path) {
return null;
}

return signedUrl(
'audio',
track.audio_path,
audioUrlCache
);
}

async function coverUrl(track) {

if (!track?.cover_path) {
return null;
}

return signedUrl(
'covers',
track.cover_path,
coverUrlCache
);
}

function clearTrackUrlCache(track) {

if (!track) return;

if (track.audio_path) {
audioUrlCache.delete(
track.audio_path
);
}

if (track.cover_path) {
coverUrlCache.delete(
track.cover_path
);
}
}

/* =========================================================
TOAST
========================================================= */

let toastTimer;

function toast(message) {

const el = $('#toast');

if (!el) return;

el.textContent = message;
el.classList.add('show');

clearTimeout(toastTimer);

toastTimer = setTimeout(() => {
el.classList.remove('show');
}, 3000);
}

/* =========================================================
AUTH
========================================================= */

async function getUser() {

if (!sb) return null;

const {
data,
error
} = await sb.auth.getUser();

if (error) {
console.error(
'Get user error:',
error
);

```
return null;
```

}

return data.user || null;
}

async function signIn(
email,
password
) {

if (!sb) return;

const status = $('#authStatus');

if (status) {
status.textContent =
'Signing in...';
}

const {
data,
error
} = await sb.auth.signInWithPassword({
email,
password
});

if (error) {

```
console.error(
  'Sign in error:',
  error
);

if (status) {
  status.textContent =
    error.message;
}

return;
```

}

currentUser =
data.user || null;

if (status) {
status.textContent = '';
}

showApp();
}

async function signUp(
email,
password
) {

if (!sb) return;

const status = $('#authStatus');

if (status) {
status.textContent =
'Creating your account...';
}

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

```
console.error(
  'Sign up error:',
  error
);

if (status) {
  status.textContent =
    error.message;
}

return;
```

}

if (data.session) {

```
currentUser =
  data.user || null;

if (status) {
  status.textContent = '';
}

showApp();
```

} else {

```
if (status) {
  status.textContent =
    'Account created. Check your email to confirm your account.';
}
```

}
}

async function signOut() {

if (!sb) return;

const {
error
} = await sb.auth.signOut();

if (error) {

```
console.error(
  'Sign out error:',
  error
);

toast(
  error.message ||
  'Could not sign out.'
);

return;
```

}

currentUser = null;
tracks = [];
playlists = [];
currentTrackIndex = -1;
activePlaylist = null;

audio.pause();
audio.removeAttribute('src');
audio.load();

closePlaylistViewer();
showAuth();
}

/* =========================================================
AUTH UI
========================================================= */

let authMode = 'signin';

function setupAuth() {

const form =
$('#authForm');

const toggle =
$('#authToggle');

const keepLoggedIn =
$('#keepLoggedIn');

if (keepLoggedIn) {

```
const saved =
  localStorage.getItem(
    'frequency-keep-logged-in'
  );

keepLoggedIn.checked =
  saved !== 'false';

keepLoggedIn.addEventListener(
  'change',
  () => {

    localStorage.setItem(
      'frequency-keep-logged-in',
      String(
        keepLoggedIn.checked
      )
    );

  }
);
```

}

if (toggle) {

```
toggle.addEventListener(
  'click',
  () => {

    authMode =
      authMode === 'signin'
        ? 'signup'
        : 'signin';

    const submit =
      $('#authSubmit');

    const status =
      $('#authStatus');

    if (authMode === 'signup') {

      if (submit) {
        submit.textContent =
          'Create account';
      }

      toggle.textContent =
        'Already have an account? Sign in';

    } else {

      if (submit) {
        submit.textContent =
          'Sign in';
      }

      toggle.textContent =
        'Need an account? Sign up';
    }

    if (status) {
      status.textContent = '';
    }
  }
);
```

}

if (form) {

```
form.addEventListener(
  'submit',
  async (event) => {

    event.preventDefault();

    const email =
      $('#authEmail')
        ?.value
        .trim();

    const password =
      $('#authPassword')
        ?.value;

    if (!email || !password) {
      return;
    }

    if (authMode === 'signup') {

      await signUp(
        email,
        password
      );

    } else {

      await signIn(
        email,
        password
      );

    }
  }
);
```

}
}

function showAuth() {

$('#authView')
?.classList.remove('hidden');

$('#appView')
?.classList.add('hidden');
}

function showApp() {

$('#authView')
?.classList.add('hidden');

$('#appView')
?.classList.remove('hidden');

loadLibrary()
.then(() => {
renderCurrentPage();
})
.catch((error) => {

```
  console.error(
    'Load library error:',
    error
  );

  toast(
    'Could not load your library.'
  );
});
```

}

function setupAuthListener() {

if (!sb) return;

sb.auth.onAuthStateChange(
async (_event, session) => {

```
  const nextUser =
    session?.user || null;

  currentUser =
    nextUser;

  if (nextUser) {

    $('#authView')
      ?.classList.add('hidden');

    $('#appView')
      ?.classList.remove('hidden');

    await loadLibrary();

    renderCurrentPage();

  } else {

    showAuth();

  }
}
```

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
throw error;
}

tracks =
data || [];
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

```
console.warn(
  'Playlist loading error:',
  error
);

playlists = [];
return;
```

}

playlists =
data || [];
}

async function loadLibrary() {

await Promise.all([
loadTracks(),
loadPlaylists()
]);

updateTrackCount();

if (
currentTrackIndex >=
tracks.length
) {
currentTrackIndex =
tracks.length - 1;
}
}

function updateTrackCount() {

const count =
$('#trackCount');

if (!count) return;

count.textContent =
`${tracks.length} ${
      tracks.length === 1
        ? 'track'
        : 'tracks'
    }`;
}

/* =========================================================
NAVIGATION
========================================================= */

function setupNavigation() {

$$$('.nav-item')
  .forEach((button) => {

    button.addEventListener(
      'click',
      () => {

        const page =
          button.dataset.page;

        if (!page) return;

        setPage(page);
      }
    );

  });
}


function setPage(page) {

currentPage =
  page;

$$('.nav-item')
  .forEach((button) => {

    button.classList.toggle(
      'active',
      button.dataset.page === page
    );

  });


$$('.page')
  .forEach((section) => {

    section.classList.remove(
      'active-page'
    );

  });


const target =
  $(`#page-${page}`);

if (target) {
  target.classList.add(
    'active-page'
  );
}


const titles = {
  library: 'Library',
  search: 'Search',
  albums: 'Albums',
  playlists: 'Playlists',
  transmissions: 'Transmissions'
};

const title =
  $('#pageTitle');

if (title) {
  title.textContent =
    titles[page] ||
    'Library';
}


const switcherVisible =
  page === 'library';

$('#viewCollection')
  ?.classList.toggle(
    'hidden',
    !switcherVisible
  );

$('#viewList')
  ?.classList.toggle(
    'hidden',
    !switcherVisible
  );


if (page === 'library') {

  renderLibrary();

} else if (page === 'search') {

  renderSearch();

} else if (page === 'albums') {

  renderAlbums();

} else if (page === 'playlists') {

  renderPlaylists();

}
}


function renderCurrentPage() {

setPage(
  currentPage
);

setView(
  viewMode
);
}


/* =========================================================
 VIEW SWITCHER
========================================================= */

function setupViewSwitcher() {

$('#viewCollection')
  ?.addEventListener(
    'click',
    () => {
      setView('collection');
    }
  );

$('#viewList')
  ?.addEventListener(
    'click',
    () => {
      setView('list');
    }
  );
}


function setView(mode) {

viewMode =
  mode;

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


if (currentPage !== 'library') {
  return;
}


$('#collectionView')
  ?.classList.toggle(
    'hidden',
    mode !== 'collection'
  );

$('#listView')
  ?.classList.toggle(
    'hidden',
    mode !== 'list'
  );


if (mode === 'collection') {

  renderCarousel();

} else {

  renderList();
}
}


/* =========================================================
 LIBRARY
========================================================= */

function renderLibrary() {

updateTrackCount();

const empty =
  $('#emptyLibrary');

const collection =
  $('#collectionView');

const list =
  $('#listView');


if (!tracks.length) {

  empty
    ?.classList.remove('hidden');

  collection
    ?.classList.add('hidden');

  list
    ?.classList.add('hidden');

  return;
}


empty
  ?.classList.add('hidden');


if (viewMode === 'collection') {

  collection
    ?.classList.remove('hidden');

  list
    ?.classList.add('hidden');

  renderCarousel();

} else {

  collection
    ?.classList.add('hidden');

  list
    ?.classList.remove('hidden');

  renderList();
}
}


/* =========================================================
 CAROUSEL — 3D ALBUM OBJECT GALLERY
========================================================= */

let carouselSignature = '';

function getCarouselSignature() {

return tracks
  .map(
    (track) =>
      [
        track.id,
        track.cover_path,
        track.title,
        track.artist
      ].join(':')
  )
  .join('|');
}

async function renderCarousel() {

const carousel =
  $('#carousel');

if (!carousel) return;

if (!tracks.length) {
  carousel.innerHTML = '';
  return;
}

const signature =
  getCarouselSignature();

if (signature !== carouselSignature) {

  carouselSignature = signature;

  carousel.innerHTML = tracks
    .map(
      (track, index) => `
        <button
          class="carousel-card"
          data-index="${index}"
          type="button"
          aria-label="${escapeHtml(track.title || 'track')}"
        >
          <span class="album-object" aria-hidden="true">
            <span class="album-face">
              <span class="track-art">
                <span class="art-placeholder">F</span>
              </span>
              <span class="album-glass"></span>
              <span class="album-print"></span>
            </span>
            <span class="album-spine"></span>
            <span class="album-edge-bottom"></span>
            <span class="album-edge-right"></span>
            <span class="album-shadow"></span>
          </span>
        </button>
      `
    )
    .join('');

  $$('.carousel-card').forEach((card) => {

    card.addEventListener(
      'click',
      () => {

        const index =
          Number(
            card.dataset.index
          );

        if (index === carouselIndex) {
          playTrack(index);
        } else {
          carouselIndex = index;
          updateCarouselPosition();
          updateCarouselMeta();
        }
      }
    );
  });

  await hydrateCarouselArtwork();
}

carouselIndex = Math.min(
  Math.max(carouselIndex, 0),
  tracks.length - 1
);

updateCarouselPosition();
updateCarouselMeta();
}

async function hydrateCarouselArtwork() {

const token = renderToken;
const cards = $$('.carousel-card');

await Promise.all(
  cards.map(async (card) => {

    const index =
      Number(
        card.dataset.index
      );

    const track =
      tracks[index];

    if (!track) return;

    const url =
      await coverUrl(track);

    if (token !== renderToken) return;

    const art =
      card.querySelector(
        '.track-art'
      );

    if (!art) return;

    if (url) {

      art.innerHTML = `
        <img
          src="${escapeAttribute(url)}"
          alt=""
          draggable="false"
        />
      `;

    } else {

      art.innerHTML =
        '<span class="art-placeholder">F</span>';

    }
  })
);
}

function updateCarouselPosition() {

const carousel =
  $('#carousel');

const cards =
  $$('.carousel-card');

if (
  !carousel ||
  !cards.length
) {
  return;
}

const width =
  carousel.clientWidth ||
  1100;

const gap =
  Math.max(
    205,
    Math.min(
      365,
      width * 0.255
    )
  );

cards.forEach(
  (card, index) => {

    const offset =
      index -
      carouselIndex;

    const distance =
      Math.abs(offset);

    const x =
      offset * gap;

    const y =
      Math.min(
        distance * 12,
        54
      );

    const z =
      offset === 0
        ? 155
        : -Math.min(
            distance * 125,
            650
          );

    const rotateY =
      offset * -21;

    const rotateX =
      distance * 1.8;

    const scale =
      offset === 0
        ? 1
        : Math.max(
            0.52,
            1 -
            distance * 0.105
          );

    const opacity =
      distance > 4
        ? 0
        : Math.max(
            0.12,
            1 -
            distance * 0.2
          );

    card.style.transform =
      `translate3d(${x}px, ${y}px, ${z}px) ` +
      `rotateX(${rotateX}deg) ` +
      `rotateY(${rotateY}deg) ` +
      `scale(${scale})`;

    card.style.opacity =
      String(opacity);

    card.style.zIndex =
      String(
        1000 -
        distance * 20 -
        (
          offset > 0
            ? offset
            : 0
        )
      );

    card.style.pointerEvents =
      distance <= 4
        ? 'auto'
        : 'none';

    card.classList.toggle(
      'active',
      index === carouselIndex
    );
  }
);
}

function updateCarouselMeta() {

const track =
  tracks[carouselIndex];

if (!track) return;

$('#activeArtist').textContent =
  track.artist ||
  'Unknown artist';

$('#activeTitle').textContent =
  track.title ||
  'Untitled';

$('#activeAlbum').textContent =
  track.album ||
  'Single';
}

function carouselNext() {

if (!tracks.length) return;

carouselIndex =
  Math.min(
    carouselIndex + 1,
    tracks.length - 1
  );

updateCarouselPosition();
updateCarouselMeta();
}

function carouselPrevious() {

if (!tracks.length) return;

carouselIndex =
  Math.max(
    carouselIndex - 1,
    0
  );

updateCarouselPosition();
updateCarouselMeta();
}


/* =========================================================
 CAROUSEL DRAG / SWIPE
========================================================= */

function setupCarouselGestures() {

const carousel =
  $('#carousel');

if (!carousel) return;

carousel.addEventListener(
  'pointerdown',
  (event) => {

    if (
      event.button !== undefined &&
      event.button !== 0
    ) {
      return;
    }

    isDragging = true;

    dragStartX =
      event.clientX;

    dragCurrentX =
      event.clientX;

    carousel.classList.add(
      'is-dragging'
    );

    carousel.setPointerCapture(
      event.pointerId
    );
  }
);

carousel.addEventListener(
  'pointermove',
  (event) => {

    if (!isDragging) return;

    dragCurrentX =
      event.clientX;
  }
);

carousel.addEventListener(
  'pointerup',
  (event) => {

    if (!isDragging) return;

    isDragging = false;

    carousel.classList.remove(
      'is-dragging'
    );

    const delta =
      dragCurrentX -
      dragStartX;

    if (
      Math.abs(delta) >
      45
    ) {

      if (delta < 0) {
        carouselNext();
      } else {
        carouselPrevious();
      }
    }

    try {
      carousel.releasePointerCapture(
        event.pointerId
      );
    } catch {}
  }
);

carousel.addEventListener(
  'pointercancel',
  () => {

    isDragging = false;

    carousel.classList.remove(
      'is-dragging'
    );
  }
);

carousel.addEventListener(
  'wheel',
  (event) => {

    if (
      Math.abs(event.deltaY) >
      Math.abs(event.deltaX)
    ) {

      event.preventDefault();

      if (event.deltaY > 0) {
        carouselNext();
      } else {
        carouselPrevious();
      }
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

if (!container) return;


if (!tracks.length) {

  container.innerHTML =
    '<p class="muted">No music yet.</p>';

  return;
}


const token =
  ++renderToken;


const artwork =
  await Promise.all(
    tracks.map(
      (track) =>
        coverUrl(track)
    )
  );


if (token !== renderToken) {
  return;
}


container.innerHTML =
  tracks
    .map(
      (track, index) => {

        const cover =
          artwork[index];

        return `
          <div
            class="track-row"
            data-index="${index}"
          >

            <button
              class="track-art track-play"
              type="button"
              data-action="play"
              aria-label="Play"
            >
              ${
                cover
                  ? `
                    <img
                      src="${escapeAttribute(
                        cover
                      )}"
                      alt=""
                    />
                  `
                  : `
                    <div class="art-placeholder">
                      F
                    </div>
                  `
              }
            </button>


            <button
              class="track-info track-play"
              type="button"
              data-action="play"
            >
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
                ${
                  track.album
                    ? ` · ${escapeHtml(
                        track.album
                      )}`
                    : ''
                }
              </span>
            </button>


            <div class="track-meta">

              ${
                track.genre
                  ? `
                    <span>
                      ${escapeHtml(
                        track.genre
                      )}
                    </span>
                  `
                  : ''
              }

              ${
                track.year
                  ? `
                    <span>
                      ${escapeHtml(
                        String(
                          track.year
                        )
                      )}
                    </span>
                  `
                  : ''
              }

            </div>


            <div class="row-actions">

              <button
                class="small-btn"
                type="button"
                data-action="edit"
              >
                Edit
              </button>

              <button
                class="small-btn"
                type="button"
                data-action="delete"
              >
                Delete
              </button>

            </div>

          </div>
        `;
      }
    )
    .join('');


container
  .querySelectorAll(
    '[data-action]'
  )
  .forEach(
    (button) => {

      button.addEventListener(
        'click',
        (event) => {

          event.stopPropagation();

          const row =
            button.closest(
              '.track-row'
            );

          if (!row) return;

          const index =
            Number(
              row.dataset.index
            );

          const action =
            button.dataset.action;


          if (
            action === 'play'
          ) {

            playTrack(index);

          } else if (
            action === 'edit'
          ) {

            openEditTrack(index);

          } else if (
            action === 'delete'
          ) {

            deleteTrack(index);

          }

        }
      );

    }
  );
}


/* =========================================================
 EDIT TRACK
========================================================= */

function openEditTrack(index) {

const track =
  tracks[index];

if (!track) return;

editingTrackIndex =
  index;


$('#editTitle').value =
  track.title || '';

$('#editArtist').value =
  track.artist || '';

$('#editAlbum').value =
  track.album || '';

$('#editGenre').value =
  track.genre || '';

$('#editYear').value =
  track.year || '';


$('#editCoverFile').value =
  '';


const preview =
  $('#editCoverPreview');

if (preview) {

  if (track.cover_path) {

    coverUrl(track)
      .then((url) => {

        if (url) {

          preview.innerHTML = `
            <img
              src="${escapeAttribute(
                url
              )}"
              alt=""
            />
          `;

        } else {

          preview.innerHTML =
            '<span>F</span>';

        }

      });

  } else {

    preview.innerHTML =
      '<span>F</span>';
  }
}


$('#editStatus').textContent =
  '';

openModal('editModal');
}


async function saveEditedTrack(event) {

event.preventDefault();

if (
  !sb ||
  !currentUser ||
  editingTrackIndex < 0
) {
  return;
}


const track =
  tracks[editingTrackIndex];

if (!track) return;


const status =
  $('#editStatus');

const button =
  $('#editForm button[type="submit"]');


const title =
  $('#editTitle')
    .value
    .trim();

const artist =
  $('#editArtist')
    .value
    .trim();

const album =
  $('#editAlbum')
    .value
    .trim();

const genre =
  $('#editGenre')
    .value
    .trim();

const yearInput =
  $('#editYear')
    .value
    .trim();


if (!title) {

  if (status) {
    status.textContent =
      'Title is required.';
  }

  return;
}


if (!artist) {

  if (status) {
    status.textContent =
      'Artist is required.';
  }

  return;
}


let year = null;

if (yearInput) {

  year =
    Number(yearInput);

  if (
    !Number.isInteger(year) ||
    year < 0 ||
    year > 9999
  ) {

    if (status) {
      status.textContent =
        'Year must be a valid number.';
    }

    return;
  }
}


const coverFile =
  $('#editCoverFile')
    ?.files?.[0] || null;


try {

  if (button) {
    button.disabled = true;
    button.textContent =
      'Saving...';
  }

  if (status) {
    status.textContent =
      'Saving changes...';
  }


  const {
    data: updatedRows,
    error
  } = await sb
    .from('tracks')
    .update({
      title:
        title || 'Untitled',

      artist:
        artist || 'Unknown artist',

      album:
        album || null,

      genre:
        genre || null,

      year
    })
    .eq(
      'id',
      track.id
    )
    .eq(
      'user_id',
      currentUser.id
    )
    .select(
      'id,title,artist,album,genre,year,cover_path,audio_path'
    );


  if (error) {
    throw error;
  }


  if (
    !updatedRows ||
    !updatedRows.length
  ) {

    throw new Error(
      'Frequency could not update this track. Supabase returned no updated row. Check the UPDATE policy for the tracks table.'
    );
  }


  let updatedTrack =
    updatedRows[0];


  if (coverFile) {

    const extension =
      getFileExtension(
        coverFile.name
      );

    const safeName =
      sanitizeFileName(
        coverFile.name
      );

    const newPath =
      `${currentUser.id}/` +
      `${crypto.randomUUID()}-` +
      `${safeName || `cover.${extension}`}`;


    if (status) {
      status.textContent =
        'Uploading new artwork...';
    }


    const {
      error:
        coverUploadError
    } = await sb.storage
      .from('covers')
      .upload(
        newPath,
        coverFile,
        {
          upsert: false,
          contentType:
            coverFile.type ||
            undefined
        }
      );


    if (coverUploadError) {
      throw coverUploadError;
    }


    const oldCoverPath =
      track.cover_path;


    const {
      data:
        coverUpdatedRows,
      error:
        coverUpdateError
    } = await sb
      .from('tracks')
      .update({
        cover_path:
          newPath
      })
      .eq(
        'id',
        track.id
      )
      .eq(
        'user_id',
        currentUser.id
      )
      .select(
        'id,title,artist,album,genre,year,cover_path,audio_path'
      );


    if (coverUpdateError) {

      await sb.storage
        .from('covers')
        .remove([
          newPath
        ]);

      throw coverUpdateError;
    }


    if (
      !coverUpdatedRows ||
      !coverUpdatedRows.length
    ) {

      await sb.storage
        .from('covers')
        .remove([
          newPath
        ]);

      throw new Error(
        'Artwork uploaded, but Frequency could not attach it to the track.'
      );
    }


    updatedTrack =
      coverUpdatedRows[0];


    if (
      oldCoverPath &&
      oldCoverPath !== newPath
    ) {

      const {
        error:
          oldCoverDeleteError
      } = await sb.storage
        .from('covers')
        .remove([
          oldCoverPath
        ]);

      if (oldCoverDeleteError) {

        console.warn(
          'Old artwork cleanup failed:',
          oldCoverDeleteError
        );
      }
    }

  }


  tracks[
    editingTrackIndex
  ] = {
    ...tracks[
      editingTrackIndex
    ],
    ...updatedTrack
  };


  clearTrackUrlCache(
    track
  );


  if (
    track.cover_path !==
    updatedTrack.cover_path
  ) {

    coverUrlCache.delete(
      track.cover_path
    );
  }


  closeModal(
    'editModal'
  );


  renderToken++;

  carouselSignature =
    '';


  renderCurrentPage();


  await loadLibrary();

  renderCurrentPage();

  toast(
    'Track updated successfully.'
  );


} catch (error) {

  console.error(
    'EDIT TRACK ERROR:',
    error
  );


  let message =
    error?.message ||
    'Could not update track.';


  if (
    error?.code ===
    '42501'
  ) {

    message =
      'Supabase is blocking the edit. Your tracks UPDATE policy needs to allow users to update their own tracks.';
  }


  if (status) {
    status.textContent =
      message;
  }


  toast(message);


} finally {

  if (button) {
    button.disabled = false;
    button.textContent =
      'Save changes';
  }

}
}


/* =========================================================
 DELETE TRACK
========================================================= */

async function deleteTrack(index) {

if (
  !sb ||
  !currentUser
) {
  return;
}


const track =
  tracks[index];

if (!track) return;


const confirmed =
  window.confirm(
    `Delete "${track.title || 'this track'}" from Frequency? This will also remove its stored audio and artwork.`
  );


if (!confirmed) {
  return;
}


try {

  if (
    currentTrackIndex ===
    index
  ) {

    audio.pause();

    audio.removeAttribute(
      'src'
    );

    audio.load();

    currentTrackIndex =
      -1;

    updatePlayerEmpty();
  }


  const {
    error
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


  if (error) {
    throw error;
  }


  const storageWarnings = [];


  if (track.audio_path) {

    const {
      error:
        audioDeleteError
    } = await sb.storage
      .from('audio')
      .remove([
        track.audio_path
      ]);

    if (audioDeleteError) {

      storageWarnings.push(
        'audio'
      );

      console.warn(
        audioDeleteError
      );
    }
  }


  if (track.cover_path) {

    const {
      error:
        coverDeleteError
    } = await sb.storage
      .from('covers')
      .remove([
        track.cover_path
      ]);

    if (coverDeleteError) {

      storageWarnings.push(
        'artwork'
      );

      console.warn(
        coverDeleteError
      );
    }
  }


  clearTrackUrlCache(
    track
  );


  if (
    currentTrackIndex >
    index
  ) {

    currentTrackIndex--;
  }


  if (
    carouselIndex >=
    tracks.length - 1
  ) {

    carouselIndex =
      Math.max(
        0,
        tracks.length - 2
      );
  }


  await loadLibrary();

  renderToken++;
  carouselSignature = '';

  renderCurrentPage();


  if (storageWarnings.length) {

    toast(
      `Track deleted. Some ${storageWarnings.join(
        ' and '
      )} cleanup failed.`
    );

  } else {

    toast(
      'Track deleted.'
    );
  }


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

function setupSearch() {

$('#searchInput')
  ?.addEventListener(
    'input',
    () => {
      renderSearch();
    }
  );
}


async function renderSearch() {

const container =
  $('#searchResults');

const input =
  $('#searchInput');

if (!container) return;


const query =
  (
    input?.value ||
    ''
  )
    .trim()
    .toLowerCase();


if (!query) {

  container.innerHTML =
    '<p class="muted">Search your library by song, artist, album, genre or year.</p>';

  return;
}


const results =
  tracks.filter(
    (track) => {

      const haystack = [
        track.title,
        track.artist,
        track.album,
        track.genre,
        track.year
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(
        query
      );
    }
  );


if (!results.length) {

  container.innerHTML =
    '<p class="muted">Nothing found.</p>';

  return;
}


const artwork =
  await Promise.all(
    results.map(
      (track) =>
        coverUrl(track)
    )
  );


container.innerHTML =
  results
    .map(
      (track, resultIndex) => {

        const originalIndex =
          tracks.findIndex(
            (item) =>
              item.id ===
              track.id
          );

        const cover =
          artwork[resultIndex];


        return `
          <div
            class="track-row"
            data-index="${originalIndex}"
          >

            <button
              class="track-art track-play"
              data-action="play"
              type="button"
            >
              ${
                cover
                  ? `
                    <img
                      src="${escapeAttribute(
                        cover
                      )}"
                      alt=""
                    />
                  `
                  : `
                    <div class="art-placeholder">
                      F
                    </div>
                  `
              }
            </button>


            <button
              class="track-info track-play"
              data-action="play"
              type="button"
            >

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

                ${
                  track.album
                    ? ` · ${escapeHtml(
                        track.album
                      )}`
                    : ''
                }
              </span>

            </button>


            <div class="row-actions">

              <button
                class="small-btn"
                data-action="edit"
                type="button"
              >
                Edit
              </button>

              <button
                class="small-btn"
                data-action="delete"
                type="button"
              >
                Delete
              </button>

            </div>

          </div>
        `;
      }
    )
    .join('');


container
  .querySelectorAll(
    '[data-action]'
  )
  .forEach(
    (button) => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest(
              '.track-row'
            );

          const index =
            Number(
              row.dataset.index
            );

          const action =
            button.dataset.action;


          if (
            action === 'play'
          ) {

            playTrack(index);

          } else if (
            action === 'edit'
          ) {

            openEditTrack(index);

          } else if (
            action === 'delete'
          ) {

            deleteTrack(index);
          }

        }
      );

    }
  );
}


/* =========================================================
 ALBUMS
========================================================= */

async function renderAlbums() {

const container =
  $('#albumsGrid');

if (!container) return;


if (!tracks.length) {

  container.innerHTML =
    '<p class="muted">No albums yet.</p>';

  return;
}


const groups =
  new Map();


tracks.forEach(
  (track) => {

    const album =
      track.album?.trim() ||
      'Singles';

    if (!groups.has(album)) {
      groups.set(
        album,
        []
      );
    }

    groups
      .get(album)
      .push(track);
  }
);


const albums =
  [...groups.entries()];


const artwork =
  await Promise.all(
    albums.map(
      ([, albumTracks]) =>
        coverUrl(
          albumTracks[0]
        )
    )
  );


container.innerHTML =
  albums
    .map(
      ([album, albumTracks], index) => {

        const cover =
          artwork[index];


        return `
          <button
            class="grid-card"
            type="button"
            data-album="${escapeAttribute(
              album
            )}"
          >

            <div class="grid-art">

              ${
                cover
                  ? `
                    <img
                      src="${escapeAttribute(
                        cover
                      )}"
                      alt=""
                    />
                  `
                  : `
                    <div class="art-placeholder">
                      F
                    </div>
                  `
              }

            </div>

            <strong>
              ${escapeHtml(album)}
            </strong>

            <span>
              ${escapeHtml(
                albumTracks[0]
                  ?.artist ||
                'Unknown artist'
              )}
            </span>

          </button>
        `;
      }
    )
    .join('');


container
  .querySelectorAll(
    '.grid-card'
  )
  .forEach(
    (card) => {

      card.addEventListener(
        'click',
        () => {

          const album =
            card.dataset.album;

          const albumTracks =
            groups.get(album);

          if (
            !albumTracks?.length
          ) {
            return;
          }

          const firstIndex =
            tracks.findIndex(
              (track) =>
                track.id ===
                albumTracks[0].id
            );

          if (
            firstIndex >= 0
          ) {
            playTrack(
              firstIndex
            );
          }

        }
      );

    }
  );
}


/* =========================================================
 PLAYLISTS
========================================================= */

async function renderPlaylists() {

const container =
  $('#playlistsGrid');

if (!container) return;


if (!playlists.length) {

  container.innerHTML =
    '<p class="muted">No playlists yet.</p>';

  return;
}


const covers =
  await Promise.all(
    playlists.map(
      (playlist) =>
        playlist.cover_path
          ? signedUrl(
              'covers',
              playlist.cover_path,
              coverUrlCache
            )
          : null
    )
  );


container.innerHTML =
  playlists
    .map(
      (playlist, index) => {

        const cover =
          covers[index];


        return `
          <button
            class="grid-card"
            type="button"
            data-playlist-id="${escapeAttribute(
              String(
                playlist.id
              )
            )}"
          >

            <div class="grid-art">

              ${
                cover
                  ? `
                    <img
                      src="${escapeAttribute(
                        cover
                      )}"
                      alt=""
                    />
                  `
                  : `
                    <div class="art-placeholder">
                      F
                    </div>
                  `
              }

            </div>

            <strong>
              ${escapeHtml(
                playlist.name ||
                'Untitled playlist'
              )}
            </strong>

            <span>
              ${escapeHtml(
                playlist.description ||
                'Playlist'
              )}
            </span>

          </button>
        `;
      }
    )
    .join('');


/*
   THIS WAS THE MISSING PIECE.

   The playlist cards were being rendered,
   but nothing was listening for clicks.
*/

container
  .querySelectorAll(
    '[data-playlist-id]'
  )
  .forEach(
    (card) => {

      card.addEventListener(
        'click',
        () => {

          const playlistId =
            card.dataset.playlistId;

          const playlist =
            playlists.find(
              (item) =>
                String(item.id) ===
                String(playlistId)
            );

          if (!playlist) {
            return;
          }

          openPlaylistViewer(
            playlist
          );
        }
      );

    }
  );
}


/* =========================================================
 PLAYLIST VIEWER
========================================================= */

function createPlaylistViewer() {

let viewer =
  $('#playlistViewer');

if (viewer) {
  return viewer;
}


viewer =
  document.createElement(
    'div'
  );

viewer.id =
  'playlistViewer';

viewer.className =
  'modal hidden';

viewer.innerHTML = `
  <div
    class="modal-card"
    style="
      width:min(720px,100%);
      max-height:85vh;
      overflow:auto;
    "
  >

    <button
      class="close"
      id="playlistViewerClose"
      aria-label="Close"
      type="button"
    >
      ×
    </button>

    <div
      id="playlistViewerCover"
      style="
        width:160px;
        height:160px;
        margin-bottom:24px;
        border:1px solid #292929;
        background:#111;
        overflow:hidden;
        display:grid;
        place-items:center;
      "
    >
      <span
        style="
          font-size:48px;
          font-weight:900;
          color:#666;
        "
      >
        F
      </span>
    </div>

    <p class="eyebrow">
      FREQUENCY / PLAYLIST
    </p>

    <h2 id="playlistViewerName">
      Playlist
    </h2>

    <p
      id="playlistViewerDescription"
      class="muted"
      style="
        line-height:1.6;
        margin-top:10px;
      "
    >
      Playlist
    </p>

    <div
      style="
        margin-top:28px;
        border-top:1px solid #242424;
        padding-top:18px;
      "
    >

      <p class="eyebrow">
        CONTENT
      </p>

      <p
        id="playlistViewerEmpty"
        class="muted"
      >
        This playlist is ready for music.
      </p>

    </div>

  </div>
`;


document.body.appendChild(
  viewer
);


$('#playlistViewerClose')
  ?.addEventListener(
    'click',
    () => {
      closePlaylistViewer();
    }
  );


viewer.addEventListener(
  'click',
  (event) => {

    if (
      event.target ===
      viewer
    ) {

      closePlaylistViewer();

    }

  }
);


return viewer;
}


async function openPlaylistViewer(
playlist
) {

if (!playlist) return;


activePlaylist =
  playlist;


const viewer =
  createPlaylistViewer();

const cover =
  $('#playlistViewerCover');

const name =
  $('#playlistViewerName');

const description =
  $('#playlistViewerDescription');

const empty =
  $('#playlistViewerEmpty');


if (name) {

  name.textContent =
    playlist.name ||
    'Untitled playlist';
}


if (description) {

  description.textContent =
    playlist.description ||
    'No description.';
}


if (empty) {

  empty.textContent =
    'This playlist is ready for music. Add songs to it once playlist track management is connected.';
}


if (cover) {

  cover.innerHTML = `
    <span
      style="
        font-size:48px;
        font-weight:900;
        color:#666;
      "
    >
      F
    </span>
  `;


  if (playlist.cover_path) {

    const url =
      await signedUrl(
        'covers',
        playlist.cover_path,
        coverUrlCache
      );

    if (url) {

      cover.innerHTML = `
        <img
          src="${escapeAttribute(url)}"
          alt=""
          style="
            width:100%;
            height:100%;
            object-fit:cover;
            display:block;
          "
        />
      `;
    }
  }
}


viewer.classList.remove(
  'hidden'
);
}


function closePlaylistViewer() {

const viewer =
  $('#playlistViewer');

if (!viewer) return;

viewer.classList.add(
  'hidden'
);

activePlaylist =
  null;
}


/* =========================================================
 PLAYBACK
========================================================= */

async function playTrack(index) {

const track =
  tracks[index];

if (!track) return;


try {

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

  carouselIndex =
    index;


  audio.src =
    url;

  audio.volume =
    Number(
      $('#volume')?.value ||
      0.8
    );


  updatePlayer(
    track
  );

  updateCarouselPosition();
  updateCarouselMeta();


  await audio.play();

  updatePlayButton();

} catch (error) {

  console.error(
    'Playback error:',
    error
  );

  toast(
    error.message ||
    'Could not play this track.'
  );
}
}


function updatePlayer(track) {

$('#playerTitle').textContent =
  track.title ||
  'Untitled';

$('#playerArtist').textContent =
  track.artist ||
  'Unknown artist';


const cover =
  $('#playerCover');

if (!cover) return;


if (track.cover_path) {

  coverUrl(track)
    .then((url) => {

      if (url) {

        cover.innerHTML = `
          <img
            src="${escapeAttribute(
              url
            )}"
            alt=""
          />
        `;

      } else {

        cover.textContent =
          'F';
      }

    });

} else {

  cover.textContent =
    'F';
}
}


function updatePlayerEmpty() {

$('#playerTitle').textContent =
  'Nothing playing';

$('#playerArtist').textContent =
  'Choose a track';

$('#playerCover').textContent =
  'F';

$('#progress').value =
  0;

$('#currentTime').textContent =
  '0:00';

$('#duration').textContent =
  '0:00';

updatePlayButton();
}


function updatePlayButton() {

const button =
  $('#playBtn');

if (!button) return;

button.textContent =
  audio.paused
    ? '▶'
    : 'Ⅱ';
}


function togglePlay() {

if (
  currentTrackIndex <
  0
) {

  if (tracks.length) {
    playTrack(0);
  }

  return;
}


if (audio.paused) {

  audio.play()
    .catch(
      console.error
    );

} else {

  audio.pause();

}

}


function nextTrack() {

if (!tracks.length) return;


if (shuffled) {

  let next;

  if (
    tracks.length === 1
  ) {

    next = 0;

  } else {

    do {
      next =
        Math.floor(
          Math.random() *
          tracks.length
        );
    } while (
      next ===
      currentTrackIndex
    );
  }

  playTrack(next);

  return;
}


const next =
  currentTrackIndex < 0
    ? 0
    : (
        currentTrackIndex + 1
      ) %
      tracks.length;


playTrack(next);
}


function previousTrack() {

if (!tracks.length) return;


if (
  audio.currentTime >
  3
) {

  audio.currentTime =
    0;

  return;
}


const previous =
  currentTrackIndex <= 0
    ? tracks.length - 1
    : currentTrackIndex - 1;


playTrack(
  previous
);
}


function setupPlayback() {

$('#playBtn')
  ?.addEventListener(
    'click',
    togglePlay
  );

$('#nextBtn')
  ?.addEventListener(
    'click',
    nextTrack
  );

$('#prevBtn')
  ?.addEventListener(
    'click',
    previousTrack
  );


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


$('#repeatBtn')
  ?.addEventListener(
    'click',
    () => {

      repeatMode =
        !repeatMode;

      $('#repeatBtn')
        ?.classList.toggle(
          'active',
          repeatMode
        );

      toast(
        repeatMode
          ? 'Repeat on'
          : 'Repeat off'
      );
    }
  );


$('#progress')
  ?.addEventListener(
    'input',
    () => {

      if (
        !Number.isFinite(
          audio.duration
        )
      ) {
        return;
      }

      const percentage =
        Number(
          $('#progress').value
        );

      audio.currentTime =
        audio.duration *
        (percentage / 100);
    }
  );


$('#volume')
  ?.addEventListener(
    'input',
    () => {

      audio.volume =
        Number(
          $('#volume').value
        );
    }
  );


audio.addEventListener(
  'loadedmetadata',
  () => {

    $('#duration').textContent =
      formatTime(
        audio.duration
      );

  }
);


audio.addEventListener(
  'timeupdate',
  () => {

    if (
      !Number.isFinite(
        audio.duration
      )
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


    $('#currentTime').textContent =
      formatTime(
        audio.currentTime
      );

  }
);


audio.addEventListener(
  'play',
  updatePlayButton
);

audio.addEventListener(
  'pause',
  updatePlayButton
);


audio.addEventListener(
  'ended',
  () => {

    if (repeatMode) {

      audio.currentTime =
        0;

      audio.play()
        .catch(
          console.error
        );

    } else {

      nextTrack();

    }

  }
);


audio.addEventListener(
  'error',
  (event) => {

    console.error(
      'Audio element error:',
      event
    );

    toast(
      'Frequency could not play this audio file.'
    );

    updatePlayButton();
  }
);
}


/* =========================================================
 UPLOAD
========================================================= */

function setupUpload() {

$('#uploadBtn')
  ?.addEventListener(
    'click',
    () => {
      openModal(
        'uploadModal'
      );
    }
  );


$('#emptyUploadBtn')
  ?.addEventListener(
    'click',
    () => {
      openModal(
        'uploadModal'
      );
    }
  );


$('#uploadForm')
  ?.addEventListener(
    'submit',
    uploadTrack
  );
}


async function uploadTrack(event) {

event.preventDefault();

if (
  !sb ||
  !currentUser
) {
  return;
}


const status =
  $('#uploadStatus');

const submit =
  $('#uploadForm button[type="submit"]');


const audioFile =
  $('#trackFile')
    ?.files?.[0];

const coverFile =
  $('#coverFile')
    ?.files?.[0] ||
  null;


const title =
  $('#trackTitle')
    .value
    .trim();

const artist =
  $('#trackArtist')
    .value
    .trim();

const album =
  $('#trackAlbum')
    .value
    .trim();

const genre =
  $('#trackGenre')
    .value
    .trim();

const yearInput =
  $('#trackYear')
    .value
    .trim();


if (!audioFile) {
  return;
}


let year = null;

if (yearInput) {

  year =
    Number(yearInput);

  if (
    !Number.isInteger(year)
  ) {

    if (status) {
      status.textContent =
        'Year must be a number.';
    }

    return;
  }
}


let audioPath = null;
let coverPath = null;


try {

  if (submit) {
    submit.disabled = true;
    submit.textContent =
      'Uploading...';
  }


  if (status) {
    status.textContent =
      'Preparing track...';
  }


  const extension =
    getFileExtension(
      audioFile.name
    );


  const safeName =
    sanitizeFileName(
      audioFile.name
    );


  audioPath =
    `${currentUser.id}/` +
    `${crypto.randomUUID()}-` +
    `${safeName || `track.${extension}`}`;


  const {
    error:
      audioUploadError
  } = await sb.storage
    .from('audio')
    .upload(
      audioPath,
      audioFile,
      {
        upsert: false,
        contentType:
          audioFile.type ||
          undefined
      }
    );


  if (audioUploadError) {
    throw audioUploadError;
  }


  if (status) {
    status.textContent =
      'Uploading artwork...';
  }


  if (coverFile) {

    const coverSafeName =
      sanitizeFileName(
        coverFile.name
      );

    const coverExtension =
      getFileExtension(
        coverFile.name
      );


    coverPath =
      `${currentUser.id}/` +
      `${crypto.randomUUID()}-` +
      `${
        coverSafeName ||
        `cover.${coverExtension}`
      }`;


    const {
      error:
        coverUploadError
    } = await sb.storage
      .from('covers')
      .upload(
        coverPath,
        coverFile,
        {
          upsert: false,
          contentType:
            coverFile.type ||
            undefined
        }
      );


    if (coverUploadError) {
      throw coverUploadError;
    }
  }


  if (status) {
    status.textContent =
      'Adding track to your library...';
  }


  const {
    error:
      insertError
  } = await sb
    .from('tracks')
    .insert({
      user_id:
        currentUser.id,

      title:
        title || 'Untitled',

      artist:
        artist || 'Unknown artist',

      album:
        album || null,

      genre:
        genre || null,

      year,

      audio_path:
        audioPath,

      cover_path:
        coverPath
    });


  if (insertError) {
    throw insertError;
  }


  $('#uploadForm')
    .reset();


  closeModal(
    'uploadModal'
  );


  await loadLibrary();

  renderToken++;
  carouselSignature = '';

  renderCurrentPage();


  toast(
    'Track added to Frequency.'
  );


} catch (error) {

  console.error(
    'Upload error:',
    error
  );


  if (audioPath) {

    await sb.storage
      .from('audio')
      .remove([
        audioPath
      ])
      .catch(
        console.error
      );
  }


  if (coverPath) {

    await sb.storage
      .from('covers')
      .remove([
        coverPath
      ])
      .catch(
        console.error
      );
  }


  if (status) {
    status.textContent =
      error.message ||
      'Could not upload track.';
  }


  toast(
    error.message ||
    'Could not upload track.'
  );


} finally {

  if (submit) {
    submit.disabled = false;
    submit.textContent =
      'Upload track';
  }

}
}


/* =========================================================
 PLAYLIST CREATION
========================================================= */

function setupPlaylists() {

$('#newPlaylistBtn')
  ?.addEventListener(
    'click',
    () => {
      openModal(
        'playlistModal'
      );
    }
  );


$('#playlistForm')
  ?.addEventListener(
    'submit',
    createPlaylist
  );
}


async function createPlaylist(event) {

event.preventDefault();

if (
  !sb ||
  !currentUser
) {
  return;
}


const status =
  $('#playlistStatus');

const button =
  $('#playlistForm button[type="submit"]');


const name =
  $('#playlistName')
    .value
    .trim();

const description =
  $('#playlistDescription')
    .value
    .trim();

const coverFile =
  $('#playlistCover')
    ?.files?.[0] ||
  null;


let coverPath = null;


try {

  if (button) {
    button.disabled = true;
    button.textContent =
      'Creating...';
  }


  if (!name) {

    if (status) {
      status.textContent =
        'Playlist name is required.';
    }

    return;
  }


  if (coverFile) {

    const safeName =
      sanitizeFileName(
        coverFile.name
      );


    coverPath =
      `${currentUser.id}/playlists/` +
      `${crypto.randomUUID()}-` +
      `${safeName}`;


    const {
      error
    } = await sb.storage
      .from('covers')
      .upload(
        coverPath,
        coverFile,
        {
          upsert: false,
          contentType:
            coverFile.type ||
            undefined
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


  $('#playlistForm')
    .reset();


  closeModal(
    'playlistModal'
  );


  await loadPlaylists();

  renderPlaylists();


  toast(
    'Playlist created.'
  );


} catch (error) {

  console.error(
    'Playlist error:',
    error
  );


  if (coverPath) {

    await sb.storage
      .from('covers')
      .remove([
        coverPath
      ])
      .catch(
        console.error
      );
  }


  if (status) {
    status.textContent =
      error.message ||
      'Could not create playlist.';
  }


  toast(
    error.message ||
    'Could not create playlist.'
  );


} finally {

  if (button) {
    button.disabled = false;
    button.textContent =
      'Create playlist';
  }

}
}


/* =========================================================
 MODALS
========================================================= */

function openModal(id) {

const modal =
  $(`#${id}`);

if (!modal) return;

modal.classList.remove(
  'hidden'
);
}


function closeModal(id) {

const modal =
  $(`#${id}`);

if (!modal) return;

modal.classList.add(
  'hidden'
);
}


function setupModals() {

$$('[data-close]')
  .forEach(
    (button) => {

      button.addEventListener(
        'click',
        () => {

          closeModal(
            button.dataset.close
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

            closeModal(
              modal.id
            );

          }

        }
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

    const target =
      event.target;

    const isTyping =
      target instanceof
        HTMLInputElement ||
      target instanceof
        HTMLTextAreaElement;


    if (
      event.key ===
      'Escape'
    ) {

      $$('.modal:not(.hidden)')
        .forEach(
          (modal) => {
            closeModal(
              modal.id
            );
          }
        );

      closePlaylistViewer();

      return;
    }


    if (isTyping) {
      return;
    }


    if (
      event.code ===
      'Space'
    ) {

      event.preventDefault();

      togglePlay();

      return;
    }


    if (
      currentPage ===
      'library' &&
      viewMode ===
      'collection'
    ) {

      if (
        event.key ===
        'ArrowLeft'
      ) {

        event.preventDefault();
        carouselPrevious();

      } else if (
        event.key ===
        'ArrowRight'
      ) {

        event.preventDefault();
        carouselNext();
      }

      return;
    }


    if (
      event.key ===
      'ArrowLeft'
    ) {

      event.preventDefault();
      previousTrack();

    } else if (
      event.key ===
      'ArrowRight'
    ) {

      event.preventDefault();
      nextTrack();
    }

  }
);
}


/* =========================================================
 HELPERS
========================================================= */

function formatTime(seconds) {

if (
  !Number.isFinite(seconds) ||
  seconds < 0
) {
  return '0:00';
}


const minutes =
  Math.floor(
    seconds / 60
  );

const remaining =
  Math.floor(
    seconds % 60
  );


return (
  `${minutes}:` +
  `${String(
    remaining
  ).padStart(2, '0')}`
);
}


function getFileExtension(
filename
) {

if (!filename) {
  return 'bin';
}

const parts =
  filename
    .split('.');

return (
  parts.length > 1
    ? parts.pop()
        .toLowerCase()
    : 'bin'
);
}


function sanitizeFileName(
filename
) {

return String(
  filename || ''
)
  .replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  )
  .slice(
    0,
    150
  );
}


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

return escapeHtml(
  value
);
}


/* =========================================================
 GENERAL EVENTS
========================================================= */

function setupGeneralEvents() {

$('#playActive')
  ?.addEventListener(
    'click',
    () => {

      if (
        carouselIndex >= 0 &&
        tracks[carouselIndex]
      ) {

        playTrack(
          carouselIndex
        );
      }

    }
  );


$('#signOutBtn')
  ?.addEventListener(
    'click',
    signOut
  );
}


/* =========================================================
 INIT
========================================================= */

async function init() {

setupAuth();
setupAuthListener();

setupNavigation();
setupViewSwitcher();

setupCarouselGestures();

setupSearch();

setupUpload();

setupPlaylists();

setupPlayback();

setupModals();

setupKeyboard();

setupGeneralEvents();


if (!sb) {

  showAuth();

  const status =
    $('#authStatus');

  if (status) {
    status.textContent =
      'Supabase configuration is missing.';
  }

  return;
}


try {

  currentUser =
    await getUser();


  if (currentUser) {

    showApp();

  } else {

    showAuth();

  }

} catch (error) {

  console.error(
    'Initialization error:',
    error
  );

  showAuth();

}
}


init();
$$$
