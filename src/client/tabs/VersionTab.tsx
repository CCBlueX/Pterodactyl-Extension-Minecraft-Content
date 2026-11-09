import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Badge, Button, Checkbox, Dialog, Label, Select, Switch, TitledGreyBox, httpErrorToHuman, toast, useServerPermission } from '@pterodactyl/sdk';
import {
    changeSoftware,
    getCurrentSoftware,
    getSoftwareBuilds,
    getSoftwareTypes,
    getSoftwareVersions,
    keys,
    type BackupSlots,
    type Cleanup,
    type Platform,
    type SoftwareBuild,
} from '../api';
import { useServerIds } from '../hooks';
import { SOFTWARE_NAMES, formatBytes, formatDate, softwareIcon } from '../lib/format';
import { isOlder } from '../lib/versions';

const GROUPS = [
    { id: 'plugins', label: 'Plugins' },
    { id: 'modded', label: 'Mods' },
    { id: 'proxy', label: 'Proxies' },
    { id: '', label: 'Other' },
];

const CLEANUPS: { value: Cleanup; label: string }[] = [
    { value: 'smart', label: "Remove the old software's libraries and caches" },
    { value: 'keep', label: 'Replace only the server jar' },
    { value: 'full', label: 'Remove everything except worlds and server.properties' },
];

