<?php

declare(strict_types=1);

namespace MinecraftContent\Support;

use UnexpectedValueException;

/**
 * Reads the Minecraft version a world was last saved with from its level.dat (gzip-compressed NBT).
 */
final class LevelDat
{
    private const int MAX_BYTES = 16 * 1024 * 1024;

    private const int MAX_DEPTH = 64;

    private int $position = 0;

    private function __construct(private readonly string $bytes) {}

    /** @return array{data_version: int|null, version: string|null}|null Null when the file is not a readable level.dat. */
    public static function read(string $contents): ?array
    {
        $bytes = str_starts_with($contents, "\x1f\x8b") ? @gzdecode($contents, self::MAX_BYTES) : $contents;

        if (! is_string($bytes)) {
            return null;
        }

        try {
            $data = (new self($bytes))->root()['Data'] ?? null;
        } catch (UnexpectedValueException) {
            return null;
        }

        if (! is_array($data)) {
            return null;
        }

        $version = is_array($data['Version'] ?? null) ? ($data['Version']['Name'] ?? null) : null;

        return [
            'data_version' => is_int($data['DataVersion'] ?? null) ? $data['DataVersion'] : null,
            'version' => is_string($version) && $version !== '' ? $version : null,
        ];
    }

    /** @return array<string, mixed> */
    private function root(): array
    {
        if ($this->unsigned(1) !== 10) {
            throw new UnexpectedValueException('The root tag is not a compound.');
        }

        $this->string();

        return $this->compound(0);
    }

    /** @return array<string, mixed> */
    private function compound(int $depth): array
    {
        $values = [];

        while (($type = $this->unsigned(1)) !== 0) {
            $name = $this->string();
            $values[$name] = $this->payload($type, $depth + 1);
        }

        return $values;
    }

    private function payload(int $type, int $depth): mixed
    {
        if ($depth > self::MAX_DEPTH) {
            throw new UnexpectedValueException('The NBT data is nested too deeply.');
        }

        return match ($type) {
            1 => $this->signed(1),
            2 => $this->signed(2),
            3 => $this->signed(4),
            4 => unpack('J', $this->take(8))[1],
            5 => unpack('G', $this->take(4))[1],
            6 => unpack('E', $this->take(8))[1],
            7 => $this->skipArray(1),
            8 => $this->string(),
            9 => $this->list($depth),
            10 => $this->compound($depth),
            11 => $this->skipArray(4),
            12 => $this->skipArray(8),
            default => throw new UnexpectedValueException("Unknown NBT tag {$type}."),
        };
    }

    /** @return list<mixed> */
    private function list(int $depth): array
    {
        $type = $this->unsigned(1);
        $length = $this->signed(4);
        $values = [];

        if ($type === 0 || $length <= 0) {
            return [];
        }

        for ($i = 0; $i < $length; $i++) {
            $values[] = $this->payload($type, $depth);
        }

        return $values;
    }

    /** Byte, int and long arrays are never needed, so only their length is read. */
    private function skipArray(int $width): null
    {
        $length = $this->signed(4);

        if ($length > 0) {
            $this->take($length * $width);
        }

        return null;
    }

    private function string(): string
    {
        return $this->take($this->unsigned(2));
    }

    private function unsigned(int $bytes): int
    {
        return unpack($bytes === 1 ? 'C' : 'n', $this->take($bytes))[1];
    }

    private function signed(int $bytes): int
    {
        $value = $bytes === 4 ? unpack('N', $this->take(4))[1] : $this->unsigned($bytes);
        $limit = 1 << ($bytes * 8);

        return $value >= $limit >> 1 ? $value - $limit : $value;
    }

    private function take(int $length): string
    {
        if ($length < 0 || $this->position + $length > mb_strlen($this->bytes, '8bit')) {
            throw new UnexpectedValueException('The NBT data ends early.');
        }

        $chunk = mb_substr($this->bytes, $this->position, $length, '8bit');
        $this->position += $length;

        return $chunk;
    }
}
