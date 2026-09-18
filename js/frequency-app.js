import { AudioPlayer } from './audioPlayer.js';
import { AudioAnalyzer } from './eq.js';
import { supabase } from './supabaseClient.js';

const player = new AudioPlayer();
const analyzer = new AudioAnalyzer(player.audio);
let playlist = [];
let currentIndex = 0;
let shuffle = false;
let authUser = null;
let selectionToken = 0;

const $ = id => document.getElementById(id);
const rooms = ['collection', 'list', 'equalizer', 'transmission', 'profile'];
const nav = [...document.querySelectorAll('.nav-tab')];
const wheel = $('song-wheel');
const selector = $('song-selector');
const eq = [...document.querySelectorAll('.eq-bands input')];

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
}[char]));

const fmt = seconds => Number.isFinite(seconds)
    ? `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
    : '00:00';

async function signedUrl(bucket, path) {
    if (!supabase || !path) return '';
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (error) {
        console.warn(`Could not create signed ${bucket} URL:`, error);
        return '';
    }
    return data?.signedUrl || '';
}

async function hydrateCovers(tracks) {
    return Promise.all(tracks.map(async track => ({
        ...track,
        _coverUrl: track.cover_path
            ? (await signedUrl('covers', track.cover_path)) || 'assets/default-art.jpg'
            : 'assets/default-art.jpg'
    })));
}

const cover = track => track?._coverUrl || 'assets/default-art.jpg';

function toast(message) {
    const element = $('toast');
    element.textContent = message;
    element.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove('show'), 2500);
}

let roomTransitionBusy = false;

function room(name) {
    if (!rooms.includes(name)) return;
    const current = rooms.find(roomName => $(`room-${roomName}`)?.classList.contains('active-room'));
    if (current === name || roomTransitionBusy) return;

    const transition = $('room-transition');
    const transitionIndex = transition?.querySelector('.room-transition-index');
    const transitionName = transition?.querySelector('.room-transition-name');
    const destination = $(`room-${name}`);

    if (!transition || !destination) {
        rooms.forEach(roomName => {
            const section = $(`room-${roomName}`);
            if (section) section.classList.toggle('active-room', roomName === name);
        });
        nav.forEach(button => button.classList.toggle('active', button.dataset.tab === name));
        if (name === 'list') renderList();
        return;
    }

    roomTransitionBusy = true;
    const index = String(rooms.indexOf(name) + 1).padStart(2, '0');
    const labels = { collection:'ARCHIVE CHAMBER', list:'ARCHIVE INDEX', equalizer:'AUDIO COMMAND CENTER', transmission:'TRANSMISSION CHAMBER', profile:'PRIVATE CHAMBER' };
    transitionIndex.textContent = `ROOM ${index}`;
    transitionName.textContent = labels[name] || name.toUpperCase();
    document.body.classList.remove('room-arriving');
    document.body.classList.add('room-entering');

    window.setTimeout(() => {
        rooms.forEach(roomName => {
            const section = $(`room-${roomName}`);
            if (section) section.classList.toggle('active-room', roomName === name);
        });
        nav.forEach(button => button.classList.toggle('active', button.dataset.tab === name));
        if (name === 'list') renderList();

        document.body.classList.remove('room-entering');
        document.body.classList.add('room-arriving');

        window.setTimeout(() => {
            document.body.classList.remove('room-arriving');
            roomTransitionBusy = false;
        }, 400);
    }, 300);
}

nav.forEach(button => {
    button.addEventListener('click', event => {
        event.preventDefault();
        const destination = button.dataset.tab;
        if (!rooms.includes(destination)) return;

        const current = rooms.find(roomName => $(`room-${roomName}`)?.classList.contains('active-room'));
        if (current === destination || roomTransitionBusy) return;

        const transition = $('room-transition');
        const transitionIndex = transition?.querySelector('.room-transition-index');
        const transitionName = transition?.querySelector('.room-transition-name');
        const destinationRoom = $(`room-${destination}`);

        if (!transition || !transitionIndex || !transitionName || !destinationRoom) {
            room(destination);
            return;
        }

        roomTransitionBusy = true;
        const index = String(rooms.indexOf(destination) + 1).padStart(2, '0');
        const labels = {
            collection: 'ARCHIVE CHAMBER',
            list: 'ARCHIVE INDEX',
            equalizer: 'AUDIO COMMAND CENTER',
            transmission: 'TRANSMISSION CHAMBER',
            profile: 'PRIVATE CHAMBER'
        };

        transitionIndex.textContent = `ROOM ${index}`;
        transitionName.textContent = labels[destination] || destination.toUpperCase();

        document.body.classList.remove('room-arriving');
        void transition.offsetWidth;
        document.body.classList.add('room-entering');

        window.setTimeout(() => {
            rooms.forEach(roomName => {
                const section = $(`room-${roomName}`);
                if (section) section.classList.toggle('active-room', roomName === destination);
            });
            nav.forEach(item => item.classList.toggle('active', item === button));
            if (destination === 'list') renderList();

            document.body.classList.remove('room-entering');
            document.body.classList.add('room-arriving');

            window.setTimeout(() => {
                document.body.classList.remove('room-arriving');
                roomTransitionBusy = false;
            }, 2000);
        }, 4500);
    });
});

$('brand-button').addEventListener('click', () => room('collection'));

$('upload-button').addEventListener('click', () => {
    if (!authUser) {
        $('auth-dialog').showModal();
        toast('Enter your vault before uploading.');
        return;
    }
    $('upload-dialog').showModal();
});

document.querySelectorAll('[data-close]').forEach(button => {
    button.addEventListener('click', () => $(button.dataset.close).close());
});

function profile() {
    $('profile-title').textContent = authUser
        ? (authUser.email?.split('@')[0] || 'VAULT OWNER')
        : 'PRIVATE SESSION';
    $('profile-status').textContent = authUser
        ? 'Private vault connected. Your signals and cover art belong to this session.'
        : 'Sign in to unlock your private vault and uploads.';
    $('auth-open').classList.toggle('hidden', !!authUser);
    $('sign-out').classList.toggle('hidden', !authUser);
}

async function session() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    authUser = data.session?.user || null;
    profile();
}

$('auth-open').addEventListener('click', () => $('auth-dialog').showModal());

$('sign-out').addEventListener('click', async () => {
    await supabase?.auth.signOut();
    authUser = null;
    currentIndex = 0;
    player.pause();
    renderEmpty();
    profile();
    toast('Vault session closed.');
});

$('auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (!supabase) {
        $('auth-message').textContent = 'Vault service is unavailable.';
        return;
    }
    $('auth-message').textContent = 'AUTHENTICATING...';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
        $('auth-message').textContent = error.message;
        return;
    }
    authUser = data.user;
    $('auth-dialog').close();
    profile();
    await load();
    toast('Vault unlocked.');
});

$('auth-signup').addEventListener('click', async () => {
    const email = $('auth-email').value.trim();
    const password = $('auth-password').value;
    if (!supabase) {
        $('auth-message').textContent = 'Vault service is unavailable.';
        return;
    }
    if (password.length < 6) {
        $('auth-message').textContent = 'Password must be at least 6 characters.';
        return;
    }
    $('auth-message').textContent = 'CREATING VAULT...';
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
        $('auth-message').textContent = error.message;
        return;
    }
    if (data.session) {
        authUser = data.user;
        $('auth-dialog').close();
        profile();
        await load();
        toast('Vault created.');
    } else {
        $('auth-message').textContent = 'Check your email to confirm the vault.';
    }
});

async function load() {
    if (!supabase || !authUser) {
        renderEmpty();
        return;
    }

    const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) {
        renderEmpty();
        toast('Could not read the vault.');
        console.error('Vault load failed:', error);
        return;
    }

    playlist = await hydrateCovers(data || []);
    currentIndex = Math.min(currentIndex, Math.max(0, playlist.length - 1));

    if (playlist.length) {
        await select(false);
    } else {
        renderEmpty();
    }
}

function renderEmpty() {
    playlist = [];
    currentIndex = 0;
    $('current-album-art').src = 'assets/default-art.jpg';
    $('player-thumb').src = 'assets/default-art.jpg';
    $('hero-title').textContent = 'VAULT EMPTY';
    $('hero-artist').textContent = authUser ? 'UPLOAD A SIGNAL' : 'ENTER YOUR VAULT';
    $('player-title').textContent = 'VAULT EMPTY';
    $('player-artist').textContent = 'NO SIGNAL';
    $('player-status-label').textContent = 'STAND BY';
    $('current-time').textContent = '00:00';
    $('total-time').textContent = '00:00';
    $('wave-progress').style.left = '0%';
    wheel.innerHTML = `<div class="song-item active"><strong>VAULT EMPTY</strong><small>${authUser ? 'UPLOAD YOUR FIRST SIGNAL' : 'ENTER YOUR VAULT'}</small></div>`;
}

async function select(auto = false) {
    const track = playlist[currentIndex];
    if (!track) {
        renderEmpty();
        return;
    }

    const token = ++selectionToken;
    const art = cover(track);
    $('current-album-art').src = art;
    $('player-thumb').src = art;
    $('hero-title').textContent = track.title || 'UNTITLED';
    $('hero-artist').textContent = track.artist || 'UNKNOWN ARTIST';
    $('player-title').textContent = track.title || 'UNTITLED';
    $('player-artist').textContent = track.artist || 'UNKNOWN ARTIST';
    $('player-status-label').textContent = 'LOADING';

    const audioUrl = await signedUrl('audio', track.audio_path);
    if (token !== selectionToken) return;

    if (!audioUrl) {
        $('player-status-label').textContent = 'SIGNAL UNAVAILABLE';
        toast('Could not open this signal.');
        return;
    }

    player.load({ audioUrl });
    player.setMediaSessionTrack({
        title: track.title || 'Untitled',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Frequency',
        artwork: art
    });
    renderWheel();

    if (analyzer.isInitialized) {
        analyzer.resume();
        eq.forEach((input, index) => analyzer.setBand(index, input.value));
    }

    if (auto) {
        analyzer.init();
        analyzer.resume();
        await player.play();
    }
}

function renderWheel() {
    wheel.innerHTML = '';
    playlist.forEach((track, index) => {
        const distance = index - currentIndex;
        const button = document.createElement('button');
        button.className = `song-item ${index === currentIndex ? 'active' : ''}`;
        button.style.opacity = Math.max(0.12, 1 - Math.abs(distance) * 0.17);
        button.style.transform = `translateX(${Math.min(30, Math.abs(distance) * 4)}px) scale(${Math.max(0.72, 1 - Math.abs(distance) * 0.045)})`;
        button.innerHTML = `<strong>${esc(track.title || 'Untitled')}</strong><small>${esc(track.artist || 'Unknown Artist')}</small>`;
        button.addEventListener('click', () => {
            currentIndex = index;
            select(true);
        });
        wheel.appendChild(button);
    });
}

function move(direction, auto = true) {
    if (!playlist.length) return;
    currentIndex = shuffle
        ? Math.floor(Math.random() * playlist.length)
        : (currentIndex + direction + playlist.length) % playlist.length;
    select(auto);
}

selector.addEventListener('wheel', event => {
    if (!playlist.length) return;
    event.preventDefault();
    move(event.deltaY > 0 ? 1 : -1, true);
}, { passive: false });

let touchY = null;
selector.addEventListener('pointerdown', event => {
    touchY = event.clientY;
    selector.setPointerCapture?.(event.pointerId);
});
selector.addEventListener('pointerup', event => {
    if (touchY === null || !playlist.length) return;
    const distance = touchY - event.clientY;
    touchY = null;
    if (Math.abs(distance) > 22) move(distance > 0 ? 1 : -1, true);
});

$('play-pause-btn').addEventListener('click', async () => {
    if (!playlist.length) {
        if (!authUser) $('auth-dialog').showModal();
        else $('upload-dialog').showModal();
        return;
    }
    analyzer.init();
    analyzer.resume();
    await player.togglePlay();
});

$('next-btn').addEventListener('click', () => move(1, true));
$('prev-btn').addEventListener('click', () => move(-1, true));

// Connect browser lock-screen / headset track controls to the same player controls.
player.onNextTrack = () => move(1, true);
player.onPreviousTrack = () => move(-1, true);
$('shuffle-btn').addEventListener('click', () => {
    shuffle = !shuffle;
    $('shuffle-btn').classList.toggle('active', shuffle);
    toast(shuffle ? 'SHUFFLE ACTIVE' : 'SHUFFLE OFF');
});

player.onEnded = () => move(1, true);
player.onPlayStateChange = playing => {
    $('play-icon').textContent = playing ? 'Ⅱ' : '▶';
    $('player-status-label').textContent = playing ? 'SIGNAL ACTIVE' : 'PAUSED';
    $('player-status-label').previousElementSibling?.classList.toggle('live', playing);
};
player.onTimeUpdate = (time, duration) => {
    $('current-time').textContent = fmt(time);
    $('total-time').textContent = fmt(duration);
    $('wave-progress').style.left = `${duration ? (time / duration) * 100 : 0}%`;
};
player.audio.addEventListener('error', () => {
    $('player-status-label').textContent = 'SIGNAL ERROR';
    toast('This signal could not be played.');
});

$('waveform-container').addEventListener('click', event => {
    if (!player.duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    player.seek((event.clientX - rect.left) / rect.width * player.duration);
});

function renderList() {
    $('list-count').textContent = `${playlist.length} SIGNALS`;
    $('list-container').innerHTML = playlist.length
        ? playlist.map((track, index) => `
            <button class="list-row ${index === currentIndex ? 'current' : ''}" data-i="${index}">
                <img src="${esc(cover(track))}" alt="">
                <div><strong>${esc(track.title || 'Untitled')}</strong><small>${esc(track.artist || 'Unknown Artist')}</small></div>
                <em>${esc(track.album || 'VAULT SIGNAL')}</em>
            </button>`).join('')
        : '<div class="profile-status">No signals in the vault.</div>';

    document.querySelectorAll('.list-row').forEach(row => {
        row.addEventListener('click', () => {
            currentIndex = Number(row.dataset.i);
            select(true);
            room('collection');
        });
    });
}

function eqDraw() {
    const values = eq.map(input => Number(input.value));
    if (analyzer.isInitialized) values.forEach((value, index) => analyzer.setBand(index, value));
    $('eq-status').textContent = values.every(value => value === 0)
        ? 'FLAT'
        : `${values.filter(value => value !== 0).length} BANDS ACTIVE`;
}

eq.forEach(input => input.addEventListener('input', eqDraw));
$('eq-reset').addEventListener('click', () => {
    eq.forEach(input => input.value = 0);
    analyzer.reset();
    eqDraw();
});
eqDraw();

function drawWaveform() {
    const collectionActive = $('room-collection')?.classList.contains('active-room');
    if (!collectionActive || document.hidden) {
        setTimeout(() => requestAnimationFrame(drawWaveform), 250);
        return;
    }
    const canvas = $('waveform-canvas');
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const data = analyzer.getWaveformData();
    context.beginPath();
    for (let pixel = 0; pixel < width; pixel += 1) {
        const index = data.length ? Math.floor(pixel / width * data.length) : 0;
        const value = data.length ? (data[index] - 128) / 128 : 0;
        const y = height / 2 + value * height * 0.38;
        pixel ? context.lineTo(pixel, y) : context.moveTo(pixel, y);
    }
    context.strokeStyle = 'rgba(255,255,255,.72)';
    context.stroke();
    requestAnimationFrame(drawWaveform);
}

drawWaveform();

const uploadQueue = [];

function resetUploadQueue() {
    uploadQueue.forEach(item => { URL.revokeObjectURL(item.objectUrl); if (item.coverUrl) URL.revokeObjectURL(item.coverUrl); });
    uploadQueue.length = 0;
    renderUploadQueue();
    $('upload-progress').textContent = '';
    $('submit-upload').disabled = true;
    $('audio-files').value = '';
}

function formatFileSize(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return (bytes / Math.pow(1024, index)).toFixed(index ? 1 : 0) + ' ' + units[index];
}

function createUploadItem(file) {
    return { id: crypto.randomUUID(), audioFile: file, title: file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim(), artist: '', album: '', genre: '', coverFile: null, coverUrl: '', objectUrl: URL.createObjectURL(file) };
}

function renderUploadQueue() {
    const queue = $('upload-queue');
    $('upload-count').textContent = uploadQueue.length + ' SIGNAL' + (uploadQueue.length === 1 ? '' : 'S');
    $('submit-upload').disabled = !uploadQueue.length;
    queue.innerHTML = uploadQueue.length ? uploadQueue.map(item => {
        return '<article class="upload-item" data-upload-id="' + item.id + '">' +
            '<div class="upload-art-wrap"><img class="upload-art" src="' + esc(item.coverUrl || 'assets/default-art.jpg') + '" alt=""><label class="cover-change" title="Change cover"><span>ART</span><input class="cover-input" type="file" accept="image/*" data-upload-id="' + item.id + '"></label></div>' +
            '<div class="upload-file-meta"><strong>' + esc(item.audioFile.name) + '</strong><small>' + formatFileSize(item.audioFile.size) + '</small></div>' +
            '<div class="upload-fields">' +
                '<label>TITLE<input data-field="title" data-upload-id="' + item.id + '" value="' + esc(item.title) + '" required></label>' +
                '<label>ARTIST<input data-field="artist" data-upload-id="' + item.id + '" value="' + esc(item.artist) + '" placeholder="Artist" required></label>' +
                '<label>ALBUM<input data-field="album" data-upload-id="' + item.id + '" value="' + esc(item.album) + '" placeholder="Album"></label>' +
                '<label>GENRE<input data-field="genre" data-upload-id="' + item.id + '" value="' + esc(item.genre) + '" placeholder="Genre"></label>' +
            '</div><button type="button" class="upload-remove" data-remove-upload="' + item.id + '" aria-label="Remove signal">×</button></article>';
    }).join('') : '<div class="upload-empty">Your upload queue is empty.</div>';

    queue.querySelectorAll('[data-field]').forEach(input => input.addEventListener('input', event => {
        const item = uploadQueue.find(entry => entry.id === event.currentTarget.dataset.uploadId);
        if (item) item[event.currentTarget.dataset.field] = event.currentTarget.value;
    }));
    queue.querySelectorAll('.cover-input').forEach(input => input.addEventListener('change', event => {
        const item = uploadQueue.find(entry => entry.id === event.currentTarget.dataset.uploadId);
        const file = event.currentTarget.files?.[0];
        if (!item || !file) return;
        if (item.coverUrl) URL.revokeObjectURL(item.coverUrl);
        item.coverFile = file; item.coverUrl = URL.createObjectURL(file); renderUploadQueue();
    }));
    queue.querySelectorAll('[data-remove-upload]').forEach(button => button.addEventListener('click', () => {
        const index = uploadQueue.findIndex(item => item.id === button.dataset.removeUpload);
        if (index === -1) return;
        const removed = uploadQueue.splice(index, 1)[0];
        URL.revokeObjectURL(removed.objectUrl); if (removed.coverUrl) URL.revokeObjectURL(removed.coverUrl);
        renderUploadQueue();
    }));
}

function addAudioFiles(files) {
    [...files].filter(file => file.type.startsWith('audio/')).forEach(file => {
        const duplicate = uploadQueue.some(item => item.audioFile.name === file.name && item.audioFile.size === file.size && item.audioFile.lastModified === file.lastModified);
        if (!duplicate) uploadQueue.push(createUploadItem(file));
    });
    renderUploadQueue();
}

const audioDropZone = $('audio-drop-zone');
const audioFiles = $('audio-files');
audioDropZone.addEventListener('dragover', event => { event.preventDefault(); audioDropZone.classList.add('dragging'); });
audioDropZone.addEventListener('dragleave', event => { if (!audioDropZone.contains(event.relatedTarget)) audioDropZone.classList.remove('dragging'); });
audioDropZone.addEventListener('drop', event => { event.preventDefault(); audioDropZone.classList.remove('dragging'); addAudioFiles(event.dataTransfer.files); });
audioFiles.addEventListener('change', event => addAudioFiles(event.currentTarget.files));

$('upload-button').addEventListener('click', () => {
    if (!authUser) return;
    resetUploadQueue();
});

$('upload-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!authUser || !supabase || !uploadQueue.length) return;
    const invalid = uploadQueue.find(item => !item.title.trim() || !item.artist.trim());
    if (invalid) {
        $('upload-progress').textContent = 'Every signal needs a title and artist.';
        document.querySelector('[data-upload-id="' + invalid.id + '"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }
    $('submit-upload').disabled = true;
    const total = uploadQueue.length;
    try {
        for (let index = 0; index < total; index += 1) {
            const item = uploadQueue[index];
            $('upload-progress').textContent = 'UPLOADING ' + (index + 1) + ' / ' + total + ' — ' + item.title;
            const base = authUser.id + '/' + crypto.randomUUID();
            const audioPath = base + '-' + item.audioFile.name.replace(/[^a-z0-9._-]/gi, '_');
            let result = await supabase.storage.from('audio').upload(audioPath, item.audioFile, { contentType: item.audioFile.type || 'audio/mpeg', upsert: false });
            if (result.error) throw result.error;
            let coverPath = null;
            if (item.coverFile?.size) {
                coverPath = base + '-' + item.coverFile.name.replace(/[^a-z0-9._-]/gi, '_');
                result = await supabase.storage.from('covers').upload(coverPath, item.coverFile, { contentType: item.coverFile.type || 'image/jpeg', upsert: false });
                if (result.error) throw result.error;
            }
            const { error } = await supabase.from('tracks').insert({ user_id: authUser.id, title: item.title.trim(), artist: item.artist.trim(), album: item.album.trim() || null, genre: item.genre.trim() || null, audio_path: audioPath, cover_path: coverPath });
            if (error) throw error;
        }
        $('upload-dialog').close();
        uploadQueue.forEach(item => { URL.revokeObjectURL(item.objectUrl); if (item.coverUrl) URL.revokeObjectURL(item.coverUrl); });
        uploadQueue.length = 0; renderUploadQueue(); $('upload-progress').textContent = '';
        await load();
        toast(total + ' ' + (total === 1 ? 'signal' : 'signals') + ' added to the vault.');
    } catch (error) {
        console.error('Signal upload failed:', error);
        $('upload-progress').textContent = error.message || 'Upload failed. The remaining signals are still in the queue.';
        renderUploadQueue();
    } finally {
        $('submit-upload').disabled = !uploadQueue.length;
    }
});

renderUploadQueue();

supabase?.auth.onAuthStateChange((_event, sessionData) => {
    authUser = sessionData?.user || null;
    profile();
});

session().then(load);
