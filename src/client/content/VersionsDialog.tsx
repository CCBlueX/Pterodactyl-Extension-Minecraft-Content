import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Badge, Button, Dialog, Empty, EmptyDescription, EmptyHeader, EmptyTitle, Spinner, httpErrorToHuman } from '@pterodactyl/sdk';
import { getVersions, keys, type ContentType, type Platform, type Project, type Version } from '../api';
import { useDetection, useServerIds } from '../hooks';
import { formatBytes } from '../lib/format';
import { versionRange } from '../lib/versions';

interface Props {
    type: ContentType;
    project: Project | null;
    onClose: () => void;
    onPick: (version: Version) => void;
    pending: boolean;
    action?: string;
}

const TONES = { release: 'success', beta: 'warning', alpha: 'danger' } as const;

/** A listed game version fits when it is the server's version or the release line it belongs to (1.21 for 1.21.4). */
const fitsMinecraft = (versions: string[], minecraft: string) => versions.length === 0 || versions.some((version) => minecraft === version || minecraft.startsWith(`${version}.`));

/** The newest release that runs on the server, or the newest prerelease when no release does. Modpacks bring their own software. */
export function recommendedVersion(versions: Version[], type: ContentType, platform: Platform | undefined): Version | undefined {
    const fitting = versions.filter((version) => {
        if (version.file === null && type !== 'modpack') {
            return false;
        }

        if (type === 'modpack' || !platform) {
            return true;
        }

        const minecraft = !platform.minecraft || fitsMinecraft(version.game_versions, platform.minecraft);
        // Hangar only lists files for the server's platform, under Hangar's own platform name.
        const loader = (type !== 'plugin' && type !== 'mod') || version.source === 'hangar' || version.loaders.length === 0 || version.loaders.some((name) => platform.loaders.includes(name));

        return minecraft && loader;
    });

    return fitting.find((version) => version.type === 'release') ?? fitting[0];
}

export default function VersionsDialog({ type, project, onClose, onPick, pending, action = 'Install' }: Props) {
    return (
        <Dialog open={project !== null} onClose={onClose} title={project ? `${project.name} versions` : ''} description='Only versions that fit this server are listed.'>
            {project && <VersionPicker key={`${project.source}:${project.id}`} type={type} project={project} onClose={onClose} onPick={onPick} pending={pending} action={action} />}
        </Dialog>
    );
}

function VersionPicker({ type, project, onClose, onPick, pending, action }: Omit<Props, 'project' | 'action'> & { project: Project; action: string }) {
    const { identifier } = useServerIds();
    const platform = useDetection().data?.platform;
    const [picked, setPicked] = useState<string | null>(null);
    const versions = useQuery({
        queryKey: keys.versions(identifier, type, project.source, project.id),
        queryFn: () => getVersions(identifier, type, project.source, project.id),
    });

    if (versions.isLoading) {
        return <Spinner centered />;
    }

    if (versions.isError) {
        return (
            <Alert type='danger'>
                {httpErrorToHuman(versions.error)}{' '}
                <Button.Text size='xsmall' onClick={() => versions.refetch()}>
                    Retry
                </Button.Text>
            </Alert>
        );
    }

    const list = (versions.data?.versions ?? []).slice(0, 50);

    if (list.length === 0) {
        return (
            <Empty size='compact'>
                <EmptyHeader>
                    <EmptyTitle>No fitting version</EmptyTitle>
                    <EmptyDescription>No version of this project runs on this server.</EmptyDescription>
                </EmptyHeader>
            </Empty>
        );
    }

    const recommended = recommendedVersion(list, type, platform);
    const selected = list.find((version) => version.id === (picked ?? recommended?.id));

    return (
        <>
            <div role='radiogroup' aria-label='Versions' className='mcc:grid mcc:max-h-96 mcc:gap-2 mcc:overflow-y-auto'>
                {list.map((version) => {
                    const allowed = version.file !== null || type === 'modpack';
                    const checked = version.id === selected?.id;

                    return (
                        <button
                            key={version.id}
                            type='button'
                            role='radio'
                            aria-checked={checked}
                            disabled={!allowed}
                            onClick={() => setPicked(version.id)}
                            className={`mcc:flex mcc:w-full mcc:items-center mcc:gap-3 mcc:rounded-sm mcc:border mcc:p-2 mcc:text-left mcc:disabled:opacity-60 ${
                                checked ? 'mcc:border-primary mcc:bg-primary/10' : 'mcc:border-border mcc:hover:bg-sunken'
                            }`}
                        >
                            <span className='mcc:min-w-0 mcc:flex-1'>
                                <span className='mcc:flex mcc:flex-wrap mcc:items-center mcc:gap-2 mcc:text-sm mcc:text-foreground'>
                                    <span className='mcc:min-w-0 mcc:truncate'>{version.name}</span>
                                    <Badge tone={TONES[version.type] ?? 'neutral'}>{version.type}</Badge>
                                    {version.id === recommended?.id && <Badge tone='info'>Recommended</Badge>}
                                    {!allowed && <Badge tone='neutral'>Download not allowed</Badge>}
                                </span>
                                <span className='mcc:block mcc:truncate mcc:text-xs mcc:text-muted-foreground'>
                                    {[
                                        version.loaders.join(', '),
                                        versionRange(version.game_versions),
                                        type !== 'modpack' && platform?.minecraft && version.game_versions.length > 0 && fitsMinecraft(version.game_versions, platform.minecraft)
                                            ? `fits ${platform.minecraft}`
                                            : null,
                                        version.file ? formatBytes(version.file.size) : null,
                                    ]
                                        .filter(Boolean)
                                        .join(' · ')}
                                </span>
                            </span>
                        </button>
                    );
                })}
            </div>
            <Dialog.Footer>
                <Button.Text className='mcc:w-full mcc:sm:w-auto' onClick={onClose}>
                    Cancel
                </Button.Text>
                <Button className='mcc:w-full mcc:sm:w-auto' disabled={pending || !selected} isLoading={pending} onClick={() => selected && onPick(selected)}>
                    {selected ? `${action} ${selected.name}` : action}
                </Button>
            </Dialog.Footer>
        </>
    );
}
