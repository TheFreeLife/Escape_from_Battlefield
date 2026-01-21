export const recipes = [
    // --- PISTOLS ---
    {
        result: 'pistol',
        ingredients: [
            ['iron_ingot', 'short_barrel', null],
            ['pistol_grip', 'spring', null]
        ]
    },
    {
        result: 'glock18',
        ingredients: [
            ['smg_receiver', 'short_barrel', null],
            ['pistol_grip', 'spring', null]
        ]
    },
    {
        result: 'deagle',
        ingredients: [
            ['iron_ingot', 'iron_ingot', 'short_barrel'],
            ['pistol_grip', 'spring', 'iron_ingot']
        ]
    },
    {
        result: 'magnum',
        ingredients: [
            ['iron_ingot', 'short_barrel', 'iron_ingot'],
            ['pistol_grip', 'spring', null]
        ]
    },

    // --- RIFLES ---
    {
        result: 'ak47',
        ingredients: [
            ['iron_ingot', 'ak_receiver', 'long_barrel'],
            ['wood_plank', 'spring', 'iron_ingot']
        ]
    },
    {
        result: 'm4a1',
        ingredients: [
            ['iron_ingot', 'ar_receiver', 'long_barrel'],
            ['iron_ingot', 'spring', 'pistol_grip']
        ]
    },
    {
        result: 'scarh',
        ingredients: [
            ['ar_receiver', 'long_barrel', 'iron_ingot'],
            ['pistol_grip', 'spring', 'iron_ingot']
        ]
    },
    {
        result: 'famas',
        ingredients: [
            ['ar_receiver', 'long_barrel', 'spring'],
            ['iron_ingot', 'iron_ingot', null]
        ]
    },

    // --- SMGS ---
    {
        result: 'mp5',
        ingredients: [
            ['smg_receiver', 'short_barrel', 'spring'],
            ['pistol_grip', 'iron_ingot', null]
        ]
    },
    {
        result: 'vector',
        ingredients: [
            ['smg_receiver', 'short_barrel', 'spring'],
            ['spring', 'pistol_grip', null]
        ]
    },
    {
        result: 'p90',
        ingredients: [
            ['smg_receiver', 'smg_receiver', 'short_barrel'],
            ['spring', 'iron_ingot', null]
        ]
    },

    // --- SNIPERS ---
    {
        result: 'kar98k',
        ingredients: [
            ['wood_plank', 'bolt_action_parts', 'long_barrel'],
            ['wood_plank', 'spring', null]
        ]
    },
    {
        result: 'awm',
        ingredients: [
            ['iron_ingot', 'bolt_action_parts', 'long_barrel'],
            ['iron_ingot', 'spring', 'pistol_grip']
        ]
    },
    {
        result: 'svd',
        ingredients: [
            ['ar_receiver', 'long_barrel', 'iron_ingot'],
            ['wood_plank', 'spring', null]
        ]
    },

    // --- SHOTGUNS ---
    {
        result: 'remington870',
        ingredients: [
            ['shotgun_parts', 'short_barrel', 'iron_ingot'],
            ['wood_plank', 'spring', null]
        ]
    },
    {
        result: 'aa12',
        ingredients: [
            ['ar_receiver', 'shotgun_parts', 'short_barrel'],
            ['pistol_grip', 'spring', 'iron_ingot']
        ]
    },
    {
        result: 'db_shotgun',
        ingredients: [
            ['short_barrel', 'short_barrel', 'shotgun_parts'],
            ['wood_plank', 'spring', null]
        ]
    },

    // --- HEAVY / EXPLOSIVES ---
    {
        result: 'm249',
        ingredients: [
            ['ar_receiver', 'ar_receiver', 'long_barrel'],
            ['iron_ingot', 'spring', 'spring']
        ]
    },
    {
        result: 'rpg7',
        ingredients: [
            ['iron_ingot', 'long_barrel', 'explosive_material'],
            ['pistol_grip', 'wood_plank', null]
        ]
    },
    {
        result: 'm79',
        ingredients: [
            ['wood_plank', 'short_barrel', 'explosive_material'],
            ['spring', null, null]
        ]
    }
];
