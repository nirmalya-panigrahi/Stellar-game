export type Difficulty = 'Nebula' | 'Stellar' | 'Quasar';
export type GameState = 'intro' | 'playing' | 'collapsed' | 'ascended' | 'neutron';
export type Destiny = null | 'dwarf' | 'supernova';
export type ParticleKind = 'helium' | 'alpha' | 'isotope' | 'shield';

export interface ElementSpec {
    symbol: string;
    mass: number;
    name: string;
    color: string;
    radius: number;
    alphasRequired: number;
    poem: [string, string];
}

export const ELEMENTS: ElementSpec[] = [
    {
        symbol: 'C',
        mass: 12,
        name: 'Carbon',
        color: '#f59e0b',
        radius: 30,
        alphasRequired: 3,
        poem: ['From quiet dust the first spark grew,', 'A coal of light in endless blue.'],
    },
    {
        symbol: 'O',
        mass: 16,
        name: 'Oxygen',
        color: '#38bdf8',
        radius: 32,
        alphasRequired: 3,
        poem: ['The very breath that sustains my frame', 'Is forged in the heat of your sacred flame.'],
    },
    {
        symbol: 'Ne',
        mass: 20,
        name: 'Neon',
        color: '#fb7185',
        radius: 34,
        alphasRequired: 3,
        poem: ['Like neon signs in a midnight street,', 'My heart glows bright whenever we meet.'],
    },
    {
        symbol: 'Mg',
        mass: 24,
        name: 'Magnesium',
        color: '#f8fafc',
        radius: 35,
        alphasRequired: 4,
        poem: ['A brilliance caught in a sudden spark,', 'You light the path within the dark.'],
    },
    {
        symbol: 'Si',
        mass: 28,
        name: 'Silicon',
        color: '#94a3b8',
        radius: 37,
        alphasRequired: 4,
        poem: ['Stone and glass and ancient earth,', 'From your solid step, the worlds find birth.'],
    },
    {
        symbol: 'S',
        mass: 32,
        name: 'Sulfur',
        color: '#fbbf24',
        radius: 38,
        alphasRequired: 4,
        poem: ['Yellow dust in the cosmic wind,', 'Where transformation’s soul is pinned.'],
    },
    {
        symbol: 'Ar',
        mass: 36,
        name: 'Argon',
        color: '#a855f7',
        radius: 40,
        alphasRequired: 4,
        poem: ['Silent, noble, drifting free,', 'A ghost of light in a velvet sea.'],
    },
    {
        symbol: 'Ca',
        mass: 40,
        name: 'Calcium',
        color: '#fb923c',
        radius: 41,
        alphasRequired: 4,
        poem: ['The bone that builds the strength of life,', 'Unyielding force through starlit strife.'],
    },
    {
        symbol: 'Ti',
        mass: 44,
        name: 'Titanium',
        color: '#cbd5e1',
        radius: 42,
        alphasRequired: 4,
        poem: ['Strength of gods and steel of suns,', 'Where the river of creation runs.'],
    },
    {
        symbol: 'Cr',
        mass: 48,
        name: 'Chromium',
        color: '#e2e8f0',
        radius: 43,
        alphasRequired: 5,
        poem: ['Gleaming silver, polished bright,', 'Mirroring the stars of night.'],
    },
    {
        symbol: 'Mn',
        mass: 52,
        name: 'Manganese',
        color: '#93c5fd',
        radius: 44,
        alphasRequired: 5,
        poem: ['The subtle shift, the hidden weight,', 'Before the door of iron fate.'],
    },
    {
        symbol: 'Fe',
        mass: 56,
        name: 'Iron',
        color: '#ef4444',
        radius: 46,
        alphasRequired: 5,
        poem: ['The final bond where all currents cease,', 'In your steady core, I find my peace.'],
    },
];

