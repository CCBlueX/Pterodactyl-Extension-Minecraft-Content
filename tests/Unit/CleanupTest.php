<?php

declare(strict_types=1);

namespace MinecraftContent\Tests\Unit;

use InvalidArgumentException;
use MinecraftContent\Support\Cleanup;
use PHPUnit\Framework\TestCase;

final class CleanupTest extends TestCase
{
    private const array ROOT = [
        'server.jar', 'server.properties', 'eula.txt', 'ops.json', '.mc-content.json', 'libraries', 'versions', 'cache',
        'plugins', 'mods', 'config', 'logs', 'world', 'world_nether', 'world_the_end', 'creative', 'creative_nether', 'other_nether',
    ];

    public function test_keep_only_replaces_the_server_jar(): void
    {
        $this->assertSame(['server.jar'], Cleanup::paths('keep', self::ROOT, ['world']));
    }

    public function test_smart_removes_the_jar_and_old_libraries_but_keeps_content(): void
    {
        $paths = Cleanup::paths('smart', self::ROOT, ['world']);

        $this->assertContains('server.jar', $paths);
        $this->assertContains('libraries', $paths);
        $this->assertContains('versions', $paths);
        $this->assertContains('.fabric', $paths);

        foreach (['world', 'plugins', 'mods', 'config', 'server.properties'] as $kept) {
            $this->assertNotContains($kept, $paths);
        }
    }

    public function test_full_removes_everything_except_worlds_and_server_properties(): void
    {
        $this->assertSame(
            ['server.jar', 'ops.json', '.mc-content.json', 'libraries', 'versions', 'cache', 'plugins', 'mods', 'config', 'logs', 'other_nether'],
            Cleanup::paths('full', self::ROOT, ['world', 'creative']),
        );
    }

    public function test_unknown_modes_are_refused(): void
    {
        $this->expectException(InvalidArgumentException::class);

        Cleanup::paths('everything');
    }
}
