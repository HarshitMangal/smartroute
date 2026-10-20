/*
 * ============================================================================
 * 🛡️ services/circuitBreaker.js — Netflix Hystrix Style Circuit Breaker
 * ============================================================================
 *
 * 🎓 INTERVIEW CONCEPTS (Reliability Engineering & Microservices):
 *
 * 1. THE CASCADING FAILURE PROBLEM:
 *    - In microservices / decoupled architectures, if a downstream dependency
 *      (like a native C++ binary or external service) becomes slow or starts
 *      crashing, upstream callers pile up in the event loop, causing cascading
 *      server failure.
 *
 * 2. CIRCUIT BREAKER 3-STATE MACHINE:
 *    - CLOSED: Normal operation. Requests pass through to C++ binary.
 *    - OPEN: When failures exceed threshold (e.g., 3 consecutive failures),
 *      the circuit TRIPS to OPEN. All subsequent requests fail-fast or return
 *      instant fallback without calling the unhealthy binary.
 *    - HALF-OPEN: After a cooldown timeout (15s), one test request is allowed
 *      through to probe health. If it succeeds, circuit resets to CLOSED.
 *      If it fails, it trips back to OPEN.
 * ============================================================================
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 3;
    this.cooldownTimeoutMs = options.cooldownTimeoutMs || 15000; // 15 seconds
    this.executionTimeoutMs = options.executionTimeoutMs || 4000; // 4 seconds max per run

    this.state = 'CLOSED'; // 'CLOSED' | 'OPEN' | 'HALF-OPEN'
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.totalExecutions = 0;
  }

  async fire(action, fallbackAction) {
    this.totalExecutions++;

    // Check if OPEN circuit should transition to HALF-OPEN
    if (this.state === 'OPEN') {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.cooldownTimeoutMs) {
        this.state = 'HALF-OPEN';
        console.log('⚡ Circuit Breaker transitioned to HALF-OPEN (testing health)');
      } else {
        console.warn(`🛑 Circuit Breaker is OPEN. Executing Fallback (tripped ${Math.round((this.cooldownTimeoutMs - elapsed) / 1000)}s remaining)`);
        if (fallbackAction) return fallbackAction('Circuit Breaker OPEN — native engine protected');
        throw new Error('Circuit Breaker is OPEN — engine temporarily unavailable');
      }
    }

    try {
      // Execute with timeout race
      const result = await Promise.race([
        action(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Engine execution timed out after ${this.executionTimeoutMs}ms`)), this.executionTimeoutMs)
        ),
      ]);

      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure(err);
      if (fallbackAction) {
        return fallbackAction(err.message);
      }
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF-OPEN') {
      this.state = 'CLOSED';
      console.log('✅ Circuit Breaker recovered: state reset to CLOSED');
    }
  }

  onFailure(err) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    console.warn(`⚠️ Circuit Breaker failure registered (${this.failureCount}/${this.failureThreshold}): ${err.message}`);

    if (this.failureCount >= this.failureThreshold || this.state === 'HALF-OPEN') {
      this.state = 'OPEN';
      console.error(`🚨 Circuit Breaker TRIPPED to OPEN! Engine will be bypassed for ${this.cooldownTimeoutMs / 1000}s`);
    }
  }

  getStatus() {
    return {
      state: this.state, // 'CLOSED' | 'OPEN' | 'HALF-OPEN'
      failureCount: this.failureCount,
      failureThreshold: this.failureThreshold,
      totalExecutions: this.totalExecutions,
      lastFailureTime: this.lastFailureTime,
      isHealthy: this.state === 'CLOSED',
    };
  }

  // Admin manual reset
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
    console.log('🔄 Circuit Breaker manually reset to CLOSED');
  }
}

// Singleton instance for the C++ optimization engine
const engineBreaker = new CircuitBreaker({
  failureThreshold: 3,
  cooldownTimeoutMs: 15000,
  executionTimeoutMs: 4000,
});

module.exports = { engineBreaker };
