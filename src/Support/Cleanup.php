<?php

declare(strict_types=1);

namespace MinecraftContent\Support;

use InvalidArgumentException;

/**
 * Which files go before new server software is installed.
 */
final class Cleanup
{
    public const array MODES = ['keep', 'smart', 'full'];

    /** Libraries and caches of the old software that a new version would trip over. */
    private const array SOFTWARE = ['libraries', 'versions', 'cache', 'bundler', '.fabric', '.quilt'];

    /** Files a full clean-up keeps besides the worlds. */
    private const array KEEP = ['server.properties', 'eula.txt'];

    /**
     * keep: only the server jar. smart: the jar plus the old software's libraries and caches.
     * full: everything in the root except the worlds (with their split dimension folders) and server.properties.
     *
     * @param  list<string>  $root  Names in the server's root, needed for "full".
     * @param  list<string>  $worlds  World folders in the root.
     * @return list<string>
     */
    public static function paths(string $mode, array $root = [], array $worlds = []): array
    {
        return match ($mode) {
            'keep' => ['server.jar'],
            'smart' => ['server.jar', ...self::SOFTWARE],
            'full' => array_values(array_filter($root, static fn (string $name): bool => ! in_array($name, self::KEEP, true) && ! self::isWorld($name, $worlds))),
            default => throw new InvalidArgumentException("Unknown clean-up mode \"{$mode}\"."),
        };
    }

    /** @param list<string> $worlds */
    private static function isWorld(string $name, array $worlds): bool
    {
        return in_array($name, $worlds, true)
            || (preg_match('/^(.+)_(nether|the_end)$/', $name, $match) === 1 && in_array($match[1], $worlds, true));
    }
}
