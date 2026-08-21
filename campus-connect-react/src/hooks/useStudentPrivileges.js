/**
 * useStudentPrivileges Hook
 * ==========================
 * Reactive hook providing delegated privilege states for students:
 * - isCR: Class Representative
 * - isCS: Core Student
 * - isPC: Placement Coordinator
 * - canBroadcast: Allowed to send section notices
 * - canEditSchedule: Allowed to draft timetable adjustments
 * - canViewLogs: Allowed to view raw attendance sheets
 */

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { delegationsApi } from '../services/api';

export const DELEGATED_BADGE_CONFIG = {
  CLASS_REPRESENTATIVE: {
    label: 'Class Representative (CR)',
    short: 'CR',
    color: '#8b5cf6', // Violet
    bg: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.4)',
    icon: '👑',
  },
  CORE_STUDENT: {
    label: 'Core Student (CS)',
    short: 'Core',
    color: '#3b82f6', // Blue
    bg: 'rgba(59, 130, 246, 0.15)',
    border: 'rgba(59, 130, 246, 0.4)',
    icon: '⚡',
  },
  PLACEMENT_COORDINATOR: {
    label: 'Placement Coordinator',
    short: 'TPO Lead',
    color: '#10b981', // Emerald
    bg: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(16, 185, 129, 0.4)',
    icon: '💼',
  },
};

export function useStudentPrivileges() {
  const { user, isStudent } = useAuth();
  const [data, setData] = useState({
    delegated_role: 'NONE',
    can_broadcast: false,
    can_edit_schedule: false,
    can_view_logs: false,
    privileges: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isStudent) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    delegationsApi.getMyPrivileges()
      .then(res => {
        if (isMounted && res && !res.error) {
          setData(res);
        }
      })
      .catch(err => console.error('Failed to load student privileges:', err))
      .finally(() => { if (isMounted) setLoading(false); });

    return () => { isMounted = false; };
  }, [isStudent, user]);

  const delegatedRole = data.delegated_role || user?.delegated_role || 'NONE';
  const isCR = delegatedRole === 'CLASS_REPRESENTATIVE';
  const isCS = delegatedRole === 'CORE_STUDENT';
  const isPC = delegatedRole === 'PLACEMENT_COORDINATOR';
  const hasPrivileges = isCR || isCS || isPC;

  const activeBadge = useMemo(() => {
    return DELEGATED_BADGE_CONFIG[delegatedRole] || null;
  }, [delegatedRole]);

  return {
    loading,
    delegatedRole,
    isCR,
    isCS,
    isPC,
    hasPrivileges,
    canBroadcast: Boolean(data.can_broadcast || user?.can_broadcast),
    canEditSchedule: Boolean(data.can_edit_schedule || user?.can_edit_schedule),
    canViewLogs: Boolean(data.can_view_logs || user?.can_view_logs),
    privileges: data.privileges || [],
    activeBadge,
  };
}
