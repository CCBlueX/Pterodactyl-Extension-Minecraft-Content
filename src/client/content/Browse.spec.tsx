import type { ReactElement } from 'react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createExtensionTestHost, createTestServer } from '@pterodactyl/sdk/testing';
import { getFilters, getVersions, search, type FilterOptions, type Version } from '../api';
import Browse from './Browse';
import VersionsDialog from './VersionsDialog';

const filters: Record<string, FilterOptions> = {
    modrinth: {
        version: { default: '1.21.4', options: ['1.21.5', '1.21.4', '1.20.1'], ignored: null },
        loader: { default: 'paper', options: ['paper', 'purpur', 'folia', 'spigot'], ignored: null },
        category: { options: [{ value: 'economy', label: 'Economy' }], ignored: null },
    },
    spiget: {
        version: { default: '1.21.4', options: [], ignored: 'SpigotMC cannot filter by Minecraft version.' },
        loader: { default: 'paper', options: ['paper', 'purpur', 'folia', 'spigot'], ignored: 'SpigotMC cannot filter by server software.' },
        category: { options: [], ignored: 'SpigotMC cannot combine categories with a search.' },
    },
};

const project = { source: 'modrinth', id: 'Vebnzrzj', slug: 'luckperms', name: 'LuckPerms', author: 'Luck', description: 'A permissions plugin.', icon: null, downloads: 10, url: '' } as const;

vi.mock('../api', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../api')>()),
    getDetection: vi.fn().mockResolvedValue({
        platform: { software: 'paper', minecraft: '1.21.4', kind: 'plugins', loaders: ['paper', 'spigot', 'bukkit'], detected: true },
        types: [],
        software: [],
        modpack: null,
        cleanup: 'smart',
        resource_pack: null,
        job: null,
    }),
    getFilters: vi.fn(),
    search: vi.fn(),
    getVersions: vi.fn(),
}));

let host: ReturnType<typeof createExtensionTestHost> | undefined;

beforeEach(() => {
    localStorage.clear();
    vi.mocked(getFilters).mockImplementation((_server, _type, source) => Promise.resolve(filters[source]));
    vi.mocked(search).mockReset().mockResolvedValue({ total: 1, projects: [project] });
});

afterEach(() => {
    cleanup();
    host?.dispose();
    host = undefined;
});

function renderWithHost(element: ReactElement) {
    host = createExtensionTestHost({ extensionId: 'minecraft-content', prefix: 'mcc', server: createTestServer({ permissions: ['ext.minecraft-content.read'] }) });

    return render(element, { wrapper: host.Wrapper });
}

const renderBrowse = () => renderWithHost(<Browse type='plugin' sources={['modrinth', 'spiget']} installed={new Set()} actions={() => null} />);

async function pick(label: string, option: string) {
    const input = await screen.findByLabelText(label);
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(await screen.findByRole('option', { name: option }));
}

test('starts with the server version and platform and widens the search on request', async () => {
    renderBrowse();

    expect(await screen.findByText('LuckPerms')).toBeTruthy();
    expect(((await screen.findByLabelText('Version')) as HTMLInputElement).value).toBe('1.21.4');
    expect((screen.getByLabelText('Platform') as HTMLInputElement).value).toBe('Paper');
    expect(vi.mocked(search).mock.calls[0][6]).toEqual({});

    await pick('Version', 'Any version');
    await waitFor(() => expect(vi.mocked(search).mock.lastCall?.[6]).toEqual({ version: 'any' }));

    await pick('Category', 'Economy');
    await waitFor(() => expect(vi.mocked(search).mock.lastCall?.[6]).toEqual({ version: 'any', category: 'economy' }));

    fireEvent.click(screen.getByRole('button', { name: 'Reset filters' }));
    // The server-default search is still cached, so the reset shows it without a new request.
    await waitFor(() => expect((screen.getByLabelText('Version') as HTMLInputElement).value).toBe('1.21.4'));
    expect(screen.queryByRole('button', { name: 'Reset filters' })).toBeNull();
});

test('disables the filters a source cannot apply and says why', async () => {
    renderBrowse();
    await screen.findByText('LuckPerms');

    await pick('Source', 'SpigotMC');
    await waitFor(() => expect(vi.mocked(search).mock.lastCall?.[2]).toBe('spiget'));

    await waitFor(() => expect((screen.getByLabelText('Version') as HTMLInputElement).disabled).toBe(true));
    expect((screen.getByLabelText('Version') as HTMLInputElement).value).toBe('Any version');
    expect(screen.getByText('SpigotMC cannot filter by Minecraft version.')).toBeTruthy();
    expect((screen.getByLabelText('Category') as HTMLInputElement).disabled).toBe(true);
});

test('remembers the list view', async () => {
    renderBrowse();
    await screen.findByText('LuckPerms');

    fireEvent.click(screen.getByRole('button', { name: 'List view' }));
    expect(document.querySelector('[data-view]')?.getAttribute('data-view')).toBe('list');

    cleanup();
    host?.dispose();
    renderBrowse();
    await screen.findByText('LuckPerms');
    expect(document.querySelector('[data-view]')?.getAttribute('data-view')).toBe('list');
    expect(screen.getByRole('button', { name: 'List view' }).getAttribute('aria-pressed')).toBe('true');
});

const version = (id: string, type: Version['type'], game_versions: string[]): Version => ({
    source: 'modrinth',
    project: project.id,
    id,
    name: id,
    number: id,
    type,
    game_versions,
    loaders: ['paper'],
    published: null,
    file: { url: 'https://cdn.modrinth.com/x.jar', name: 'x.jar', size: 1024, sha1: null },
});

test('recommends and preselects the newest release that fits the server', async () => {
    vi.mocked(getVersions).mockResolvedValue({ versions: [version('6.0-beta', 'beta', ['1.21.4']), version('5.5', 'release', ['1.21']), version('5.4', 'release', ['1.21.4'])] });
    const onPick = vi.fn();
    renderWithHost(<VersionsDialog type='plugin' project={project} onClose={() => undefined} onPick={onPick} pending={false} />);

    const recommended = (await screen.findByText('Recommended')).closest('[role="radio"]')!;
    expect(recommended.textContent).toContain('5.5');
    expect(recommended.getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Install 5.5' }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ id: '5.5' }));
});
