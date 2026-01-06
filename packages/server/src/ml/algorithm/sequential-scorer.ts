/**
 * Sequential Scorer - Session-aware track selection
 *
 * Unlike point-wise scoring (does user like X?), this scorer considers
 * the sequence of recently played tracks to predict what fits "next".
 *
 * Techniques used:
 * 1. Trajectory Velocity - If user is moving from calm -> energetic, continue that trend
 * 2. Genre Transition Matrix - Learn which genre transitions are preferred
 * 3. Tempo Ramp - Smooth BPM transitions for "DJ flow"
 */

import type { Track, AudioFeatures } from '../types';

/**
 * Track with pre-fetched features for sequential scoring
 */
export interface SequentialTrack {
    track: Track;
    audio?: AudioFeatures;
    embedding?: number[];
}

/**
 * Context for sequential scoring - recent session history
 */
export interface SequentialContext {
    /** Last N tracks played in this session */
    recentTracks: SequentialTrack[];
    /** Current timestamp */
    timestamp: number;
    /** Session duration in minutes */
    sessionDuration: number;
}

/**
 * Result from sequential scoring with component breakdown
 */
export interface SequentialScoreResult {
    /** Overall sequential fit score (0-1) */
    score: number;
    /** Confidence in the score based on available data */
    confidence: number;
    /** Human-readable explanation */
    explanation: string;
    /** Individual component scores (0-1) */
    components: {
        trajectoryFit: number;
        tempoFlow: number;
        genreTransition: number;
        energyProgression: number;
    };
}

// Genre transition probabilities (learned from listening patterns)
// Higher = more natural transition
const DEFAULT_GENRE_TRANSITIONS: Record<string, Record<string, number>> = {
    'rock': { 'rock': 0.7, 'metal': 0.5, 'indie': 0.6, 'pop': 0.4, 'electronic': 0.3 },
    'pop': { 'pop': 0.7, 'rock': 0.4, 'r&b': 0.5, 'electronic': 0.5, 'indie': 0.4 },
    'electronic': { 'electronic': 0.7, 'pop': 0.5, 'ambient': 0.4, 'hip-hop': 0.4 },
    'hip-hop': { 'hip-hop': 0.7, 'r&b': 0.6, 'pop': 0.4, 'electronic': 0.4 },
    'jazz': { 'jazz': 0.7, 'blues': 0.6, 'soul': 0.5, 'classical': 0.4 },
    'classical': { 'classical': 0.8, 'ambient': 0.5, 'jazz': 0.4 },
    'ambient': { 'ambient': 0.8, 'electronic': 0.5, 'classical': 0.4, 'new-age': 0.5 },
};

export class SequentialScorer {
    private genreTransitions: Record<string, Record<string, number>>;
    private userTransitions: Map<string, Map<string, number>> = new Map();

    constructor() {
        this.genreTransitions = { ...DEFAULT_GENRE_TRANSITIONS };
    }

    /**
     * Score a candidate track based on session context
     */
    score(candidate: SequentialTrack, context: SequentialContext): SequentialScoreResult {
        if (context.recentTracks.length === 0) {
            // No history - neutral score
            return {
                score: 0.5,
                confidence: 0.3,
                explanation: 'No session history yet',
                components: { trajectoryFit: 0.5, tempoFlow: 0.5, genreTransition: 0.5, energyProgression: 0.5 },
            };
        }

        const components = {
            trajectoryFit: this.calculateTrajectoryFit(candidate, context),
            tempoFlow: this.calculateTempoFlow(candidate, context),
            genreTransition: this.calculateGenreTransition(candidate, context),
            energyProgression: this.calculateEnergyProgression(candidate, context),
        };

        // Weighted combination
        const score =
            components.trajectoryFit * 0.3 +
            components.tempoFlow * 0.25 +
            components.genreTransition * 0.25 +
            components.energyProgression * 0.2;

        const confidence = Math.min(0.9, 0.3 + context.recentTracks.length * 0.1);

        const explanation = this.generateExplanation(components, context);

        return { score, confidence, explanation, components };
    }

    /**
     * Calculate how well the candidate fits the trajectory in embedding space
     */
    private calculateTrajectoryFit(candidate: SequentialTrack, context: SequentialContext): number {
        const recent = context.recentTracks;
        if (recent.length < 2 || !candidate.embedding) return 0.5;

        // Get embeddings from recent tracks
        const recentEmbeddings = recent
            .filter(t => t.embedding)
            .slice(-3)
            .map(t => t.embedding!);

        if (recentEmbeddings.length < 2) return 0.5;

        // Calculate trajectory (velocity vector in embedding space)
        const trajectory = this.calculateTrajectory(recentEmbeddings);

        // Calculate predicted next point
        const lastEmbedding = recentEmbeddings[recentEmbeddings.length - 1];
        const predicted = lastEmbedding.map((v, i) => v + trajectory[i] * 0.5);

        // How close is candidate to predicted?
        const distance = this.euclideanDistance(candidate.embedding, predicted);

        // Convert distance to score (closer = higher)
        return Math.max(0, 1 - distance);
    }

