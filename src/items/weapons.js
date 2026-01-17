export const weapons = [
    {
        id: 'pistol',
        name: 'P1911 Pistol',
        type: 'weapon',
        color: '#95a5a6',
        fireRate: 0.3,
        damage: 3,
        magSize: 8,
        reloadTime: 1.5,
        description: '표준 부무장 권총입니다. 신뢰성이 높습니다.',
        svg: `<path d="M20,32 L44,32 L44,38 L20,38 Z M20,38 L26,54 L18,54 L14,38 Z" fill="#444" />`
    },
    {
        id: 'ak47',
        name: 'AK-47',
        type: 'weapon',
        color: '#d35400',
        fireRate: 0.1,
        damage: 10,
        magSize: 30,
        reloadTime: 2.0,
        description: '높은 공격력과 빠른 연사력을 가진 러시아제 돌격소총입니다.',
        svg: `<path d="M4,30 L16,30 L16,42 L4,48 Z" fill="#5d4037" />
              <path d="M16,32 L58,32 L58,36 L16,36 Z" fill="#333" />
              <path d="M25,36 Q28,55 35,55 L42,55 Q35,50 32,36 Z" fill="#222" />
              <path d="M45,36 L48,50 L54,50 L51,36 Z" fill="#222" />
              <path d="M20,28 L30,28 L30,32 L20,32 Z" fill="#444" />`
    }
];
