import { describe, expect, it } from 'vitest';
import { parseClientMessage, ProtocolError } from '../src/connection/protocol.js';

describe('connection notification acknowledgements', () => {
  it('accepts each documented presentation outcome', () => {
    for (const presentation of [
      'submitted',
      'permission-denied',
      'notifications-disabled',
      'channel-disabled',
      'failed',
    ]) {
      expect(parseClientMessage({
        type: 'notification-ack',
        protocolVersion: 1,
        notificationId: 'notification-1',
        processed: true,
        presentation,
      })).toMatchObject({
        type: 'notification-ack',
        notificationId: 'notification-1',
        processed: true,
        presentation,
      });
    }
  });

  it('accepts an explicit processing failure only with failed presentation', () => {
    expect(parseClientMessage({
      type: 'notification-ack',
      protocolVersion: 1,
      notificationId: 'notification-1',
      processed: false,
      presentation: 'failed',
    })).toMatchObject({ processed: false, presentation: 'failed' });
  });

  it('rejects malformed acknowledgement fields and unsupported versions', () => {
    const valid = {
      type: 'notification-ack',
      protocolVersion: 1,
      notificationId: 'notification-1',
      processed: true,
      presentation: 'submitted',
    };
    for (const invalid of [
      { ...valid, notificationId: '' },
      { ...valid, notificationId: 'contains spaces' },
      { ...valid, processed: 'true' },
      { ...valid, presentation: 'visible' },
      { ...valid, processed: false, presentation: 'submitted' },
      { ...valid, protocolVersion: 2 },
    ]) {
      expect(() => parseClientMessage(invalid)).toThrow(ProtocolError);
    }
  });
});
