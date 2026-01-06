/**
 * Training Scheduler - Manages automatic model retraining
 */

import type { AutoTrainingConfig } from '../types';

export class TrainingScheduler {
  private config: AutoTrainingConfig;
  private isRunning = false;
  private lastTrainingTime = 0;
  private lastEventCount = 0;
  private scheduledTraining: ReturnType<typeof setTimeout> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private trainFn: (() => Promise<void>) | null = null;

  constructor(config: Partial<AutoTrainingConfig> = {}) {
    this.config = {
      enabled: true,
      minInterval: 24 * 60 * 60 * 1000, // 24 hours
      minNewEvents: 10,
      maxInterval: 7 * 24 * 60 * 60 * 1000, // 7 days
      trainOnStartup: false,
      trainWhenIdle: true,
      idleThreshold: 5 * 60 * 1000, // 5 minutes
      ...config,
    };
  }

  /**
   * Start the scheduler
   */
  start(trainFn: () => Promise<void>): void {
    if (this.isRunning) return;

    this.trainFn = trainFn;
    this.isRunning = true;

    console.log('[TrainingScheduler] Started');

    // Train on startup if configured
    if (this.config.trainOnStartup) {
      this.scheduleTraining(0);
    }

    // Set up idle detection if enabled
    if (this.config.trainWhenIdle) {
      this.setupIdleDetection();
    }
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;

    if (this.scheduledTraining) {
      clearTimeout(this.scheduledTraining);
      this.scheduledTraining = null;
    }

    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    console.log('[TrainingScheduler] Stopped');
  }

  /**
   * Check if training should be scheduled
   */
  checkAndSchedule(currentEventCount: number): void {
    if (!this.config.enabled || !this.isRunning) return;

    const newEvents = currentEventCount - this.lastEventCount;
    const timeSinceLastTraining = Date.now() - this.lastTrainingTime;

    // Check if we have enough new events
    if (newEvents < this.config.minNewEvents) return;

    // Check if enough time has passed
    if (timeSinceLastTraining < this.config.minInterval) {
      // Schedule for later if not already scheduled
      if (!this.scheduledTraining) {
        const delay = this.config.minInterval - timeSinceLastTraining;
        this.scheduleTraining(delay);
      }
      return;
    }

    // Schedule training soon
    this.scheduleTraining(1000);
  }

  /**
   * Force immediate training
   */
  async trainNow(): Promise<void> {
    if (!this.trainFn) {
      throw new Error('Training function not set');
    }

    // Clear any scheduled training
    if (this.scheduledTraining) {
      clearTimeout(this.scheduledTraining);
      this.scheduledTraining = null;
    }

    await this.runTraining();
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<AutoTrainingConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get time until next scheduled training (for admin UI)
   * Returns null if no training is scheduled
   */
  getNextTrainingTime(): number | null {
    if (!this.scheduledTraining) return null;

    const timeSinceLastTraining = Date.now() - this.lastTrainingTime;
    if (timeSinceLastTraining >= this.config.maxInterval) {
      return Date.now(); // Training overdue
    }

    return this.lastTrainingTime + this.config.minInterval;
  }

  /**
   * Get current scheduler status (for admin UI)
   */
  getStatus(): {
    isRunning: boolean;
    lastTrainingTime: number;
    nextTrainingTime: number | null;
    config: AutoTrainingConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastTrainingTime: this.lastTrainingTime,
      nextTrainingTime: this.getNextTrainingTime(),
      config: { ...this.config },
    };
  }

  /**
   * Schedule training after a delay
   */
  private scheduleTraining(delayMs: number): void {
    if (this.scheduledTraining) {
      clearTimeout(this.scheduledTraining);
    }

    this.scheduledTraining = setTimeout(() => {
      this.runTraining();
    }, delayMs);

    console.log(`[TrainingScheduler] Training scheduled in ${delayMs / 1000}s`);
  }

  /**
   * Run the training
   */
  private async runTraining(): Promise<void> {
    if (!this.trainFn || !this.isRunning) return;

    this.scheduledTraining = null;

    console.log('[TrainingScheduler] Starting training...');

    try {
      await this.trainFn();
      this.lastTrainingTime = Date.now();
      console.log('[TrainingScheduler] Training completed');
    } catch (error) {
      console.error('[TrainingScheduler] Training failed:', error);
    }
  }

  /**
   * Set up idle detection
   */
  private setupIdleDetection(): void {
    const resetIdleTimer = () => {
      if (this.idleTimer) {
        clearTimeout(this.idleTimer);
      }

      this.idleTimer = setTimeout(() => {
        this.onIdle();
      }, this.config.idleThreshold);
    };

    // Listen for user activity (browser environment)
    if (typeof window !== 'undefined') {
      ['mousemove', 'keydown', 'click', 'scroll'].forEach(event => {
        window.addEventListener(event, resetIdleTimer, { passive: true });
      });
    }

    resetIdleTimer();
  }

  /**
   * Called when user is idle
   */
  private async onIdle(): Promise<void> {
    if (!this.config.trainWhenIdle || !this.isRunning) return;

    const timeSinceLastTraining = Date.now() - this.lastTrainingTime;

    // Only train if enough time has passed
    if (timeSinceLastTraining >= this.config.minInterval) {
      console.log('[TrainingScheduler] User idle, checking if training needed...');
      // Training will be triggered by checkAndSchedule if there are new events
    }
  }
}
