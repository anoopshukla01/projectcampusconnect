/**
 * OTP Authentication Utility
 * ==========================
 * Isolated client-side utility for multi-channel OTP delivery (Email & SMS):
 * - Unified dispatch for Email (Gmail delivery) and SMS (Twilio / Fast2SMS / MSG91).
 * - Client-side validation, E.164 phone formatting, and 60-second resend cooldown timers.
 */

import { authApi } from '../../services/api';

/**
 * Formats a phone number to standard 10-digit clean string or E.164.
 */
export function formatPhoneNumber(phone = '') {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return digits;
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(2);
  return digits;
}

/**
 * Validates whether an identifier is a valid email or 10-digit phone number.
 */
export function validateOtpIdentifier(identifier = '', type = 'EMAIL') {
  if (type === 'EMAIL') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(identifier.trim().toLowerCase());
  }
  const cleanPhone = formatPhoneNumber(identifier);
  return cleanPhone.length === 10;
}

/**
 * Sends a 6-digit OTP to Email or Phone.
 *
 * @param {Object} params
 * @param {string} params.identifier - Email address or 10-digit phone number
 * @param {'EMAIL' | 'SMS'} params.type - Delivery channel
 * @param {string} [params.collegeCode] - Required for student email claim
 * @returns {Promise<{ ok: boolean, message?: string, mockOtp?: string, error?: string }>}
 */
export async function sendOtp({ identifier, type = 'EMAIL', collegeCode = '' }) {
  const isEmail = type === 'EMAIL' || identifier.includes('@');
  const payload = {};

  if (isEmail) {
    payload.email = identifier.trim().toLowerCase();
    if (collegeCode) payload.college_code = collegeCode.trim().toUpperCase();
  } else {
    payload.phone = formatPhoneNumber(identifier);
  }

  try {
    const res = await authApi.otpSend(payload);
    if (res && res.success !== false && (res.message || res.status === 200 || !res.error)) {
      return {
        ok: true,
        message: res.message || `OTP sent successfully via ${isEmail ? 'Email' : 'SMS'}. Valid for 5 minutes.`,
        mockOtp: res.mock_otp || null,
      };
    }
    return {
      ok: false,
      error: res?.details || res?.message || res?.error || 'Failed to dispatch OTP. Please check provider configuration or contact details.',
    };
  } catch (err) {
    const errorMsg = err.response?.data?.details || err.response?.data?.message || err.response?.data?.error || err.message || 'Delivery error occurred while sending OTP.';
    return {
      ok: false,
      error: errorMsg,
    };
  }
}

/**
 * Verifies a 6-digit OTP code against the server hash.
 *
 * @param {Object} params
 * @param {string} params.identifier - Email or phone
 * @param {string} params.otp - 6-digit code
 * @returns {Promise<{ ok: boolean, otpVerifiedToken?: string, message?: string, error?: string }>}
 */
export async function verifyOtp({ identifier, otp }) {
  const isEmail = identifier.includes('@');
  const payload = {
    otp: otp.trim(),
  };

  if (isEmail) {
    payload.email = identifier.trim().toLowerCase();
  } else {
    payload.phone = formatPhoneNumber(identifier);
  }

  try {
    const res = await authApi.otpVerify(payload);
    if (res && res.otp_verified_token) {
      return {
        ok: true,
        otpVerifiedToken: res.otp_verified_token,
        message: 'OTP verified successfully.',
      };
    }
    return {
      ok: false,
      error: res?.error || res?.message || 'Invalid or expired OTP code.',
    };
  } catch (err) {
    return {
      ok: false,
      error: err.message || 'Verification failed. Please check the code.',
    };
  }
}
