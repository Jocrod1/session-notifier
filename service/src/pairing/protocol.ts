export const PAIRING_PATH = '/pair';
export const PAIRING_PLATFORM = 'android';

export interface PairingDeviceInfo {
  name: string;
  platform: typeof PAIRING_PLATFORM;
  appVersion: string;
}

export interface PairingRequestPayload {
  token: string;
  device: PairingDeviceInfo;
}

export interface PairingRequest {
  device: PairingDeviceInfo;
  address: string;
}

export interface PairingResponse {
  accepted: boolean;
  deviceId?: string;
  credential?: string;
  message?: string;
}

const MAX_FIELD_LENGTH = 200;

export function parsePairingPayload(value: unknown): PairingRequestPayload {
  if (!isRecord(value) || typeof value.token !== 'string' || !value.token || !isRecord(value.device)) {
    throw new Error('Pairing payload must contain a token and device object');
  }
  const { device } = value;
  if (
    typeof device.name !== 'string' ||
    !device.name.trim() ||
    device.name.length > MAX_FIELD_LENGTH ||
    device.platform !== PAIRING_PLATFORM ||
    typeof device.appVersion !== 'string' ||
    !device.appVersion.trim() ||
    device.appVersion.length > MAX_FIELD_LENGTH
  ) {
    throw new Error('Pairing device must contain name, platform "android", and appVersion');
  }
  return {
    token: value.token,
    device: {
      name: device.name.trim(),
      platform: PAIRING_PLATFORM,
      appVersion: device.appVersion.trim(),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
