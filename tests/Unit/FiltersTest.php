<?php

declare(strict_types=1);

namespace MinecraftContent\Tests\Unit;

use MinecraftContent\Content\ContentType;
use MinecraftContent\Platform\Platform;
use MinecraftContent\Sources\CurseForge;
use MinecraftContent\Sources\Filters;
use MinecraftContent\Sources\Hangar;
use MinecraftContent\Sources\Modrinth;
use PHPUnit\Framework\TestCase;

final class FiltersTest extends TestCase
{
    public function test_defaults_follow_the_server(): void
    {
        $paper = new Platform('paper', '1.21.4');

        $this->assertEquals(new Filters('1.21.4', 'paper'), Filters::defaults(ContentType::Plugin, $paper));
        $this->assertEquals(new Filters('1.21.4', null), Filters::defaults(ContentType::Datapack, $paper));
        $this->assertEquals(new Filters(null, null), Filters::defaults(ContentType::Modpack, $paper));
    }

    public function test_picked_values_replace_the_defaults(): void
    {
        $quilt = new Platform('quilt', '1.20.1');

        $this->assertEquals(new Filters('1.20.1', 'quilt'), Filters::from(ContentType::Mod, $quilt, null, null, null));
        $this->assertEquals(new Filters(null, null, 'magic'), Filters::from(ContentType::Mod, $quilt, 'any', 'any', 'magic'));
        $this->assertEquals(new Filters('1.19.2', 'fabric'), Filters::from(ContentType::Mod, $quilt, '1.19.2', 'fabric', ''));
        $this->assertNull(Filters::from(ContentType::Mod, $quilt, null, 'unknown', null)->loader);
    }

    public function test_loader_options_stay_within_the_server_kind(): void
    {
        $this->assertSame(['paper', 'purpur', 'folia', 'spigot'], Filters::loaderOptions(ContentType::Plugin, new Platform('purpur', '1.21.4')));
        $this->assertSame(['velocity', 'bungeecord'], Filters::loaderOptions(ContentType::Plugin, new Platform('velocity', null)));
        $this->assertSame(['fabric', 'quilt', 'forge', 'neoforge'], Filters::loaderOptions(ContentType::Modpack, new Platform('vanilla', '1.21.4')));
        $this->assertSame([], Filters::loaderOptions(ContentType::ResourcePack, new Platform('fabric', '1.21.4')));
    }

    public function test_modrinth_defaults_keep_the_server_facets(): void
    {
        $paper = new Platform('paper', '1.21.4');
        $query = Modrinth::searchQuery(ContentType::Plugin, Filters::defaults(ContentType::Plugin, $paper), 'perms', 'downloads', 2);

        $this->assertSame([['project_type:plugin'], ['categories:paper', 'categories:spigot', 'categories:bukkit'], ['versions:1.21.4']], json_decode($query['facets'], true));
        $this->assertSame(['perms', 'downloads', 20], [$query['query'], $query['index'], $query['offset']]);

        $modpack = Modrinth::searchQuery(ContentType::Modpack, Filters::defaults(ContentType::Modpack, $paper), '', 'relevance', 1);
        $this->assertSame([['project_type:modpack'], ['server_side:required', 'server_side:optional']], json_decode($modpack['facets'], true));
    }

    public function test_modrinth_maps_widened_and_narrowed_filters(): void
    {
        $facets = static fn (ContentType $type, Filters $filters): array => json_decode(Modrinth::searchQuery($type, $filters, '', 'relevance', 1)['facets'], true);

        $this->assertSame([['project_type:mod'], ['server_side:required', 'server_side:optional']], $facets(ContentType::Mod, new Filters(null, null)));
        $this->assertSame(
            [['project_type:mod'], ['categories:quilt', 'categories:fabric'], ['versions:1.20.1'], ['categories:magic'], ['server_side:required', 'server_side:optional']],
            $facets(ContentType::Mod, new Filters('1.20.1', 'quilt', 'magic')),
        );
        $this->assertSame([['project_type:modpack'], ['categories:forge'], ['server_side:required', 'server_side:optional']], $facets(ContentType::Modpack, new Filters(null, 'forge')));
        $this->assertSame([['project_type:resourcepack'], ['versions:1.21.4'], ['categories:16x']], $facets(ContentType::ResourcePack, new Filters('1.21.4', 'paper', '16x')));
    }

    public function test_curseforge_maps_filters(): void
    {
        $fabric = new Platform('fabric', '1.21.1');
        $defaults = CurseForge::searchQuery(ContentType::Mod, Filters::defaults(ContentType::Mod, $fabric), '', 'downloads', 1);

        $this->assertSame(['gameId' => 432, 'classId' => 6, 'sortField' => 6, 'sortOrder' => 'desc', 'pageSize' => 20, 'index' => 0, 'gameVersion' => '1.21.1', 'modLoaderType' => 4], $defaults);

        $widened = CurseForge::searchQuery(ContentType::Mod, new Filters(null, null, '423'), 'jei', 'relevance', 3);
        $this->assertSame(['gameId' => 432, 'classId' => 6, 'searchFilter' => 'jei', 'sortField' => 2, 'sortOrder' => 'desc', 'pageSize' => 20, 'index' => 40, 'categoryId' => 423], $widened);

        $this->assertSame(1, CurseForge::searchQuery(ContentType::Modpack, new Filters(null, 'forge'), '', 'relevance', 1)['modLoaderType']);
        $this->assertArrayNotHasKey('modLoaderType', CurseForge::searchQuery(ContentType::Plugin, new Filters(null, 'paper'), '', 'relevance', 1));
        $this->assertArrayNotHasKey('categoryId', CurseForge::searchQuery(ContentType::Mod, new Filters(null, null, 'magic'), '', 'relevance', 1));
    }

    public function test_hangar_maps_filters(): void
    {
        $paper = new Platform('paper', '1.21.4');

        $this->assertSame(
            ['limit' => 20, 'offset' => 0, 'platform' => 'PAPER', 'sort' => '-downloads', 'version' => '1.21.4'],
            Hangar::searchQuery($paper, Filters::defaults(ContentType::Plugin, $paper), '', 'relevance', 1),
        );
        $this->assertSame(
            ['q' => 'chest', 'limit' => 20, 'offset' => 0, 'platform' => 'PAPER', 'sort' => '-stars', 'category' => 'economy'],
            Hangar::searchQuery($paper, new Filters(null, 'folia', 'economy'), 'chest', 'follows', 1),
        );
        $this->assertArrayNotHasKey('category', Hangar::searchQuery($paper, new Filters(null, null, 'magic'), '', 'relevance', 1));
        $this->assertArrayNotHasKey('version', Hangar::searchQuery(new Platform('velocity', '1.21.4'), new Filters('1.21.4', null), '', 'relevance', 1));
    }

    public function test_category_options_come_from_the_source_tags(): void
    {
        $modrinth = Modrinth::categoryOptions([
            ['name' => 'game-mechanics', 'project_type' => 'mod'],
            ['name' => 'adventure', 'project_type' => 'mod'],
            ['name' => 'kitchen-sink', 'project_type' => 'modpack'],
        ], 'mod');

        $this->assertSame([['value' => 'adventure', 'label' => 'Adventure'], ['value' => 'game-mechanics', 'label' => 'Game mechanics']], $modrinth);
        $this->assertSame(
            [['value' => '420', 'label' => 'Storage']],
            CurseForge::categoryOptions([['id' => 6, 'name' => 'Mods', 'isClass' => true], ['id' => 420, 'name' => 'Storage', 'isClass' => false]]),
        );
    }
}
