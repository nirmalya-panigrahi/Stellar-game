/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * STELLAR — The Nucleosynthesis Engine
 * A poetic astrophysical survival and evolution game.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
    Shield,
    Activity,
    Volume2,
    VolumeX,
    AlertCircle,
    Scale,
    Gem,
    Flame,
    ArrowRight,
    Pause,
    Play,
    HelpCircle,
    ChevronDown,
    ChevronUp,
    BookOpen,
    Atom,
    Wind,
    X,
    RotateCcw,
    Library,
} from 'lucide-react';
import {
    ELEMENTS,
    DESTINY_POEMS,
    DIFFICULTY_CONFIG,
    Difficulty,
    GameState,
    Destiny,
    ParticleKind,
    CodexProgress,
    loadCodex,
    saveCodex,
    playTone,
} from './gameData';

interface SimParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    type: ParticleKind;
    radius: number;
    color: string;
    glow: number;
    label: string;
    elementIdx: number;
    pulsePhase: number;
}

interface ConvectionNode {
    x: number;
    y: number;
    order: number;
    reached: boolean;
}

interface Shockwave {
    x: number;
    y: number;
    radius: number;
    maxRadius: number;
    color: string;
    alpha: number;
    lineWidth: number;
}

interface BurstSpark {
    x: number;
    y: number;
    vx: number;
    vy: number;
    radius: number;
    color: string;
    life: number;
    maxLife: number;
}

interface FloatingText {
    x: number;
    y: number;
    vy: number;
    text: string;
    color: string;
    life: number;
    maxLife: number;
}

interface BgStar {
    x: number;
    y: number;
    size: number;
    depth: number;
    alpha: number;
}

interface EvolutionBanner {
    symbol: string;
    name: string;
    mass: number;
    color: string;
    poem: [string, string];
}

interface RunSummary {
    finalElement: string;
    finalSymbol: string;
    peakMass: number;
    alphasFused: number;
    timeSurvivedSec: number;
    difficulty: Difficulty;
}

function clamp(val: number, min: number, max: number) {
    return Math.max(min, Math.min(max, val));
}

function createParticle(
    width: number,
    height: number,
    type: ParticleKind,
    currentElementIdx: number,
    difficulty: Difficulty,
    isMobile: boolean
): SimParticle {
    const cfg = DIFFICULTY_CONFIG[difficulty];
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;

    if (isMobile && type === 'helium') {
        x = Math.random() * width;
        y = -20;
        vx = (Math.random() - 0.5) * 1.4;
        vy = (Math.random() * 1.8 + 1.6) * cfg.speedMult;
    } else {
        const side = Math.floor(Math.random() * 4);
        if (side === 0) {
            x = Math.random() * width;
            y = -24;
        } else if (side === 1) {
            x = width + 24;
            y = Math.random() * height;
        } else if (side === 2) {
            x = Math.random() * width;
            y = height + 24;
        } else {
            x = -24;
            y = Math.random() * height;
        }

        const angle = Math.atan2(height / 2 - y, width / 2 - x) + (Math.random() - 0.5) * 0.55;
        const baseSpeed =
            type === 'helium'
                ? Math.random() * 1.7 + 2.3
                : type === 'alpha'
                ? Math.random() * 0.5 + 0.85
                : type === 'shield'
                ? 1.15
                : Math.random() * 0.7 + 1.05;
        const speed = baseSpeed * cfg.speedMult;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
    }

    if (type === 'helium') {
        return {
            x,
            y,
            vx,
            vy,
            type,
            radius: 6.5,
            color: '#f43f5e',
            glow: 10,
            label: '',
            elementIdx: 0,
            pulsePhase: Math.random() * Math.PI * 2,
        };
    }

    if (type === 'alpha') {
        return {
            x,
            y,
            vx,
            vy,
            type,
            radius: 13,
            color: '#38bdf8',
            glow: 16,
            label: 'α',
            elementIdx: 0,
            pulsePhase: Math.random() * Math.PI * 2,
        };
    }

    if (type === 'shield') {
        return {
            x,
            y,
            vx,
            vy,
            type,
            radius: 15,
            color: '#22d3ee',
            glow: 22,
            label: '◈',
            elementIdx: 0,
            pulsePhase: Math.random() * Math.PI * 2,
        };
    }

    const availableMax = Math.min(currentElementIdx, ELEMENTS.length - 1);
    const targetIdx =
        availableMax >= ELEMENTS.length - 1 && Math.random() > 0.3
            ? availableMax
            : Math.floor(Math.random() * (availableMax + 1));
    const el = ELEMENTS[targetIdx];

    return {
        x,
        y,
        vx,
        vy,
        type,
        radius: 15,
        color: el.color,
        glow: 16,
        label: el.symbol,
        elementIdx: targetIdx,
        pulsePhase: Math.random() * Math.PI * 2,
    };
}

function drawPolygon(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    sides: number,
    rotation = 0
) {
    ctx.beginPath();
    for (let i = 0; i < sides; i++) {
        const a = rotation + (i * Math.PI * 2) / sides;
        const px = x + Math.cos(a) * radius;
        const py = y + Math.sin(a) * radius;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
    }
    ctx.closePath();
}

