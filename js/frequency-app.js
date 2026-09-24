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

const signedUrlCache = new Map();
const signedUrlPending = new Map();

async function signedUrl(bucket, path) {
    if (!supabase || !path) return '';

    const key = bucket + ':' + path;
    const cached = signedUrlCache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.url;

    const pending = signedUrlPending.get(key);
    if (pending) return pending;

    const request = supabase.storage.from(bucket).createSignedUrl(path, 3600)
        .then(({ data, error }) => {
            if (error) {
                console.warn(`Could not create signed ${bucket} URL:`, error);
                return '';
            }
            const url = data?.signedUrl || '';
            if (url) {
                // Reuse the same signed URL for almost its full lifetime. This
                // avoids a fresh network round-trip every time a track is selected.
                signedUrlCache.set(key, { url, expiresAt: Date.now() + 50 * 60 * 1000 });
            }
            return url;
        })
        .finally(() => signedUrlPending.delete(key));

    signedUrlPending.set(key, request);
    return request;
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
            }, 700);
        }, 300);
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

let profileUsername = '';

async function getProfileUsername() {
    if (!supabase || !authUser) return '';
    const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', authUser.id)
        .maybeSingle();
    if (error) {
        console.warn('Could not load Frequency username:', error);
        return '';
    }
    return data?.username || '';
}

async function profile() {
    profileUsername = authUser ? await getProfileUsername() : '';
    const origin = $('transmission-origin-name');
    if (origin) origin.textContent = profileUsername || 'USERNAME NOT SET';
    $('profile-title').textContent = authUser
        ? (profileUsername ? '@' + profileUsername : 'USERNAME NOT SET')
        : 'PRIVATE SESSION';
    $('profile-status').textContent = authUser
        ? (profileUsername
            ? 'Private vault connected. Your signals and cover art belong to this session.'
            : 'Set a username so other Frequency stations can find you for transmissions.')
        : 'Sign in to unlock your private vault and uploads.';
    $('auth-open').classList.toggle('hidden', !!authUser);
    $('sign-out').classList.toggle('hidden', !authUser);
    $('edit-username').classList.toggle('hidden', !authUser);
}

async function session() {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    authUser = data.session?.user || null;
    profile();
}

$('auth-open').addEventListener('click', () => $('auth-dialog').showModal());

$('edit-username').addEventListener('click', async () => {
    if (!authUser) return;
    $('username-input').value = profileUsername;
    $('username-message').textContent = '';
    $('username-dialog').showModal();
});

$('username-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!authUser || !supabase) return;

    const username = $('username-input').value.trim().replace(/^@+/, '').toLowerCase();
    if (!/^[a-z0-9_]{3,24}$/.test(username)) {
        $('username-message').textContent = 'Use 3–24 letters, numbers, or underscores.';
        return;
    }

    $('username-message').textContent = 'UPDATING STATION ID...';
    const { error } = await supabase
        .from('profiles')
        .upsert({ id: authUser.id, username }, { onConflict: 'id' });

    if (error) {
        $('username-message').textContent = error.code === '23505'
            ? 'That username is already in use.'
            : (error.message || 'Could not update username.');
        return;
    }

    profileUsername = username;
    $('username-dialog').close();
    await profile();
    toast('Username updated to @' + username + '.');
});


let transmissionRecipientId = '';
let transmissionRecipientUsername = '';
let transmissionTrack = null;
let incomingTransmissionPollTimer = null;
let incomingTransmissionItems = new Map();
let transmissionAlertItem = null;

