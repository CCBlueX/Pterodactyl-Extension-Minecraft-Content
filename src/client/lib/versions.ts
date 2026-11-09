/** Orders Minecraft versions by their numbers, so 1.21.10 comes after 1.21.9. */
export function compareVersions(a: string, b: string): number {
    const left = a.split(/[^0-9]+/).filter(Boolean).map(Number);
    const right = b.split(/[^0-9]+/).filter(Boolean).map(Number);

    for (let index = 0; index < Math.max(left.length, right.length); index++) {
        const difference = (left[index] ?? -1) - (right[index] ?? -1);

        if (difference !== 0) {
            return difference;
        }
    }

    return a.localeCompare(b);
}

/** "1.20.5 to 1.21.11", or the single version, from versions in any order. */
export function versionRange(versions: string[]): string {
    const sorted = [...new Set(versions)].sort(compareVersions);

    return sorted.length > 1 ? `${sorted[0]} to ${sorted[sorted.length - 1]}` : (sorted[0] ?? '');
}

/** True when `version` came out before `than` in a newest-first history. Versions missing from it compare as false. */
export function isOlder(newestFirst: string[], version: string, than: string): boolean {
    const position = newestFirst.indexOf(version);
    const other = newestFirst.indexOf(than);

    return position !== -1 && other !== -1 && position > other;
}