export default function VersionTab({ platform, busy }: { platform: Platform; busy: boolean }) {
    const { identifier } = useServerIds();
    const queryClient = useQueryClient();
    const canChange = useServerPermission('ext.minecraft-content.version');
    const [type, setType] = useState(platform.software.toUpperCase());
    const [version, setVersion] = useState<string | null>(null);
    const [build, setBuild] = useState<number | null>(null);
    const [snapshots, setSnapshots] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [cleanup, setCleanup] = useState<Cleanup>('smart');
    const [backup, setBackup] = useState<boolean | null>(null);
    const [acceptDowngrade, setAcceptDowngrade] = useState(false);

    const types = useQuery({ queryKey: keys.software(identifier), queryFn: () => getSoftwareTypes(identifier), staleTime: Infinity });
    const current = useQuery({ queryKey: keys.software(identifier, 'current'), queryFn: () => getCurrentSoftware(identifier) });
    const installed = current.data?.installed ?? null;
    const update = current.data?.update ?? null;
    const world = current.data?.world ?? null;
    const slots = current.data?.backups ?? null;
    const versions = useQuery({ queryKey: keys.software(identifier, type), queryFn: () => getSoftwareVersions(identifier, type) });
    const history = useQuery({ queryKey: keys.software(identifier, 'VANILLA'), queryFn: () => getSoftwareVersions(identifier, 'VANILLA'), enabled: !!world?.version });
    const builds = useQuery({
        queryKey: keys.software(identifier, type, version ?? ''),
        queryFn: () => getSoftwareBuilds(identifier, type, version!),
        enabled: version !== null,
    });

    const visible = useMemo(
        () => (versions.data?.versions ?? []).filter((item) => snapshots || item.type !== 'snapshot' || item.id === platform.minecraft),
        [versions.data, snapshots, platform.minecraft]
    );
    const newestRelease = visible.find((item) => item.type === 'release')?.id;
    const recommended = builds.data?.builds.find((item) => !item.experimental)?.id;

    useEffect(() => {
        if (visible.some((item) => item.id === version)) {
            return;
        }

        const current = visible.find((item) => item.id === platform.minecraft) ?? visible.find((item) => item.type === 'release') ?? visible[0];
        setVersion(current?.id ?? null);
    }, [visible]);

    useEffect(() => setBuild(recommended ?? builds.data?.builds[0]?.id ?? null), [builds.data]);

    const groups = useMemo(
        () =>
            GROUPS.map((group) => ({
                label: group.label,
                options: (types.data?.types ?? [])
                    .filter((item) => !item.deprecated && (group.id === '' ? !GROUPS.some((other) => other.id && item.categories.includes(other.id)) : item.categories[0] === group.id))
                    .map((item) => ({ value: item.id, label: item.experimental ? `${item.name} (experimental)` : item.name })),
            })).filter((group) => group.options.length > 0),
        [types.data]
    );

    const chosen = versions.data?.versions.find((item) => item.id === version);
    const chosenBuild = builds.data?.builds.find((item) => item.id === build);
    const downgrade = !!world?.version && !!version && isOlder((history.data?.versions ?? []).map((item) => item.id), version, world.version);
    const backingUp = (slots?.free ?? 0) > 0 && (backup ?? true);

    const change = useMutation({
        mutationFn: (input?: { type: string; version: string; build: number }) =>
            changeSoftware(
                identifier,
                input
                    ? { ...input, cleanup: 'keep', backup: (slots?.free ?? 0) > 0 }
                    : { type, version: version!, build, cleanup, backup: backingUp, downgrade: downgrade && acceptDowngrade }
            ),
        onSuccess: () => {
            setConfirming(false);
            queryClient.invalidateQueries({ queryKey: keys.detect(identifier) });
            queryClient.invalidateQueries({ queryKey: keys.software(identifier, 'current') });
        },
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    const open = () => {
        setAcceptDowngrade(false);
        setConfirming(true);
    };

    return (
        <div className='mcc:grid mcc:grid-cols-1 mcc:gap-4 mcc:lg:grid-cols-[minmax(0,1fr)_20rem]'>
            <TitledGreyBox title='Change server software' className='mcc:min-w-0'>
                <Switch label='Show snapshots' description='Test versions of upcoming Minecraft releases.' checked={snapshots} onChange={setSnapshots} />
                <div className='mcc:mt-4 mcc:grid mcc:grid-cols-1 mcc:gap-4 mcc:md:grid-cols-3'>
                    <div>
                        <Label htmlFor='mcc-software'>Software</Label>
                        <Select id='mcc-software' value={type} groups={groups} onChange={(value) => setType(String(value))} />
                    </div>
                    <div>
                        <Label htmlFor='mcc-version'>Version</Label>
                        <Select
                            id='mcc-version'
                            value={version}
                            disabled={!versions.data}
                            onChange={(value) => setVersion(String(value))}
                            options={visible.map((item) => ({
                                value: item.id,
                                textLabel: item.id,
                                label: (
                                    <span className='mcc:flex mcc:flex-wrap mcc:items-center mcc:gap-1.5'>
                                        {item.id}
                                        {item.id === newestRelease && <Badge tone='success'>Latest</Badge>}
                                        {item.type === 'snapshot' && <Badge tone='warning'>Snapshot</Badge>}
                                        {item.java && <Badge tone='neutral'>Java {item.java}</Badge>}
                                    </span>
                                ),
                            }))}
                        />
                    </div>
                    <div>
                        <Label htmlFor='mcc-build'>Build</Label>
                        <Select
                            id='mcc-build'
                            value={build}
                            disabled={!builds.data}
                            onChange={(value) => setBuild(Number(value))}
                            options={(builds.data?.builds ?? []).map((item, index) => ({
                                value: item.id,
                                textLabel: item.name,
                                label: (
                                    <span className='mcc:flex mcc:flex-wrap mcc:items-center mcc:gap-1.5'>
                                        {item.name}
                                        {item.created && <span className='mcc:text-xs mcc:text-muted-foreground'>{formatDate(item.created)}</span>}
                                        <BuildBadges build={item} latest={index === 0} recommended={item.id === recommended} />
                                        {installed?.build === item.id && installed.version === version && installed.type === type && <Badge tone='info'>Installed</Badge>}
                                    </span>
                                ),
                            }))}
                        />
                    </div>
                </div>
                {chosenBuild && chosenBuild.changes.length > 0 && (
                    <div className='mcc:mt-3 mcc:rounded-sm mcc:bg-sunken mcc:px-3 mcc:py-2'>
                        <p className='mcc:text-xs mcc:uppercase mcc:text-muted-foreground'>Changes in {chosenBuild.name}</p>
                        <ul className='mcc:mt-1 mcc:list-disc mcc:pl-5 mcc:text-xs mcc:text-foreground'>
                            {chosenBuild.changes.slice(0, 5).map((line) => (
                                <li key={line} className='mcc:truncate'>
                                    {line}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
                <div className='mcc:mt-4 mcc:flex mcc:flex-wrap mcc:items-center mcc:gap-2 mcc:text-xs mcc:text-muted-foreground'>
                    {chosen?.java && <Badge tone='neutral'>Java {chosen.java}</Badge>}
                    <span>
                        {chosen?.java && 'The matching Docker image is picked when the egg has one. '}
                        {chosenBuild?.size ? `Download size ${formatBytes(chosenBuild.size)}.` : ''}
                    </span>
                </div>
                {canChange && (
                    <div className='mcc:mt-4 mcc:flex mcc:justify-end'>
                        <Button disabled={!version || !build || busy} onClick={open}>
                            Install
                        </Button>
                    </div>
                )}
            </TitledGreyBox>
            <TitledGreyBox title='Current' className='mcc:min-w-0'>
                <div className='mcc:flex mcc:items-center mcc:gap-3'>
                    <img alt='' src={softwareIcon(platform.software)} className='mcc:h-10 mcc:w-10 mcc:shrink-0' />
                    <div className='mcc:min-w-0'>
                        <p className='mcc:text-foreground'>
                            {SOFTWARE_NAMES[platform.software] ?? platform.software} {platform.minecraft}
                        </p>
                        <p className='mcc:text-xs mcc:text-muted-foreground'>
                            {installed ? `Build ${installed.name}, installed ${formatDate(installed.installed_at)}` : platform.detected ? 'Detected from the server files.' : 'Set by hand.'}
                        </p>
                        {world?.version && <p className='mcc:text-xs mcc:text-muted-foreground'>World &quot;{world.name}&quot; last saved with {world.version}.</p>}
                    </div>
                </div>
                {update && installed && (
                    <div className='mcc:mt-4 mcc:rounded-sm mcc:border mcc:border-warning/25 mcc:bg-warning/10 mcc:p-3'>
                        <p className='mcc:text-sm mcc:text-warning'>Build {update.name} is out.</p>
                        {update.changes[0] && <p className='mcc:mt-1 mcc:truncate mcc:text-xs mcc:text-muted-foreground'>{update.changes[0]}</p>}
                        {canChange && (
                            <>
                                <Button size='small' className='mcc:mt-2' disabled={busy} isLoading={change.isPending} onClick={() => change.mutate({ type: installed.type, version: installed.version, build: update.id })}>
                                    Update now
                                </Button>
                                <p className='mcc:mt-1 mcc:text-xs mcc:text-muted-foreground'>{(slots?.free ?? 0) > 0 ? 'Takes a backup first.' : 'No backup slot free, updates without a backup.'}</p>
                            </>
                        )}
                    </div>
                )}
            </TitledGreyBox>
            <Dialog
                open={confirming}
                onClose={() => setConfirming(false)}
                title={`Install ${types.data?.types.find((item) => item.id === type)?.name ?? type} ${version ?? ''}?`}
                preventExternalClose={change.isPending}
            >
                <div className='mcc:grid mcc:gap-4'>
                    <p className='mcc:text-sm mcc:text-muted-foreground'>
                        The server stops while the new server software is downloaded and starts again afterwards if it was running. Plugins or mods for other software stop loading.
                    </p>
                    {downgrade && world && (
                        <Alert type='danger' title='Older than the world'>
                            <p>
                                The world &quot;{world.name}&quot; was last saved with Minecraft {world.version}. Opening it with {version} can corrupt chunks or lose items.
                            </p>
                            <label className='mcc:mt-2 mcc:flex mcc:items-center mcc:gap-2'>
                                <Checkbox checked={acceptDowngrade} onChange={setAcceptDowngrade} />I understand the world may break
                            </label>
                        </Alert>
                    )}
                    <div>
                        <Label htmlFor='mcc-version-cleanup'>Before installing</Label>
                        <Select id='mcc-version-cleanup' value={cleanup} onChange={(value) => setCleanup(value as Cleanup)} options={CLEANUPS} />
                    </div>
                    <div>
                        <label className='mcc:flex mcc:items-center mcc:gap-2 mcc:text-sm mcc:text-foreground'>
                            <Checkbox checked={backingUp} disabled={!slots || slots.free === 0} onChange={setBackup} />
                            Back up first
                        </label>
                        <p className='mcc:mt-1 mcc:text-xs mcc:text-muted-foreground'>{backupHint(slots)}</p>
                    </div>
                </div>
                <Dialog.Footer>
                    <Button.Text className='mcc:w-full mcc:sm:w-auto' disabled={change.isPending} onClick={() => setConfirming(false)}>
                        Cancel
                    </Button.Text>
                    <Button
                        className='mcc:w-full mcc:sm:w-auto'
                        disabled={(downgrade && !acceptDowngrade) || (!!world?.version && history.isPending)}
                        isLoading={change.isPending}
                        onClick={() => change.mutate(undefined)}
                    >
                        Install
                    </Button>
                </Dialog.Footer>
            </Dialog>
        </div>
    );
}

function BuildBadges({ build, latest, recommended }: { build: SoftwareBuild; latest: boolean; recommended: boolean }) {
    return (
        <>
            {latest && <Badge tone='info'>Latest</Badge>}
            {recommended && <Badge tone='success'>Recommended</Badge>}
            {build.experimental ? <Badge tone='warning'>Experimental</Badge> : !recommended && <Badge tone='neutral'>Stable</Badge>}
        </>
    );
}

function backupHint(slots: BackupSlots | null): string {
    if (!slots) {
        return 'Checking the backup slots...';
    }

    if (slots.limit === 0) {
        return 'This server has no backup slots, so the install runs without a backup.';
    }

    if (slots.free === 0) {
        return `All ${slots.limit} backup slots are in use, so the install runs without a backup. Delete an old backup to make room.`;
    }

    return `The backup finishes before any file changes. ${slots.free} of ${slots.limit} backup slots free.`;
}