function syncTransmissionDestination() {
    const label = '@' + (transmissionRecipientUsername || 'WAITING');
    if (transmissionDestination) transmissionDestination.textContent = label;
    const pickerDestination = $('transmission-picker-destination');
    if (pickerDestination) pickerDestination.textContent = label;

    const state = document.querySelector('.transmission-state');
    if (state) {
        state.textContent = transmissionRecipientId ? 'DESTINATION LOCKED' : 'READY';
        state.classList.toggle('locked', !!transmissionRecipientId);
    }

    const status = $('transmission-status');
    if (status && !transmissionTrack) {
        status.textContent = transmissionRecipientId ? 'DESTINATION LOCKED // SELECT A SIGNAL' : 'READY TO TRANSMIT';
    }
}

function renderTransmissionTracks() {
    const list = $('transmission-track-list');
    if (!list) return;
    if (!playlist.length) {
        list.innerHTML = '<div class="transmission-track-empty">NO SIGNALS IN YOUR VAULT</div>';
        return;
    }

    list.innerHTML = playlist.map((track, index) =>
        '<button type="button" class="transmission-track-option ' + (transmissionTrack?.id === track.id ? 'selected' : '') + '" data-track-index="' + index + '">' +
        '<img src="' + esc(cover(track)) + '" alt="">' +
        '<span><strong>' + esc(track.title || 'Untitled') + '</strong><small>' + esc(track.artist || 'Unknown Artist') + '</small></span>' +
        '<em>' + (transmissionTrack?.id === track.id ? 'SELECTED' : 'SEND') + '</em></button>'
    ).join('');

    list.querySelectorAll('.transmission-track-option').forEach(button => {
        button.addEventListener('click', () => {
            transmissionTrack = playlist[Number(button.dataset.trackIndex)] || null;
            $('transmission-track-title').textContent = transmissionTrack?.title || 'SELECT A SIGNAL';
            $('transmission-track-artist').textContent = transmissionTrack?.artist || 'NO MUSIC SELECTED';
            const art = $('transmission-track-art');
            if (art) art.src = cover(transmissionTrack);
            const status = $('transmission-status');
            if (status) status.textContent = transmissionTrack ? 'SIGNAL ARMED // READY TO TRANSMIT' : 'READY TO TRANSMIT';
            renderTransmissionTracks();
            toast('Signal selected: ' + (transmissionTrack?.title || 'Untitled'));
        });
    });
}

async function openTransmissionPicker() {
    if (!authUser) {
        $('auth-dialog').showModal();
        toast('Enter your vault before transmitting.');
        return;
    }
    // Let the picker open before a destination is chosen. This allows the
    // user to select the song first and lock the receiving station afterward.
    syncTransmissionDestination();

    // Refresh the private vault list when the picker opens so newly loaded
    // or newly uploaded signals are always available for selection.
    if (!playlist.length) await load();

    // Default to the currently selected song when possible, while still
    // allowing the user to choose a different signal.
    if (!transmissionTrack && playlist.length) {
        transmissionTrack = playlist[
            Math.max(0, Math.min(currentIndex, playlist.length - 1))
        ] || playlist[0];
    }

    if (transmissionTrack) {
        $('transmission-track-title').textContent = transmissionTrack.title || 'SELECT A SIGNAL';
        $('transmission-track-artist').textContent = transmissionTrack.artist || 'NO MUSIC SELECTED';
        const art = $('transmission-track-art');
        if (art) art.src = cover(transmissionTrack);
    }

    renderTransmissionTracks();
    $('transmission-message').value = '';
    $('transmission-message-status').textContent = '';
    $('transmission-dialog').showModal();
}

document.querySelector('.transmission-signal')?.addEventListener('click', openTransmissionPicker);
$('transmit-signal-btn').addEventListener('click', openTransmissionPicker);

