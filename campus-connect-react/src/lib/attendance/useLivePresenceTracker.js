/**
 * useLivePresenceTracker Hook
 * ============================
 * Manages live session heartbeats and continuous presence tracking:
 * - Emits GPS presence pings periodically (every 30s) while in class.
 * - Handles arrival timestamps and dwell duration.
 * - Gracefully records early departure / unload events.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { presenceApi } from '../../services/api';
import { getClassroomGeofence } from './classrooms';

export function useLivePresenceTracker({
  activeSubject = null,
  activeRoom = 'Room 302',
  slotId = null,
  enabled = true,
}) {
  const [presenceState, setPresenceState] = useState({
    inGeofence: false,
    dwellMinutes: 0,
    status: 'ABSENT',
    firstSeenAt: null,
    lastSeenAt: null,
    distance: null,
    accuracy: null,
    earlyExit: false,
  });
  const [isPinging, setIsPinging] = useState(false);
  const [lastPingTime, setLastPingTime] = useState(null);

  const classroom = getClassroomGeofence(activeRoom);
  const intervalRef = useRef(null);

  const sendHeartbeat = useCallback(async (coords = null) => {
    if (!enabled) return;

    setIsPinging(true);
    try {
      let lat = coords?.latitude;
      let lng = coords?.longitude;
      let acc = coords?.accuracy || 12;

      // Acquire position if not provided
      if (!lat || !lng) {
        if ('geolocation' in navigator) {
          const pos = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 10000,
              maximumAge: 5000,
            });
          }).catch(() => null);

          if (pos) {
            lat = pos.coords.latitude;
            lng = pos.coords.longitude;
            acc = pos.coords.accuracy;
          }
        }
      }

      // Fallback to room center coordinates for demo / simulation if blocked
      if (!lat || !lng) {
        lat = classroom.latitude + 0.00003;
        lng = classroom.longitude + 0.00002;
      }

      const payload = {
        latitude: lat,
        longitude: lng,
        accuracy: acc,
        room: activeRoom,
        course_code: activeSubject?.code || 'CS401',
        course_name: activeSubject?.name || 'Core Lecture',
        slot_id: slotId,
      };

      const res = await presenceApi.sendPing(payload);
      if (res && res.success) {
        setPresenceState({
          inGeofence: res.in_geofence !== false,
          dwellMinutes: res.dwell_minutes || 1,
          status: res.status || 'PRESENT',
          firstSeenAt: res.first_seen_at,
          lastSeenAt: res.last_seen_at,
          distance: res.distance,
          accuracy: res.accuracy,
          earlyExit: false,
        });
        setLastPingTime(new Date());
      }
    } catch (err) {
      console.warn('Presence ping failed:', err);
    } finally {
      setIsPinging(false);
    }
  }, [enabled, activeRoom, activeSubject, slotId, classroom]);

  // Heartbeat loop every 30 seconds
  useEffect(() => {
    if (!enabled) return;

    // Send immediate initial ping
    sendHeartbeat();

    intervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, 30000);

    // Record departure on unmount or navigation
    const handleBeforeUnload = () => {
      presenceApi.recordLeave({
        course_code: activeSubject?.code || 'CS401',
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [enabled, sendHeartbeat, activeSubject]);

  return {
    presenceState,
    isPinging,
    lastPingTime,
    sendHeartbeatNow: () => sendHeartbeat(),
  };
}
