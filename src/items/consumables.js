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
        id: 'grenade',
        name: 'Frag Grenade',
        type: 'grenade',
        color: '#4b5320',
        description: '강력한 폭발을 일으키는 세열수류탄입니다. 투척 거리에 비례하여 파괴력이 전달됩니다.',
        svg: `<path d="M25,15 L39,15 L39,20 L25,20 Z" fill="#333" />
              <rect x="22" y="20" width="20" height="30" rx="8" fill="#4b5320" />
              <path d="M22,30 L42,30 M22,40 L42,40 M32,20 L32,50" stroke="rgba(0,0,0,0.2)" stroke-width="1" />
              <circle cx="39" cy="12" r="4" fill="none" stroke="#666" stroke-width="2" />`
    }
];
