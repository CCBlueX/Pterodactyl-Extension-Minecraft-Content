import { useEffect, useState, type ReactNode } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
    Badge,
    Button,
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyMedia,
    EmptyTitle,
    Input,
    Label,
    NamedIcon,
    Pagination,
    Select,
    ServerError,
    Spinner,
    httpErrorToHuman,
    useCurrentUser,
} from '@pterodactyl/sdk';
import { getFilters, keys, search, type ContentType, type Project, type SearchFilters, type SourceName, type Sort } from '../api';
import { useDetection, useServerIds } from '../hooks';
import { FOLLOWERS, SOURCE_NAMES, formatDownloads } from '../lib/format';
import ProjectIcon from '../components/ProjectIcon';
import BrowseFilters from './BrowseFilters';
import ProjectDialog from './ProjectDialog';

interface Props {
    type: ContentType;
    sources: SourceName[];
    installed: Set<string>;
    actions: (project: Project) => ReactNode;
}

type View = 'grid' | 'list';

const SORTS: { value: Sort; label: string }[] = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'downloads', label: 'Downloads' },
    { value: 'updated', label: 'Recently updated' },
    { value: 'newest', label: 'Newest' },
    { value: 'follows', label: 'Most followed' },
];

export default function Browse({ type, sources, installed, actions }: Props) {
    const { identifier } = useServerIds();
    const minecraft = useDetection().data?.platform.minecraft ?? null;
    const [source, setSource] = useState<SourceName>(sources[0]);
    const [input, setInput] = useState('');
    const [query, setQuery] = useState('');
    const [sort, setSort] = useState<Sort>('relevance');
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [view, setView] = useStoredView();
    const [open, setOpen] = useState<Project | null>(null);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setQuery(input.trim());
            setPage(1);
        }, 350);

        return () => clearTimeout(timeout);
    }, [input]);

    const options = useQuery({ queryKey: keys.filters(identifier, type, source), queryFn: () => getFilters(identifier, type, source), staleTime: 300_000 });
    const results = useQuery({
        queryKey: keys.search(identifier, type, source, query, sort, page, filters),
        queryFn: () => search(identifier, type, source, query, sort, page, filters),
        placeholderData: keepPreviousData,
    });

    const total = results.data?.total ?? 0;
    const changed = Object.values(filters).some((value) => value !== undefined);
    const changeFilters = (next: SearchFilters) => {
        setFilters(next);
        setPage(1);
    };

    return (
        <div className='mcc:grid mcc:grid-cols-1 mcc:gap-4'>
            <div className='mcc:grid mcc:grid-cols-2 mcc:gap-2 mcc:sm:grid-cols-[minmax(0,1fr)_10rem_12rem]'>
                <div className='mcc:col-span-2 mcc:sm:col-span-1'>
                    <Input placeholder='Search...' aria-label='Search' value={input} onChange={(event) => setInput(event.currentTarget.value)} />
                </div>
                <div>
                    <Label htmlFor='mcc-browse-source' className='mcc:sr-only'>
                        Source
                    </Label>
                    <Select
                        id='mcc-browse-source'
                        value={source}
                        disabled={sources.length < 2}
                        onChange={(value) => {
                            setSource(value as SourceName);
                            // Categories belong to one source; version and loader carry over.
                            changeFilters({ ...filters, category: undefined });
                        }}
                        options={sources.map((name) => ({ value: name, label: SOURCE_NAMES[name] }))}
                    />
                </div>
                <div>
                    <Label htmlFor='mcc-browse-sort' className='mcc:sr-only'>
                        Sort
                    </Label>
                    <Select id='mcc-browse-sort' value={sort} onChange={(value) => setSort(value as Sort)} options={SORTS} />
                </div>
            </div>

            <div className='mcc:grid mcc:grid-cols-2 mcc:items-end mcc:gap-2 mcc:sm:flex mcc:sm:flex-wrap'>
                {options.data ? (
                    <BrowseFilters type={type} options={options.data} minecraft={minecraft} value={filters} onChange={changeFilters} />
                ) : options.isError ? (
                    <p className='mcc:col-span-2 mcc:text-sm mcc:text-muted-foreground'>
                        Filters could not be loaded.{' '}
                        <Button.Text size='xsmall' onClick={() => options.refetch()}>
                            Retry
                        </Button.Text>
                    </p>
                ) : null}
                <div className='mcc:col-span-2 mcc:flex mcc:items-center mcc:justify-end mcc:gap-1 mcc:sm:ml-auto'>
                    {changed && (
                        <Button.Text size='small' onClick={() => changeFilters({})}>
                            Reset filters
                        </Button.Text>
                    )}
                    <ViewButton icon='layout-grid' label='Grid view' active={view === 'grid'} onClick={() => setView('grid')} />
                    <ViewButton icon='list' label='List view' active={view === 'list'} onClick={() => setView('list')} />
                </div>
            </div>

            {results.isError ? (
                <ServerError title='Could not search' message={httpErrorToHuman(results.error)} onRetry={() => results.refetch()} />
            ) : !results.data ? (
                <Spinner centered />
            ) : results.data.projects.length === 0 ? (
                <Empty>
                    <EmptyHeader>
                        <EmptyMedia variant='icon'>
                            <NamedIcon name='search-x' />
                        </EmptyMedia>
                        <EmptyTitle>Nothing found</EmptyTitle>
                        <EmptyDescription>{changed ? 'Try another search or widen the filters.' : 'Try another search or source.'}</EmptyDescription>
                    </EmptyHeader>
                    {changed && (
                        <EmptyContent>
                            <Button.Text size='small' onClick={() => changeFilters({})}>
                                Reset filters
                            </Button.Text>
                        </EmptyContent>
                    )}
                </Empty>
            ) : (
                <Pagination
                    onPageSelect={setPage}
                    data={{
                        data: results.data.projects,
                        meta: { pagination: { total, count: results.data.projects.length, per_page: 20, current_page: page, total_pages: Math.max(1, Math.ceil(total / 20)) } },
                    }}
                >
                    {({ items }) => (
                        <div
                            data-view={view}
                            className={`mcc:grid mcc:grid-cols-1 ${view === 'grid' ? 'mcc:gap-3 mcc:lg:grid-cols-2' : 'mcc:gap-2'} ${results.isPlaceholderData ? 'mcc:opacity-60' : ''}`}
                        >
                            {items.map((project) => (
                                <ProjectCard
                                    key={`${project.source}:${project.id}`}
                                    project={project}
                                    compact={view === 'list'}
                                    installed={installed.has(project.id)}
                                    onOpen={() => setOpen(project)}
                                >
                                    {actions(project)}
                                </ProjectCard>
                            ))}
                        </div>
                    )}
                </Pagination>
            )}
            <ProjectDialog
                project={open}
                onClose={() => setOpen(null)}
                actions={open && <span className='mcc:contents' onClickCapture={() => setTimeout(() => setOpen(null))}>{actions(open)}</span>}
            />
        </div>
    );
}

