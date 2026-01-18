export const weapons = [
    {
        id: 'pistol',
        name: 'P1911 Pistol',
        type: 'weapon',
        color: '#95a5a6',
        fireRate: 0.45,
        damage: 3,
        magSize: 8,
        reloadTime: 1.5,
        bulletSpeed: 1000,
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
        bulletSpeed: 1400,
        description: '높은 공격력과 빠른 연사력을 가진 러시아제 돌격소총입니다.',
        svg: `<path d="M4,30 L16,30 L16,42 L4,48 Z" fill="#5d4037" />
              <path d="M16,32 L58,32 L58,36 L16,36 Z" fill="#333" />
              <path d="M25,36 Q28,55 35,55 L42,55 Q35,50 32,36 Z" fill="#222" />
              <path d="M45,36 L48,50 L54,50 L51,36 Z" fill="#222" />
              <path d="M20,28 L30,28 L30,32 L20,32 Z" fill="#444" />`
    },
    {
        id: 'm40',
        name: 'M40 Sniper',
        type: 'weapon',
        color: '#27ae60',
        fireRate: 1.2,
        damage: 100,
        magSize: 5,
        reloadTime: 3.0,
        bulletSpeed: 2500,
        range: 1200,
        description: '강력한 한 발을 선사하는 볼트액션 저격소총입니다. 정밀 사격에 적합합니다.',
        svg: `<path d="M4,34 L12,34 L18,48 L4,48 Z" fill="#4a5d23" />
              <path d="M12,38 L58,38 L58,42 L12,42 Z" fill="#222" />
              <path d="M18,34 L35,34 L35,38 L18,38 Z" fill="#4a5d23" />
              <path d="M22,28 L38,28 L38,32 L22,32 Z" fill="#111" />
              <path d="M26,32 L26,34 M34,32 L34,34" stroke="#111" stroke-width="2" />
              <path d="M30,38 L34,48 L28,48 L26,38 Z" fill="#111" />`
    },
    {
        id: 'm16',
        name: 'M16A4',
        type: 'weapon',
        color: '#34495e',
        fireRate: 0.12,
        damage: 8,
        magSize: 30,
        reloadTime: 2.2,
        bulletSpeed: 1600,
        description: '정확도가 높고 탄속이 매우 빠른 미군 표준 돌격소총입니다.',
        svg: `<path d="M4,32 L14,32 L16,44 L6,44 Z" fill="#2c3e50" />
              <path d="M14,34 L58,34 L58,37 L14,37 Z" fill="#111" />
              <path d="M20,37 L22,48 L28,48 L26,37 Z" fill="#222" />
              <path d="M35,37 L37,45 L42,45 L40,37 Z" fill="#222" />
              <path d="M20,30 L35,30 L35,34 L20,34 Z" fill="#333" />
              <path d="M45,30 L55,30 L55,34 L45,34 Z" fill="#333" />`
    },
    {
        id: 'db_shotgun',
        name: 'Double Barrel',
        type: 'weapon',
        color: '#7e5109',
        fireRate: 0.5,
        damage: 6,
        magSize: 2,
        reloadTime: 1.8,
        bulletSpeed: 900,
        pellets: 8,
        spread: 0.2, // Radians
        description: '강력한 화력을 가진 중거리 산탄총입니다. 두 발을 빠르게 발사할 수 있습니다.',
        svg: `<path d="M4,36 L18,34 L18,46 L4,44 Z" fill="#5d4037" />
              <path d="M18,36 L58,36 L58,39 L18,39 Z" fill="#777" />
              <path d="M18,38 L58,38 L58,41 L18,41 Z" fill="#555" />
              <path d="M20,41 L25,52 L18,52 L15,41 Z" fill="#222" />`
    }
];
