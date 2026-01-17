export const weapons = [
    {
        id: 'rifle',
        name: 'Assault Rifle',
        type: 'weapon',
        color: '#2c3e50',
        fireRate: 0.2,
        damage: 1,
        svg: "<rect x='10' y='28' width='44' height='8' /><rect x='14' y='36' width='10' height='10' />"
    },
    {
        id: 'ak47',
        name: 'AK-47',
        type: 'weapon',
        color: '#d35400',
        fireRate: 0.1,
        damage: 10, // Significantly higher damage as requested
        description: '높은 공격력과 빠른 연사력을 가진 러시아제 돌격소총입니다.',
        svg: `<path d="M4,30 L16,30 L16,42 L4,48 Z" fill="#5d4037" />
              <path d="M16,32 L58,32 L58,36 L16,36 Z" fill="#333" />
              <path d="M25,36 Q28,55 35,55 L42,55 Q35,50 32,36 Z" fill="#222" />
              <path d="M45,36 L48,50 L54,50 L51,36 Z" fill="#222" />
              <path d="M20,28 L30,28 L30,32 L20,32 Z" fill="#444" />`
    }
];
