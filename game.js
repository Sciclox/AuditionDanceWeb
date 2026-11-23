/**
 * AUDITION CYBER GROOVE // ARCADE RHYTHM CLUB
 * Motor de Juego de Ritmo, Baile en Canvas 2D y Sintetizador Procedural Web Audio API.
 * Creado con máxima fidelidad a Audition Online.
 */

(function () {
    'use strict';

    // =========================================================================
    // 1. CONFIGURACIÓN Y ESTADO GLOBAL
    // =========================================================================
    const CONFIG = {
        canvasWidth: 960,
        canvasHeight: 500,
        arrowSymbols: {
            ArrowLeft: '←',
            ArrowUp: '↑',
            ArrowDown: '↓',
            ArrowRight: '→'
        },
        oppositeKeys: {
            ArrowLeft: 'ArrowRight',
            ArrowRight: 'ArrowLeft',
            ArrowUp: 'ArrowDown',
            ArrowDown: 'ArrowUp'
        },
        keyAliases: {
            'a': 'ArrowLeft', 'A': 'ArrowLeft',
            'w': 'ArrowUp',   'W': 'ArrowUp',
            's': 'ArrowDown', 'S': 'ArrowDown',
            'd': 'ArrowRight','D': 'ArrowRight',
            '4': 'ArrowLeft',
            '8': 'ArrowUp',
            '2': 'ArrowDown',
            '6': 'ArrowRight'
        }
    };

    const gameState = {
        bpm: 128,
        beatDuration: 60 / 128,
        measureDuration: (60 / 128) * 4,
        isPlaying: false,
        isMuted: false,
        score: 0,
        displayScore: 0,
        combo: 0,
        maxStreak: 0,
        level: 1,
        mode: 'standard', // 'standard' | 'chance'
        
        // Secuencia de flechas actual
        sequence: [],
        currentIndex: 0,
        sequenceReady: false,
        hasHitSpaceThisMeasure: false,
        currentMeasureIndex: -1,

        // Contadores de juicio
        counts: { perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 },

        // Bailarín y animación
        dancerState: 'idle', // 'idle' | 'groove' | 'perfect' | 'great' | 'miss'
        dancerStateTimer: 0,
        cameraShake: 0
    };

    // =========================================================================
    // 2. REFERENCIAS AL DOM
    // =========================================================================
    const DOM = {
        canvas: document.getElementById('danceCanvas'),
        ctx: document.getElementById('danceCanvas').getContext('2d'),
        songSelect: document.getElementById('songSelect'),
        diffSelect: document.getElementById('diffSelect'),
        muteBtn: document.getElementById('muteBtn'),
        scoreDisplay: document.getElementById('scoreDisplay'),
        comboDisplay: document.getElementById('comboDisplay'),
        comboNumber: document.getElementById('comboNumber'),
        feverBadge: document.getElementById('feverBadge'),
        streakDisplay: document.getElementById('streakDisplay'),
        levelDisplay: document.getElementById('levelDisplay'),
        judgmentText: document.getElementById('judgmentText'),
        timingOffset: document.getElementById('timingOffset'),
        arrowContainer: document.getElementById('arrowContainer'),
        beatBar: document.getElementById('beatBar'),
        hitZone: document.getElementById('hitZone'),
        beatMarker: document.getElementById('beatMarker'),
        startOverlay: document.getElementById('startOverlay'),
        startBtn: document.getElementById('startBtn'),
        resultsOverlay: document.getElementById('resultsOverlay'),
        restartBtn: document.getElementById('restartBtn'),
        resGrade: document.getElementById('resGrade'),
        resTitle: document.getElementById('resTitle'),
        resScore: document.getElementById('resScore'),
        resCombo: document.getElementById('resCombo'),
        resAccuracy: document.getElementById('resAccuracy'),
        cntPerfect: document.getElementById('cntPerfect'),
        cntGreat: document.getElementById('cntGreat'),
        cntCool: document.getElementById('cntCool'),
        cntBad: document.getElementById('cntBad'),
        cntMiss: document.getElementById('cntMiss')
    };

    // Partículas visuales
    const particles = [];
    const floatingScores = [];

    // =========================================================================
    // 3. MOTOR DE AUDIO PROCEDURAL (WEB AUDIO API MULTI-TRACK)
    // =========================================================================
    let audioCtx = null;
    let masterGain = null;
    let nextNoteTime = 0;
    let current16thNote = 0;
    const scheduleAheadTime = 0.12;
    const lookahead = 25.0; // ms
    let timerId = null;

    // Progresión de acordes EDM: Am -> F -> C -> G
    const CHORD_ROOTS = [220.00, 174.61, 261.63, 196.00]; // La, Fa, Do, Sol

    function initAudio() {
        if (!audioCtx) {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            audioCtx = new AudioContextClass();
            masterGain = audioCtx.createGain();
            masterGain.gain.setValueAtTime(gameState.isMuted ? 0 : 0.7, audioCtx.currentTime);
            
            // Compresor de dinámica para sonido arcade contundente
            const compressor = audioCtx.createDynamicsCompressor();
            compressor.threshold.setValueAtTime(-14, audioCtx.currentTime);
            compressor.knee.setValueAtTime(30, audioCtx.currentTime);
            compressor.ratio.setValueAtTime(8, audioCtx.currentTime);
            compressor.attack.setValueAtTime(0.003, audioCtx.currentTime);
            compressor.release.setValueAtTime(0.15, audioCtx.currentTime);

            masterGain.connect(compressor);
            compressor.connect(audioCtx.destination);
        }
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }

    // --- INSTRUMENTOS PROCEDURALES ---

    function playKick(time) {
        if (!audioCtx || gameState.isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.frequency.setValueAtTime(140, time);
        osc.frequency.exponentialRampToValueAtTime(38, time + 0.12);

        gain.gain.setValueAtTime(1.0, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + 0.23);
    }

    function playSnare(time) {
        if (!audioCtx || gameState.isMuted) return;
        // Tono del parche
        const osc = audioCtx.createOscillator();
        const oscGain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(220, time);
        osc.frequency.exponentialRampToValueAtTime(70, time + 0.08);
        oscGain.gain.setValueAtTime(0.6, time);
        oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.14);
        osc.connect(oscGain);
        oscGain.connect(masterGain);
        osc.start(time);
        osc.stop(time + 0.15);

        // Ruido del bordón
        const bufferSize = audioCtx.sampleRate * 0.18;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1200, time);
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.8, time);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(masterGain);
        noise.start(time);
        noise.stop(time + 0.19);
    }

    function playHiHat(time, open = false) {
        if (!audioCtx || gameState.isMuted) return;
        const dur = open ? 0.22 : 0.045;
        const bufferSize = audioCtx.sampleRate * dur;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(9500, time);
        filter.Q.setValueAtTime(4, time);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(open ? 0.35 : 0.22, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);
        noise.start(time);
        noise.stop(time + dur + 0.01);
    }

    function playBassSynth(freq, time, dur) {
        if (!audioCtx || gameState.isMuted) return;
        const osc = audioCtx.createOscillator();
        const filter = audioCtx.createBiquadFilter();
        const gain = audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq / 2, time);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(400, time);
        filter.frequency.exponentialRampToValueAtTime(1600, time + 0.04);
        filter.frequency.exponentialRampToValueAtTime(300, time + dur);

        gain.gain.setValueAtTime(0.35, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + dur + 0.02);
    }

    function playMelodyArp(freq, time, dur) {
        if (!audioCtx || gameState.isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(freq * 2, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(time);
        osc.stop(time + dur + 0.01);
    }

    // --- EFECTOS DE SONIDO (SFX) ---

    function playKeyClick() {
        if (!audioCtx || gameState.isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1400, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.04);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.05);
    }

    function playErrorBuzz() {
        if (!audioCtx || gameState.isMuted) return;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(110, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.2);
    }

    function playJudgmentSfx(type) {
        if (!audioCtx || gameState.isMuted) return;
        const now = audioCtx.currentTime;
        if (type === 'perfect') {
            // Acorde triunfal arpegiado (Do - Mi - Sol - Si)
            [523.25, 659.25, 783.99, 987.77, 1046.50].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, now + idx * 0.035);
                gain.gain.setValueAtTime(0.35, now + idx * 0.035);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.035 + 0.28);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + idx * 0.035);
                osc.stop(now + idx * 0.035 + 0.3);
            });
        } else if (type === 'great') {
            [659.25, 880.00].forEach((freq, idx) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, now + idx * 0.04);
                gain.gain.setValueAtTime(0.35, now + idx * 0.04);
                gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.2);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(now + idx * 0.04);
                osc.stop(now + idx * 0.04 + 0.22);
            });
        } else if (type === 'cool') {
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(587.33, now);
            gain.gain.setValueAtTime(0.3, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 0.16);
        } else if (type === 'miss' || type === 'bad') {
            playErrorBuzz();
        }
    }

    // --- SECUENCIADOR MUSICAL (RHYTHM SCHEDULER) ---
    function scheduleNote(noteIndex, time) {
        const beatInMeasure = (noteIndex % 16) / 4; // 0, 0.25, 0.5 ... 3.75
        const chordIndex = Math.floor(noteIndex / 16) % CHORD_ROOTS.length;
        const root = CHORD_ROOTS[chordIndex];

        // 1. Bombo en cada tiempo (Four-on-the-floor: 0, 4, 8, 12)
        if (noteIndex % 4 === 0) {
            playKick(time);
        }

        // 2. Caja en tiempos 2 y 4 (8 y 24 dentro de 16th notes)
        if (noteIndex % 8 === 4) {
            playSnare(time);
        }

        // 3. Hi-hats en semicorcheas y contratiempo abierto
        if (noteIndex % 4 === 2) {
            playHiHat(time, true); // Abierto en contratiempo
        } else {
            playHiHat(time, false);
        }

        // 4. Línea de bajo arpegiada
        const bassNotes = [1, 1, 1.25, 1.5];
        const bassFreq = root * (bassNotes[noteIndex % 4]);
        playBassSynth(bassFreq, time, 0.12);

        // 5. Sintetizador melódico cada 2 compases
        if ((noteIndex % 8 === 0) || (noteIndex % 8 === 3) || (noteIndex % 8 === 6)) {
            const scaleOffsets = [1, 1.2, 1.33, 1.5, 1.77, 2];
            const arpFreq = root * scaleOffsets[(noteIndex * 3) % scaleOffsets.length];
            playMelodyArp(arpFreq, time, 0.1);
        }
    }

    function scheduler() {
        while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
            scheduleNote(current16thNote, nextNoteTime);
            // Avanzar tiempo a la siguiente semicorchea
            const secondsPer16th = (60.0 / gameState.bpm) / 4;
            nextNoteTime += secondsPer16th;
            current16thNote++;
        }
        if (gameState.isPlaying) {
            timerId = setTimeout(scheduler, lookahead);
        }
    }

    // =========================================================================
    // 4. GENERACIÓN DE SECUENCIA DE FLECHAS Y REGLAS DE AUDITION
    // =========================================================================
    function getSequenceLengthForLevel(level) {
        // Nivel 1: 4 flechas | Nivel 2: 5 flechas | Nivel 3: 6 flechas ... Máximo 9 flechas
        return Math.min(4 + (level - 1), 9);
    }

    function generateSequence() {
        const length = getSequenceLengthForLevel(gameState.level);
        const keys = ['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'];
        gameState.sequence = [];

        for (let i = 0; i < length; i++) {
            const rawKey = keys[Math.floor(Math.random() * keys.length)];
            // En modo Chance, ~25% de probabilidad de flecha invertida (roja)
            const isChance = (gameState.mode === 'chance') && (Math.random() < 0.28);
            gameState.sequence.push({
                expectedKey: isChance ? CONFIG.oppositeKeys[rawKey] : rawKey,
                displayKey: rawKey,
                isChance: isChance,
                isHit: false
            });
        }

        gameState.currentIndex = 0;
        gameState.sequenceReady = false;
        gameState.hasHitSpaceThisMeasure = false;
        renderArrows();
    }

    function renderArrows() {
        DOM.arrowContainer.innerHTML = '';
        gameState.sequence.forEach((item, index) => {
            const card = document.createElement('div');
            card.className = 'arrow-card';
            if (item.isChance) card.classList.add('chance');
            if (index === gameState.currentIndex && !gameState.sequenceReady) {
                card.classList.add('active');
            }
            if (item.isHit) {
                card.classList.add('hit');
            }
            card.textContent = CONFIG.arrowSymbols[item.displayKey];
            DOM.arrowContainer.appendChild(card);
        });
    }

    // =========================================================================
    // 5. GESTIÓN DE ENTRADAS DE TECLADO (INPUT HANDLER)
    // =========================================================================
    function handleKeyDown(e) {
        if (!gameState.isPlaying) return;

        let key = e.key;
        // Mapeo de alias (WASD / teclado numérico)
        if (CONFIG.keyAliases[key]) {
            key = CONFIG.keyAliases[key];
        }

        // --- BARRA ESPACIADORA (SPACEBAR HIT) ---
        if (e.code === 'Space' || key === ' ') {
            e.preventDefault();
            handleSpaceHit();
            return;
        }

        // --- TECLAS DIRECCIONALES ---
        if (['ArrowLeft', 'ArrowUp', 'ArrowDown', 'ArrowRight'].includes(key)) {
            e.preventDefault();
            handleArrowInput(key);
        }
    }

    function handleArrowInput(key) {
        if (gameState.sequenceReady) return; // Ya completó todas las flechas, espera el espacio

        const currentTarget = gameState.sequence[gameState.currentIndex];
        if (!currentTarget) return;

        if (key === currentTarget.expectedKey) {
            // ¡Acierto!
            currentTarget.isHit = true;
            gameState.currentIndex++;
            playKeyClick();

            if (gameState.currentIndex >= gameState.sequence.length) {
                gameState.sequenceReady = true;
                // Breve feedback visual
            }
            renderArrows();
        } else {
            // Error en flecha -> Resetea la secuencia actual y marca fallo
            playErrorBuzz();
            gameState.sequence.forEach(item => item.isHit = false);
            gameState.currentIndex = 0;
            renderArrows();

            // Animación de shake en las flechas
            const cards = DOM.arrowContainer.querySelectorAll('.arrow-card');
            cards.forEach(c => {
                c.classList.add('error');
                setTimeout(() => c.classList.remove('error'), 250);
            });
        }
    }

    function handleSpaceHit() {
        if (gameState.hasHitSpaceThisMeasure) return; // Un solo golpe por compás
        gameState.hasHitSpaceThisMeasure = true;

        const beatBarRect = DOM.beatBar.getBoundingClientRect();
        const hitZoneRect = DOM.hitZone.getBoundingClientRect();
        const markerRect = DOM.beatMarker.getBoundingClientRect();

        // Calcular distancia entre centros del marcador y de la hit zone
        const markerCenter = markerRect.left + markerRect.width / 2;
        const hitZoneCenter = hitZoneRect.left + hitZoneRect.width / 2;
        const distancePx = Math.abs(markerCenter - hitZoneCenter);

        // Si el jugador no completó todas las flechas: MISS automático
        if (!gameState.sequenceReady) {
            triggerJudgment('miss', 'FLECHAS INCOMPLETAS', 0);
            return;
        }

        // Evaluación de timing con ventanas de Audition
        if (distancePx <= 22) {
            triggerJudgment('perfect', 'PERFECT', 1000);
        } else if (distancePx <= 48) {
            triggerJudgment('great', 'GREAT', 600);
        } else if (distancePx <= 78) {
            triggerJudgment('cool', 'COOL', 300);
        } else if (distancePx <= 115) {
            triggerJudgment('bad', 'BAD', 100);
        } else {
            triggerJudgment('miss', 'MISS', 0);
        }
    }

    // =========================================================================
    // 6. SISTEMA DE JUICIOS, PUNTUACIÓN Y RECOMPENSAS
    // =========================================================================
    function triggerJudgment(type, label, basePoints) {
        gameState.counts[type]++;
        gameState.dancerState = type;
        gameState.dancerStateTimer = 0.6; // Duración de la pose especial

        // Reset o incremento de combo
        if (type === 'perfect' || type === 'great' || type === 'cool') {
            gameState.combo++;
            if (gameState.combo > gameState.maxStreak) {
                gameState.maxStreak = gameState.combo;
            }

            // Multiplicador de combo (Fever mode a partir de combo 8)
            const multiplier = gameState.combo >= 8 ? 2 : 1;
            const pointsEarned = (basePoints + (gameState.combo * 50)) * multiplier;
            gameState.score += pointsEarned;

            // Nivel aumenta cada 3 aciertos perfect/great
            if (gameState.counts.perfect + gameState.counts.great >= gameState.level * 3) {
                gameState.level = Math.min(gameState.level + 1, 9);
            }

            // Partículas de celebración
            const hitZoneRect = DOM.hitZone.getBoundingClientRect();
            const canvasRect = DOM.canvas.getBoundingClientRect();
            const spawnX = hitZoneRect.left - canvasRect.left + hitZoneRect.width / 2;
            const spawnY = hitZoneRect.top - canvasRect.top;
            createSparkleBurst(spawnX, spawnY, type === 'perfect' ? 40 : 20, type);

            // Puntos flotantes
            addFloatingScore(`+${pointsEarned}`, 480, 240, type);

            if (type === 'perfect') {
                gameState.cameraShake = 8;
            }
        } else {
            // BAD o MISS rompe el combo
            gameState.combo = 0;
            gameState.cameraShake = 4;
            addFloatingScore('BREAK!', 480, 240, 'miss');
        }

        playJudgmentSfx(type);
        updateHud(label, type);
    }

    function updateHud(label, type) {
        // Judgment Text
        DOM.judgmentText.textContent = label;
        DOM.judgmentText.className = '';
        void DOM.judgmentText.offsetWidth; // Force reflow
        DOM.judgmentText.classList.add(`judgment-${type}`);

        // Combo
        if (gameState.combo > 1) {
            DOM.comboDisplay.classList.remove('hidden');
            DOM.comboNumber.textContent = gameState.combo;
            if (gameState.combo >= 8) {
                DOM.feverBadge.classList.remove('hidden');
            } else {
                DOM.feverBadge.classList.add('hidden');
            }
        } else {
            DOM.comboDisplay.classList.add('hidden');
        }

        // Streak y Nivel
        DOM.streakDisplay.textContent = gameState.maxStreak;
        DOM.levelDisplay.textContent = `LV ${gameState.level}`;
    }

    // =========================================================================
    // 7. RENDERIZADO DEL ESCENARIO 2D / 3D Y BAILARÍN EN CANVAS
    // =========================================================================
    function createSparkleBurst(x, y, count, type) {
        const colors = type === 'perfect' 
            ? ['#00f2fe', '#ffe600', '#ff007f', '#ffffff'] 
            : ['#00ff77', '#ffffff', '#00f2fe'];
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 2,
                size: Math.random() * 5 + 3,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 1.0,
                decay: Math.random() * 0.03 + 0.02
            });
        }
    }

    function addFloatingScore(text, x, y, type) {
        floatingScores.push({
            text: text,
            x: x,
            y: y,
            vy: -1.8,
            life: 1.0,
            type: type
        });
    }

    function drawStage(time) {
        const ctx = DOM.ctx;
        const w = CONFIG.canvasWidth;
        const h = CONFIG.canvasHeight;

        ctx.save();

        // Efecto Camera Shake
        if (gameState.cameraShake > 0) {
            const shakeX = (Math.random() * 2 - 1) * gameState.cameraShake;
            const shakeY = (Math.random() * 2 - 1) * gameState.cameraShake;
            ctx.translate(shakeX, shakeY);
            gameState.cameraShake *= 0.88;
            if (gameState.cameraShake < 0.1) gameState.cameraShake = 0;
        }

        // 1. FONDO DE DISCOTECA ESPACIAL
        ctx.fillStyle = '#060613';
        ctx.fillRect(0, 0, w, h);

        // 2. EQUALIZADOR Y PANTALLAS DJ AL FONDO
        const barCount = 28;
        const barWidth = 14;
        const barSpacing = 8;
        const totalEqWidth = barCount * (barWidth + barSpacing);
        const eqStartX = (w - totalEqWidth) / 2;
        const beatFraction = audioCtx ? (audioCtx.currentTime % gameState.beatDuration) / gameState.beatDuration : 0;
        const pulse = 1 - beatFraction;

        for (let i = 0; i < barCount; i++) {
            const freqVal = Math.sin(time * 0.006 + i * 0.35) * 0.5 + 0.5;
            const barH = (freqVal * 90 + pulse * 40);
            const grad = ctx.createLinearGradient(0, 180 - barH, 0, 180);
            grad.addColorStop(0, '#ff007f');
            grad.addColorStop(1, 'rgba(0, 242, 254, 0.2)');
            ctx.fillStyle = grad;
            ctx.fillRect(eqStartX + i * (barWidth + barSpacing), 180 - barH, barWidth, barH);
        }

        // 3. LUCES LÁSER MÓVILES (SPOTLIGHTS)
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 4; i++) {
            const laserAngle = Math.sin(time * 0.002 + i * 1.5) * 0.6 + (i - 1.5) * 0.35;
            ctx.beginPath();
            ctx.moveTo(w / 2, 0);
            ctx.lineTo(w / 2 + Math.tan(laserAngle) * 500 - 80, h);
            ctx.lineTo(w / 2 + Math.tan(laserAngle) * 500 + 80, h);
            ctx.closePath();
            const laserGrad = ctx.createRadialGradient(w / 2, 0, 10, w / 2 + Math.tan(laserAngle) * 250, 250, 400);
            laserGrad.addColorStop(0, i % 2 === 0 ? 'rgba(0, 242, 254, 0.45)' : 'rgba(255, 0, 127, 0.45)');
            laserGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = laserGrad;
            ctx.fill();
        }
        ctx.restore();

        // 4. PISTA DE BAILE DISCO EN PERSPECTIVA 3D
        const horizonY = 220;
        const floorGrad = ctx.createLinearGradient(0, horizonY, 0, h);
        floorGrad.addColorStop(0, '#0a0a24');
        floorGrad.addColorStop(1, '#020208');
        ctx.fillStyle = floorGrad;
        ctx.fillRect(0, horizonY, w, h - horizonY);

        // Cuadrícula en perspectiva (Checkered Disco Floor)
        ctx.strokeStyle = `rgba(0, 242, 254, ${0.25 + pulse * 0.2})`;
        ctx.lineWidth = 1.5;

        // Líneas radiales hacia el punto de fuga (480, 220)
        for (let x = -200; x <= w + 200; x += 60) {
            ctx.beginPath();
            ctx.moveTo(w / 2, horizonY);
            ctx.lineTo(x, h);
            ctx.stroke();
        }

        // Líneas horizontales de profundidad
        for (let d = 0; d < 12; d++) {
            const t = Math.pow(d / 12, 1.8);
            const lineY = horizonY + t * (h - horizonY);
            ctx.strokeStyle = d % 2 === 0 ? `rgba(255, 0, 127, ${0.2 + pulse * 0.25})` : `rgba(0, 242, 254, ${0.15 + pulse * 0.15})`;
            ctx.beginPath();
            ctx.moveTo(0, lineY);
            ctx.lineTo(w, lineY);
            ctx.stroke();
        }

        // Reflejo neon debajo del bailarín
        const glowGrad = ctx.createRadialGradient(w / 2, 420, 10, w / 2, 420, 140);
        glowGrad.addColorStop(0, `rgba(0, 242, 254, ${0.5 + pulse * 0.4})`);
        glowGrad.addColorStop(0.6, 'rgba(157, 78, 221, 0.2)');
        glowGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGrad;
        ctx.beginPath();
        ctx.ellipse(w / 2, 425, 140, 35, 0, 0, Math.PI * 2);
        ctx.fill();

        // 5. RENDERIZADO DEL BAILARÍN ANIMADO (CHIBI CYBER DANCER)
        drawDancerCharacter(ctx, w / 2, 390, time, pulse);

        // 6. SISTEMA DE PARTÍCULAS
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.life -= p.decay;
            if (p.life <= 0) {
                particles.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = p.life;
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }

        // 7. PUNTOS FLOTANTES (+1000, FEVER, ETC.)
        for (let i = floatingScores.length - 1; i >= 0; i--) {
            const fs = floatingScores[i];
            fs.y += fs.vy;
            fs.life -= 0.022;
            if (fs.life <= 0) {
                floatingScores.splice(i, 1);
                continue;
            }
            ctx.save();
            ctx.globalAlpha = fs.life;
            ctx.font = 'bold 24px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = fs.type === 'perfect' ? '#ffe600' : (fs.type === 'great' ? '#00f2fe' : '#ffffff');
            ctx.shadowColor = ctx.fillStyle;
            ctx.shadowBlur = 12;
            ctx.fillText(fs.text, fs.x, fs.y);
            ctx.restore();
        }

        ctx.restore();
    }

    function drawDancerCharacter(ctx, x, y, time, beatPulse) {
        const danceTime = time * 0.008 * (gameState.bpm / 120);
        let bounce = Math.abs(Math.sin(danceTime * Math.PI)) * 16 * beatPulse;
        let hipSway = Math.sin(danceTime * Math.PI) * 12;
        let headBob = Math.sin(danceTime * Math.PI * 2) * 4;

        ctx.save();
        ctx.translate(x, y - bounce);

        // AURA FEVER (Si el combo >= 8)
        if (gameState.combo >= 8) {
            ctx.save();
            ctx.shadowColor = '#ff007f';
            ctx.shadowBlur = 30;
            ctx.strokeStyle = `rgba(255, 0, 127, ${0.4 + Math.sin(danceTime * 4) * 0.3})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(0, -70, 55, 95, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // Pose de Juicio Especial
        if (gameState.dancerStateTimer > 0) {
            gameState.dancerStateTimer -= 0.016;
            if (gameState.dancerState === 'perfect') {
                // Freeze pose: Salto aéreo con brazos en V
                ctx.translate(0, -25);
                drawCyberTorso(ctx, 0, -65, 0);
                drawCyberHead(ctx, 0, -110, 0);
                drawArm(ctx, -18, -80, -Math.PI * 0.75, 45); // Brazo izq arriba
                drawArm(ctx, 18, -80, -Math.PI * 0.25, 45);  // Brazo der arriba
                drawLeg(ctx, -14, -30, -0.4, 45);
                drawLeg(ctx, 14, -30, 0.4, 45);
                ctx.restore();
                return;
            } else if (gameState.dancerState === 'miss') {
                // Pose de tropiezo / mareo
                ctx.rotate(0.18);
                drawCyberTorso(ctx, 0, -45, 0.1);
                drawCyberHead(ctx, 0, -85, 0.2);
                drawArm(ctx, -18, -60, 0.6, 35);
                drawArm(ctx, 18, -60, 0.9, 35);
                drawLeg(ctx, -12, -15, -0.2, 35);
                drawLeg(ctx, 12, -15, 0.6, 35);
                // Gotas de sudor cómico
                ctx.fillStyle = '#00f2fe';
                ctx.beginPath();
                ctx.arc(35, -95, 5, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
                return;
            }
        }

        // --- POSE ESTÁNDAR DE BAILE DINÁMICO (GROOVE) ---
        // Piernas
        const legLeftAngle = Math.sin(danceTime * Math.PI) * 0.35;
        const legRightAngle = -Math.sin(danceTime * Math.PI) * 0.35;
        drawLeg(ctx, -15, -30, legLeftAngle, 48);
        drawLeg(ctx, 15, -30, legRightAngle, 48);

        // Torso con cadera oscilante
        drawCyberTorso(ctx, hipSway * 0.3, -65, hipSway * 0.02);

        // Cabeza con cyber visor
        drawCyberHead(ctx, hipSway * 0.2, -112 + headBob, hipSway * 0.03);

        // Brazos al ritmo disco
        const armLeftAngle = Math.cos(danceTime * Math.PI) * 0.8 - 0.4;
        const armRightAngle = -Math.cos(danceTime * Math.PI) * 0.8 + 0.4;
        drawArm(ctx, -20 + hipSway * 0.3, -80, armLeftAngle, 42);
        drawArm(ctx, 20 + hipSway * 0.3, -80, armRightAngle, 42);

        ctx.restore();
    }

    function drawCyberHead(ctx, x, y, rot) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // Pelo Anime Neón
        ctx.fillStyle = '#ff007f';
        ctx.beginPath();
        ctx.arc(0, -6, 26, Math.PI, Math.PI * 2);
        ctx.lineTo(24, 8);
        ctx.lineTo(-24, 8);
        ctx.closePath();
        ctx.fill();

        // Cara
        ctx.fillStyle = '#ffdfc4';
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        // Cyber Visor futurista
        ctx.fillStyle = '#00f2fe';
        ctx.shadowColor = '#00f2fe';
        ctx.shadowBlur = 12;
        ctx.fillRect(-18, -4, 36, 10);
        ctx.shadowBlur = 0;

        // Auriculares DJ
        ctx.fillStyle = '#111';
        ctx.fillRect(-24, -12, 6, 24);
        ctx.fillRect(18, -12, 6, 24);
        ctx.strokeStyle = '#ffe600';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, -12, 22, Math.PI, Math.PI * 2);
        ctx.stroke();

        ctx.restore();
    }

    function drawCyberTorso(ctx, x, y, rot) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rot);

        // Chaqueta Cyberpunk
        ctx.fillStyle = '#161633';
        ctx.strokeStyle = '#00f2fe';
        ctx.lineWidth = 2;
        ctx.fillRect(-18, -25, 36, 48);
        ctx.strokeRect(-18, -25, 36, 48);

        // Detalles brillantes
        ctx.fillStyle = '#ffe600';
        ctx.fillRect(-6, -20, 12, 38);

        // Cinturón con hebilla luminosa
        ctx.fillStyle = '#ff007f';
        ctx.fillRect(-18, 16, 36, 6);

        ctx.restore();
    }

    function drawArm(ctx, x, y, angle, len) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, len);
        ctx.stroke();

        // Muñequera neon y mano
        ctx.fillStyle = '#00f2fe';
        ctx.beginPath();
        ctx.arc(0, len, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawLeg(ctx, x, y, angle, len) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle);
        ctx.strokeStyle = '#222244';
        ctx.lineWidth = 10;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, len);
        ctx.stroke();

        // Zapatilla neón
        ctx.fillStyle = '#ffe600';
        ctx.shadowColor = '#ffe600';
        ctx.shadowBlur = 8;
        ctx.fillRect(-6, len - 3, 16, 9);
        ctx.restore();
    }

    // =========================================================================
    // 8. BUCLE PRINCIPAL DE JUEGO (GAME LOOP)
    // =========================================================================
    function gameLoop(timestamp) {
        if (!gameState.isPlaying) return;

        // 1. Renderizar gráficos
        drawStage(timestamp);

        // 2. Interpolar suavemente el marcador de ritmo (Beat Marker)
        if (audioCtx) {
            const beatDuration = gameState.beatDuration;
            const measureDuration = gameState.measureDuration;
            const currentAudioTime = audioCtx.currentTime;

            // Compás actual (índice entero)
            const measureIndex = Math.floor(currentAudioTime / measureDuration);
            if (measureIndex !== gameState.currentMeasureIndex) {
                // Nuevo compás iniciado:
                if (gameState.currentMeasureIndex !== -1 && !gameState.hasHitSpaceThisMeasure) {
                    // Si terminó el compás anterior sin golpear espacio: MISS
                    if (gameState.sequenceReady) {
                        triggerJudgment('miss', 'TIME OUT', 0);
                    }
                }
                gameState.currentMeasureIndex = measureIndex;
                gameState.hasHitSpaceThisMeasure = false;
                generateSequence();
            }

            // Progreso suave dentro del compás de 4 tiempos (0.0 a 1.0)
            const measureProgress = (currentAudioTime % measureDuration) / measureDuration;
            const barWidth = DOM.beatBar.clientWidth;
            const markerWidth = 28;
            const markerX = measureProgress * (barWidth - markerWidth);
            DOM.beatMarker.style.left = `${markerX}px`;
        }

        // 3. Suavizar marcador numérico de Score
        if (gameState.displayScore < gameState.score) {
            gameState.displayScore += Math.ceil((gameState.score - gameState.displayScore) * 0.12);
            DOM.scoreDisplay.textContent = String(gameState.displayScore).padStart(7, '0');
        }

        requestAnimationFrame(gameLoop);
    }

    // =========================================================================
    // 9. CONTROL DE FLUJO DEL JUEGO (START, PAUSE, RESULTS)
    // =========================================================================
    function startGame() {
        initAudio();
        gameState.isPlaying = true;
        gameState.score = 0;
        gameState.displayScore = 0;
        gameState.combo = 0;
        gameState.maxStreak = 0;
        gameState.level = 1;
        gameState.counts = { perfect: 0, great: 0, cool: 0, bad: 0, miss: 0 };
        gameState.currentMeasureIndex = -1;

        // Configuración de BPM según selector
        gameState.bpm = parseInt(DOM.songSelect.value) || 128;
        gameState.beatDuration = 60 / gameState.bpm;
        gameState.measureDuration = gameState.beatDuration * 4;
        gameState.mode = DOM.diffSelect.value === 'chance' ? 'chance' : 'standard';

        // Ocultar overlays
        DOM.startOverlay.classList.add('hidden');
        DOM.resultsOverlay.classList.add('hidden');

        // Resetear secuenciador de audio
        current16thNote = 0;
        nextNoteTime = audioCtx.currentTime + 0.1;
        scheduler();

        // Generar primera secuencia
        generateSequence();
        updateHud('READY', 'init');

        requestAnimationFrame(gameLoop);
    }

    function toggleMute() {
        gameState.isMuted = !gameState.isMuted;
        if (masterGain && audioCtx) {
            masterGain.gain.setValueAtTime(gameState.isMuted ? 0 : 0.7, audioCtx.currentTime);
        }
        DOM.muteBtn.textContent = gameState.isMuted ? '🔇 MUTED' : '🔊 AUDIO';
    }

    function showResults() {
        gameState.isPlaying = false;
        if (timerId) clearTimeout(timerId);

        DOM.resultsOverlay.classList.remove('hidden');

        // Métricas
        const totalNotes = gameState.counts.perfect + gameState.counts.great + gameState.counts.cool + gameState.counts.bad + gameState.counts.miss;
        const weightedAccuracy = totalNotes > 0 
            ? Math.round(((gameState.counts.perfect * 100 + gameState.counts.great * 80 + gameState.counts.cool * 50) / (totalNotes * 100)) * 100) 
            : 0;

        DOM.resScore.textContent = gameState.score.toLocaleString();
        DOM.resCombo.textContent = gameState.maxStreak;
        DOM.resAccuracy.textContent = `${weightedAccuracy}%`;

        DOM.cntPerfect.textContent = gameState.counts.perfect;
        DOM.cntGreat.textContent = gameState.counts.great;
        DOM.cntCool.textContent = gameState.counts.cool;
        DOM.cntBad.textContent = gameState.counts.bad;
        DOM.cntMiss.textContent = gameState.counts.miss;

        // Rango (Grade)
        let grade = 'F';
        let title = 'KEEP PRACTICING';
        if (weightedAccuracy >= 92) { grade = 'SS'; title = 'GODLIKE GROOVE!'; }
        else if (weightedAccuracy >= 82) { grade = 'S'; title = 'FANTASTIC DANCER!'; }
        else if (weightedAccuracy >= 70) { grade = 'A'; title = 'GREAT PERFORMANCE!'; }
        else if (weightedAccuracy >= 55) { grade = 'B'; title = 'GOOD EFFORT!'; }
        else if (weightedAccuracy >= 40) { grade = 'C'; title = 'ALMOST THERE!'; }

        DOM.resGrade.textContent = grade;
        DOM.resTitle.textContent = title;

        // Guardar High Score local
        const savedHigh = parseInt(localStorage.getItem('audition_highscore') || '0');
        if (gameState.score > savedHigh) {
            localStorage.setItem('audition_highscore', gameState.score.toString());
        }
    }

    // =========================================================================
    // 10. LISTENERS DE INICIALIZACIÓN
    // =========================================================================
    document.addEventListener('DOMContentLoaded', () => {
        DOM.startBtn.addEventListener('click', startGame);
        DOM.restartBtn.addEventListener('click', startGame);
        DOM.muteBtn.addEventListener('click', toggleMute);
        document.addEventListener('keydown', handleKeyDown);

        DOM.songSelect.addEventListener('change', () => {
            if (gameState.isPlaying) startGame();
        });
        DOM.diffSelect.addEventListener('change', () => {
            gameState.mode = DOM.diffSelect.value === 'chance' ? 'chance' : 'standard';
        });

        // Dibujar frame inicial del escenario estático
        drawStage(0);
    });

})();
