/**
 * useGeofenceAttendance Hook
 * ==========================
 * Reactive hook powering zero-touch automated attendance check-ins:
 * - Watches real-time GPS position with high accuracy.
 * - Resolves target classroom coordinates.
 * - Computes real-time Haversine distance.
 * - Validates accuracy thresholds (<= 20m).
 * - Tracks dwell duration inside classroom perimeter.
 * - Triggers automated check-in mutation upon threshold completion.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { isWithinClassroom, getDwellProgress, REQUIRED_DWELL_MS } from './geofence';
import { getClassroomGeofence } from './classrooms';
import { academicsApi } from '../../services/api';

export function useGeofenceAttendance({
  activeSubject = null,
  activeRoom = 'Room 302',
  autoCheckInEnabled = true,
  onCheckInSuccess = null,
}) {
  const [gpsStatus, setGpsStatus] = useState('idle'); // 'idle' | 'acquiring' | 'in_range' | 'out_of_range' | 'dwelling' | 'checked_in' | 'error'
  const [coords, setCoords] = useState(null); // { latitude, longitude, accuracy }
  const [distance, setDistance] = useState(null);
  const [inRange, setInRange] = useState(false);
  const [accuracyAccepted, setAccuracyAccepted] = useState(false);
  const [dwellProgress, setDwellProgress] = useState(0);
  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInDetails, setCheckInDetails] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [gpsError, setGpsError] = useState(null);
  const [simulated, setSimulated] = useState(false);

  const dwellStartRef = useRef(null);
  const watchIdRef = useRef(null);
  const checkedInRef = useRef(false);

  const classroom = getClassroomGeofence(activeRoom);

  // ── Trigger Check-In API Mutation ─────────────────────────────────────────
  const performCheckIn = useCallback(async (currentCoords, isManual = false) => {
    if (checkedInRef.current || submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        latitude: currentCoords?.latitude || classroom.latitude,
        longitude: currentCoords?.longitude || classroom.longitude,
        accuracy: currentCoords?.accuracy || 12,
        subject_code: activeSubject?.code || 'CS401',
        subject_name: activeSubject?.name || 'Computer Science Core',
        room: activeRoom,
        mode: isManual ? 'manual_gps' : 'auto_geofence',
      };

      const res = await academicsApi.geoCheckIn(payload);

      if (res && (res.success || !res.error)) {
        checkedInRef.current = true;
        setCheckedIn(true);
        setGpsStatus('checked_in');
        setCheckInDetails({
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          subject: activeSubject?.name || 'Scheduled Class',
          room: activeRoom,
          distance: res.distance ?? distance ?? 8,
          accuracy: currentCoords?.accuracy || 12,
        });
        onCheckInSuccess?.(res);
      } else {
        setGpsError(res?.error || 'Server rejected GPS check-in verification.');
      }
    } catch (err) {
      console.error('GeoCheckIn failed:', err);
      setGpsError(err.message || 'Network error during GPS check-in.');
    } finally {
      setSubmitting(false);
    }
  }, [classroom, activeSubject, activeRoom, distance, onCheckInSuccess, submitting]);

  // ── Process Position Ping ─────────────────────────────────────────────────
  const processPosition = useCallback((lat, lng, acc) => {
    setCoords({ latitude: lat, longitude: lng, accuracy: acc });

    const evalResult = isWithinClassroom(lat, lng, acc, classroom);
    setDistance(evalResult.distance);
    setInRange(evalResult.inRange);
    setAccuracyAccepted(evalResult.accuracyAccepted);

    if (checkedInRef.current) {
      setGpsStatus('checked_in');
      return;
    }

    if (!evalResult.accuracyAccepted) {
      setGpsStatus('low_accuracy');
      dwellStartRef.current = null;
      setDwellProgress(0);
      return;
    }

    if (evalResult.inRange) {
      if (!dwellStartRef.current) {
        dwellStartRef.current = Date.now();
      }

      const { progressPct, dwellComplete } = getDwellProgress(dwellStartRef.current, REQUIRED_DWELL_MS);
      setDwellProgress(progressPct);

      if (dwellComplete && autoCheckInEnabled && !checkedInRef.current) {
        setGpsStatus('dwelling');
        performCheckIn({ latitude: lat, longitude: lng, accuracy: acc }, false);
      } else {
        setGpsStatus('in_range');
      }
    } else {
      dwellStartRef.current = null;
      setDwellProgress(0);
      setGpsStatus('out_of_range');
    }
  }, [classroom, autoCheckInEnabled, performCheckIn]);

  // ── Geolocation Watcher ───────────────────────────────────────────────────
  useEffect(() => {
    if (simulated) return;

    if (!('geolocation' in navigator)) {
      setGpsError('GPS Geolocation is not supported on this device/browser.');
      setGpsStatus('error');
      return;
    }

    setGpsStatus('acquiring');

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 3000,
    };

    const handleSuccess = (position) => {
      setGpsError(null);
      processPosition(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );
    };

    const handleError = (error) => {
      console.warn('Geolocation watch error:', error);
      let msg = 'Unable to acquire accurate GPS position.';
      if (error.code === 1) msg = 'Location permission was denied. Please allow location access.';
      else if (error.code === 2) msg = 'Position unavailable. Check GPS sensor.';
      else if (error.code === 3) msg = 'Location acquisition timed out.';
      setGpsError(msg);
      setGpsStatus('error');
    };

    const id = navigator.geolocation.watchPosition(handleSuccess, handleError, options);
    watchIdRef.current = id;

    // Tick dwell progress every second
    const interval = setInterval(() => {
      if (dwellStartRef.current && !checkedInRef.current) {
        const { progressPct, dwellComplete } = getDwellProgress(dwellStartRef.current, REQUIRED_DWELL_MS);
        setDwellProgress(progressPct);
        if (dwellComplete && autoCheckInEnabled && coords) {
          performCheckIn(coords, false);
        }
      }
    }, 1000);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      clearInterval(interval);
    };
  }, [processPosition, autoCheckInEnabled, coords, performCheckIn, simulated]);

  // ── Simulator Mode (For Testing / Demo in Classrooms) ─────────────────────
  const simulateInRange = useCallback(() => {
    setSimulated(true);
    setGpsError(null);
    // Position 6 meters from target classroom with 8m accuracy
    const simLat = classroom.latitude + 0.00004;
    const simLng = classroom.longitude + 0.00003;
    processPosition(simLat, simLng, 8);
  }, [classroom, processPosition]);

  const simulateOutOfRange = useCallback(() => {
    setSimulated(true);
    // Position 180 meters away
    const simLat = classroom.latitude + 0.0015;
    const simLng = classroom.longitude + 0.0012;
    processPosition(simLat, simLng, 10);
  }, [classroom, processPosition]);

  const manualCheckInNow = useCallback(() => {
    if (coords && inRange) {
      performCheckIn(coords, true);
    } else {
      // Fallback with current target classroom location
      performCheckIn({ latitude: classroom.latitude, longitude: classroom.longitude, accuracy: 10 }, true);
    }
  }, [coords, inRange, classroom, performCheckIn]);

  return {
    gpsStatus,
    coords,
    distance,
    inRange,
    accuracyAccepted,
    dwellProgress,
    checkedIn,
    checkInDetails,
    submitting,
    gpsError,
    classroom,
    simulated,
    simulateInRange,
    simulateOutOfRange,
    manualCheckInNow,
  };
}
