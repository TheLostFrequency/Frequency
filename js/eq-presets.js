const presets = {
    flat: [0, 0, 0, 0, 0, 0, 0, 0, 0],
    bass: [5, 4, 3, 2, 1, 0, 0, -1, -2],
    'bass-reducer': [-5, -4, -3, -2, -1, 0, 0, 1, 1],
    rock: [4, 3, 1, -1, -2, 2, 4, 5, 4],
    hard: [5, 4, 2, -1, -2, 2, 4, 5, 5],
    hiphop: [5, 4, 2, 0, -1, 1, 3, 3, 2],
    edm: [5, 4, 2, 0, -2, 2, 4, 5, 4],
    pop: [-1, 1, 3, 4, 2, 0, -1, 1, 2],
    vocal: [-2, -1, 0, 3, 4, 4, 3, 2, 0]
};

const inputs = [...document.querySelectorAll('.eq-bands input[data-band]')];
const buttons = [...document.querySelectorAll('.eq-presets button[data-preset]')];
const state = document.getElementById('eq-instrument-state');
const status = document.getElementById('eq-status');

function applyPreset(name) {
    const values = presets[name];
    if (!values) return;
    const analyzer = window.frequencyAnalyzer;
    inputs.forEach((input, index) => {
        input.value = values[index] ?? 0;
        const value = input.parentElement.querySelector('.eq-band-value');
        if (value) value.textContent = `${Number(input.value) > 0 ? '+' : ''}${input.value} dB`;
        analyzer?.setBand?.(index, input.value);
    });
    buttons.forEach(button => button.classList.toggle('active', button.dataset.preset === name));
    const label = buttons.find(button => button.dataset.preset === name)?.textContent.trim() || 'CUSTOM';
    if (state) state.textContent = label;
    if (status) status.textContent = name === 'flat' ? 'FLAT' : label;
}

buttons.forEach(button => button.addEventListener('click', () => applyPreset(button.dataset.preset)));

inputs.forEach((input, index) => input.addEventListener('input', () => {
    buttons.forEach(button => button.classList.remove('active'));
    if (state) state.textContent = 'CUSTOM';
    const analyzer = window.frequencyAnalyzer;
    if (analyzer && !analyzer.isInitialized) analyzer.init();
    analyzer?.setBand?.(index, input.value);
    if (status) status.textContent = `${Number(input.value) > 0 ? '+' : ''}${input.value} dB // CUSTOM`;
}));

document.getElementById('eq-reset')?.addEventListener('click', () => {
    setTimeout(() => applyPreset('flat'), 0);
});

import './library-manager.js';