export const DESTINY_POEMS = {
    supernova: {
        symbol: 'Au',
        name: 'Gold',
        mass: 197,
        title: 'Supernova',
        subtitle: 'Path of Power',
        poem: ['In one great flash, the dark is torn,', 'So that the rarest gold is born.'],
        summary:
            'Your mass surpassed the 1.40 M☉ Chandrasekhar Limit, triggering a cataclysmic core-collapse rebound that forged the heaviest elements in the cosmos.',
    },
    dwarf: {
        symbol: 'C',
        name: 'Diamond',
        mass: 12,
        title: 'White Dwarf',
        subtitle: 'Path of Peace',
        poem: ['A quiet light that never dies,', 'A steady love in sapphire skies.'],
        summary:
            'By remaining beneath the 1.40 M☉ Chandrasekhar Limit, you shed your outer layers gently and crystallized into an eternal diamond core.',
    },
} as const;

export const DIFFICULTY_CONFIG: Record<
    Difficulty,
    {
        label: string;
        tagline: string;
        speedMult: number;
        heliumRate: number;
        alphaRate: number;
        isotopeRate: number;
        shieldRate: number;
        healingPerSec: number;
        flareRate: number;
        sizeMult: number;
        accentClass: string;
    }
> = {
    Nebula: {
        label: 'Nebula',
        tagline: 'Gentle drift, forgiving hazards, rapid shield drops.',
        speedMult: 0.72,
        heliumRate: 0.45,
        alphaRate: 1.45,
        isotopeRate: 1.5,
        shieldRate: 1.8,
        healingPerSec: 2.2,
        flareRate: 0.35,
        sizeMult: 0.88,
        accentClass: 'text-emerald-400',
    },
    Stellar: {
        label: 'Stellar',
        tagline: 'Balanced fusion cadence and rhythmic solar flares.',
        speedMult: 1.0,
        heliumRate: 1.0,
        alphaRate: 1.0,
        isotopeRate: 1.0,
        shieldRate: 1.0,
        healingPerSec: 1.1,
        flareRate: 1.0,
        sizeMult: 1.0,
        accentClass: 'text-sky-400',
    },
    Quasar: {
        label: 'Quasar',
        tagline: 'Dense squalls, high inertia, relentless void storms.',
        speedMult: 1.28,
        heliumRate: 1.45,
        alphaRate: 0.85,
        isotopeRate: 0.78,
        shieldRate: 0.65,
        healingPerSec: 0.35,
        flareRate: 1.9,
        sizeMult: 1.1,
        accentClass: 'text-rose-400',
    },
};

export interface CodexProgress {
    unlockedElements: string[];
    endings: ('dwarf' | 'supernova')[];
}

const CODEX_STORAGE_KEY = 'stellar_codex_v1';

export function loadCodex(): CodexProgress {
    try {
        const raw = localStorage.getItem(CODEX_STORAGE_KEY);
        if (!raw) return { unlockedElements: ['C'], endings: [] };
        const parsed = JSON.parse(raw) as Partial<CodexProgress>;
        return {
            unlockedElements: Array.isArray(parsed.unlockedElements) && parsed.unlockedElements.length > 0
                ? parsed.unlockedElements
                : ['C'],
            endings: Array.isArray(parsed.endings) ? parsed.endings : [],
        };
    } catch {
        return { unlockedElements: ['C'], endings: [] };
    }
}

export function saveCodex(codex: CodexProgress) {
    try {
        localStorage.setItem(CODEX_STORAGE_KEY, JSON.stringify(codex));
    } catch {
        // Ignore storage errors in restricted environments
    }
}

let audioCtx: AudioContext | null = null;

export function playTone(freq: number, type: OscillatorType, duration: number, volume: number) {
    try {
        const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCtor) return;
        if (!audioCtx) audioCtx = new AudioContextCtor();
        if (audioCtx.state === 'suspended') {
            void audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const now = audioCtx.currentTime;

        osc.type = type;
        osc.frequency.setValueAtTime(freq, now);
        gain.gain.setValueAtTime(Math.max(0.001, volume), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration);
    } catch {
        // Audio is optional; ignore autoplay/context restrictions
    }
}
