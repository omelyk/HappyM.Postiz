import { canMountHappyMComposerShell } from './happym.composer.bootstrap';

describe('HappyM composer authenticated hydration gate', () => {
  it('does not mount user or Copilot consumers while a ticket is pending', () => {
    expect(canMountHappyMComposerShell('single-use-ticket')).toBe(false);
  });

  it('does not mount authenticated consumers before session validation', () => {
    expect(canMountHappyMComposerShell(null)).toBe(false);
    expect(
      canMountHappyMComposerShell(null, {
        active: false,
        purpose: 'composer',
      })
    ).toBe(false);
  });

  it('mounts the composer shell only for a validated composer session', () => {
    expect(
      canMountHappyMComposerShell(null, {
        active: true,
        purpose: 'composer',
      })
    ).toBe(true);
    expect(
      canMountHappyMComposerShell(null, {
        active: true,
        purpose: 'connect',
      })
    ).toBe(false);
  });
});

