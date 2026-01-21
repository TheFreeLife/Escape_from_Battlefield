export const consumables = [
    {
        id: 'medkit',
        name: 'First Aid Kit',
        type: 'consumable',
        stackable: true,
        color: '#e74c3c',
        svg: "<rect x='22' y='12' width='20' height='40' /><rect x='12' y='22' width='40' height='20' />",
        description: '체력을 회복시켜주는 구급 상자입니다.'
    },
    {
        id: "iron_ingot",
        name: "철 주괴",
        type: "consumable",
        stackable: true,
        color: "#bdc3c7",
        svg: "<rect x='15' y='25' width='34' height='14' rx='2' fill='#bdc3c7' stroke='#7f8c8d'/><path d='M15 25l5-5h34l-5 5z' fill='#ecf0f1'/>",
        description: "다양한 장비를 제작하는 데 필요한 기초 철재입니다."
    },
    {
        id: "wood_plank",
        name: "나무 판자",
        type: "consumable",
        stackable: true,
        color: "#8d6e63",
        svg: "<rect x='10' y='20' width='44' height='24' fill='#8d6e63' stroke='#5d4037'/><path d='M10 28h44M10 36h44' stroke='#5d4037' stroke-width='1'/>",
        description: "총기 개량이나 구조물 제작에 사용되는 나무 재료입니다."
    },
    {
        id: "spring",
        name: "강철 스프링",
        type: "consumable",
        stackable: true,
        color: "#7f8c8d",
        svg: "<path d='M25 15q15 5 0 10t0 10t0 10t0 10' fill='none' stroke='#7f8c8d' stroke-width='3'/>",
        description: "총기의 작동부에 필요한 중요한 부품입니다."
    },
    {
        id: "pistol_grip",
        name: "권총 손잡이",
        type: "consumable",
        stackable: true,
        color: "#333",
        svg: "<path d='M25 25l5 25h10l-5-25z' fill='#333'/>",
        description: "대부분의 총기에 사용되는 인체공학적 손잡이입니다."
    },
    {
        id: "short_barrel",
        name: "단총열",
        type: "consumable",
        stackable: true,
        color: "#555",
        svg: "<rect x='10' y='28' width='30' height='8' fill='#555' stroke='#333'/>",
        description: "권총이나 기관단총에 사용되는 짧은 총열입니다."
    },
    {
        id: "long_barrel",
        name: "장총열",
        type: "consumable",
        stackable: true,
        color: "#555",
        svg: "<rect x='10' y='28' width='50' height='8' fill='#555' stroke='#333'/>",
        description: "소총이나 저격총에 사용되는 긴 총열입니다."
    },
    {
        id: "ar_receiver",
        name: "소총 하부 총몸",
        type: "consumable",
        stackable: true,
        color: "#444",
        svg: "<rect x='15' y='25' width='35' height='15' rx='2' fill='#444'/>",
        description: "돌격소총의 핵심이 되는 작동부 뭉치입니다."
    },
    {
        id: "ak_receiver",
        name: "AK용 리시버",
        type: "consumable",
        stackable: true,
        color: "#5d4037",
        svg: "<rect x='15' y='25' width='35' height='15' fill='#5d4037' stroke='#3e2723'/>",
        description: "AK 계열 총기에 사용되는 견고한 리시버입니다."
    },
    {
        id: "smg_receiver",
        name: "기관단총 리시버",
        type: "consumable",
        stackable: true,
        color: "#222",
        svg: "<rect x='20' y='25' width='25' height='15' fill='#222'/>",
        description: "기관단총 제작에 사용되는 경량 리시버입니다."
    },
    {
        id: "bolt_action_parts",
        name: "볼트액션 뭉치",
        type: "consumable",
        stackable: true,
        color: "#7f8c8d",
        svg: "<path d='M15 30h30M40 25l5 5-5 5' fill='none' stroke='#7f8c8d' stroke-width='4'/>",
        description: "저격소총의 정밀한 사격을 가능하게 하는 장전 뭉치입니다."
    },
    {
        id: "shotgun_parts",
        name: "산탄총 작동부",
        type: "consumable",
        stackable: true,
        color: "#333",
        svg: "<rect x='15' y='30' width='35' height='10' fill='#333'/><path d='M20 40l15 5' stroke='#333' stroke-width='3'/>",
        description: "펌프액션이나 반자동 산탄총에 들어가는 부품입니다."
    },
    {
        id: "explosive_material",
        name: "폭발성 물질",
        type: "consumable",
        stackable: true,
        color: "#e67e22",
        svg: "<circle cx='32' cy='32' r='15' fill='#e67e22'/><path d='M32 25v14M25 32h14' stroke='#d35400' stroke-width='3'/>",
        description: "유탄이나 로켓탄 제작에 필요한 고폭 화약입니다."
    },
    {
        id: 'grenade',
        name: 'Frag Grenade',
        type: 'grenade',
        stackable: true,
        color: '#4b5320',
        description: '강력한 폭발을 일으키는 세열수류탄입니다.',
        svg: `<path d="M25,15 L39,15 L39,20 L25,20 Z" fill="#333" />
              <rect x="22" y="20" width="20" height="30" rx="8" fill="#4b5320" />
              <circle cx="39" cy="12" r="4" fill="none" stroke="#666" stroke-width="2" />`
    }
];