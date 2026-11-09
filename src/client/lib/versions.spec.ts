import { expect, test } from 'vitest';
import { compareVersions, versionRange } from './versions';

test('orders versions by number rather than text', () => {
    expect(['1.21.9', '1.20.5', '1.21.11', '1.21', '1.21.10'].sort(compareVersions)).toEqual(['1.20.5', '1.21', '1.21.9', '1.21.10', '1.21.11']);
});

test('shows the oldest and newest version as a range', () => {
    expect(versionRange(['1.21.7', '1.21.11', '1.20.5', '1.21.4', '1.21.8', '1.21.9'])).toBe('1.20.5 to 1.21.11');
    expect(versionRange(['1.21.4', '1.21.4'])).toBe('1.21.4');
    expect(versionRange([])).toBe('');
});
