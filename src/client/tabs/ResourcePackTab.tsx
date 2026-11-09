import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Dialog, httpErrorToHuman, toast, useServerPermission } from '@pterodactyl/sdk';
import { removeResourcePack, type Project, type SourceName, type Tracked } from '../api';
import { useServerIds } from '../hooks';
import Browse, { InstallButtons } from '../content/Browse';
import VersionsDialog from '../content/VersionsDialog';
import CurrentCard from '../components/CurrentCard';
import { useInstall } from './useInstall';

export default function ResourcePackTab({ current, sources }: { current: Tracked | null; sources: SourceName[] }) {
    const { identifier } = useServerIds();
    const queryClient = useQueryClient();
    const canInstall = useServerPermission('ext.minecraft-content.install');
    const [versionsOf, setVersionsOf] = useState<Project | null>(null);
    const [removing, setRemoving] = useState(false);
    const installation = useInstall('resourcepack');
    const removal = useMutation({
        mutationFn: () => removeResourcePack(identifier),
        onSuccess: () => (setRemoving(false), queryClient.invalidateQueries({ queryKey: ['minecraft-content', identifier] })),
        onError: (error) => toast.error(httpErrorToHuman(error)),
    });

    return (
        <div className='mcc:grid mcc:grid-cols-1 mcc:gap-4'>
            <CurrentCard
                title='Server resource pack'
                empty='Players join without a server resource pack.'
                item={current}
                hint='Players are asked to download it when they join.'
                action={
                    current &&
                    canInstall && (
                        <Button.Danger size='small' onClick={() => setRemoving(true)}>
                            Remove
                        </Button.Danger>
                    )
                }
            />
            <Browse
                type='resourcepack'
                sources={sources}
                installed={new Set(current ? [current.project] : [])}
                actions={(project) => (
                    <InstallButtons
                        disabled={!canInstall}
                        pending={installation.isPending && installation.variables?.project === project.id}
                        onInstall={() => installation.mutate({ source: project.source, project: project.id })}
                        onVersions={() => setVersionsOf(project)}
                    />
                )}
            />
            <VersionsDialog
                type='resourcepack'
                project={versionsOf}
                onClose={() => setVersionsOf(null)}
                pending={installation.isPending}
                action='Use'
                onPick={(version) => installation.mutateAsync({ source: version.source, project: versionsOf!.id, version: version.id }).then(() => setVersionsOf(null)).catch(() => undefined)}
            />
            <Dialog.Confirm
                open={removing}
                onClose={() => setRemoving(false)}
                title={`Remove ${current?.name ?? 'the resource pack'}?`}
                confirm='Remove'
                pending={removal.isPending}
                onConfirmed={() => removal.mutate()}
            >
                The pack is cleared from server.properties, so players join without it after the next restart.
            </Dialog.Confirm>
        </div>
    );
}
