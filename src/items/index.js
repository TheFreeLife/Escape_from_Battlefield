import { weapons } from './weapons.js';
import { consumables } from './consumables.js';
import { equipment } from './equipment.js';

export const allItems = [
    ...weapons,
    ...consumables,
    ...equipment
];

export const getItem = (id) => allItems.find(item => item.id === id);
