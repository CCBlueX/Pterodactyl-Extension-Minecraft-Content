<?php

declare(strict_types=1);

namespace MinecraftContent\Sources;

use MinecraftContent\Content\ContentType;
use MinecraftContent\Platform\Platform;

/**
 * What a search is narrowed to. Version and loader start at what the server runs; null means any.
 * The loader is a server software name (paper, fabric...) standing for the loaders that software runs.
 */
final readonly class Filters
{
    public const string ANY = 'any';

    public function __construct(
        public ?string $version,
        public ?string $loader,
        public ?string $category = null,
    ) {}

    public static function defaults(ContentType $type, Platform $platform): self
    {
        if ($type === ContentType::Modpack) {
            return new self(null, null);
        }

        return new self($platform->minecraft, self::loaderOptions($type, $platform) === [] ? null : $platform->software);
    }

    /** Values a user picked on top of the defaults: a missing value keeps the default, "any" drops the filter. */
    public static function from(ContentType $type, Platform $platform, ?string $version, ?string $loader, ?string $category): self
    {
        $defaults = self::defaults($type, $platform);

        return new self(
            $version === null ? $defaults->version : ($version === self::ANY ? null : $version),
            $loader === null ? $defaults->loader : ($loader === self::ANY || ! isset(Platform::SOFTWARE[$loader]) ? null : $loader),
            $category === null || $category === '' ? null : $category,
        );
    }

    /** @return list<string> Server software the type can be narrowed to, empty when loaders do not apply. */
    public static function loaderOptions(ContentType $type, Platform $platform): array
    {
        $kind = match ($type) {
            ContentType::Plugin, ContentType::Mod => $platform->kind(),
            ContentType::Modpack => 'mods',
            default => null,
        };

        if ($kind === null || $kind === 'vanilla') {
            return [];
        }

        return array_keys(array_filter(Platform::SOFTWARE, static fn (array $software): bool => $software['kind'] === $kind));
    }

    /** @return list<string> Modrinth loader names of the chosen software. */
    public function loaders(): array
    {
        return $this->loader === null ? [] : Platform::SOFTWARE[$this->loader]['loaders'];
    }
}
