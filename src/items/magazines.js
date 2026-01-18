import { weapons } from './weapons.js';

export const magazines = weapons.map(w => ({
    id: `${w.id}_mag`,
    name: `${w.name} 탄창`,
    type: 'magazine',
    weaponId: w.id,
    color: w.color,
    weight: 0.3, // 탄창 하나의 무게
    description: `${w.name} 전용 탄창입니다. 재장전(R) 시 사용됩니다.`,
    svg: `<rect x="20" y="15" width="24" height="34" fill="${w.color}" opacity="0.8" /><rect x="24" y="10" width="16" height="5" fill="#333" />`
}));
