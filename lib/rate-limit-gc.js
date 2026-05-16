/**
 * Periodic GC for in-memory rate-limit Maps.
 *
 * Why: accessRequestRateLimits & operatorLoginAttempts grow unbounded across IPs
 * (V10 audit, "Periodic GC" — MEDIU). On Render free with long uptime that
 * eventually leaks RAM and amplifies DoS via spoofed source IPs.
 *
 * Usage in server.js (after maps are defined):
 *
 *   const { installRateLimitGC } = require('./lib/rate-limit-gc');
 *
 *   installRateLimitGC([
 *     {
 *       name: 'accessRequestRateLimits',
 *       map: accessRequestRateLimits,
 *       ttlMs: 60 * 60 * 1000,                 // 1h
 *       getLastSeenAt: (v) => v.windowStart || 0,
 *     },
 *     {
 *       name: 'operatorLoginAttempts',
 *       map: operatorLoginAttempts,
 *       ttlMs: 60 * 60 * 1000,
 *       getLastSeenAt: (v) => v.windowStart || 0,
 *     },
 *   ], { intervalMs: 10 * 60 * 1000, logger });
 *
 * Returns a stop() function — call it on graceful shutdown (SIGTERM handler) if you have one.
 */

'use strict';

function installRateLimitGC(targets, options = {}) {
  const intervalMs = options.intervalMs || 10 * 60 * 1000; // 10 minutes default
  const logger = options.logger || null;
  const now = options.nowFn || (() => Date.now());

  if (!Array.isArray(targets) || targets.length === 0) {
    return () => {};
  }

  function sweep() {
    const t = now();
    const summary = [];

    for (const target of targets) {
      const { name, map, ttlMs, getLastSeenAt } = target;

      if (!map || typeof map.forEach !== 'function' || typeof map.delete !== 'function') {
        continue;
      }

      const before = map.size;
      const toDelete = [];

      map.forEach((value, key) => {
        let lastSeen = 0;
        try {
          lastSeen = Number(getLastSeenAt(value)) || 0;
        } catch (_) {
          lastSeen = 0;
        }
        // Fallback: if we cannot read a timestamp, treat as expired (safer than leaking).
        if (lastSeen === 0 || (t - lastSeen) > ttlMs) {
          toDelete.push(key);
        }
      });

      for (const key of toDelete) {
        map.delete(key);
      }

      if (toDelete.length > 0) {
        summary.push(`${name}: ${before} -> ${map.size} (-${toDelete.length})`);
      }
    }

    if (summary.length > 0 && logger && typeof logger.info === 'function') {
      logger.info('[rate-limit-gc] swept', { entries: summary });
    }
  }

  // Don't sweep on boot — let maps populate first.
  const handle = setInterval(sweep, intervalMs);

  // Don't keep the event loop alive just for GC (Node will exit if nothing else).
  if (typeof handle.unref === 'function') {
    handle.unref();
  }

  return function stop() {
    clearInterval(handle);
  };
}

module.exports = { installRateLimitGC };
