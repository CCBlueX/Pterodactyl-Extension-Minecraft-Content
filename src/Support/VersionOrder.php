<?php

declare(strict_types=1);

namespace MinecraftContent\Support;

/**
 * Compares Minecraft versions by their place in the release history, which also orders snapshots.
 */
final class VersionOrder
{
    /**
     * True when $version came out before $than. Versions missing from the history compare as false.
     *
     * @param  list<string>  $newestFirst  Every Minecraft version, newest first.
     */
    public static function isOlder(array $newestFirst, string $version, string $than): bool
    {
        $positions = array_flip($newestFirst);

        return isset($positions[$version], $positions[$than]) && $positions[$version] > $positions[$than];
    }
}
