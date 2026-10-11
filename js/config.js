// ===== BOLA 3D — config =====
export const PITCH = { L: 105, W: 68 };          // meters
export const HX = PITCH.L / 2, HZ = PITCH.W / 2;
export const GOAL_W = 7.32, GOAL_H = 2.44;
export const BALL_R = 0.35;
export const GRAV = 24;
export const WALK = 7.2, SPRINT = 9.8, GK_SPD = 6.8, AI_SPD = 6.9, AI_SPRINT = 8.8;

export const TEAMS = [
  { name: 'Garuda FC',   short: 'GRD', color: 0xd62828, trim: 0xffffff, form: '4-3-3' },
  { name: 'Biru Pesisir', short: 'BIR', color: 0x1d4ed8, trim: 0xffffff, form: '4-4-2' },
  { name: 'Emas FC',     short: 'EMS', color: 0xf5b301, trim: 0x161616, form: '4-3-3' },
  { name: 'Hutan FC',    short: 'HTN', color: 0x15803d, trim: 0xffffff, form: '4-4-2' },
];

// formation slots as fractions: x of half-length (negative = own half), z of half-width
export const FORMATIONS = {
  '4-3-3': [
    [-0.94, 0],
    [-0.60, -0.34], [-0.65, -0.11], [-0.65, 0.11], [-0.60, 0.34],
    [-0.34, -0.24], [-0.37, 0], [-0.34, 0.24],
    [-0.06, -0.27], [-0.09, 0], [-0.06, 0.27],
  ],
  '4-4-2': [
    [-0.94, 0],
    [-0.60, -0.34], [-0.65, -0.11], [-0.65, 0.11], [-0.60, 0.34],
    [-0.32, -0.30], [-0.36, -0.10], [-0.36, 0.10], [-0.32, 0.30],
    [-0.07, -0.14], [-0.07, 0.14],
  ],
};

export const ROLES = ['GK','DF','DF','DF','DF','MF','MF','MF','FW','FW','FW'];

export const COMMENTARY = {
  kickoff: [
    'Peluit dibunyikan! Pertandingan dimulai!',
    'Kick-off! Mari kita saksikan 90 menit penuh drama!',
  ],
  goal: [
    'GOOOL! Bola bersarang di gawang!',
    'GOOOL! Tendangan keras tak mampu dibendung kiper!',
    'GOOOL! Stadion bergemuruh!',
    'GOOOL! Gol indah! Gol indah!',
  ],
  fulltime: [
    'Peluit panjang dibunyikan! Pertandingan berakhir!',
    'Selesai! Laga yang luar biasa!',
  ],
  halftime: ['Turun minum! Skor sementara: '],
  kickoff2: ['Babak kedua dimulai!'],
};

export const pick = (arr) => arr[(Math.random() * arr.length) | 0];
