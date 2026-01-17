export const attachments = [
    {
        id: 'scope_2x',
        name: '2x Scope',
        type: 'attachment',
        slot: 'optic',
        zoom: 1.2,
        color: '#3498db',
        description: '2배율 조준경입니다. 시야를 약간 넓혀줍니다.',
        svg: `<circle cx="32" cy="32" r="20" fill="none" stroke="#666" stroke-width="4" />
              <line x1="32" y1="12" x2="32" y2="52" stroke="#666" stroke-width="2" />
              <line x1="12" y1="32" x2="52" y2="32" stroke="#666" stroke-width="2" />`
    },
    {
        id: 'scope_4x',
        name: '4x Scope',
        type: 'attachment',
        slot: 'optic',
        zoom: 1.5,
        color: '#e67e22',
        description: '4배율 조준경입니다. 시야를 상당히 넓혀줍니다.',
        svg: `<circle cx="32" cy="32" r="22" fill="none" stroke="#444" stroke-width="5" />
              <circle cx="32" cy="32" r="18" fill="none" stroke="#333" stroke-width="2" />
              <line x1="32" y1="10" x2="32" y2="54" stroke="#e74c3c" stroke-width="1" />
              <line x1="10" y1="32" x2="54" y2="32" stroke="#e74c3c" stroke-width="1" />`
    },
    {
        id: 'laser_sight',
        name: 'Laser Sight',
        type: 'attachment',
        slot: 'underbarrel',
        color: '#e74c3c',
        description: '붉은색 레이저 포인터입니다. 조준 지점을 명확하게 표시해줍니다.',
        svg: `<rect x="20" y="28" width="24" height="8" rx="2" fill="#333" />
              <circle cx="44" cy="32" r="2" fill="#ff0000" />
              <path d="M22,36 L42,36" stroke="#555" stroke-width="1" />`
    }
];
