import {
  createHappyMWebhookHeaders,
  HAPPYM_WEBHOOK_SIGNATURE_HEADER,
  HAPPYM_WEBHOOK_TIMESTAMP_HEADER,
  verifyHappyMWebhookSignature,
} from './webhook.signature';

describe('HappyM webhook signature', () => {
  it('signs timestamp and exact payload with HMAC SHA-256', () => {
    const payload = '{"postId":"post-1"}';
    const timestamp = '1723111200';
    const headers = createHappyMWebhookHeaders(
      payload,
      timestamp,
      'test-secret'
    );

    expect(headers[HAPPYM_WEBHOOK_TIMESTAMP_HEADER]).toBe(timestamp);
    expect(headers[HAPPYM_WEBHOOK_SIGNATURE_HEADER]).toMatch(
      /^sha256=[a-f0-9]{64}$/
    );
    expect(
      verifyHappyMWebhookSignature(
        payload,
        timestamp,
        headers[HAPPYM_WEBHOOK_SIGNATURE_HEADER],
        'test-secret'
      )
    ).toBe(true);
    expect(
      verifyHappyMWebhookSignature(
        '{"postId":"other"}',
        timestamp,
        headers[HAPPYM_WEBHOOK_SIGNATURE_HEADER],
        'test-secret'
      )
    ).toBe(false);
  });

  it('does not emit signature headers when no secret is configured', () => {
    expect(createHappyMWebhookHeaders('{}', '1723111200', '')).toEqual({});
  });
});
