import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { PairingDeviceInfo } from './protocol.js';

export interface PairedDevice {
  id: string;
  name: string;
  platform: PairingDeviceInfo['platform'];
  appVersion: string;
  credential: string;
  pairedAt: string;
}

interface PersistedDevices {
  devices: Array<PairedDevice & { address?: string }>;
}

export interface DeviceRegistry {
  add(device: Omit<PairedDevice, 'id' | 'pairedAt'>): Promise<PairedDevice>;
  get(id: string): Promise<PairedDevice | undefined>;
  list(): Promise<PairedDevice[]>;
}

export class JsonDeviceRegistry implements DeviceRegistry {
  private devices: PairedDevice[] = [];
  private loaded = false;

  constructor(private readonly path: string) {}

  async add(device: Omit<PairedDevice, 'id' | 'pairedAt'>): Promise<PairedDevice> {
    await this.load();
    const paired: PairedDevice = {
      ...device,
      id: randomIdentifier(),
      pairedAt: new Date().toISOString(),
    };
    this.devices.push(paired);
    await this.save();
    return paired;
  }

  async list(): Promise<PairedDevice[]> {
    await this.load();
    return this.devices.map((device) => ({ ...device }));
  }

  async get(id: string): Promise<PairedDevice | undefined> {
    await this.load();
    await this.refresh();
    const device = this.devices.find((candidate) => candidate.id === id);
    return device ? { ...device } : undefined;
  }

  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    let parsed: PersistedDevices;
    try {
      parsed = JSON.parse(await readFile(this.path, 'utf8')) as PersistedDevices;
      if (!Array.isArray(parsed.devices)) throw new Error('devices must be an array');
    } catch (error: unknown) {
      if (isMissingFile(error)) {
        this.devices = [];
        return;
      }
      throw new Error(`Unable to load device registry: ${error instanceof Error ? error.message : String(error)}`);
    }
    const hadPeerAddresses = parsed.devices.some((device) => 'address' in device);
    this.devices = parsed.devices.map(({ address: _address, ...device }) => device);
    if (hadPeerAddresses) await this.save();
  }

  private async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    const temporaryPath = `${this.path}.tmp`;
    await writeFile(temporaryPath, JSON.stringify({ devices: this.devices }, null, 2), 'utf8');
    await rename(temporaryPath, this.path);
  }
}

function randomIdentifier(): string {
  return randomBytes(12).toString('base64url');
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}
