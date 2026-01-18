export const tankShells = [
    {
        id: 'tank_shell_he',
        name: '고폭탄 (HE)',
        type: 'tank_shell',
        damage: 300,
        explodeRadius: 250,
        color: '#e67e22',
        weight: 10,
        description: '넓은 범위에 폭발 피해를 주는 전차포 전용 고폭탄입니다.',
        svg: `<path d="M20,10 L44,10 L50,30 L50,50 L14,50 L14,30 Z" fill="#e67e22" />`
    },
    {
        id: 'tank_shell_ap',
        name: '철갑탄 (AP)',
        type: 'tank_shell',
        damage: 800,
        explodeRadius: 80,
        color: '#7f8c8d',
        weight: 12,
        description: '단일 대상에게 치명적인 피해를 주는 전차포 전용 철갑탄입니다.',
        svg: `<path d="M25,10 L39,10 L45,30 L45,55 L19,55 L19,30 Z" fill="#7f8c8d" />`
    }
];
