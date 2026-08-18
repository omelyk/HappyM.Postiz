import { createHmac, timingSafeEqual } from 'crypto';

export const HAPPYM_WEBHOOK_SIGNATURE_HEADER = 'X-HappyM-Webhook-Signature';
export const HAPPYM_WEBHOOK_TIMESTAMP_HEADER = 'X-HappyM-Webhook-Timestamp';

export function createHappyMWebhookHeaders(
  payload: string,
  timestamp: string,
  secret = process.env.HAPPYM_WEBHOOK_SIGNING_SECRET
): Record<string, string> {
  if (!secret) {
    return {};
  }

  const signature = createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`, 'utf8')
    .digest('hex');

  return {
    [HAPPYM_WEBHOOK_TIMESTAMP_HEADER]: timestamp,
    [HAPPYM_WEBHOOK_SIGNATURE_HEADER]: `sha256=${signature}`,
  };
}

export function verifyHappyMWebhookSignature(
  payload: string,
  timestamp: string,
  signature: string,
  secret: string
): boolean {
  const expected = createHappyMWebhookHeaders(payload, timestamp, secret)[
    HAPPYM_WEBHOOK_SIGNATURE_HEADER
  ];
  const expectedBytes = Buffer.from(expected, 'utf8');
  const actualBytes = Buffer.from(signature, 'utf8');
  return (
    expectedBytes.length === actualBytes.length &&
    timingSafeEqual(expectedBytes, actualBytes)
  );
}
