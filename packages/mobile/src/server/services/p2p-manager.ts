/**
 * P2P Connection Manager
 *
 * Uses Nostr relays for serverless messaging.
 * No WebRTC required - just WebSocket connections to public relays.
 * Works in both Node.js (desktop) and browsers (mobile).
 *
 * Flow:
 * 1. Desktop creates a room with a connection code (e.g., "BLUE-TIGER-42")
 * 2. Mobile joins the same room with the code
 * 3. Messages are relayed through public Nostr relays
 */

import { NostrRelay, NostrPeer, NostrRelayConfig } from './nostr-relay';

// Re-export types with P2P naming for backwards compatibility
export type P2PPeer = NostrPeer;
export type P2PConfig = NostrRelayConfig;

/**
 * P2P Manager - Wrapper around NostrRelay for backwards compatibility
 */
export class P2PManager extends NostrRelay {
  constructor(config: Partial<P2PConfig> = {}) {
    super(config);
  }
}

export default P2PManager;
