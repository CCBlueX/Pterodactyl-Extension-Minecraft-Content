import type { ReactNode } from 'react';
import { Label, Select, Tooltip } from '@pterodactyl/sdk';
import type { ContentType, FilterOptions, SearchFilters } from '../api';
import { SOFTWARE_NAMES } from '../lib/format';

interface Props {
    type: ContentType;
    options: FilterOptions;
    /** The server's Minecraft version, marked in the version list. */
    minecraft: string | null;
    value: SearchFilters;
    onChange: (value: SearchFilters) => void;
}

/** Version, loader and category above the results, preset to what the server runs. */
export default function BrowseFilters({ type, options, minecraft, value, onChange }: Props) {
    const set = (key: keyof SearchFilters, next: string | undefined) => onChange({ ...value, [key]: next });
    const loaderLabel = type === 'plugin' ? 'Platform' : 'Loader';

    return (
        <>
            <Filter id='mcc-filter-version' label='Version' ignored={options.version.ignored}>
                <Select
                    id='mcc-filter-version'
                    aria-describedby={options.version.ignored ? 'mcc-filter-version-ignored' : undefined}
                    disabled={options.version.ignored !== null}
                    value={options.version.ignored !== null ? 'any' : (value.version ?? options.version.default ?? 'any')}
                    onChange={(next) => set('version', String(next))}
                    options={[
                        { value: 'any', label: 'Any version' },
                        ...options.version.options.map((version) => ({ value: version, label: version === minecraft ? `${version} (this server)` : version, textLabel: version })),
                    ]}
                />
            </Filter>
            {options.loader && (
                <Filter id='mcc-filter-loader' label={loaderLabel} ignored={options.loader.ignored}>
                    <Select
                        id='mcc-filter-loader'
                        aria-describedby={options.loader.ignored ? 'mcc-filter-loader-ignored' : undefined}
                        disabled={options.loader.ignored !== null}
                        value={options.loader.ignored !== null ? 'any' : (value.loader ?? options.loader.default ?? 'any')}
                        onChange={(next) => set('loader', String(next))}
                        options={[
                            { value: 'any', label: `Any ${loaderLabel.toLowerCase()}` },
                            ...options.loader.options.map((software) => ({ value: software, label: SOFTWARE_NAMES[software] ?? software })),
                        ]}
                    />
                </Filter>
            )}
            <Filter id='mcc-filter-category' label='Category' ignored={options.category.ignored}>
                <Select
                    id='mcc-filter-category'
                    aria-describedby={options.category.ignored ? 'mcc-filter-category-ignored' : undefined}
                    disabled={options.category.ignored !== null || options.category.options.length === 0}
                    value={options.category.ignored !== null ? '' : (value.category ?? '')}
                    onChange={(next) => set('category', next === '' ? undefined : String(next))}
                    options={[{ value: '', label: 'All categories' }, ...options.category.options]}
                />
            </Filter>
        </>
    );
}

/** A labelled filter; one the source cannot apply explains why on hover and to screen readers. */
function Filter({ id, label, ignored, children }: { id: string; label: string; ignored: string | null; children: ReactNode }) {
    const field = (
        <div className='mcc:min-w-0 mcc:sm:w-44'>
            <Label htmlFor={id}>{label}</Label>
            {children}
            {ignored && (
                <span id={`${id}-ignored`} className='mcc:sr-only'>
                    {ignored}
                </span>
            )}
        </div>
    );

    return ignored ? <Tooltip content={ignored}>{field}</Tooltip> : field;
}
