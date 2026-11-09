<?php

declare(strict_types=1);

namespace MinecraftContent\Tests\Unit;

use MinecraftContent\Support\LevelDat;
use PHPUnit\Framework\TestCase;

final class LevelDatTest extends TestCase
{
    public function test_reads_the_data_version_and_version_name(): void
    {
        $this->assertSame(['data_version' => 4189, 'version' => '1.21.4'], LevelDat::read($this->fixture()));
    }

    public function test_reads_uncompressed_nbt(): void
    {
        $this->assertSame(4189, LevelDat::read((string) gzdecode($this->fixture()))['data_version'] ?? null);
    }

    public function test_worlds_from_before_1_9_have_no_version(): void
    {
        // Root compound "" holding Data { LevelName: "old" }.
        $nbt = "\x0a\x00\x00"."\x0a\x00\x04Data"."\x08\x00\x09LevelName\x00\x03old"."\x00\x00";

        $this->assertSame(['data_version' => null, 'version' => null], LevelDat::read(gzencode($nbt)));
    }

    public function test_broken_files_read_as_null(): void
    {
        $this->assertNull(LevelDat::read(''));
        $this->assertNull(LevelDat::read('not nbt'));
        $this->assertNull(LevelDat::read(mb_substr($this->fixture(), 0, 40, '8bit')));
        $this->assertNull(LevelDat::read(mb_substr((string) gzdecode($this->fixture()), 0, 60, '8bit')));
        $this->assertNull(LevelDat::read(gzencode("\x0a\x00\x00\x63\x00\x01x\x00")));
    }

    private function fixture(): string
    {
        return (string) file_get_contents(__DIR__.'/../Fixtures/level.dat');
    }
}