export default function App() {
    const [gameState, setGameState] = useState<GameState>('intro');
    const [difficulty, setDifficulty] = useState<Difficulty>('Stellar');
    const [isMuted, setIsMuted] = useState(false);
    const [isPaused, setIsPaused] = useState(false);

    // HUD React state (synced cleanly from simulation refs)
    const [stability, setStability] = useState(100);
    const [elementIndex, setElementIndex] = useState(0);
    const [solarMass, setSolarMass] = useState(0.5);
    const [alphasCaptured, setAlphasCaptured] = useState(0);
    const [spectralShift, setSpectralShift] = useState(0);
    const [shieldTime, setShieldTime] = useState(0);
    const [ventCooldown, setVentCooldown] = useState(0);
    const [flareWarning, setFlareWarning] = useState(0);
    const [flareActive, setFlareActive] = useState(0);
    const [neutronTimeLeft, setNeutronTimeLeft] = useState(0);
    const [destiny, setDestiny] = useState<Destiny>(null);
    const [evolutionBanner, setEvolutionBanner] = useState<EvolutionBanner | null>(null);
    const [showStartHint, setShowStartHint] = useState(false);
    const [runSummary, setRunSummary] = useState<RunSummary | null>(null);

    // Modals & Codex
    const [showHelp, setShowHelp] = useState(false);
    const [showCodex, setShowCodex] = useState(false);
    const [showNerdScience, setShowNerdScience] = useState(false);
    const [codex, setCodex] = useState<CodexProgress>(() => loadCodex());

    // Simulation refs (single source of truth inside requestAnimationFrame)
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameStateRef = useRef<GameState>('intro');
    const difficultyRef = useRef<Difficulty>('Stellar');
    const isPausedRef = useRef(false);
    const isMutedRef = useRef(false);
    const wasPausedBeforeModalRef = useRef(false);

    const playerRef = useRef({ x: 0, y: 0, vx: 0, vy: 0 });
    const targetPosRef = useRef({ x: 0, y: 0 });
    const touchLastRef = useRef<{ x: number; y: number } | null>(null);
    const keysPressedRef = useRef<Set<string>>(new Set());

    const stabilityRef = useRef(100);
    const solarMassRef = useRef(0.5);
    const peakMassRef = useRef(0.5);
    const elementIndexRef = useRef(0);
    const alphasCapturedRef = useRef(0);
    const totalAlphasRef = useRef(0);
    const spectralShiftRef = useRef(0);
    const shieldTimeRef = useRef(0);
    const ventCooldownRef = useRef(0);
    const invulnTimeRef = useRef(0);
    const flareWarningRef = useRef(0);
    const flareActiveRef = useRef(0);
    const neutronTimeLeftRef = useRef(0);
    const nodeTimerRef = useRef(0);
    const runElapsedRef = useRef(0);

    const particlesRef = useRef<SimParticle[]>([]);
    const nodesRef = useRef<ConvectionNode[]>([]);
    const nextNodeOrderRef = useRef(1);
    const trailRef = useRef<{ x: number; y: number; size: number }[]>([]);
    const shockwavesRef = useRef<Shockwave[]>([]);
    const burstSparksRef = useRef<BurstSpark[]>([]);
    const floatingTextsRef = useRef<FloatingText[]>([]);
    const bgStarsRef = useRef<BgStar[]>([]);

    const shakeRef = useRef(0);
    const hitFlashRef = useRef(0);
    const bannerTimeoutRef = useRef<number | null>(null);
    const hintTimeoutRef = useRef<number | null>(null);
    const frameRef = useRef<number>(0);

    // Keep synced mirrors of settings
    useEffect(() => {
        gameStateRef.current = gameState;
    }, [gameState]);

    useEffect(() => {
        difficultyRef.current = difficulty;
    }, [difficulty]);

    useEffect(() => {
        isPausedRef.current = isPaused;
    }, [isPaused]);

    useEffect(() => {
        isMutedRef.current = isMuted;
    }, [isMuted]);

    const playSound = useCallback((freq: number, type: OscillatorType, duration: number, volume: number) => {
        if (!isMutedRef.current) {
            playTone(freq, type, duration, volume);
        }
    }, []);

    const unlockElementInCodex = useCallback((symbol: string) => {
        setCodex(prev => {
            if (prev.unlockedElements.includes(symbol)) return prev;
            const next: CodexProgress = {
                ...prev,
                unlockedElements: [...prev.unlockedElements, symbol],
            };
            saveCodex(next);
            return next;
        });
    }, []);

    const unlockEndingInCodex = useCallback((ending: 'dwarf' | 'supernova') => {
        setCodex(prev => {
            if (prev.endings.includes(ending)) return prev;
            const next: CodexProgress = {
                ...prev,
                endings: [...prev.endings, ending],
            };
            saveCodex(next);
            return next;
        });
    }, []);

    const spawnBurst = useCallback((x: number, y: number, color: string, count = 12) => {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
            const speed = Math.random() * 3.2 + 1.2;
            burstSparksRef.current.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                radius: Math.random() * 2.5 + 1.5,
                color,
                life: 0.45,
                maxLife: 0.45,
            });
        }
    }, []);

    const spawnShockwave = useCallback((x: number, y: number, maxRadius: number, color: string, lineWidth = 3) => {
        shockwavesRef.current.push({
            x,
            y,
            radius: 16,
            maxRadius,
            color,
            alpha: 0.9,
            lineWidth,
        });
    }, []);

    const spawnFloatingText = useCallback((x: number, y: number, text: string, color: string) => {
        floatingTextsRef.current.push({
            x,
            y,
            vy: -1.1,
            text,
            color,
            life: 1.0,
            maxLife: 1.0,
        });
    }, []);

    const spawnNodes = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const padX = Math.min(140, canvas.width * 0.18);
        const padTop = 130;
        const padBottom = 140;
        const usableW = Math.max(120, canvas.width - padX * 2);
        const usableH = Math.max(120, canvas.height - padTop - padBottom);

        const created: ConvectionNode[] = [1, 2, 3].map(order => ({
            x: padX + Math.random() * usableW,
            y: padTop + Math.random() * usableH,
            order,
            reached: false,
        }));
        nodesRef.current = created;
        nextNodeOrderRef.current = 1;
        nodeTimerRef.current = 14; // 14s window to complete nodes
    }, []);

    const showEvolutionOverlay = useCallback((el: typeof ELEMENTS[number]) => {
        setEvolutionBanner({
            symbol: el.symbol,
            name: el.name,
            mass: el.mass,
            color: el.color,
            poem: el.poem,
        });
        if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
        bannerTimeoutRef.current = window.setTimeout(() => {
            setEvolutionBanner(null);
        }, 4600);
    }, []);

    const syncHudImmediate = useCallback(() => {
        setStability(stabilityRef.current);
        setSolarMass(solarMassRef.current);
        setElementIndex(elementIndexRef.current);
        setAlphasCaptured(alphasCapturedRef.current);
        setSpectralShift(spectralShiftRef.current);
        setShieldTime(shieldTimeRef.current);
        setVentCooldown(ventCooldownRef.current);
        setFlareWarning(flareWarningRef.current);
        setFlareActive(flareActiveRef.current);
        setNeutronTimeLeft(neutronTimeLeftRef.current);
    }, []);

    const resetSimulation = useCallback(
        (targetState: GameState) => {
            const canvas = canvasRef.current;
            const cx = (canvas?.width ?? window.innerWidth) / 2;
            const cy = (canvas?.height ?? window.innerHeight) / 2;

            playerRef.current = { x: cx, y: cy, vx: 0, vy: 0 };
            targetPosRef.current = { x: cx, y: cy };
            touchLastRef.current = null;
            keysPressedRef.current.clear();

            stabilityRef.current = 100;
            solarMassRef.current = 0.5;
            peakMassRef.current = 0.5;
            elementIndexRef.current = 0;
            alphasCapturedRef.current = 0;
            totalAlphasRef.current = 0;
            spectralShiftRef.current = 0;
            shieldTimeRef.current = 0;
            ventCooldownRef.current = 0;
            invulnTimeRef.current = targetState === 'playing' ? 2.0 : 0;
            flareWarningRef.current = 0;
            flareActiveRef.current = 0;
            neutronTimeLeftRef.current = 0;
            nodeTimerRef.current = 0;
            runElapsedRef.current = 0;

            particlesRef.current = [];
            nodesRef.current = [];
            nextNodeOrderRef.current = 1;
            trailRef.current = [];
            shockwavesRef.current = [];
            burstSparksRef.current = [];
            floatingTextsRef.current = [];
            shakeRef.current = 0;
            hitFlashRef.current = 0;

            if (bannerTimeoutRef.current) window.clearTimeout(bannerTimeoutRef.current);
            if (hintTimeoutRef.current) window.clearTimeout(hintTimeoutRef.current);

            setEvolutionBanner(null);
            setDestiny(null);
            setRunSummary(null);
            setIsPaused(false);
            isPausedRef.current = false;
            setShowHelp(false);
            setShowCodex(false);

            syncHudImmediate();
            gameStateRef.current = targetState;
            setGameState(targetState);

            if (targetState === 'playing') {
                setShowStartHint(true);
                hintTimeoutRef.current = window.setTimeout(() => setShowStartHint(false), 5500);
                playSound(440, 'sine', 0.22, 0.28);
            } else {
                setShowStartHint(false);
            }
        },
        [playSound, syncHudImmediate]
    );

    const triggerVentMass = useCallback(() => {
        const state = gameStateRef.current;
        if ((state !== 'playing' && state !== 'neutron') || isPausedRef.current) return;
        if (ventCooldownRef.current > 0 || solarMassRef.current <= 0.52) return;

        const shed = Math.min(0.06, solarMassRef.current - 0.5);
        solarMassRef.current = Math.max(0.5, solarMassRef.current - shed);
        ventCooldownRef.current = 1.6;

        const pX = playerRef.current.x;
        const pY = playerRef.current.y;
        spawnShockwave(pX, pY, 220, '#38bdf8', 4);
        spawnBurst(pX, pY, '#fbbf24', 14);
        spawnFloatingText(pX, pY - 36, `-${shed.toFixed(2)} M☉ · SOLAR WIND`, '#38bdf8');
        playSound(240, 'triangle', 0.3, 0.25);

        // Push back & clear Helium particles within blast radius
        for (let i = particlesRef.current.length - 1; i >= 0; i--) {
            const p = particlesRef.current[i];
            const dx = p.x - pX;
            const dy = p.y - pY;
            const dist = Math.hypot(dx, dy);
            if (dist < 220) {
                if (p.type === 'helium') {
                    spawnBurst(p.x, p.y, '#f43f5e', 5);
                    particlesRef.current.splice(i, 1);
                } else if (dist > 1) {
                    p.vx += (dx / dist) * 2.5;
                    p.vy += (dy / dist) * 2.5;
                }
            }
        }

        syncHudImmediate();
    }, [playSound, spawnBurst, spawnFloatingText, spawnShockwave, syncHudImmediate]);

    const openHelpModal = useCallback(() => {
        wasPausedBeforeModalRef.current = isPausedRef.current;
        setIsPaused(true);
        isPausedRef.current = true;
        setShowHelp(true);
    }, []);

    const closeHelpModal = useCallback(() => {
        setShowHelp(false);
        const shouldStayPaused = wasPausedBeforeModalRef.current;
        setIsPaused(shouldStayPaused);
        isPausedRef.current = shouldStayPaused;
    }, []);

    const openCodexModal = useCallback(() => {
        wasPausedBeforeModalRef.current = isPausedRef.current;
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'neutron') {
            setIsPaused(true);
            isPausedRef.current = true;
        }
        setShowCodex(true);
    }, []);

    const closeCodexModal = useCallback(() => {
        setShowCodex(false);
        if (gameStateRef.current === 'playing' || gameStateRef.current === 'neutron') {
            const shouldStayPaused = wasPausedBeforeModalRef.current;
            setIsPaused(shouldStayPaused);
            isPausedRef.current = shouldStayPaused;
        }
    }, []);

    // Keyboard controls & shortcuts
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code === 'Escape') {
                if (showHelp) {
                    closeHelpModal();
                    return;
                }
                if (showCodex) {
                    closeCodexModal();
                    return;
                }
            }

            if (showHelp || showCodex) return;

            if (e.code === 'Space') {
                if (gameStateRef.current === 'playing' || gameStateRef.current === 'neutron') {
                    e.preventDefault();
                    triggerVentMass();
                }
                return;
            }

            if (e.code === 'KeyP') {
                if (gameStateRef.current === 'playing' || gameStateRef.current === 'neutron') {
                    setIsPaused(prev => !prev);
                }
                return;
            }

            if (e.code === 'KeyM') {
                setIsMuted(prev => !prev);
                return;
            }

            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                keysPressedRef.current.add(e.code);
            }
        };

        const onKeyUp = (e: KeyboardEvent) => {
            keysPressedRef.current.delete(e.code);
        };

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('keyup', onKeyUp);
        return () => {
            window.removeEventListener('keydown', onKeyDown);
            window.removeEventListener('keyup', onKeyUp);
        };
    }, [closeCodexModal, closeHelpModal, showCodex, showHelp, triggerVentMass]);

    // Canvas resize & starfield initialization
    useEffect(() => {
        const initStars = (w: number, h: number) => {
            bgStarsRef.current = Array.from({ length: 70 }, () => ({
                x: Math.random() * w,
                y: Math.random() * h,
                size: Math.random() * 1.6 + 0.5,
                depth: Math.random() * 0.6 + 0.15,
                alpha: Math.random() * 0.45 + 0.15,
            }));
        };

        const resize = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
            if (playerRef.current.x === 0 && playerRef.current.y === 0) {
                playerRef.current.x = canvas.width / 2;
                playerRef.current.y = canvas.height / 2;
                targetPosRef.current.x = canvas.width / 2;
                targetPosRef.current.y = canvas.height / 2;
            } else {
                targetPosRef.current.x = clamp(targetPosRef.current.x, 24, canvas.width - 24);
                targetPosRef.current.y = clamp(targetPosRef.current.y, 24, canvas.height - 24);
            }
            initStars(canvas.width, canvas.height);
        };

        window.addEventListener('resize', resize);
        resize();
        return () => window.removeEventListener('resize', resize);
    }, []);

    // Main 60fps-normalized Simulation Loop (never tears down on per-frame state changes)
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        let lastTime = performance.now();
        let lastHudSync = performance.now();

        const loop = (now: number) => {
            const rawDt = (now - lastTime) / 16.6667;
            const dt = clamp(rawDt, 0.2, 2.5);
            const dtSec = dt * (1 / 60);
            lastTime = now;

            const state = gameStateRef.current;
            const paused = isPausedRef.current;
            const cfg = DIFFICULTY_CONFIG[difficultyRef.current];
            const isActivePlay = state === 'playing' || state === 'neutron';

            ctx.save();

            // Screen shake transform
            if (shakeRef.current > 0.2) {
                const sx = (Math.random() - 0.5) * shakeRef.current;
                const sy = (Math.random() - 0.5) * shakeRef.current;
                ctx.translate(sx, sy);
                if (!paused) shakeRef.current *= Math.pow(0.86, dt);
            } else {
                shakeRef.current = 0;
            }

            // Background Gradient
            const isSupernovaPath = solarMassRef.current >= 1.4;
            const diffTint =
                difficultyRef.current === 'Nebula'
                    ? '#0c162b'
                    : difficultyRef.current === 'Quasar'
                    ? '#0e0b14'
                    : '#111b33';
            const bgStart = isSupernovaPath ? '#260b14' : diffTint;
            const bgEnd = isSupernovaPath ? '#090307' : '#070d1a';

            const grad = ctx.createRadialGradient(
                canvas.width / 2,
                canvas.height / 2,
                0,
                canvas.width / 2,
                canvas.height / 2,
                Math.max(canvas.width, canvas.height) * 0.72
            );
            grad.addColorStop(0, bgStart);
            grad.addColorStop(1, bgEnd);
            ctx.fillStyle = grad;
            ctx.fillRect(-20, -20, canvas.width + 40, canvas.height + 40);

            // Subtle parallax starfield
            const pVx = isActivePlay && !paused ? playerRef.current.vx : 0.2;
            const pVy = isActivePlay && !paused ? playerRef.current.vy : 0.08;
            bgStarsRef.current.forEach(star => {
                if (!paused) {
                    star.x -= pVx * star.depth * 0.25 * dt;
                    star.y -= pVy * star.depth * 0.25 * dt;
                    if (star.x < 0) star.x += canvas.width;
                    if (star.x > canvas.width) star.x -= canvas.width;
                    if (star.y < 0) star.y += canvas.height;
                    if (star.y > canvas.height) star.y -= canvas.height;
                }
                ctx.fillStyle = `rgba(226, 232, 240, ${star.alpha})`;
                ctx.beginPath();
                ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                ctx.fill();
            });

            if (isActivePlay && !paused) {
                runElapsedRef.current += dtSec;

                // Keyboard directional steering
                const keys = keysPressedRef.current;
                const keySpeed = 8.5 * dt;
                if (keys.has('KeyA') || keys.has('ArrowLeft')) targetPosRef.current.x -= keySpeed;
                if (keys.has('KeyD') || keys.has('ArrowRight')) targetPosRef.current.x += keySpeed;
                if (keys.has('KeyW') || keys.has('ArrowUp')) targetPosRef.current.y -= keySpeed;
                if (keys.has('KeyS') || keys.has('ArrowDown')) targetPosRef.current.y += keySpeed;
                targetPosRef.current.x = clamp(targetPosRef.current.x, 24, canvas.width - 24);
                targetPosRef.current.y = clamp(targetPosRef.current.y, 24, canvas.height - 24);

                const curEl = ELEMENTS[elementIndexRef.current];

                // Momentum Physics Engine (dt-normalized)
                const drag = Math.pow(0.935, dt);
                const massEffect = 1 + (curEl.radius * cfg.sizeMult) / 110 + (solarMassRef.current - 0.5) * 0.75;
                const spring = (0.052 / massEffect) * dt;

                const ax = (targetPosRef.current.x - playerRef.current.x) * spring;
                const ay = (targetPosRef.current.y - playerRef.current.y) * spring;

                playerRef.current.vx = (playerRef.current.vx + ax) * drag;
                playerRef.current.vy = (playerRef.current.vy + ay) * drag;
                playerRef.current.x = clamp(playerRef.current.x + playerRef.current.vx * dt, 20, canvas.width - 20);
                playerRef.current.y = clamp(playerRef.current.y + playerRef.current.vy * dt, 20, canvas.height - 20);

                // Velocity-driven Spectral Shift (-100 Blueshift .. +100 Redshift)
                const speed = Math.hypot(playerRef.current.vx, playerRef.current.vy);
                const targetShift = clamp((speed - 4.2) * 16, -100, 100);
                spectralShiftRef.current += (targetShift - spectralShiftRef.current) * (1 - Math.pow(0.9, dt));

                // Timers
                if (shieldTimeRef.current > 0) {
                    shieldTimeRef.current = Math.max(0, shieldTimeRef.current - dtSec);
                }
                if (ventCooldownRef.current > 0) {
                    ventCooldownRef.current = Math.max(0, ventCooldownRef.current - dtSec);
                }
                if (invulnTimeRef.current > 0) {
                    invulnTimeRef.current = Math.max(0, invulnTimeRef.current - dtSec);
                }
                if (hitFlashRef.current > 0) {
                    hitFlashRef.current = Math.max(0, hitFlashRef.current - dtSec * 3.5);
                }

                // Passive stability recovery
                stabilityRef.current = Math.min(100, stabilityRef.current + cfg.healingPerSec * dtSec);

                // Neutron Pulse Countdown
                if (state === 'neutron') {
                    neutronTimeLeftRef.current = Math.max(0, neutronTimeLeftRef.current - dtSec);
                    if (neutronTimeLeftRef.current <= 0) {
                        const finalDestiny: 'dwarf' | 'supernova' =
                            solarMassRef.current >= 1.4 ? 'supernova' : 'dwarf';
                        setDestiny(finalDestiny);
                        unlockEndingInCodex(finalDestiny);
                        setRunSummary({
                            finalElement: 'Iron',
                            finalSymbol: 'Fe',
                            peakMass: peakMassRef.current,
                            alphasFused: totalAlphasRef.current,
                            timeSurvivedSec: runElapsedRef.current,
                            difficulty: difficultyRef.current,
                        });
                        gameStateRef.current = 'ascended';
                        setGameState('ascended');
                        syncHudImmediate();
                        playSound(finalDestiny === 'supernova' ? 880 : 660, 'sine', 1.8, 0.42);
                    }
                }

                // Solar Flare Sequence
                if (flareWarningRef.current > 0) {
                    flareWarningRef.current = Math.max(0, flareWarningRef.current - dtSec);
                    if (flareWarningRef.current === 0) {
                        flareActiveRef.current = 6.5; // 6.5s active flare
                        playSound(190, 'sawtooth', 0.8, 0.24);
                    }
                } else if (flareActiveRef.current > 0) {
                    flareActiveRef.current = Math.max(0, flareActiveRef.current - dtSec);
                } else if (state === 'playing' && elementIndexRef.current >= 1) {
                    const flareChancePerSec = 0.028 * cfg.flareRate;
                    if (Math.random() < flareChancePerSec * dtSec) {
                        flareWarningRef.current = 3.2; // 3.2s warning
                        spawnNodes();
                        playSound(320, 'sine', 0.45, 0.2);
                    }
                }

                // Convection Node Expiry
                if (nodesRef.current.length > 0) {
                    nodeTimerRef.current = Math.max(0, nodeTimerRef.current - dtSec);
                    if (nodeTimerRef.current <= 0 && flareWarningRef.current === 0 && flareActiveRef.current === 0) {
                        nodesRef.current = [];
                    }
                }

                // Spawn Particles (area-balanced)
                const isMobile = canvas.width < 640;
                const areaScalar = clamp((canvas.width * canvas.height) / (1440 * 900), 0.7, 1.35);
                const flareMult = flareActiveRef.current > 0 ? 2.2 : 1.0;

                if (state === 'playing') {
                    const heliumRatePerSec =
                        (0.65 + elementIndexRef.current * 0.42) * cfg.heliumRate * flareMult * areaScalar;
                    if (Math.random() < heliumRatePerSec * dtSec) {
                        particlesRef.current.push(
                            createParticle(canvas.width, canvas.height, 'helium', elementIndexRef.current, difficultyRef.current, isMobile)
                        );
                    }

                    const alphaBoost = spectralShiftRef.current < -20 ? 1.35 : 1.0;
                    const alphaRatePerSec =
                        Math.max(0.32, (0.78 - elementIndexRef.current * 0.032) * cfg.alphaRate * alphaBoost);
                    if (Math.random() < alphaRatePerSec * dtSec) {
                        particlesRef.current.push(
                            createParticle(canvas.width, canvas.height, 'alpha', elementIndexRef.current, difficultyRef.current, isMobile)
                        );
                    }

                    const shieldRatePerSec = 0.095 * cfg.shieldRate;
                    if (Math.random() < shieldRatePerSec * dtSec) {
                        particlesRef.current.push(
                            createParticle(canvas.width, canvas.height, 'shield', elementIndexRef.current, difficultyRef.current, isMobile)
                        );
                    }
                }

                const isotopeRatePerSec = state === 'neutron' ? 7.5 : 0.34 * cfg.isotopeRate;
                if (Math.random() < isotopeRatePerSec * dtSec) {
                    particlesRef.current.push(
                        createParticle(
                            canvas.width,
                            canvas.height,
                            'isotope',
                            state === 'neutron' ? ELEMENTS.length - 1 : elementIndexRef.current,
                            difficultyRef.current,
                            isMobile
                        )
                    );
                }
            }

            // --- RENDERING & COLLISIONS ---
            const curEl = ELEMENTS[elementIndexRef.current];
            const pX = playerRef.current.x;
            const pY = playerRef.current.y;
            const pR = curEl.radius * cfg.sizeMult;

            if (isActivePlay) {
                // Trail
                if (!paused) {
                    trailRef.current.push({ x: pX, y: pY, size: pR });
                    if (trailRef.current.length > 14) trailRef.current.shift();
                }
                trailRef.current.forEach((pos, i) => {
                    const ratio = (i + 1) / trailRef.current.length;
                    ctx.beginPath();
                    ctx.arc(pos.x, pos.y, pR * ratio * 0.72, 0, Math.PI * 2);
                    ctx.fillStyle = `${curEl.color}${Math.floor(ratio * 34)
                        .toString(16)
                        .padStart(2, '0')}`;
                    ctx.fill();
                });

                // Convection Nodes Guiding Tether (1 -> 2 -> 3)
                const unreached = nodesRef.current.filter(n => !n.reached);
                if (unreached.length > 1) {
                    ctx.save();
                    ctx.setLineDash([6, 8]);
                    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    unreached.forEach((n, idx) => {
                        if (idx === 0) ctx.moveTo(n.x, n.y);
                        else ctx.lineTo(n.x, n.y);
                    });
                    ctx.stroke();
                    ctx.restore();
                }

                // Draw Convection Nodes & Check Sequence
                nodesRef.current.forEach(node => {
                    if (node.reached) return;
                    const isTarget = node.order === nextNodeOrderRef.current;

                    ctx.save();
                    ctx.lineWidth = isTarget ? 2.5 : 1.5;
                    ctx.setLineDash([5, 5]);
                    ctx.strokeStyle = isTarget ? '#38bdf8' : 'rgba(255,255,255,0.22)';
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, isTarget ? 23 : 18, 0, Math.PI * 2);
                    ctx.stroke();

                    if (isTarget) {
                        ctx.shadowBlur = 14;
                        ctx.shadowColor = '#38bdf8';
                    }
                    ctx.fillStyle = isTarget ? '#38bdf8' : 'rgba(255,255,255,0.16)';
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 6, 0, Math.PI * 2);
                    ctx.fill();

                    ctx.setLineDash([]);
                    ctx.font = '700 12px "JetBrains Mono", monospace';
                    ctx.fillStyle = isTarget ? '#e0f2fe' : '#94a3b8';
                    ctx.textAlign = 'center';
                    ctx.fillText(node.order.toString(), node.x, node.y - 28);
                    ctx.restore();

                    if (!paused && isTarget) {
                        const dNode = Math.hypot(pX - node.x, pY - node.y);
                        if (dNode < pR + 22) {
                            node.reached = true;
                            nextNodeOrderRef.current += 1;
                            spawnShockwave(node.x, node.y, 55, '#38bdf8', 2);
                            playSound(560 + node.order * 110, 'sine', 0.12, 0.22);

                            if (node.order === 3) {
                                shieldTimeRef.current = 8;
                                nodesRef.current = [];
                                spawnShockwave(pX, pY, 120, '#22d3ee', 3);
                                spawnFloatingText(pX, pY - pR - 14, 'MAGNETIC SHIELD · 8s', '#22d3ee');
                                playSound(960, 'triangle', 0.38, 0.32);
                            }
                        }
                    }
                });

                // Spectral Time-Dilation & Mass Modifiers
                const shift = spectralShiftRef.current;
                const heliumTimeScale = shift < -20 ? 0.65 : shift > 20 ? 1.25 : 1.0;
                const isotopeMassMult = shift > 20 ? 1.5 : 1.0;
                const alphaPullRange = shift < -20 ? 380 : Math.abs(shift) <= 20 ? 220 : 0;

                // Update & Draw Particles
                for (let i = particlesRef.current.length - 1; i >= 0; i--) {
                    const p = particlesRef.current[i];
                    if (!p) continue;

                    if (!paused) {
                        p.pulsePhase += 0.08 * dt;

                        if (state === 'neutron') {
                            const boost = Math.pow(1.001, dt);
                            p.vx *= boost;
                            p.vy *= boost;
                        }

                        // Gravitational pull on Helium at high mass (> 1.0 M☉)
                        if (p.type === 'helium' && solarMassRef.current > 1.0) {
                            const dx = pX - p.x;
                            const dy = pY - p.y;
                            const dist = Math.hypot(dx, dy);
                            if (dist > 1 && dist < 380) {
                                const pullStrength = (solarMassRef.current - 1.0) * 14;
                                const force = (pullStrength / Math.max(180, dist)) * 0.045 * dt;
                                p.vx += (dx / dist) * force;
                                p.vy += (dy / dist) * force;
                            }
                        }

                        // Magnetic Alpha Pull (strongest in Blueshift)
                        if (p.type === 'alpha' && alphaPullRange > 0) {
                            const dx = pX - p.x;
                            const dy = pY - p.y;
                            const dist = Math.hypot(dx, dy);
                            if (dist > 1 && dist < alphaPullRange) {
                                const pullStrength = shift < -20 ? 0.24 : 0.1;
                                p.vx += (dx / dist) * pullStrength * dt;
                                p.vy += (dy / dist) * pullStrength * dt;
                            }
                        }

                        // Soft separation to reduce clumping
                        for (let j = i - 1; j >= 0; j--) {
                            const other = particlesRef.current[j];
                            if (!other) continue;
                            const dx = p.x - other.x;
                            const dy = p.y - other.y;
                            const minDist = p.radius + other.radius + 4;
                            const distSq = dx * dx + dy * dy;
                            if (distSq > 0 && distSq < minDist * minDist) {
                                const dist = Math.sqrt(distSq);
                                const force = ((minDist - dist) / dist) * 0.12 * dt;
                                p.vx += dx * force;
                                p.vy += dy * force;
                                other.vx -= dx * force;
                                other.vy -= dy * force;
                            }
                        }

                        const moveScale = p.type === 'helium' ? dt * heliumTimeScale : dt;
                        p.x += p.vx * moveScale;
                        p.y += p.vy * moveScale;
                    }

                    // Draw Distinct Particle Silhouettes
                    ctx.save();
                    if (p.glow > 0) {
                        ctx.shadowBlur = p.glow;
                        ctx.shadowColor = p.color;
                    }

                    if (p.type === 'helium') {
                        // Sharp directional crimson diamond/dart
                        const angle = Math.atan2(p.vy, p.vx);
                        ctx.translate(p.x, p.y);
                        ctx.rotate(angle);
                        ctx.beginPath();
                        ctx.moveTo(p.radius * 1.45, 0);
                        ctx.lineTo(-p.radius * 0.7, p.radius * 0.78);
                        ctx.lineTo(-p.radius * 0.35, 0);
                        ctx.lineTo(-p.radius * 0.7, -p.radius * 0.78);
                        ctx.closePath();
                        ctx.fillStyle = p.color;
                        ctx.fill();
                    } else if (p.type === 'isotope') {
                        // Faceted hexagon for mass isotopes
                        drawPolygon(ctx, p.x, p.y, p.radius, 6, p.pulsePhase * 0.2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                        ctx.lineWidth = 1.5;
                        ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                        ctx.stroke();

                        ctx.shadowBlur = 0;
                        ctx.fillStyle = '#070d1a';
                        ctx.font = '700 10px "JetBrains Mono", monospace';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(p.label, p.x, p.y + 0.5);
                    } else if (p.type === 'shield') {
                        const pulse = 1 + Math.sin(p.pulsePhase) * 0.1;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius * pulse, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius * 1.35, 0, Math.PI * 2);
                        ctx.strokeStyle = 'rgba(34, 211, 238, 0.55)';
                        ctx.lineWidth = 1.5;
                        ctx.stroke();

                        ctx.shadowBlur = 0;
                        ctx.fillStyle = '#070d1a';
                        ctx.font = '700 12px sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(p.label, p.x, p.y + 0.5);
                    } else {
                        // Alpha orb with gentle pulse
                        const pulse = 1 + Math.sin(p.pulsePhase) * 0.12;
                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.radius * pulse, 0, Math.PI * 2);
                        ctx.fillStyle = p.color;
                        ctx.fill();

                        ctx.shadowBlur = 0;
                        ctx.fillStyle = '#070d1a';
                        ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(p.label, p.x, p.y + 0.5);
                    }
                    ctx.restore();

                    // Collision Detection
                    if (!paused) {
                        const dx = p.x - pX;
                        const dy = p.y - pY;
                        const dist = Math.hypot(dx, dy);

                        if (dist < pR + p.radius) {
                            particlesRef.current.splice(i, 1);

                            if (p.type === 'helium') {
                                if (shieldTimeRef.current > 0 || invulnTimeRef.current > 0) {
                                    spawnBurst(p.x, p.y, '#38bdf8', 6);
                                    playSound(310, 'sine', 0.06, 0.08);
                                } else {
                                    const dmg = 6 + elementIndexRef.current * 0.9;
                                    stabilityRef.current = Math.max(0, stabilityRef.current - dmg);
                                    shakeRef.current = 11;
                                    hitFlashRef.current = 1.0;

                                    // Knockback away from helium hit
                                    if (dist > 0.1) {
                                        playerRef.current.vx -= (dx / dist) * 3.5;
                                        playerRef.current.vy -= (dy / dist) * 3.5;
                                    }

                                    spawnBurst(p.x, p.y, '#f43f5e', 10);
                                    spawnFloatingText(pX, pY - pR - 12, `-${Math.round(dmg)}%`, '#fb7185');

                                    if (stabilityRef.current <= 0) {
                                        setRunSummary({
                                            finalElement: curEl.name,
                                            finalSymbol: curEl.symbol,
                                            peakMass: peakMassRef.current,
                                            alphasFused: totalAlphasRef.current,
                                            timeSurvivedSec: runElapsedRef.current,
                                            difficulty: difficultyRef.current,
                                        });
                                        gameStateRef.current = 'collapsed';
                                        setGameState('collapsed');
                                        syncHudImmediate();
                                        playSound(105, 'sawtooth', 0.9, 0.4);
                                    } else {
                                        playSound(150, 'sine', 0.12, 0.22);
                                    }
                                }
                            } else if (p.type === 'isotope') {
                                const baseMassGain = 0.004 + Math.pow(p.elementIdx, 1.55) * 0.0011;
                                const massGain = baseMassGain * isotopeMassMult;
                                solarMassRef.current = Math.min(2.0, solarMassRef.current + massGain);
                                peakMassRef.current = Math.max(peakMassRef.current, solarMassRef.current);
                                stabilityRef.current = Math.min(100, stabilityRef.current + 4);

                                spawnBurst(p.x, p.y, p.color, 9);
                                spawnFloatingText(
                                    pX,
                                    pY - pR - 10,
                                    `+${massGain.toFixed(2)} M☉${isotopeMassMult > 1 ? ' (1.5×)' : ''}`,
                                    p.color
                                );
                                playSound(780, 'sine', 0.1, 0.18);
                            } else if (p.type === 'shield') {
                                shieldTimeRef.current = 8;
                                stabilityRef.current = Math.min(100, stabilityRef.current + 10);
                                spawnShockwave(pX, pY, 100, '#22d3ee', 3);
                                spawnFloatingText(pX, pY - pR - 14, 'SHIELD 8s · +10%', '#22d3ee');
                                playSound(1150, 'sine', 0.28, 0.3);
                            } else {
                                // Alpha Captured
                                totalAlphasRef.current += 1;
                                spawnBurst(p.x, p.y, '#38bdf8', 10);
                                playSound(440 + alphasCapturedRef.current * 65, 'triangle', 0.18, 0.24);

                                if (state === 'neutron') {
                                    stabilityRef.current = Math.min(100, stabilityRef.current + 4);
                                    spawnFloatingText(pX, pY - pR - 10, '+4% STABILITY', '#38bdf8');
                                } else {
                                    const nextAlphas = alphasCapturedRef.current + 1;
                                    const req = curEl.alphasRequired;

                                    if (nextAlphas >= req) {
                                        const isFinalEvolution = elementIndexRef.current >= ELEMENTS.length - 1;
                                        alphasCapturedRef.current = 0;

                                        if (isFinalEvolution) {
                                            // Enter Neutron Pulse Final Sprint
                                            gameStateRef.current = 'neutron';
                                            setGameState('neutron');
                                            stabilityRef.current = 100;
                                            invulnTimeRef.current = 1.5;
                                            neutronTimeLeftRef.current = 20;
                                            nodesRef.current = [];
                                            flareWarningRef.current = 0;
                                            flareActiveRef.current = 0;

                                            // Clear Helium and flood Isotopes for final push
                                            const burstIsotopes: SimParticle[] = [];
                                            for (let k = 0; k < 75; k++) {
                                                const np = createParticle(
                                                    canvas.width,
                                                    canvas.height,
                                                    'isotope',
                                                    ELEMENTS.length - 1,
                                                    difficultyRef.current,
                                                    canvas.width < 640
                                                );
                                                np.x = Math.random() * canvas.width;
                                                np.y = Math.random() * canvas.height;
                                                np.vx = (Math.random() - 0.5) * 1.8;
                                                np.vy = (Math.random() - 0.5) * 1.8;
                                                burstIsotopes.push(np);
                                            }
                                            particlesRef.current = burstIsotopes;
                                            spawnShockwave(pX, pY, 320, '#fbbf24', 5);
                                            playSound(1040, 'square', 0.45, 0.3);
                                            syncHudImmediate();
                                        } else {
                                            // Smooth non-blocking evolution with shockwave + grace window
                                            const nextIdx = elementIndexRef.current + 1;
                                            const nextEl = ELEMENTS[nextIdx];
                                            elementIndexRef.current = nextIdx;
                                            stabilityRef.current = Math.min(100, stabilityRef.current + 20);
                                            invulnTimeRef.current = 2.0;
                                            solarMassRef.current = Math.min(
                                                2.0,
                                                solarMassRef.current + 0.008 * Math.pow(1.08, nextIdx)
                                            );
                                            peakMassRef.current = Math.max(peakMassRef.current, solarMassRef.current);

                                            // Clear nearby Helium hazards on fusion shockwave
                                            for (let k = particlesRef.current.length - 1; k >= 0; k--) {
                                                const other = particlesRef.current[k];
                                                if (
                                                    other.type === 'helium' &&
                                                    Math.hypot(other.x - pX, other.y - pY) < 280
                                                ) {
                                                    spawnBurst(other.x, other.y, '#f43f5e', 4);
                                                    particlesRef.current.splice(k, 1);
                                                }
                                            }

                                            spawnShockwave(pX, pY, 260, nextEl.color, 4);
                                            spawnFloatingText(pX, pY - pR - 16, `FUSED → ${nextEl.name.toUpperCase()}`, nextEl.color);
                                            unlockElementInCodex(nextEl.symbol);
                                            showEvolutionOverlay(nextEl);
                                            playSound(660, 'sine', 0.35, 0.28);
                                            syncHudImmediate();
                                        }
                                    } else {
                                        alphasCapturedRef.current = nextAlphas;
                                        spawnFloatingText(pX, pY - pR - 10, `${nextAlphas}/${req} α`, '#38bdf8');
                                    }
                                }
                            }
                            continue;
                        }
                    }

                    if (
                        p.x < -120 ||
                        p.x > canvas.width + 120 ||
                        p.y < -120 ||
                        p.y > canvas.height + 120
                    ) {
                        particlesRef.current.splice(i, 1);
                    }
                }

                // Draw Shockwaves
                for (let i = shockwavesRef.current.length - 1; i >= 0; i--) {
                    const sw = shockwavesRef.current[i];
                    if (!paused) {
                        sw.radius += (sw.maxRadius - sw.radius) * 0.14 * dt;
                        sw.alpha -= 0.028 * dt;
                    }
                    if (sw.alpha <= 0) {
                        shockwavesRef.current.splice(i, 1);
                        continue;
                    }
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, sw.alpha);
                    ctx.strokeStyle = sw.color;
                    ctx.lineWidth = sw.lineWidth;
                    ctx.beginPath();
                    ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Draw Burst Sparks
                for (let i = burstSparksRef.current.length - 1; i >= 0; i--) {
                    const sp = burstSparksRef.current[i];
                    if (!paused) {
                        sp.x += sp.vx * dt;
                        sp.y += sp.vy * dt;
                        sp.vx *= Math.pow(0.94, dt);
                        sp.vy *= Math.pow(0.94, dt);
                        sp.life -= dtSec;
                    }
                    if (sp.life <= 0) {
                        burstSparksRef.current.splice(i, 1);
                        continue;
                    }
                    ctx.save();
                    ctx.globalAlpha = clamp(sp.life / sp.maxLife, 0, 1);
                    ctx.fillStyle = sp.color;
                    ctx.beginPath();
                    ctx.arc(sp.x, sp.y, sp.radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Draw Player Nucleus
                // On-core Alpha progress arc (keeps eyes on the star!)
                if (state === 'playing') {
                    const req = curEl.alphasRequired;
                    const gap = 0.14;
                    const segAngle = (Math.PI * 2 - gap * req) / req;
                    for (let s = 0; s < req; s++) {
                        const startA = -Math.PI / 2 + s * (segAngle + gap);
                        const endA = startA + segAngle;
                        ctx.save();
                        ctx.strokeStyle = s < alphasCapturedRef.current ? '#38bdf8' : 'rgba(255,255,255,0.14)';
                        ctx.lineWidth = 3;
                        ctx.lineCap = 'round';
                        ctx.beginPath();
                        ctx.arc(pX, pY, pR + 7, startA, endA);
                        ctx.stroke();
                        ctx.restore();
                    }
                }

                // Shield Aura
                if (shieldTimeRef.current > 0) {
                    ctx.save();
                    ctx.strokeStyle = '#22d3ee';
                    ctx.lineWidth = 3;
                    ctx.shadowBlur = 16;
                    ctx.shadowColor = '#22d3ee';
                    ctx.beginPath();
                    ctx.arc(pX, pY, pR + 14, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                } else if (invulnTimeRef.current > 0) {
                    // Grace invulnerability ring
                    ctx.save();
                    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
                    ctx.setLineDash([4, 4]);
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(pX, pY, pR + 13, 0, Math.PI * 2);
                    ctx.stroke();
                    ctx.restore();
                }

                // Core Body
                ctx.save();
                ctx.shadowBlur = 24;
                ctx.shadowColor = hitFlashRef.current > 0.1 ? '#f43f5e' : curEl.color;
                ctx.beginPath();
                ctx.arc(pX, pY, pR, 0, Math.PI * 2);
                ctx.fillStyle = curEl.color;
                ctx.fill();
                ctx.restore();

                // Spectral tint on core
                const shiftVal = spectralShiftRef.current;
                if (Math.abs(shiftVal) > 15) {
                    ctx.save();
                    ctx.fillStyle =
                        shiftVal > 0
                            ? `rgba(244, 63, 94, ${Math.min(0.32, shiftVal / 260)})`
                            : `rgba(56, 189, 248, ${Math.min(0.32, Math.abs(shiftVal) / 260)})`;
                    ctx.beginPath();
                    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Hit flash overlay on core
                if (hitFlashRef.current > 0.05) {
                    ctx.save();
                    ctx.fillStyle = `rgba(244, 63, 94, ${hitFlashRef.current * 0.7})`;
                    ctx.beginPath();
                    ctx.arc(pX, pY, pR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.restore();
                }

                // Inner specular highlight
                const innerGrad = ctx.createRadialGradient(pX - pR / 3, pY - pR / 3, pR / 10, pX, pY, pR);
                innerGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
                innerGrad.addColorStop(1, 'transparent');
                ctx.fillStyle = innerGrad;
                ctx.beginPath();
                ctx.arc(pX, pY, pR, 0, Math.PI * 2);
                ctx.fill();

                // Element Symbol
                ctx.fillStyle = '#070d1a';
                ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(curEl.symbol, pX, pY + 0.5);

                // Floating Combat/Capture Texts
                for (let i = floatingTextsRef.current.length - 1; i >= 0; i--) {
                    const ft = floatingTextsRef.current[i];
                    if (!paused) {
                        ft.y += ft.vy * dt;
                        ft.life -= dtSec;
                    }
                    if (ft.life <= 0) {
                        floatingTextsRef.current.splice(i, 1);
                        continue;
                    }
                    ctx.save();
                    ctx.globalAlpha = clamp(ft.life / ft.maxLife, 0, 1);
                    ctx.font = '700 12px "JetBrains Mono", monospace';
                    ctx.fillStyle = ft.color;
                    ctx.textAlign = 'center';
                    ctx.fillText(ft.text, ft.x, ft.y);
                    ctx.restore();
                }
            }

            ctx.restore();

            // Sync HUD React State at ~15fps so UI stays smooth without re-render churn
            if (isActivePlay && !paused && now - lastHudSync > 66) {
                lastHudSync = now;
                syncHudImmediate();
            }

            frameRef.current = requestAnimationFrame(loop);
        };

        frameRef.current = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(frameRef.current);
    }, [playSound, showEvolutionOverlay, spawnBurst, spawnFloatingText, spawnNodes, spawnShockwave, syncHudImmediate, unlockElementInCodex, unlockEndingInCodex]);

    // Pointer Handlers (Mouse + Relative Touch Drag)
    const handleMouseMove = (e: React.MouseEvent) => {
        if ((gameStateRef.current !== 'playing' && gameStateRef.current !== 'neutron') || isPausedRef.current) return;
        targetPosRef.current = {
            x: clamp(e.clientX, 24, window.innerWidth - 24),
            y: clamp(e.clientY, 24, window.innerHeight - 24),
        };
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if ((gameStateRef.current !== 'playing' && gameStateRef.current !== 'neutron') || isPausedRef.current) return;
        const touch = e.touches[0];
        if (touch) {
            touchLastRef.current = { x: touch.clientX, y: touch.clientY };
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if ((gameStateRef.current !== 'playing' && gameStateRef.current !== 'neutron') || isPausedRef.current) return;
        const touch = e.touches[0];
        if (!touch) return;
        if (!touchLastRef.current) {
            touchLastRef.current = { x: touch.clientX, y: touch.clientY };
            return;
        }
        const dx = touch.clientX - touchLastRef.current.x;
        const dy = touch.clientY - touchLastRef.current.y;
        touchLastRef.current = { x: touch.clientX, y: touch.clientY };

        targetPosRef.current = {
            x: clamp(targetPosRef.current.x + dx * 1.2, 24, window.innerWidth - 24),
            y: clamp(targetPosRef.current.y + dy * 1.2, 24, window.innerHeight - 24),
        };
    };

    const handleTouchEnd = () => {
        touchLastRef.current = null;
    };

    const currentElement = ELEMENTS[elementIndex];
    const isPlayingOrNeutron = gameState === 'playing' || gameState === 'neutron';
    const spectralStateLabel =
        spectralShift < -20 ? 'Blueshift · Slow Hazards' : spectralShift > 20 ? 'Redshift · 1.5× Mass' : 'Equilibrium';
    const spectralStateColor =
        spectralShift < -20 ? 'text-sky-300' : spectralShift > 20 ? 'text-rose-300' : 'text-slate-300';
    const canVentMass = isPlayingOrNeutron && !isPaused && solarMass > 0.52 && ventCooldown <= 0;

    return (
        <div
            className="relative w-full h-[100dvh] overflow-hidden bg-[#070d1a] text-slate-200 font-sans select-none touch-none"
            onMouseMove={handleMouseMove}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Subtle Spectral Edge Tint */}
            <div
                className="absolute inset-0 pointer-events-none z-[190] transition-opacity duration-150"
                style={{
                    opacity: Math.abs(spectralShift) > 20 ? 0.55 : 0,
                    boxShadow:
                        Math.abs(spectralShift) > 20
                            ? `inset 0 0 ${Math.min(110, Math.abs(spectralShift) * 1.1)}px ${
                                  spectralShift > 0 ? 'rgba(244,63,94,0.32)' : 'rgba(56,189,248,0.32)'
                              }`
                            : 'none',
                }}
            />

            <canvas ref={canvasRef} className="absolute inset-0 z-0" />

            {/* Top HUD (Visible during Gameplay) */}
            {isPlayingOrNeutron && (
                <div className="absolute top-0 left-0 right-0 p-4 sm:p-6 pt-[env(safe-area-inset-top,1rem)] flex flex-col sm:flex-row justify-between items-stretch sm:items-start pointer-events-none z-50 gap-3 bg-gradient-to-b from-black/70 via-black/30 to-transparent">
                    {/* Stability & Mass Meters */}
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="bg-slate-900/75 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-white/10 w-full sm:w-56 shadow-xl">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-3.5 h-3.5 text-emerald-400" />
                                    <span className="text-[11px] uppercase tracking-wider text-slate-200 font-semibold">
                                        Stability
                                    </span>
                                </div>
                                <span
                                    className={`text-xs font-mono font-semibold tabular-nums ${
                                        stability > 30 ? 'text-emerald-400' : 'text-rose-400'
                                    }`}
                                >
                                    {Math.ceil(stability)}% · {stability > 30 ? 'Stable' : 'Critical'}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full transition-all duration-100 ${
                                        stability > 30 ? 'bg-emerald-500' : 'bg-rose-500'
                                    }`}
                                    style={{ width: `${stability}%` }}
                                />
                            </div>
                        </div>

                        <div className="bg-slate-900/75 backdrop-blur-xl px-4 py-2.5 rounded-xl border border-white/10 w-full sm:w-64 shadow-xl">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2">
                                    <Scale className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-[11px] uppercase tracking-wider text-slate-200 font-semibold">
                                        Mass
                                    </span>
                                </div>
                                <span
                                    className={`text-xs font-mono font-semibold tabular-nums ${
                                        solarMass >= 1.4 ? 'text-rose-400' : 'text-amber-300'
                                    }`}
                                >
                                    {solarMass.toFixed(2)} M☉ · {solarMass >= 1.4 ? 'Supernova' : 'Dwarf'}
                                </span>
                            </div>
                            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden relative">
                                <div
                                    className={`h-full transition-all duration-100 ${
                                        solarMass >= 1.4 ? 'bg-rose-500' : 'bg-amber-400'
                                    }`}
                                    style={{ width: `${(solarMass / 2.0) * 100}%` }}
                                />
                                <div
                                    className="absolute left-[70%] top-0 bottom-0 w-0.5 bg-white/75"
                                    title="1.40 M☉ Chandrasekhar Limit"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Spectral State & Active Shield */}
                    <div className="flex items-center justify-between sm:justify-end gap-3">
                        <div className="bg-slate-900/75 backdrop-blur-xl px-3.5 py-2 rounded-xl border border-white/10 text-xs font-mono">
                            <span className={spectralStateColor}>{spectralStateLabel}</span>
                        </div>

                        {shieldTime > 0 && (
                            <div className="bg-sky-950/85 backdrop-blur-md px-3.5 py-2 rounded-xl border border-sky-400/40 flex items-center gap-2.5 shadow-xl">
                                <Shield className="w-4 h-4 text-sky-400" />
                                <div className="flex flex-col">
                                    <span className="text-[11px] uppercase tracking-wider text-sky-200 font-semibold tabular-nums">
                                        Shield · {shieldTime.toFixed(1)}s
                                    </span>
                                    <div className="w-24 h-1 bg-sky-900 rounded-full mt-1 overflow-hidden">
                                        <div
                                            className="h-full bg-sky-400"
                                            style={{ width: `${(shieldTime / 8) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Non-blocking Poetic Evolution Banner */}
            <AnimatePresence>
                {evolutionBanner && isPlayingOrNeutron && (
                    <motion.div
                        initial={{ opacity: 0, y: -16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -16 }}
                        transition={{ duration: 0.25 }}
                        className="fixed top-24 sm:top-24 left-1/2 -translate-x-1/2 z-[70] w-[92%] max-w-xl bg-slate-950/90 backdrop-blur-xl border border-white/15 rounded-2xl px-5 py-4 shadow-2xl pointer-events-auto"
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3.5">
                                <div
                                    className="w-11 h-11 rounded-xl flex items-center justify-center font-mono font-bold text-lg text-slate-950 shrink-0"
                                    style={{ backgroundColor: evolutionBanner.color }}
                                >
                                    {evolutionBanner.symbol}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
                                        <span className="font-semibold text-white uppercase tracking-wider">
                                            {evolutionBanner.name}
                                        </span>
                                        <span aria-hidden="true">·</span>
                                        <span className="tabular-nums">{evolutionBanner.mass} amu</span>
                                    </div>
                                    <p className="font-serif italic text-sm sm:text-base text-slate-100 mt-1 leading-snug">
                                        “{evolutionBanner.poem[0]} {evolutionBanner.poem[1]}”
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setEvolutionBanner(null)}
                                aria-label="Dismiss evolution notice"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* First-Run On-Canvas Onboarding Hint */}
            <AnimatePresence>
                {showStartHint && gameState === 'playing' && !evolutionBanner && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-28 sm:top-24 left-1/2 -translate-x-1/2 z-[55] pointer-events-none bg-slate-950/85 backdrop-blur-md border border-white/10 px-4 py-2 rounded-xl text-xs text-slate-200 text-center max-w-[90%]"
                    >
                        Steer with <span className="text-white font-semibold">Mouse / Drag / WASD</span> · Catch{' '}
                        <span className="text-sky-400 font-semibold">Blue α</span> · Dodge{' '}
                        <span className="text-rose-400 font-semibold">Red Shards</span> ·{' '}
                        <span className="text-amber-300 font-semibold">Space</span> to Vent Mass
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Solar Flare Imminent Banner */}
            <AnimatePresence>
                {flareWarning > 0 && isPlayingOrNeutron && (
                    <motion.div
                        initial={{ opacity: 0, y: -12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-40 sm:top-36 left-1/2 -translate-x-1/2 bg-rose-950/90 backdrop-blur-xl px-5 py-2.5 rounded-xl border border-rose-500/50 flex items-center gap-3 shadow-2xl z-[65] pointer-events-none"
                    >
                        <Flame className="w-4 h-4 text-rose-400 shrink-0" />
                        <div className="flex flex-col">
                            <span className="text-xs font-semibold text-rose-200 tracking-wide">
                                Solar Flare Imminent · Trace Nodes 1 → 2 → 3 for Shield
                            </span>
                            <div className="w-48 h-1 bg-rose-900 rounded-full mt-1.5 overflow-hidden">
                                <div
                                    className="h-full bg-rose-400"
                                    style={{ width: `${(flareWarning / 3.2) * 100}%` }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Active Solar Flare Ambient Overlay */}
            {flareActive > 0 && isPlayingOrNeutron && (
                <div className="fixed inset-0 bg-rose-500/10 pointer-events-none z-[40]" />
            )}

            {/* Neutron Pulse Final Sprint Banner */}
            {gameState === 'neutron' && (
                <div className="fixed top-28 sm:top-24 left-1/2 -translate-x-1/2 pointer-events-none z-[60] text-center w-[92%] max-w-md bg-slate-950/85 backdrop-blur-xl border border-amber-400/35 rounded-2xl px-5 py-3 shadow-2xl">
                    <div className="text-amber-400 font-mono text-base sm:text-lg tracking-[0.2em] font-bold uppercase">
                        Neutron Pulse · <span className="tabular-nums">{neutronTimeLeft.toFixed(1)}s</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 tabular-nums">
                        {solarMass >= 1.4
                            ? `${solarMass.toFixed(2)} M☉ reached — Supernova collapse locked (Vent Mass to stay Dwarf)`
                            : `Need +${(1.4 - solarMass).toFixed(2)} M☉ from Isotopes to reach 1.40 M☉ Supernova`}
                    </p>
                </div>
            )}

            {/* Mobile Bottom-Left Compact Nucleus Card */}
            {isPlayingOrNeutron && (
                <div className="absolute bottom-6 left-4 sm:left-6 pb-[env(safe-area-inset-bottom,0px)] md:hidden z-50 pointer-events-none">
                    <div className="bg-slate-900/80 backdrop-blur-xl px-4 py-3 rounded-xl border border-white/10 shadow-2xl min-w-[165px]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-[11px] uppercase tracking-wider text-slate-300 font-semibold">
                                {gameState === 'neutron' ? 'Critical Core' : currentElement.name}
                            </span>
                            <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                {currentElement.mass} amu
                            </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-2xl font-mono font-bold text-white leading-none">
                                {currentElement.symbol}
                            </span>
                            {gameState === 'playing' && (
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-mono text-sky-400 tabular-nums">
                                        {alphasCaptured}/{currentElement.alphasRequired} α
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Desktop Bottom Element Progression Strip */}
            {isPlayingOrNeutron && (
                <div className="absolute bottom-6 left-6 right-72 pb-[env(safe-area-inset-bottom,0px)] hidden md:flex items-center gap-4 p-3 pr-5 bg-slate-900/75 backdrop-blur-xl rounded-2xl border border-white/10 z-50 overflow-x-auto shadow-2xl no-scrollbar">
                    <div className="flex items-center gap-3 border-r border-white/10 pr-4 shrink-0">
                        <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-950 font-bold font-mono text-sm"
                            style={{ backgroundColor: currentElement.color }}
                        >
                            {currentElement.symbol}
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-xs text-white font-semibold">{currentElement.name}</span>
                            <span className="text-[11px] text-slate-400 font-mono tabular-nums">
                                {gameState === 'neutron'
                                    ? 'Neutron Collapse'
                                    : `${alphasCaptured}/${currentElement.alphasRequired} α · ${currentElement.mass} amu`}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 flex-nowrap">
                        {ELEMENTS.map((el, idx) => {
                            const isNext = idx === elementIndex + 1;
                            const isPast = idx < elementIndex;
                            const isCurrent = idx === elementIndex;

                            return (
                                <div
                                    key={el.symbol}
                                    title={`${el.name} (${el.mass} amu)`}
                                    className={`relative flex items-center justify-center w-9 h-9 rounded-lg border transition-colors ${
                                        isCurrent
                                            ? 'bg-sky-500 border-sky-300 text-slate-950 font-bold shadow-lg'
                                            : isPast
                                            ? 'border-white/30 bg-white/15 text-white'
                                            : isNext
                                            ? 'border-sky-400/40 bg-white/5 text-slate-200'
                                            : 'border-white/10 bg-transparent text-slate-500 opacity-50'
                                    }`}
                                >
                                    {isNext && gameState === 'playing' && (
                                        <div
                                            className="absolute bottom-0 left-0 right-0 bg-sky-400/25 rounded-b-lg pointer-events-none"
                                            style={{
                                                height: `${(alphasCaptured / currentElement.alphasRequired) * 100}%`,
                                            }}
                                        />
                                    )}
                                    <span className="text-xs font-mono font-bold relative z-10">{el.symbol}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Bottom-Right Utility & Action Controls */}
            <div className="absolute bottom-6 right-4 sm:right-6 pb-[env(safe-area-inset-bottom,0px)] flex items-center gap-2.5 z-[110]">
                {isPlayingOrNeutron && (
                    <button
                        onClick={triggerVentMass}
                        disabled={!canVentMass}
                        title="Vent Mass (Space) — Shed 0.06 M☉ and push back Helium"
                        className={`h-11 px-3.5 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                            canVentMass
                                ? 'bg-slate-900/90 border-sky-400/40 text-sky-200 hover:bg-sky-500/20 hover:border-sky-400 cursor-pointer'
                                : 'bg-slate-900/60 border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                    >
                        <Wind className="w-4 h-4" />
                        <span>
                            {ventCooldown > 0 ? `Vent ${ventCooldown.toFixed(1)}s` : 'Vent Mass'}
                        </span>
                    </button>
                )}

                {isPlayingOrNeutron && (
                    <button
                        onClick={() => setIsPaused(prev => !prev)}
                        aria-label={isPaused ? 'Resume game' : 'Pause game'}
                        title={isPaused ? 'Resume (P)' : 'Pause (P)'}
                        className="w-11 h-11 bg-slate-900/90 border border-white/10 rounded-xl flex items-center justify-center text-slate-300 hover:text-emerald-400 hover:border-emerald-400/40 transition-colors"
                    >
                        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                )}

                <button
                    onClick={openCodexModal}
                    aria-label="Open Stellar Codex"
                    title="Stellar Codex"
                    className="w-11 h-11 bg-slate-900/90 border border-white/10 rounded-xl flex items-center justify-center text-slate-300 hover:text-amber-300 hover:border-amber-400/40 transition-colors"
                >
                    <Library className="w-4 h-4" />
                </button>

                <button
                    onClick={() => setIsMuted(prev => !prev)}
                    aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
                    title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                    className="w-11 h-11 bg-slate-900/90 border border-white/10 rounded-xl flex items-center justify-center text-slate-300 hover:text-sky-400 hover:border-sky-400/40 transition-colors"
                >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>

                <button
                    onClick={openHelpModal}
                    aria-label="Open Stellar Manual"
                    title="Manual & Controls"
                    className="w-11 h-11 bg-slate-900/90 border border-white/10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:border-white/30 transition-colors"
                >
                    <HelpCircle className="w-4 h-4" />
                </button>
            </div>

            {/* Pause Overlay */}
            <AnimatePresence>
                {isPaused && isPlayingOrNeutron && !showHelp && !showCodex && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[85] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-6"
                    >
                        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
                            <h2 className="text-2xl font-light tracking-widest uppercase text-white mb-2">
                                Simulation Paused
                            </h2>
                            <p className="text-sm text-slate-400 mb-6">
                                Active core: {currentElement.name} ({currentElement.symbol}) · {solarMass.toFixed(2)} M☉
                            </p>
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => setIsPaused(false)}
                                    className="w-full py-3 px-6 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4" />
                                    Resume
                                </button>
                                <button
                                    onClick={() => resetSimulation('intro')}
                                    className="w-full py-3 px-6 rounded-xl border border-white/15 text-slate-300 text-sm hover:bg-white/5 transition-colors flex items-center justify-center gap-2"
                                >
                                    <RotateCcw className="w-4 h-4" />
                                    Return to Title
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stage Screens: Intro / Collapsed / Ascended */}
            <AnimatePresence mode="wait">
                {gameState === 'intro' && (
                    <motion.div
                        key="intro"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="absolute inset-0 flex flex-col items-center justify-start sm:justify-center bg-[#060b18]/92 backdrop-blur-2xl z-[100] p-6 sm:p-10 pt-[env(safe-area-inset-top,2rem)] pb-24 text-center overflow-y-auto"
                    >
                        <div className="flex flex-col items-center max-w-4xl w-full relative z-10">
                            <p className="text-xs font-mono tracking-[0.35em] uppercase text-sky-400 mb-3">
                                Stellar Nucleosynthesis Simulation
                            </p>
                            <h1 className="text-5xl sm:text-7xl font-light tracking-[0.28em] text-white mb-4">
                                STELLAR
                            </h1>
                            <p className="max-w-xl text-sm sm:text-base text-slate-300 font-light leading-relaxed mb-10">
                                Guide your stellar core from Carbon to Iron through the Helium squall. Balance mass
                                against the <span className="font-mono text-rose-300 font-semibold">1.40 M☉</span>{' '}
                                Chandrasekhar Limit to choose your final destiny.
                            </p>

                            {/* 3 Clear Pillars */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full mb-10 text-left">
                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <span className="w-3 h-3 rounded-full bg-sky-400 inline-block" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                                            01. Fuse Elements
                                        </h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                        Capture <span className="text-sky-300 font-medium">Blue α Orbs</span> to evolve
                                        from Carbon to Iron. Dodge sharp{' '}
                                        <span className="text-rose-300 font-medium">Red Helium</span> shards.
                                    </p>
                                </div>

                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                                            02. Bend Tempo
                                        </h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                        Glide slowly for <span className="text-sky-300 font-medium">Blueshift</span>{' '}
                                        (slows hazards &amp; pulls α), or dash fast for{' '}
                                        <span className="text-rose-300 font-medium">Redshift</span> (1.5× isotope mass).
                                    </p>
                                </div>

                                <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-5">
                                    <div className="flex items-center gap-2.5 mb-2">
                                        <span className="w-3 h-3 rounded-full bg-amber-400 inline-block" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-white">
                                            03. Shape Destiny
                                        </h3>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                                        Collect Isotopes to gain mass or press{' '}
                                        <span className="text-amber-300 font-medium">Space / Vent Mass</span> to stay
                                        under 1.40 M☉.
                                    </p>
                                </div>
                            </div>

                            {/* Difficulty Selector + Immediate Start CTA */}
                            <div className="flex flex-col items-center gap-4 w-full max-w-md">
                                <div className="flex items-center gap-1.5 p-1.5 bg-white/5 rounded-xl border border-white/10 w-full">
                                    {(['Nebula', 'Stellar', 'Quasar'] as const).map(lvl => (
                                        <button
                                            key={lvl}
                                            onClick={() => setDifficulty(lvl)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold tracking-wider uppercase transition-all whitespace-nowrap ${
                                                difficulty === lvl
                                                    ? 'bg-white text-slate-950 shadow-md'
                                                    : 'text-slate-400 hover:text-white'
                                            }`}
                                        >
                                            {lvl}
                                        </button>
                                    ))}
                                </div>
                                <p className={`text-xs ${DIFFICULTY_CONFIG[difficulty].accentClass}`}>
                                    {DIFFICULTY_CONFIG[difficulty].tagline}
                                </p>

                                <button
                                    onClick={() => resetSimulation('playing')}
                                    className="w-full py-3.5 px-8 rounded-xl bg-white text-slate-950 font-bold text-sm uppercase tracking-[0.2em] hover:bg-sky-100 transition-all shadow-xl flex items-center justify-center gap-3 active:scale-[0.98]"
                                >
                                    <span>Start Simulation</span>
                                    <ArrowRight className="w-4 h-4" />
                                </button>

                                <div className="flex items-center gap-6 text-xs text-slate-400 pt-1">
                                    <button
                                        onClick={openHelpModal}
                                        className="hover:text-white underline underline-offset-4 transition-colors"
                                    >
                                        Read Manual
                                    </button>
                                    <span aria-hidden="true">·</span>
                                    <button
                                        onClick={openCodexModal}
                                        className="hover:text-amber-300 underline underline-offset-4 transition-colors"
                                    >
                                        Stellar Codex ({codex.unlockedElements.length}/{ELEMENTS.length})
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {gameState === 'collapsed' && (
                    <motion.div
                        key="collapsed"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 backdrop-blur-2xl z-[150] p-6 text-center overflow-y-auto"
                    >
                        <div className="flex flex-col items-center max-w-md w-full py-8">
                            <AlertCircle className="w-16 h-16 text-rose-500 mb-5" />
                            <h2 className="text-3xl font-light tracking-widest text-white mb-2 uppercase">
                                Star Collapsed
                            </h2>
                            <p className="text-slate-300 text-sm mb-6">
                                The helium squall overwhelmed your core before synthesis could complete.
                            </p>

                            {runSummary && (
                                <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3 text-left">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Final Core</div>
                                        <div className="text-sm font-semibold text-white">
                                            {runSummary.finalElement} ({runSummary.finalSymbol})
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Peak Mass</div>
                                        <div className="text-sm font-mono font-semibold text-amber-300 tabular-nums">
                                            {runSummary.peakMass.toFixed(2)} M☉
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Alphas Fused</div>
                                        <div className="text-sm font-mono font-semibold text-sky-300 tabular-nums">
                                            {runSummary.alphasFused}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Duration</div>
                                        <div className="text-sm font-mono font-semibold text-slate-200 tabular-nums">
                                            {Math.round(runSummary.timeSurvivedSec)}s · {runSummary.difficulty}
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                                <button
                                    onClick={() => resetSimulation('playing')}
                                    className="flex-1 px-6 py-3 rounded-xl bg-rose-500 text-white font-semibold text-sm hover:bg-rose-400 transition-colors"
                                >
                                    Play Again
                                </button>
                                <button
                                    onClick={() => resetSimulation('intro')}
                                    className="flex-1 px-6 py-3 rounded-xl border border-white/15 text-slate-200 text-sm hover:bg-white/5 transition-colors"
                                >
                                    Change Mode
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {gameState === 'ascended' && destiny && (
                    <motion.div
                        key="ascended"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className={`absolute inset-0 flex flex-col items-center justify-start sm:justify-center ${
                            destiny === 'supernova' ? 'bg-[#170609]' : 'bg-[#081226]'
                        } z-[200] p-6 sm:p-8 pt-[env(safe-area-inset-top,2rem)] pb-24 text-center overflow-y-auto`}
                    >
                        <div className="flex flex-col items-center py-6 max-w-xl w-full relative z-10">
                            <motion.div
                                initial={{ scale: 0.7, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ duration: 0.5 }}
                                className={`w-36 h-36 sm:w-44 sm:h-44 rounded-full ${
                                    destiny === 'supernova'
                                        ? 'bg-amber-400 shadow-[0_0_90px_rgba(251,191,36,0.75)]'
                                        : 'bg-slate-100 shadow-[0_0_80px_rgba(148,163,184,0.45)]'
                                } flex flex-col items-center justify-center mb-7`}
                            >
                                {destiny === 'supernova' ? (
                                    <Flame className="w-8 h-8 text-slate-950 mb-1" />
                                ) : (
                                    <Gem className="w-8 h-8 text-sky-950 mb-1" />
                                )}
                                <span className="text-4xl font-light text-slate-950 leading-none">
                                    {DESTINY_POEMS[destiny].symbol}
                                </span>
                                <span className="text-xs text-slate-900 font-bold uppercase tracking-widest mt-1">
                                    {DESTINY_POEMS[destiny].name}
                                </span>
                            </motion.div>

                            <p className="text-xs font-mono uppercase tracking-[0.25em] text-slate-400 mb-1">
                                {DESTINY_POEMS[destiny].subtitle}
                            </p>
                            <h2
                                className={`text-2xl sm:text-4xl font-light tracking-[0.25em] uppercase mb-5 ${
                                    destiny === 'supernova' ? 'text-amber-300' : 'text-sky-200'
                                }`}
                            >
                                {DESTINY_POEMS[destiny].title}
                            </h2>

                            <div className="mb-5 space-y-1">
                                <p className="text-lg sm:text-2xl font-serif italic text-white">
                                    “{DESTINY_POEMS[destiny].poem[0]}”
                                </p>
                                <p className="text-lg sm:text-2xl font-serif italic text-white">
                                    “{DESTINY_POEMS[destiny].poem[1]}”
                                </p>
                            </div>

                            <p className="text-slate-300 mb-6 max-w-md text-xs sm:text-sm leading-relaxed">
                                {DESTINY_POEMS[destiny].summary}
                            </p>

                            {runSummary && (
                                <div className="w-full bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-6 grid grid-cols-3 gap-3 text-center">
                                    <div>
                                        <div className="text-[11px] text-slate-400">Final Mass</div>
                                        <div className="text-sm font-mono font-semibold text-amber-300 tabular-nums">
                                            {solarMass.toFixed(2)} M☉
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Alphas Fused</div>
                                        <div className="text-sm font-mono font-semibold text-sky-300 tabular-nums">
                                            {runSummary.alphasFused}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-[11px] text-slate-400">Run Time</div>
                                        <div className="text-sm font-mono font-semibold text-slate-200 tabular-nums">
                                            {Math.round(runSummary.timeSurvivedSec)}s
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                                <button
                                    onClick={() => resetSimulation('playing')}
                                    className="flex-1 px-6 py-3 rounded-xl bg-white text-slate-950 font-semibold text-sm hover:bg-slate-200 transition-colors"
                                >
                                    Play Again
                                </button>
                                <button
                                    onClick={openCodexModal}
                                    className="flex-1 px-6 py-3 rounded-xl border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
                                >
                                    View Codex
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Help / Manual Modal */}
            <AnimatePresence>
                {showHelp && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeHelpModal}
                        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 12 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 12 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-3xl max-h-[85dvh] overflow-y-auto shadow-2xl no-scrollbar"
                        >
                            <div className="p-6 sm:p-10 relative">
                                <button
                                    onClick={closeHelpModal}
                                    aria-label="Close Manual"
                                    className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-3.5 mb-7">
                                    <div className="p-2.5 bg-amber-500/15 rounded-xl border border-amber-500/25">
                                        <BookOpen className="w-6 h-6 text-amber-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">Stellar Manual</h2>
                                        <p className="text-slate-400 text-xs uppercase tracking-widest">
                                            Controls, Tempo &amp; Nucleosynthesis
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <section className="space-y-4">
                                        <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">
                                            Controls &amp; Spectral Tempo
                                        </h3>

                                        <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 space-y-2 text-sm text-slate-300">
                                            <p>
                                                Steer with your <span className="text-white font-medium">mouse</span>,{' '}
                                                <span className="text-white font-medium">relative touch drag</span>, or{' '}
                                                <span className="text-white font-medium">WASD / Arrow keys</span>.
                                                Heavier elements carry greater inertia.
                                            </p>
                                            <ul className="text-xs text-slate-400 space-y-1.5 pt-1">
                                                <li>
                                                    • <span className="text-sky-300 font-semibold">Blueshift (Slow):</span>{' '}
                                                    Slows incoming Helium hazards by 35% and pulls Blue α orbs toward you.
                                                </li>
                                                <li>
                                                    • <span className="text-rose-300 font-semibold">Redshift (Fast):</span>{' '}
                                                    Accelerates flux and grants <span className="text-white">1.5× mass</span>{' '}
                                                    from Isotopes.
                                                </li>
                                                <li>
                                                    • <span className="text-amber-300 font-semibold">Space / Vent Mass:</span>{' '}
                                                    Sheds 0.06 M☉ in a shockwave that vaporizes nearby Helium hazards.
                                                </li>
                                            </ul>
                                        </div>

                                        <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 space-y-2 text-sm text-slate-300">
                                            <p className="font-semibold text-white">Particles &amp; Flares</p>
                                            <ul className="text-xs text-slate-400 space-y-1.5">
                                                <li>
                                                    • <span className="text-sky-400 font-semibold">Blue α Orbs:</span>{' '}
                                                    Advance your core from Carbon (C) up to Iron (Fe).
                                                </li>
                                                <li>
                                                    • <span className="text-amber-300 font-semibold">Hex Isotopes:</span>{' '}
                                                    Increase your Solar Mass (M☉) and heal +4% Stability.
                                                </li>
                                                <li>
                                                    • <span className="text-rose-400 font-semibold">Red Shards:</span>{' '}
                                                    Helium-4 squall hazards that drain Stability on impact.
                                                </li>
                                                <li>
                                                    • <span className="text-cyan-300 font-semibold">Nodes 1 → 2 → 3:</span>{' '}
                                                    Trace numbered rings during Solar Flares for an 8s Magnetic Shield.
                                                </li>
                                            </ul>
                                        </div>
                                    </section>

                                    <section className="space-y-4">
                                        <div className="flex items-center gap-2 text-sky-400">
                                            <Atom className="w-4 h-4" />
                                            <h3 className="text-sm font-bold uppercase tracking-wider">
                                                Astrophysics &amp; Endings
                                            </h3>
                                        </div>

                                        <p className="text-sm text-slate-300 leading-relaxed">
                                            You begin as a <span className="text-white font-medium">Carbon (C)</span>{' '}
                                            nucleus. Capturing Alpha particles fuses heavier elements through the alpha
                                            process until reaching <span className="text-white font-medium">Iron (Fe)</span>,
                                            triggering a 20-second <span className="text-amber-300">Neutron Pulse</span>.
                                        </p>

                                        <div className="bg-white/[0.04] p-4 rounded-2xl border border-white/10 text-xs text-slate-300 space-y-2">
                                            <div>
                                                <span className="text-sky-300 font-semibold">Below 1.40 M☉:</span>{' '}
                                                Ascend as a <span className="text-white">Diamond White Dwarf</span>.
                                            </div>
                                            <div>
                                                <span className="text-amber-300 font-semibold">1.40 M☉ or higher:</span>{' '}
                                                Trigger a <span className="text-white">Supernova</span> that forges Gold.
                                            </div>
                                        </div>

                                        <button
                                            onClick={() => setShowNerdScience(!showNerdScience)}
                                            className="flex items-center justify-between w-full px-4 py-3 bg-sky-500/10 hover:bg-sky-500/20 rounded-xl text-sky-300 transition-colors font-mono text-xs uppercase tracking-wider border border-sky-500/25"
                                        >
                                            <span>Deep Science Notes</span>
                                            {showNerdScience ? (
                                                <ChevronUp className="w-4 h-4" />
                                            ) : (
                                                <ChevronDown className="w-4 h-4" />
                                            )}
                                        </button>

                                        <AnimatePresence>
                                            {showNerdScience && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: 'auto', opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pt-2 space-y-2.5 text-xs font-mono text-slate-400 leading-relaxed">
                                                        <p>
                                                            <span className="text-slate-200 font-semibold">
                                                                Chandrasekhar Limit (1.40 M☉):
                                                            </span>{' '}
                                                            Maximum mass of a stable white dwarf before electron degeneracy
                                                            pressure yields to core collapse.
                                                        </p>
                                                        <p>
                                                            <span className="text-slate-200 font-semibold">Alpha Ladder:</span>{' '}
                                                            Sequential Helium-4 captures step nuclei upward in multiples of 4
                                                            amu from Carbon-12 to Iron-56.
                                                        </p>
                                                        <p>
                                                            <span className="text-slate-200 font-semibold">Iron Peak:</span>{' '}
                                                            Beyond Iron, nuclear fusion absorbs energy rather than releasing it,
                                                            halting core support.
                                                        </p>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </section>
                                </div>

                                <div className="mt-8 pt-6 border-t border-white/10 flex justify-center">
                                    <button
                                        onClick={closeHelpModal}
                                        className="px-8 py-3 bg-emerald-500 text-slate-950 font-bold rounded-xl uppercase tracking-wider text-xs hover:bg-emerald-400 transition-colors"
                                    >
                                        {isPlayingOrNeutron ? 'Resume Simulation' : 'Close Manual'}
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Stellar Codex Modal (Unlocked Poems & Endings) */}
            <AnimatePresence>
                {showCodex && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeCodexModal}
                        className="fixed inset-0 z-[1000] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-md"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 12 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 12 }}
                            onClick={e => e.stopPropagation()}
                            className="bg-slate-900 border border-white/15 rounded-3xl w-full max-w-3xl max-h-[85dvh] overflow-y-auto shadow-2xl no-scrollbar"
                        >
                            <div className="p-6 sm:p-10 relative">
                                <button
                                    onClick={closeCodexModal}
                                    aria-label="Close Codex"
                                    className="absolute top-5 right-5 p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>

                                <div className="flex items-center gap-3.5 mb-6">
                                    <div className="p-2.5 bg-sky-500/15 rounded-xl border border-sky-500/25">
                                        <Library className="w-6 h-6 text-sky-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-semibold text-white">Stellar Codex</h2>
                                        <p className="text-slate-400 text-xs uppercase tracking-widest">
                                            {codex.unlockedElements.length}/{ELEMENTS.length} Elements Forged ·{' '}
                                            {codex.endings.length}/2 Destinies Unlocked
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                                    {(['dwarf', 'supernova'] as const).map(endKey => {
                                        const unlocked = codex.endings.includes(endKey);
                                        const info = DESTINY_POEMS[endKey];
                                        return (
                                            <div
                                                key={endKey}
                                                className={`p-4 rounded-2xl border ${
                                                    unlocked
                                                        ? 'bg-white/[0.05] border-amber-400/35'
                                                        : 'bg-white/[0.02] border-white/10 opacity-50'
                                                }`}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                                                        {info.title} ({info.symbol})
                                                    </span>
                                                    <span className="text-[11px] font-mono text-slate-400">
                                                        {unlocked ? 'Discovered' : 'Locked'}
                                                    </span>
                                                </div>
                                                <p className="font-serif italic text-sm text-slate-200">
                                                    {unlocked
                                                        ? `“${info.poem[0]} ${info.poem[1]}”`
                                                        : 'Complete a full Iron synthesis to unlock this destiny.'}
                                                </p>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {ELEMENTS.map(el => {
                                        const unlocked = codex.unlockedElements.includes(el.symbol);
                                        return (
                                            <div
                                                key={el.symbol}
                                                className={`p-4 rounded-2xl border flex items-start gap-3 ${
                                                    unlocked
                                                        ? 'bg-white/[0.04] border-white/10'
                                                        : 'bg-white/[0.015] border-white/5 opacity-45'
                                                }`}
                                            >
                                                <div
                                                    className="w-9 h-9 rounded-lg flex items-center justify-center font-mono font-bold text-sm text-slate-950 shrink-0"
                                                    style={{ backgroundColor: unlocked ? el.color : '#334155' }}
                                                >
                                                    {el.symbol}
                                                </div>
                                                <div>
                                                    <div className="text-xs font-semibold text-white">
                                                        {el.name}{' '}
                                                        <span className="text-slate-400 font-mono">· {el.mass} amu</span>
                                                    </div>
                                                    <p className="font-serif italic text-xs sm:text-sm text-slate-300 mt-1">
                                                        {unlocked ? `“${el.poem[0]} ${el.poem[1]}”` : 'Fuse this element to record its verse.'}
                                                    </p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="mt-6 pt-5 border-t border-white/10 flex justify-center">
                                    <button
                                        onClick={closeCodexModal}
                                        className="px-7 py-2.5 bg-white text-slate-950 font-semibold rounded-xl text-xs uppercase tracking-wider hover:bg-slate-200 transition-colors"
                                    >
                                        Close Codex
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
