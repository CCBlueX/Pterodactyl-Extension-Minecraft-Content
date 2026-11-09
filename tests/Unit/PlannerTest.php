<?php

declare(strict_types=1);

namespace MinecraftContent\Tests\Unit;

use MinecraftContent\Plans\Planner;
use PHPUnit\Framework\TestCase;
use ReflectionClass;

final class PlannerTest extends TestCase
{
    public function test_a_version_change_backs_up_before_any_file_changes(): void
    {
        $steps = $this->planner()->version('PAPER', '1.21.4', 232, 'smart', true, true);

        $this->assertSame(['stop', 'backup', 'cleanup', 'loader', 'redetect', 'start'], array_column($steps, 'op'));
        $this->assertSame('smart', $steps[2]['mode']);
    }

    public function test_without_a_backup_the_cleanup_comes_first(): void
    {
        $steps = $this->planner()->version('PAPER', '1.21.4', null, 'full', false, false);

        $this->assertSame(['stop', 'cleanup', 'loader', 'redetect'], array_column($steps, 'op'));
    }

    private function planner(): Planner
    {
        return (new ReflectionClass(Planner::class))->newInstanceWithoutConstructor();
    }
}
