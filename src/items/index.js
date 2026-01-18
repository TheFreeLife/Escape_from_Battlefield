import { weapons } from './weapons.js';
import { consumables } from './consumables.js';
import { equipment } from './equipment.js';
import { attachments } from './attachments.js';
import { magazines } from './magazines.js';
import { tankShells } from './tankShells.js';

export const allItems = [
    ...weapons,
    ...consumables,
    ...equipment,
    ...attachments,
    ...magazines,
    ...tankShells
];

export const getItem = (id) => allItems.find(item => item.id === id);
