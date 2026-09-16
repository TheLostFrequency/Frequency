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

function room(name) {
    rooms.forEach(roomName => {
        const section = $(`room-${roomName}`);
        if (section) section.classList.toggle('active-room', roomName === name);
    });
    nav.forEach(button => button.classList.toggle('active', button.dataset.tab === name));
    if (name === 'list') renderList();
}

nav.forEach(button => {
    button.addEventListener('click', () => room(button.dataset.tab));
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

function fileName(labelId, inputId, emptyText) {
    $(inputId).addEventListener('change', () => {
        $(labelId).textContent = $(inputId).files[0]?.name || emptyText;
    });
}

fileName('audio-file-name', 'audio-file', 'Choose an audio file');
fileName('cover-file-name', 'cover-file', 'Optional cover image');

$('upload-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!authUser || !supabase) return;

    const form = new FormData(event.currentTarget);
    const audioFile = form.get('audio');
    const coverFile = form.get('cover');

    if (!audioFile?.size) {
        $('upload-progress').textContent = 'Select an audio file.';
        return;
    }

    $('submit-upload').disabled = true;
    $('upload-progress').textContent = 'UPLOADING SIGNAL...';

    try {
        const base = `${authUser.id}/${crypto.randomUUID()}`;
        const audioPath = `${base}-${audioFile.name.replace(/[^a-z0-9._-]/gi, '_')}`;
        let result = await supabase.storage.from('audio').upload(audioPath, audioFile, {
            contentType: audioFile.type || 'audio/mpeg',
            upsert: false
        });
        if (result.error) throw result.error;

        let coverPath = null;
        if (coverFile?.size) {
            coverPath = `${base}-${coverFile.name.replace(/[^a-z0-9._-]/gi, '_')}`;
            result = await supabase.storage.from('covers').upload(coverPath, coverFile, {
                contentType: coverFile.type || 'image/jpeg',
                upsert: false
            });
            if (result.error) throw result.error;
        }

        const { error } = await supabase.from('tracks').insert({
            user_id: authUser.id,
            title: form.get('title'),
            artist: form.get('artist'),
            album: form.get('album') || null,
            genre: form.get('genre') || null,
            audio_path: audioPath,
            cover_path: coverPath
        });
        if (error) throw error;

        $('upload-dialog').close();
        event.currentTarget.reset();
        $('audio-file-name').textContent = 'Choose an audio file';
        $('cover-file-name').textContent = 'Optional cover image';
        await load();
        toast('Signal added to the vault.');
    } catch (error) {
        console.error('Signal upload failed:', error);
        $('upload-progress').textContent = error.message || 'Upload failed.';
    } finally {
        $('submit-upload').disabled = false;
    }
});

supabase?.auth.onAuthStateChange((_event, sessionData) => {
    authUser = sessionData?.user || null;
    profile();
});

session().then(load);