$('transmission-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!authUser || !supabase) return;

    if (!transmissionRecipientId) {
        $('transmission-message-status').textContent = 'SELECT A DESTINATION FIRST.';
        return;
    }
    if (!transmissionTrack) {
        $('transmission-message-status').textContent = 'SELECT A SIGNAL FIRST.';
        return;
    }

    const button = $('confirm-transmission');
    button.disabled = true;
    $('transmission-message-status').textContent = 'OPENING PRIVATE CHANNEL...';

    const { error } = await supabase.from('transmissions').insert({
        sender_id: authUser.id,
        recipient_id: transmissionRecipientId,
        track_id: transmissionTrack.id,
        title: transmissionTrack.title || 'Untitled',
        artist: transmissionTrack.artist || 'Unknown Artist',
        album: transmissionTrack.album || null,
        audio_path: transmissionTrack.audio_path,
        cover_path: transmissionTrack.cover_path || null,
        message: $('transmission-message').value.trim() || null
    });

    if (error) {
        console.error('Transmission failed:', error);
        $('transmission-message-status').textContent = error.message || 'TRANSMISSION FAILED.';
        button.disabled = false;
        return;
    }

    $('transmission-dialog').close();
    button.disabled = false;

    // Keep the successful transmission visible long enough to be unmistakable.
    const sentTo = transmissionRecipientUsername || 'UNKNOWN STATION';
    if ($('transmission-status')) $('transmission-status').textContent = 'SIGNAL TRANSMITTED // SENT TO @' + sentTo;
    toast('TRANSMISSION COMPLETE // SIGNAL SENT TO @' + sentTo);

    // Restart both beam layers after the picker closes. Two animation
    // frames give iOS time to paint the active Transmission room before the
    // launch begins, preventing the beam from waiting for a room switch.
    const launchBeam = () => {
        [$('transmission-beam'), $('transmission-beam-fx')].forEach(element => {
            if (!element) return;
            element.classList.remove('transmitting');
            void element.offsetWidth;
            element.classList.add('transmitting');
        });
    };
    requestAnimationFrame(() => requestAnimationFrame(launchBeam));
});

