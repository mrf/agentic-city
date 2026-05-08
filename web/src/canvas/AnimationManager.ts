/**
 * AnimationManager — tween helpers for UFO flight, pulse, and blink animations.
 *
 * Stateless time-based helpers are static methods.
 * Per-agent state (hover phase offsets) is stored in the instance map.
 */

/** Stable hash of a string to a 32-bit unsigned int. */
function hashId(id: string): number {
  let h = 5381;
  for (let i = 0; i < id.length; i++) {
    h = ((h * 33) ^ id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export class AnimationManager {
  private agentPhases = new Map<string, number>();

  /** Return the stable random phase offset [0, 2π) for an agent. */
  private getPhase(agentId: string): number {
    let phase = this.agentPhases.get(agentId);
    if (phase === undefined) {
      phase = (hashId(agentId) / 0x100000000) * Math.PI * 2;
      this.agentPhases.set(agentId, phase);
    }
    return phase;
  }

  /** Gentle vertical hover bob in screen pixels (−3 … +3). */
  getHoverBob(agentId: string, time: number): number {
    return Math.sin(time * 0.0015 + this.getPhase(agentId)) * 3;
  }

  /** Rotation angle for porthole spin [0, 2π). */
  getPortholeSpin(agentId: string, time: number): number {
    return (time * 0.0003 + this.getPhase(agentId)) % (Math.PI * 2);
  }

  /** Evaluate a cubic bezier at t ∈ [0, 1]. */
  static bezier(
    p0: [number, number],
    p1: [number, number],
    p2: [number, number],
    p3: [number, number],
    t: number,
  ): [number, number] {
    const mt = 1 - t;
    return [
      mt * mt * mt * p0[0] + 3 * mt * mt * t * p1[0] + 3 * mt * t * t * p2[0] + t * t * t * p3[0],
      mt * mt * mt * p0[1] + 3 * mt * mt * t * p1[1] + 3 * mt * t * t * p2[1] + t * t * t * p3[1],
    ];
  }

  /**
   * Pulsing alpha for "thinking" dome glow — oscillates 0.3 … 1.0.
   * @param period ms per full cycle
   */
  static pulseAlpha(time: number, period = 1400): number {
    return 0.3 + 0.7 * (0.5 + 0.5 * Math.sin((time / period) * Math.PI * 2));
  }

  /**
   * Binary blink for error state — on/off at given period.
   */
  static blinkAlpha(time: number, period = 700): number {
    return Math.sin((time / period) * Math.PI) > 0 ? 1 : 0.15;
  }

  /**
   * Scan-line scroll offset (0 … lineSpacing) that advances over time.
   */
  static scanOffset(time: number, lineSpacing: number, speed = 0.02): number {
    return (time * speed) % lineSpacing;
  }
}
