export const consumables = [
    {
        id: 'medkit',
        name: 'First Aid Kit',
        type: 'consumable',
        color: '#e74c3c',
        svg: "<rect x='22' y='12' width='20' height='40' /><rect x='12' y='22' width='40' height='20' />",
        description: '체력을 회복시켜주는 구급 상자입니다.'
    },
    {
        id: 'mag_pistol',
        name: 'Pistol Magazine',
        type: 'magazine',
        weaponId: 'pistol',
        ammoAmount: 8,
        color: '#95a5a6',
        description: '권총 전용 8발들이 탄창입니다.',
        svg: `<rect x="25" y="15" width="14" height="34" rx="2" fill="#7f8c8d" />
              <rect x="25" y="44" width="14" height="5" fill="#34495e" />`
    },
    {
        id: 'mag_ak47',
        name: 'AK-47 Magazine',
        type: 'magazine',
        weaponId: 'ak47',
        ammoAmount: 30,
        color: '#d35400',
        description: 'AK-47 전용 30발들이 탄창입니다.',
        svg: `<path d="M25,10 Q35,10 35,50 L25,50 Q25,10 25,10" fill="#2c3e50" />
              <rect x="24" y="45" width="12" height="6" fill="#34495e" />`
    },
    {
        id: 'mag_m40',
        name: 'M40 Magazine',
        type: 'magazine',
        weaponId: 'm40',
        ammoAmount: 5,
        color: '#27ae60',
        description: 'M40 전용 5발들이 탄창입니다.',
        svg: `<rect x="22" y="30" width="20" height="20" rx="2" fill="#2c3e50" />
              <rect x="22" y="46" width="20" height="4" fill="#34495e" />`
    }
];