async function handleIncomingTransmission(item, action, row) {
    if (!authUser || !supabase || !item?.id) return false;

    const actionButton = row?.querySelector(action === 'accept'
        ? '.transmission-received-accept'
        : '.transmission-received-decline');

    if (actionButton) {
        actionButton.disabled = true;
        actionButton.textContent = action === 'accept' ? 'ACCEPTING...' : 'DECLINING...';
    }

    if (action === 'accept') {
        const saved = await saveTransmissionToCollection(item, null);
        if (!saved) {
            if (actionButton) {
                actionButton.disabled = false;
                actionButton.textContent = 'ACCEPT SIGNAL';
            }
            return false;
        }
    }

    const { error } = await supabase.from('transmissions')
        .update({ read_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('recipient_id', authUser.id);

    if (error) {
        console.error('Transmission decision failed:', error);
        if (actionButton) {
            actionButton.disabled = false;
            actionButton.textContent = action === 'accept' ? 'ACCEPT SIGNAL' : 'DECLINE';
        }
        toast('Could not close the incoming signal.');
        return false;
    }

    row?.remove();

    const container = $('transmission-incoming-list');
    const panel = document.querySelector('.transmission-incoming-panel');
    if (container && !container.querySelector('.transmission-incoming-item')) {
        container.innerHTML = '';
        panel?.classList.remove('has-signal');
        if (panel) panel.hidden = true;
        if ($('transmission-incoming-status')) $('transmission-incoming-status').textContent = 'RECEIVER STANDBY';
    }

    toast(action === 'accept' ? 'Signal accepted into your collection.' : 'Incoming signal declined.');
    return true;
}

async function saveTransmissionToCollection(item, button) {
    if (!authUser || !supabase || !item?.audio_path) return false;

    if (button) {
        button.disabled = true;
        button.textContent = 'ACCEPTING...';
    }

    // A transmission is a private reference to the sender's existing signal.
    // Do not copy the storage object from the browser. The recipient is
    // granted private SELECT access through the transmission row, so the
    // original audio/cover path can be saved directly into the recipient's
    // Collection and played from there.
    const { data: existing, error: existingError } = await supabase
        .from('tracks')
        .select('id')
        .eq('user_id', authUser.id)
        .eq('audio_path', item.audio_path)
        .limit(1);

    if (existingError) {
        console.error('Collection check failed:', existingError);
        if (button) {
            button.disabled = false;
            button.textContent = 'ACCEPT SIGNAL';
        }
        toast('Could not check your collection: ' + (existingError.message || 'database error'));
        return false;
    }

    let saveError = null;

    if (existing?.length) {
        const result = await supabase.from('tracks')
            .update({
                title: item.title || 'Untitled',
                artist: item.artist || 'Unknown Artist',
                album: item.album || null,
                audio_path: item.audio_path,
                cover_path: item.cover_path || null
            })
            .eq('id', existing[0].id)
            .eq('user_id', authUser.id);

        saveError = result.error;
    } else {
        const result = await supabase.from('tracks').insert({
            user_id: authUser.id,
            title: item.title || 'Untitled',
            artist: item.artist || 'Unknown Artist',
            album: item.album || null,
            audio_path: item.audio_path,
            cover_path: item.cover_path || null
        });

        saveError = result.error;
    }

    if (saveError) {
        console.error('Save received signal failed:', saveError);
        if (button) {
            button.disabled = false;
            button.textContent = 'ACCEPT SIGNAL';
        }
        toast('Could not save signal: ' + (saveError.message || 'database error'));
        return false;
    }

    if (button) {
        button.textContent = 'IN COLLECTION';
        button.disabled = true;
    }

    await load();
    return true;
}

async function playReceivedTransmission(item) {
    if (!item?.audio_path) {
        toast('This transmission has no audio signal.');
        return false;
    }

    const url = await signedUrl('audio', item.audio_path);
    if (!url) {
        toast('Could not access the received signal audio.');
        return false;
    }

    player.load({ audioUrl: url });
    player.setMediaSessionTrack({
        title: item.title || 'Untitled',
        artist: item.artist || 'Unknown Artist',
        album: item.album || 'Frequency',
        artwork: item.cover_path ? ((await signedUrl('covers', item.cover_path)) || 'assets/default-art.jpg') : 'assets/default-art.jpg'
    });

    try {
        await player.play();
    } catch (error) {
        console.error('Received signal playback failed:', error);
        toast('The received signal could not be played.');
        return false;
    }

    return true;
}

function closeTransmissionAlert() {
    const alert = $('transmission-alert');
    if (!alert) return;
    alert.hidden = true;
    transmissionAlertItem = null;
}

async function showTransmissionAlert(item) {
    if (!item) return;
    transmissionAlertItem = item;
    const alert = $('transmission-alert');
    if (!alert) return;
    $('transmission-alert-from').textContent = 'FROM @' + (item._senderUsername || 'UNKNOWN STATION');
    $('transmission-alert-title').textContent = item.title || 'UNTITLED SIGNAL';
    $('transmission-alert-artist').textContent = item.artist || 'UNKNOWN ARTIST';
    alert.hidden = false;
}

async function loadIncomingTransmissions() {
    const container = $('transmission-incoming-list');
    const status = $('transmission-incoming-status');
    const panel = document.querySelector('.transmission-incoming-panel');
    if (!container || !supabase || !authUser) return;

    const { data, error } = await supabase.from('transmissions')
        .select('id, sender_id, title, artist, album, audio_path, cover_path, message, created_at, read_at')
        .eq('recipient_id', authUser.id)
        .is('read_at', null)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.warn('Incoming transmissions failed:', error);
        panel?.classList.remove('has-signal');
        if (panel) panel.hidden = true;
        return;
    }

    if (!data?.length) {
        panel?.classList.remove('has-signal');
        if (panel) panel.hidden = true;
        container.innerHTML = '';
        if (status) status.textContent = 'RECEIVER STANDBY';
        return;
    }

    const ids = [...new Set(data.map(item => item.sender_id).filter(Boolean))];
    const result = ids.length ? await supabase.from('profiles').select('id, username').in('id', ids) : { data: [] };
    const names = Object.fromEntries((result.data || []).map(row => [row.id, row.username]));

    const previousIds = new Set(incomingTransmissionItems.keys());
    const currentIds = new Set(data.map(item => item.id));
    const enrichedItems = data.map(item => ({ ...item, _senderUsername: names[item.sender_id] || 'UNKNOWN STATION' }));
    incomingTransmissionItems = new Map(enrichedItems.map(item => [item.id, item]));

    const newItem = enrichedItems.find(item => !previousIds.has(item.id));
    if (newItem && !transmissionAlertItem) await showTransmissionAlert(newItem);
    if (transmissionAlertItem && !currentIds.has(transmissionAlertItem.id)) closeTransmissionAlert();
    const artUrls = Object.fromEntries(await Promise.all(
        data.filter(item => item.cover_path).map(async item => [item.id, await signedUrl('covers', item.cover_path)])
    ));

    if (status) status.textContent = data.length + ' INCOMING SIGNAL' + (data.length === 1 ? '' : 'S');
    panel?.classList.add('has-signal');
    if (panel) panel.hidden = false;

    container.innerHTML = data.map(item => {
        const sender = names[item.sender_id] || 'UNKNOWN STATION';
        return '<article class="transmission-incoming-item unread" data-transmission-id="' + esc(item.id) + '">' +
            '<div class="transmission-incoming-art"><img src="' + esc(artUrls[item.id] || 'assets/default-art.jpg') + '" alt=""></div>' +
            '<div class="transmission-incoming-copy"><span class="micro-label">INCOMING SIGNAL</span>' +
            '<strong>' + esc(item.title || 'UNTITLED SIGNAL') + '</strong><small>' + esc(item.artist || 'UNKNOWN ARTIST') + ' // FROM @' + esc(sender) + '</small>' +
            (item.message ? '<p>' + esc(item.message) + '</p>' : '') + '</div>' +
            '<div class="transmission-incoming-actions">' +
            '<button type="button" class="room-action transmission-received-play">PLAY</button>' +
            '<button type="button" class="room-action transmission-received-accept">ACCEPT SIGNAL</button>' +
            '<button type="button" class="room-action transmission-received-decline">DECLINE</button>' +
            '</div></article>';
    }).join('');

    container.querySelectorAll('.transmission-incoming-item').forEach(row => {
        const item = data.find(entry => entry.id === row?.dataset.transmissionId);
        row.querySelector('.transmission-received-play')?.addEventListener('click', async event => {
            event.currentTarget.disabled = true;
            event.currentTarget.textContent = 'PLAYING...';
            const ok = await playReceivedTransmission(item);
            event.currentTarget.disabled = false;
            event.currentTarget.textContent = ok ? 'PLAY' : 'RETRY';
        });
        row.querySelector('.transmission-received-accept')?.addEventListener('click', () => {
            handleIncomingTransmission(item, 'accept', row);
        });
        row.querySelector('.transmission-received-decline')?.addEventListener('click', () => {
            handleIncomingTransmission(item, 'decline', row);
        });
    });
}

function startIncomingTransmissionPolling() {
    clearInterval(incomingTransmissionPollTimer);
    incomingTransmissionItems.clear();
    closeTransmissionAlert();
    if (!authUser) return;
    loadIncomingTransmissions();
    incomingTransmissionPollTimer = window.setInterval(() => {
        if (document.hidden || !authUser) return;
        loadIncomingTransmissions();
    }, 5000);
}

const transmissionSearch = $('transmission-user-search');
const transmissionResults = $('transmission-user-results');
const transmissionDestination = $('transmission-destination-name');

let transmissionSearchTimer = 0;

function hideTransmissionResults() {
    transmissionResults.innerHTML = '';
    transmissionResults.style.display = 'none';
    transmissionResults.setAttribute('aria-hidden', 'true');
}

function showTransmissionResults(rows) {
    transmissionResults.innerHTML = rows.length
        ? rows.map(row => '<button type="button" class="transmission-user-result" data-user-id="' + esc(row.id) + '" data-username="' + esc(row.username) + '"><strong>@' + esc(row.username) + '</strong><small>FREQUENCY STATION</small></button>').join('')
        : '<div class="transmission-no-results">NO FREQUENCY STATIONS FOUND</div>';
    transmissionResults.style.display = 'block';
    transmissionResults.setAttribute('aria-hidden', 'false');

    // Use delegated selection so the username result remains clickable even
    // when the result list is rebuilt by a new search.
    transmissionResults.onclick = event => {
        const button = event.target.closest('.transmission-user-result');
        if (!button || !transmissionResults.contains(button)) return;
        event.preventDefault();
        event.stopPropagation();

        const username = button.dataset.username || '';
        const userId = button.dataset.userId || '';
        if (!username || !userId) return;

        transmissionRecipientId = userId;
        transmissionRecipientUsername = username;
        if (transmissionDestination) transmissionDestination.textContent = '@' + username;
        syncTransmissionDestination();
        transmissionSearch.value = username;
        hideTransmissionResults();
        transmissionSearch.blur();
        toast('Destination locked: @' + username);
    };
}

async function searchTransmissionUsers() {
    if (!supabase || !authUser) {
        showTransmissionResults([]);
        return;
    }

    const term = transmissionSearch.value.trim().replace(/^@+/, '').toLowerCase();
    if (!term) {
        hideTransmissionResults();
        return;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('id, username')
        .ilike('username', term + '%')
        .neq('id', authUser.id)
        .order('username')
        .limit(6);

    if (error) {
        console.warn('Transmission user search failed:', error);
        showTransmissionResults([]);
        return;
    }

    showTransmissionResults(data || []);
}

transmissionSearch.addEventListener('input', () => {
    clearTimeout(transmissionSearchTimer);
    transmissionSearchTimer = window.setTimeout(searchTransmissionUsers, 180);
});

transmissionSearch.addEventListener('focus', () => {
    if (transmissionSearch.value.trim()) searchTransmissionUsers();
});

document.addEventListener('click', event => {
    if (!transmissionSearch.closest('.transmission-search-block')?.contains(event.target)) hideTransmissionResults();
});

$('transmission-alert-play')?.addEventListener('click', async event => {
    if (!transmissionAlertItem) return;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'PLAYING...';
    const ok = await playReceivedTransmission(transmissionAlertItem);
    event.currentTarget.disabled = false;
    event.currentTarget.textContent = ok ? 'PLAY' : 'RETRY';
});

$('transmission-alert-accept')?.addEventListener('click', async event => {
    if (!transmissionAlertItem) return;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'ACCEPTING...';
    const ok = await handleIncomingTransmission(transmissionAlertItem, 'accept', null);
    if (!ok) {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = 'ACCEPT SIGNAL';
    } else closeTransmissionAlert();
});

$('transmission-alert-decline')?.addEventListener('click', async event => {
    if (!transmissionAlertItem) return;
    event.currentTarget.disabled = true;
    event.currentTarget.textContent = 'DECLINING...';
    const ok = await handleIncomingTransmission(transmissionAlertItem, 'decline', null);
    if (!ok) {
        event.currentTarget.disabled = false;
        event.currentTarget.textContent = 'DECLINE';
    } else closeTransmissionAlert();
});

$('transmission-alert-dismiss')?.addEventListener('click', closeTransmissionAlert);

const volumeSlider = $('volume-slider');
const volumeButton = $('volume-btn');
let lastVolume = 1;

function syncVolumeUI() {
    const value = player.audio.volume;
    if (volumeSlider) volumeSlider.value = String(Math.round(value * 100));
    if (volumeButton) {
        volumeButton.textContent = value === 0 ? 'MUTE' : 'VOL';
        volumeButton.setAttribute('aria-label', value === 0 ? 'Unmute volume' : 'Mute volume');
    }
}

volumeSlider?.addEventListener('input', event => {
    const value = Number(event.target.value) / 100;
    player.setVolume(value);
    if (value > 0) lastVolume = value;
    syncVolumeUI();
});

volumeButton?.addEventListener('click', () => {
    if (player.audio.volume > 0) {
        lastVolume = player.audio.volume;
        player.setVolume(0);
    } else player.setVolume(lastVolume || 1);
    syncVolumeUI();
});

syncVolumeUI();

$('sign-out').addEventListener('click', async () => {
    await supabase?.auth.signOut();
    authUser = null;
    profileUsername = '';
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

async function repairAcceptedTransmissionTracks() {
    if (!supabase || !authUser) return 0;

    const { data: transmissions, error: transmissionError } = await supabase
        .from('transmissions')
        .select('id, audio_path, cover_path')
        .eq('recipient_id', authUser.id)
        .order('created_at', { ascending: true });

    if (transmissionError || !transmissions?.length) return 0;

    const sourcePaths = [...new Set(transmissions.map(item => item.audio_path).filter(Boolean))];

    const { data: brokenTracks, error: trackError } = await supabase
        .from('tracks')
        .select('id, title, artist, album, audio_path, cover_path')
        .eq('user_id', authUser.id)
        .in('audio_path', sourcePaths);

    if (trackError || !brokenTracks?.length) return 0;

    let repaired = 0;

    for (const track of brokenTracks) {
        const transmission = transmissions.find(item => item.audio_path === track.audio_path);
        if (!transmission) continue;

        const base = authUser.id + '/' + crypto.randomUUID();
        const sourceName = track.audio_path.split('/').pop() || 'signal.mp3';
        const safeAudioName = sourceName.replace(/[^a-z0-9._-]/gi, '_');
        const recipientAudioPath = base + '-' + safeAudioName;

        const audioCopy = await supabase.storage.from('audio').copy(
            track.audio_path,
            recipientAudioPath
        );

        if (audioCopy.error) {
            console.warn('Could not repair transmitted audio:', audioCopy.error);
            continue;
        }

        let recipientCoverPath = null;

        if (track.cover_path) {
            const sourceCoverName = track.cover_path.split('/').pop() || 'cover.jpg';
            const safeCoverName = sourceCoverName.replace(/[^a-z0-9._-]/gi, '_');
            recipientCoverPath = base + '-' + safeCoverName;

            const coverCopy = await supabase.storage.from('covers').copy(
                track.cover_path,
                recipientCoverPath
            );

            if (coverCopy.error) {
                console.warn('Could not repair transmitted cover:', coverCopy.error);
                recipientCoverPath = null;
            }
        }

        const { error: updateError } = await supabase
            .from('tracks')
            .update({
                audio_path: recipientAudioPath,
                cover_path: recipientCoverPath
            })
            .eq('id', track.id)
            .eq('user_id', authUser.id);

        if (updateError) {
            console.warn('Could not update repaired track:', updateError);
            await supabase.storage.from('audio').remove([recipientAudioPath]);
            if (recipientCoverPath) await supabase.storage.from('covers').remove([recipientCoverPath]);
            continue;
        }

        repaired++;
    }

    return repaired;
}

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

    // Make the music list usable immediately. Cover art and receiver polling
    // are secondary work and must not block the first playable signal.
    playlist = (data || []).map(track => ({ ...track, _coverUrl: 'assets/default-art.jpg' }));
    currentIndex = Math.min(currentIndex, Math.max(0, playlist.length - 1));

    if (playlist.length) {
        await select(false);
    } else {
        renderEmpty();
    }

    // Finish non-critical work after the player is ready.
    hydrateCovers(data || []).then(hydrated => {
        const coversById = new Map(hydrated.map(track => [track.id, track._coverUrl]));
        playlist.forEach(track => {
            if (coversById.has(track.id)) track._coverUrl = coversById.get(track.id);
        });
        if (playlist[currentIndex]) {
            const art = cover(playlist[currentIndex]);
            $('current-album-art').src = art;
            $('player-thumb').src = art;
        }
        renderWheel();
    });

    loadIncomingTransmissions();
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
        // Let the native media element start first. The analyzer now wakes
        // asynchronously from the play event instead of blocking playback.
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
    // Playback starts through the native media element; AudioAnalyzer wakes
    // from the play event without blocking the click handler.
    await player.togglePlay();
});

$('next-btn').addEventListener('click', () => move(1, true));
$('prev-btn').addEventListener('click', () => move(-1, true));

// Connect browser lock-screen / headset track controls to the same player controls.
player.onNextTrack = () => move(1, true);
player.onPreviousTrack = () => move(-1, true);

function registerMediaSessionTrackControls() {
    if (!('mediaSession' in navigator)) return;
    const register = (name, handler) => {
        try { navigator.mediaSession.setActionHandler(name, handler); } catch (_) {}
    };

    register('nexttrack', () => {
        console.log('[Frequency] nexttrack received');
        move(1, true);
    });
    register('previoustrack', () => {
        console.log('[Frequency] previoustrack received');
        move(-1, true);
    });
    register('seekbackward', null);
    register('seekforward', null);
}

registerMediaSessionTrackControls();
player.audio.addEventListener('play', registerMediaSessionTrackControls);
player.audio.addEventListener('loadedmetadata', registerMediaSessionTrackControls);
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

let waveformCanvasWidth = 0;
let waveformCanvasHeight = 0;
let waveformCanvasRatio = 1;
let waveformLastDraw = 0;
const waveformFrameInterval = 1000 / 30;

function drawWaveform(timestamp = 0) {
    const collectionActive = $('room-collection')?.classList.contains('active-room');
    if (!collectionActive || document.hidden) {
        setTimeout(() => requestAnimationFrame(drawWaveform), 250);
        return;
    }

    if (timestamp - waveformLastDraw < waveformFrameInterval) {
        requestAnimationFrame(drawWaveform);
        return;
    }
    waveformLastDraw = timestamp;

    const canvas = $('waveform-canvas');
    const context = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));

    // Resizing a canvas every frame forces the browser to recreate its backing
    // store. Only resize when the viewport actually changed.
    if (width !== waveformCanvasWidth || height !== waveformCanvasHeight || ratio !== waveformCanvasRatio) {
        waveformCanvasWidth = width;
        waveformCanvasHeight = height;
        waveformCanvasRatio = ratio;
        canvas.width = Math.max(1, Math.floor(width * ratio));
        canvas.height = Math.max(1, Math.floor(height * ratio));
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    context.clearRect(0, 0, width, height);

    const data = analyzer.isInitialized ? analyzer.getWaveformData() : null;
    if (data?.length) {
        context.beginPath();
        const step = width > 600 ? 2 : 1;
        for (let pixel = 0; pixel < width; pixel += step) {
            const index = Math.floor(pixel / width * data.length);
            const value = (data[index] - 128) / 128;
            const y = height / 2 + value * height * 0.38;
            pixel ? context.lineTo(pixel, y) : context.moveTo(pixel, y);
        }
        context.strokeStyle = 'rgba(255,255,255,.72)';
        context.stroke();
    }

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
    const audioExtensions = /\.(mp3|m4a|aac|wav|flac|ogg|oga|aiff|aif)$/i;
    [...files].filter(file => file.type.startsWith('audio/') || audioExtensions.test(file.name)).forEach(file => {
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
    startIncomingTransmissionPolling();
});

session().then(async () => {
    await load();
    startIncomingTransmissionPolling();
});