/** Grid or list, remembered per user in this browser. */
function useStoredView(): [View, (view: View) => void] {
    const key = `mcc:browse-view:${useCurrentUser()?.uuid ?? 'guest'}`;
    const [view, setView] = useState<View>(() => (readStorage(key) === 'list' ? 'list' : 'grid'));

    return [
        view,
        (next) => {
            setView(next);
            try {
                localStorage.setItem(key, next);
            } catch {
                // Private windows can refuse storage; the choice then lasts until reload.
            }
        },
    ];
}

function readStorage(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function ViewButton({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
    return (
        <Button.Text size='small' aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={active ? 'mcc:text-foreground' : 'mcc:text-muted-foreground'}>
            <NamedIcon name={icon} size={16} />
        </Button.Text>
    );
}

/** On phones the buttons move below the text and share its full width. List rows keep the description to one line. */
function ProjectCard({ project, compact, installed, onOpen, children }: { project: Project; compact: boolean; installed: boolean; onOpen: () => void; children: ReactNode }) {
    return (
        <div className={`mcc:flex mcc:min-w-0 mcc:flex-col mcc:rounded-sm mcc:bg-card mcc:shadow-md mcc:sm:flex-row ${compact ? 'mcc:gap-2 mcc:px-3 mcc:py-2' : 'mcc:gap-3 mcc:p-3'}`}>
            <div className={`mcc:flex mcc:min-w-0 mcc:flex-1 mcc:gap-3 ${compact ? 'mcc:items-center' : ''}`}>
                <ProjectIcon src={project.icon} name={project.name} size={compact ? 32 : 48} />
                <div className='mcc:min-w-0 mcc:flex-1'>
                    <div className='mcc:flex mcc:min-w-0 mcc:items-center mcc:gap-2'>
                        <button
                            type='button'
                            onClick={onOpen}
                            className='mcc:min-w-0 mcc:truncate mcc:rounded-sm mcc:text-left mcc:text-base mcc:font-semibold mcc:text-foreground mcc:outline-none mcc:hover:underline mcc:focus-visible:ring-2 mcc:focus-visible:ring-ring'
                        >
                            {project.name}
                        </button>
                        {installed && (
                            <span className='mcc:shrink-0'>
                                <Badge tone='success'>Installed</Badge>
                            </span>
                        )}
                    </div>
                    <p className='mcc:truncate mcc:text-xs mcc:text-muted-foreground'>
                        {project.author && `by ${project.author} · `}
                        {formatDownloads(project.downloads)} downloads
                        {project.followers != null && FOLLOWERS[project.source] && ` · ${formatDownloads(project.followers)} ${FOLLOWERS[project.source]}`}
                    </p>
                    <p className={`mcc:mt-1 mcc:text-sm mcc:break-words mcc:text-muted-foreground ${compact ? 'mcc:line-clamp-1' : 'mcc:line-clamp-2'}`}>{project.description}</p>
                </div>
            </div>
            <div className={`mcc:flex mcc:gap-2 mcc:*:flex-1 mcc:sm:shrink-0 mcc:sm:justify-center mcc:sm:*:flex-none ${compact ? 'mcc:sm:flex-row mcc:sm:items-center' : 'mcc:sm:flex-col'}`}>{children}</div>
        </div>
    );
}

export function InstallButtons({ onInstall, onVersions, pending, disabled }: { onInstall: () => void; onVersions: () => void; pending: boolean; disabled: boolean }) {
    return (
        <>
            <Button size='small' isLoading={pending} disabled={disabled} onClick={onInstall}>
                Install
            </Button>
            <Button.Text size='small' disabled={disabled} onClick={onVersions}>
                Versions
            </Button.Text>
        </>
    );
}
