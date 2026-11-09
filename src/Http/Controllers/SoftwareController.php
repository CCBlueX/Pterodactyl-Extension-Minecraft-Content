<?php

declare(strict_types=1);

namespace MinecraftContent\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use MinecraftContent\Content\Installed;
use MinecraftContent\Content\Worlds;
use MinecraftContent\Panel\Panel;
use MinecraftContent\Plans\Planner;
use MinecraftContent\Plans\Plans;
use MinecraftContent\Platform\Detector;
use MinecraftContent\Sources\McJars;
use MinecraftContent\Support\Cleanup;
use MinecraftContent\Support\LevelDat;
use MinecraftContent\Support\VersionOrder;
use Pterodactyl\Facades\Activity;
use Pterodactyl\Models\Server;
use Throwable;

final class SoftwareController extends Controller
{
    private const string TYPE = '/^[A-Z][A-Z0-9_]{1,31}$/';

    public function __construct(
        private readonly McJars $mcjars,
        private readonly Planner $planner,
        private readonly Plans $plans,
        private readonly Panel $panel,
        private readonly Detector $detector,
        private readonly Installed $installed,
        private readonly Worlds $worlds,
    ) {}

    public function types(Request $request, Server $server): JsonResponse
    {
        $this->authorize($request, $server, 'read');

        return $this->attempt(fn (): array => ['types' => array_values($this->mcjars->types())]);
    }

    public function versions(Request $request, Server $server, string $type): JsonResponse
    {
        $this->authorize($request, $server, 'read');
        abort_unless(preg_match(self::TYPE, $type) === 1, 404);

        return $this->attempt(fn (): array => ['versions' => $this->mcjars->versions($type)]);
    }

    public function builds(Request $request, Server $server, string $type, string $version): JsonResponse
    {
        $this->authorize($request, $server, 'read');
        abort_unless(preg_match(self::TYPE, $type) === 1 && preg_match(self::VERSION, $version) === 1, 404);

        return $this->attempt(fn (): array => ['builds' => array_map(
            static fn (array $build): array => array_diff_key($build, ['installation' => true]),
            array_slice($this->mcjars->builds($type, $version), 0, 50),
        )]);
    }

    /**
     * The build installed through this extension, a newer stable build of the same version if there is one,
     * the free backup slots and the version the active world was last saved with.
     */
    public function current(Request $request, Server $server): JsonResponse
    {
        $this->authorize($request, $server, 'read');

        return $this->attempt(function () use ($server): array {
            $installed = $this->installed->all($server)['software'];
            $platform = $this->detector->detect($server);
            $update = null;

            // A jar swapped by hand makes the remembered build meaningless.
            if ($installed === null || mb_strtolower((string) $installed['type']) !== $platform->software || (string) $installed['version'] !== $platform->minecraft) {
                $installed = null;
            } else {
                $latest = collect($this->mcjars->builds((string) $installed['type'], (string) $installed['version']))->firstWhere('experimental', false);
                $update = $latest !== null && $latest['id'] !== (int) $installed['build'] ? array_diff_key($latest, ['installation' => true]) : null;
            }

            return ['installed' => $installed, 'update' => $update, 'backups' => $this->panel->backupSlots($server), 'world' => $this->world($server)];
        });
    }

    public function change(Request $request, Server $server): JsonResponse
    {
        $this->authorize($request, $server, 'version');

        $data = $request->validate([
            'type' => ['required', 'string', 'regex:'.self::TYPE],
            'version' => ['required', 'string', 'regex:'.self::VERSION],
            'build' => ['nullable', 'integer', 'min:1'],
            'cleanup' => ['required', 'string', 'in:'.implode(',', Cleanup::MODES)],
            'backup' => ['required', 'boolean'],
            'downgrade' => ['sometimes', 'boolean'],
        ]);

        return $this->attempt(function () use ($request, $server, $data): array {
            $build = $this->mcjars->build($data['type'], $data['version'], $data['build'] ?? null);
            abort_if($build === null, 422, 'That build does not exist.');

            $world = $this->world($server);

            if ($world !== null && $world['version'] !== null && ! ($data['downgrade'] ?? false)
                && VersionOrder::isOlder(array_column($this->mcjars->versions('VANILLA'), 'id'), $data['version'], $world['version'])) {
                abort(422, "The world \"{$world['name']}\" was last saved with Minecraft {$world['version']}. Tick \"I understand the world may break\" to install {$data['version']} anyway.");
            }

            $running = ! in_array($this->panel->state($server), ['offline', 'stopped'], true);
            $label = ucfirst(mb_strtolower($data['type']))." {$data['version']} ({$build['name']})";
            $current = $this->detector->detect($server);

            Activity::event('server:startup.edit')->subject($server)->property([
                'variable' => 'Server software',
                'old' => mb_trim("{$current->software} {$current->minecraft}"),
                'new' => $label,
            ])->log();

            return ['job' => $this->plans->start(
                $server,
                $request->user(),
                'ext.minecraft-content.version',
                "Installing {$label}",
                $this->planner->version($data['type'], $data['version'], $build['id'], $data['cleanup'], (bool) $data['backup'], $running),
            )];
        });
    }

    /** @return array{name: string, version: string|null, data_version: int|null}|null */
    private function world(Server $server): ?array
    {
        $name = $this->worlds->active($server);

        try {
            $level = LevelDat::read($this->panel->read($server, "{$name}/level.dat", 8 * 1024 * 1024) ?? '');
        } catch (Throwable) {
            return null;
        }

        return $level === null ? null : ['name' => $name, ...$level];
    }
}
