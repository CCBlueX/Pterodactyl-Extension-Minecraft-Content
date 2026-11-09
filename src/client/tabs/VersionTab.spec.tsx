import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createExtensionTestHost, createTestServer } from '@pterodactyl/sdk/testing';
import * as api from '../api';
import type { CurrentSoftware } from '../api';
import VersionTab from './VersionTab';

const VERSIONS = [
    { id: '26.2-snapshot-1', type: 'snapshot', java: 25, supported: true, latest: null },
    { id: '26.1', type: 'release', java: 25, supported: true, latest: null },
    { id: '1.21.4', type: 'release', java: 21, supported: true, latest: null },
];

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    getSoftwareTypes: vi.fn().mockResolvedValue({ types: [{ id: 'PAPER', name: 'Paper', icon: '', categories: ['plugins'], deprecated: false, experimental: false }] }),
    getSoftwareVersions: vi.fn(),
    getSoftwareBuilds: vi.fn().mockResolvedValue({
        builds: [
            { id: 3, name: '#3', project_version: null, experimental: true, size: 0, created: null, changes: [] },
            { id: 2, name: '#2', project_version: null, experimental: false, size: 0, created: null, changes: [] },
        ],
    }),
    getCurrentSoftware: vi.fn(),
    changeSoftware: vi.fn().mockResolvedValue({ job: 'job-1' }),
}));

let host: ReturnType<typeof createExtensionTestHost> | undefined;

beforeEach(() => {
    vi.mocked(api.getSoftwareVersions).mockResolvedValue({ versions: VERSIONS });
    vi.mocked(api.changeSoftware).mockClear();
});

afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
});

function renderTab(current: CurrentSoftware, minecraft = '26.1') {
    vi.mocked(api.getCurrentSoftware).mockResolvedValue(current);
    host = createExtensionTestHost({
        extensionId: 'minecraft-content',
        prefix: 'mcc',
        server: createTestServer({ owner: false, permissions: ['ext.minecraft-content.read', 'ext.minecraft-content.version'], eggFeatures: ['eula'] }),
    });
    render(<VersionTab platform={{ software: 'paper', minecraft, kind: 'plugins', loaders: ['paper'], detected: true }} busy={false} />, { wrapper: host.Wrapper });
}

async function versionOptions() {
    const input = (await screen.findByLabelText('Version')) as HTMLInputElement;
    await waitFor(() => expect(input.disabled).toBe(false));
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const options = (await screen.findAllByRole('option')).map((option) => option.textContent ?? '');
    fireEvent.keyDown(input, { key: 'Escape' });
    input.blur();
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));

    return options;
}

async function openInstall() {
    const install = await screen.findByRole('button', { name: 'Install' });
    await waitFor(() => expect((install as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(install);

    return screen.findByRole('dialog');
}

test('hides snapshots until they are switched on', async () => {
    renderTab({ installed: null, update: null, backups: { limit: 2, used: 0, free: 2 }, world: null });

    let options = await versionOptions();
    expect(options.some((option) => option.startsWith('26.2-snapshot-1'))).toBe(false);
    expect(options.find((option) => option.startsWith('26.1'))).toContain('Latest');

    fireEvent.click(screen.getByRole('switch', { name: /Show snapshots/ }));
    options = await versionOptions();
    expect(options.find((option) => option.startsWith('26.2-snapshot-1'))).toContain('Snapshot');
});

test('backs up and cleans up smartly by default', async () => {
    renderTab({ installed: null, update: null, backups: { limit: 2, used: 1, free: 1 }, world: null });

    await openInstall();
    expect(await screen.findByText(/1 of 2 backup slots free/)).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Install' }).at(-1)!);

    await waitFor(() => expect(api.changeSoftware).toHaveBeenCalled());
    expect(vi.mocked(api.changeSoftware).mock.calls[0][1]).toMatchObject({ type: 'PAPER', version: '26.1', build: 2, cleanup: 'smart', backup: true });
});

test('runs without a backup when every slot is in use', async () => {
    renderTab({ installed: null, update: null, backups: { limit: 1, used: 1, free: 0 }, world: null });

    await openInstall();
    expect(await screen.findByText(/All 1 backup slots are in use/)).toBeTruthy();
    expect(screen.getByRole('checkbox').getAttribute('aria-checked')).toBe('false');
});

test('needs the tick before installing a version older than the world', async () => {
    renderTab({ installed: null, update: null, backups: { limit: 0, used: 0, free: 0 }, world: { name: 'world', version: '26.1', data_version: 4600 } }, '1.21.4');

    await openInstall();
    expect(await screen.findByText(/The world "world" was last saved with Minecraft 26\.1/)).toBeTruthy();
    const confirm = screen.getAllByRole('button', { name: 'Install' }).at(-1) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);

    fireEvent.click(screen.getAllByRole('checkbox')[0]);
    await waitFor(() => expect(confirm.disabled).toBe(false));
    fireEvent.click(confirm);

    await waitFor(() => expect(api.changeSoftware).toHaveBeenCalled());
    expect(vi.mocked(api.changeSoftware).mock.calls[0][1]).toMatchObject({ version: '1.21.4', backup: false, downgrade: true });
});

test('update now backs up while a slot is free', async () => {
    const installed = { type: 'PAPER', version: '1.21.4', build: 1, name: '#1', installed_at: '2026-11-01T00:00:00Z' };
    const update = { id: 2, name: '#2', project_version: null, experimental: false, size: 0, created: null, changes: [] };
    renderTab({ installed, update, backups: { limit: 2, used: 1, free: 1 }, world: null }, '1.21.4');

    expect(await screen.findByText('Takes a backup first.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Update now' }));

    await waitFor(() => expect(api.changeSoftware).toHaveBeenCalled());
    expect(vi.mocked(api.changeSoftware).mock.calls[0][1]).toMatchObject({ type: 'PAPER', version: '1.21.4', build: 2, cleanup: 'keep', backup: true });
});

test('update now runs without a backup when every slot is in use', async () => {
    const installed = { type: 'PAPER', version: '1.21.4', build: 1, name: '#1', installed_at: '2026-11-01T00:00:00Z' };
    const update = { id: 2, name: '#2', project_version: null, experimental: false, size: 0, created: null, changes: [] };
    renderTab({ installed, update, backups: { limit: 1, used: 1, free: 0 }, world: null }, '1.21.4');

    fireEvent.click(await screen.findByRole('button', { name: 'Update now' }));

    await waitFor(() => expect(api.changeSoftware).toHaveBeenCalled());
    expect(vi.mocked(api.changeSoftware).mock.calls[0][1]).toMatchObject({ backup: false });
});