    /**
     * Calculate trajectory vector from sequence of embeddings
     */
    private calculateTrajectory(embeddings: number[][]): number[] {
        if (embeddings.length < 2) {
            return new Array(embeddings[0]?.length || 128).fill(0);
        }

        const trajectory: number[] = [];
        const dim = embeddings[0].length;

        for (let i = 0; i < dim; i++) {
            let sum = 0;
            for (let j = 1; j < embeddings.length; j++) {
                sum += embeddings[j][i] - embeddings[j - 1][i];
            }
            trajectory.push(sum / (embeddings.length - 1));
        }

        return trajectory;
    }

    /**
     * Calculate tempo flow score (smooth BPM transitions)
     */
    private calculateTempoFlow(candidate: SequentialTrack, context: SequentialContext): number {
        const recent = context.recentTracks;
        const lastTrack = recent[recent.length - 1];

        const lastBpm = lastTrack?.audio?.bpm;
        const candidateBpm = candidate.audio?.bpm;

        if (!lastBpm || !candidateBpm) return 0.5;

        // Ideal: BPM changes by 0-10 for smooth flow
        const bpmDiff = Math.abs(candidateBpm - lastBpm);

        if (bpmDiff <= 5) return 1.0;
        if (bpmDiff <= 10) return 0.9;
        if (bpmDiff <= 20) return 0.7;
        if (bpmDiff <= 40) return 0.5;
        return 0.3;
    }

    /**
     * Calculate genre transition score
     */
    private calculateGenreTransition(candidate: SequentialTrack, context: SequentialContext): number {
        const recent = context.recentTracks;
        const lastTrack = recent[recent.length - 1];

        const lastGenre = lastTrack?.track.genre?.toLowerCase() || 'unknown';
        const candidateGenre = candidate.track.genre?.toLowerCase() || 'unknown';

        // Check user-learned transitions first
        if (this.userTransitions.has(lastGenre)) {
            const transitions = this.userTransitions.get(lastGenre)!;
            if (transitions.has(candidateGenre)) {
                return transitions.get(candidateGenre)!;
            }
        }

        // Fall back to default transitions
        if (this.genreTransitions[lastGenre]?.[candidateGenre]) {
            return this.genreTransitions[lastGenre][candidateGenre];
        }

        // Unknown transition - neutral
        return 0.4;
    }

    /**
     * Calculate energy progression score
     */
    private calculateEnergyProgression(candidate: SequentialTrack, context: SequentialContext): number {
        const recent = context.recentTracks;
        if (recent.length < 2) return 0.5;

        // Calculate energy trend
        const energies = recent
            .filter(t => t.audio?.energy !== undefined)
            .map(t => t.audio!.energy!);

        if (energies.length < 2) return 0.5;

        // Calculate trend direction
        let trend = 0;
        for (let i = 1; i < energies.length; i++) {
            trend += energies[i] - energies[i - 1];
        }
        trend /= energies.length - 1;

        const lastEnergy = energies[energies.length - 1];
        const candidateEnergy = candidate.audio?.energy ?? 0.5;

        // Expected energy based on trend
        const expectedEnergy = Math.max(0, Math.min(1, lastEnergy + trend));

        // How close is candidate to expected?
        const diff = Math.abs(candidateEnergy - expectedEnergy);
        return Math.max(0, 1 - diff * 2);
    }

    /**
     * Learn from a user's genre transition
     */
    learnTransition(fromGenre: string, toGenre: string, success: boolean): void {
        const from = fromGenre.toLowerCase();
        const to = toGenre.toLowerCase();

        if (!this.userTransitions.has(from)) {
            this.userTransitions.set(from, new Map());
        }

        const transitions = this.userTransitions.get(from)!;
        const current = transitions.get(to) ?? 0.5;

        // Update based on success/failure
        const newValue = success
            ? Math.min(1, current + 0.05)
            : Math.max(0, current - 0.05);

        transitions.set(to, newValue);
    }

    /**
     * Generate human-readable explanation
     */
    private generateExplanation(
        components: SequentialScoreResult['components'],
        _context: SequentialContext
    ): string {
        const parts: string[] = [];

        if (components.trajectoryFit > 0.7) {
            parts.push('continues your session direction');
        } else if (components.trajectoryFit < 0.3) {
            parts.push('changes direction from recent tracks');
        }

        if (components.tempoFlow > 0.8) {
            parts.push('smooth tempo transition');
        } else if (components.tempoFlow < 0.4) {
            parts.push('notable tempo change');
        }

        if (components.energyProgression > 0.7) {
            parts.push('matches energy trend');
        }

        return parts.length > 0
            ? `Selected: ${parts.join(', ')}`
            : 'Fits current session flow';
    }

    /**
     * Euclidean distance between two vectors
     */
    private euclideanDistance(a: number[], b: number[]): number {
        let sum = 0;
        const len = Math.min(a.length, b.length);
        for (let i = 0; i < len; i++) {
            sum += (a[i] - b[i]) ** 2;
        }
        return Math.sqrt(sum);
    }
}
