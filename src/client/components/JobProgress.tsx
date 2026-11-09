import type { ExtensionJobProgress } from '@pterodactyl/sdk';
import { Button, ProgressBar } from '@pterodactyl/sdk';

export default function JobProgress({ progress, onCancel }: { progress: ExtensionJobProgress; onCancel?: () => void }) {
    const failed = progress.status === 'failed';

    return (
        <div className='mcc:rounded-sm mcc:bg-card mcc:p-3 mcc:shadow-md' role='status'>
            <div className='mcc:flex mcc:items-center mcc:justify-between mcc:gap-4 mcc:text-sm'>
                <span className={`mcc:min-w-0 mcc:break-words ${failed ? 'mcc:text-destructive' : 'mcc:text-foreground'}`}>{progress.message}</span>
                <span className='mcc:flex mcc:shrink-0 mcc:items-center mcc:gap-3'>
                    <span className='mcc:font-mono mcc:text-xs mcc:text-muted-foreground'>{progress.percent}%</span>
                    {onCancel && progress.status === 'running' && (
                        <Button.Text size='xsmall' onClick={onCancel}>
                            Cancel
                        </Button.Text>
                    )}
                </span>
            </div>
            <ProgressBar className='mcc:mt-2' value={progress.percent} tone={failed ? 'danger' : 'accent'} label={progress.message} />
        </div>
    );
}
