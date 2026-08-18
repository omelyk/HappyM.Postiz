import {
  HAPPYM_OPEN_WORKSPACE_SELECTOR,
  happyMWorkspaceKind,
  requestHappyMWorkspaceSelector,
} from './happym.workspace-selector';

describe('Social Manager workspace selector', () => {
  it('turns the system empty-state CTA into an explicit selector request', () => {
    const target = new EventTarget();
    const listener = jest.fn();
    target.addEventListener(HAPPYM_OPEN_WORKSPACE_SELECTOR, listener);

    requestHappyMWorkspaceSelector(target);

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('distinguishes the engine workspace from pharmacy tenants', () => {
    expect(happyMWorkspaceKind('happym-system', 'happym-system')).toBe(
      'system'
    );
    expect(happyMWorkspaceKind('FARMA1', 'happym-system')).toBe('pharmacy');
  });
});
