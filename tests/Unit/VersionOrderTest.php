<?php

declare(strict_types=1);

namespace MinecraftContent\Tests\Unit;

use MinecraftContent\Support\VersionOrder;
use PHPUnit\Framework\TestCase;

final class VersionOrderTest extends TestCase
{
    private const array HISTORY = ['26.1', '26.1-rc-1', '25w45a', '1.21.10', '1.21.4', '1.20.1'];

    public function test_older_versions_are_downgrades(): void
    {
        $this->assertTrue(VersionOrder::isOlder(self::HISTORY, '1.20.1', '1.21.4'));
        $this->assertTrue(VersionOrder::isOlder(self::HISTORY, '1.21.10', '25w45a'));
        $this->assertTrue(VersionOrder::isOlder(self::HISTORY, '26.1-rc-1', '26.1'));
    }

    public function test_the_same_or_newer_versions_are_not(): void
    {
        $this->assertFalse(VersionOrder::isOlder(self::HISTORY, '1.21.4', '1.21.4'));
        $this->assertFalse(VersionOrder::isOlder(self::HISTORY, '26.1', '1.20.1'));
    }

    public function test_unknown_versions_are_not_blocked(): void
    {
        $this->assertFalse(VersionOrder::isOlder(self::HISTORY, '3.4.0', '1.21.4'));
        $this->assertFalse(VersionOrder::isOlder(self::HISTORY, '1.20.1', 'Infdev'));
    }
}
