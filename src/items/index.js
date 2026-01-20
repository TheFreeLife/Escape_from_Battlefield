import { weapons } from './weapons.js';
import { ammos } from './ammos.js';
import { consumables } from './consumables.js';
import { equipment } from './equipment.js';
import { attachments } from './attachments.js';
import { tankShells } from './tankShells.js';
import { apcAmmo } from './apcAmmo.js';

export const allItems = [
    ...weapons,
    ...ammos,
    ...consumables,
    ...equipment,
    ...attachments,
    ...tankShells,
    ...apcAmmo
];

export const getItem = (id) => allItems.find(item => item.id === id);
