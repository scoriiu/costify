export type CostiState =
  | "greeting"
  | "thinking"
  | "success"
  | "alert"
  | "error"
  | "working"
  | "celebrating"
  | "sleeping"
  | "teaching";

interface CostiMascotProps {
  state?: CostiState;
  size?: number;
  className?: string;
}

const SKIN = "#D4A574";
const SKIN_DARK = "#C4956A";
const BEARD = "#3E2723";
const HAIR = "#2C1F1A";
const GLASSES = "#37474F";
const JACKET = "#2D2D4E";
const JACKET_SHADOW = "#1A1A2E";
const COLLAR = "#F0F6FC";
const DARK_3 = "#21262D";
const DARK = "#0D1117";
const PRIMARY = "#6C5CE7";
const ACCENT = "#00B894";
const WARN = "#FDCB6E";
const GRAY = "#8B949E";
const WHITE = "#F0F6FC";
const MOUTH = "#A0522D";

function Base({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* Jacket */}
      <path d="M50 105 Q50 95 60 95 L100 95 Q110 95 110 105 L112 155 Q112 160 107 160 L53 160 Q48 160 48 155 Z" fill={JACKET} stroke={JACKET_SHADOW} strokeWidth={1} />
      {/* Collar */}
      <polygon points="70,95 80,110 90,95" fill={COLLAR} opacity={0.9} />
      {/* Neck */}
      <rect x={72} y={86} width={16} height={14} rx={3} fill={SKIN} />
      {children}
    </>
  );
}

function Head({ children }: { children?: React.ReactNode }) {
  return (
    <>
      <path d="M50 55 Q50 25 80 22 Q110 25 110 55 L108 72 Q105 88 80 90 Q55 88 52 72 Z" fill={SKIN} />
      <path d="M58 68 Q58 88 80 90 Q102 88 102 68 L100 75 Q98 85 80 87 Q62 85 60 75 Z" fill={BEARD} opacity={0.85} />
      <path d="M68 68 Q74 72 80 68 Q86 72 92 68" stroke={BEARD} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M52 45 Q50 22 80 18 Q110 22 108 45 L105 38 Q103 26 80 24 Q57 26 55 38 Z" fill={HAIR} />
      <rect x={51} y={48} width={5} height={14} rx={2} fill={HAIR} />
      <rect x={104} y={48} width={5} height={14} rx={2} fill={HAIR} />
      {children}
    </>
  );
}

function Glasses({ y = 50 }: { y?: number }) {
  return (
    <>
      <rect x={58} y={y} width={20} height={14} rx={3} stroke={GLASSES} strokeWidth={2.5} fill="none" />
      <rect x={82} y={y} width={20} height={14} rx={3} stroke={GLASSES} strokeWidth={2.5} fill="none" />
      <line x1={78} y1={y + 6} x2={82} y2={y + 6} stroke={GLASSES} strokeWidth={2.5} />
      <line x1={58} y1={y + 4} x2={53} y2={y} stroke={GLASSES} strokeWidth={2} />
      <line x1={102} y1={y + 4} x2={107} y2={y} stroke={GLASSES} strokeWidth={2} />
    </>
  );
}

function Brows() {
  return (
    <>
      <path d="M59 46 Q64 43 77 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
      <path d="M83 46 Q96 43 101 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </>
  );
}

function Greeting() {
  return (
    <Base>
      <Head>
        <Glasses />
        <ellipse cx={68} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <ellipse cx={92} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <circle cx={69.5} cy={56} r={1.2} fill="white" />
        <circle cx={93.5} cy={56} r={1.2} fill="white" />
        <Brows />
        <path d="M72 76 Q80 80 90 76" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </Head>
      {/* Left arm waving (his left, our right) */}
      <g>
        {/* Upper arm sleeve — curves outward from shoulder */}
        <path d="M110 100 Q122 105 128 92" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        {/* Forearm — curves upward */}
        <path d="M128 92 Q134 78 130 56" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
        {/* Palm — tilted */}
        <g transform="rotate(-20, 130, 52)">
          <rect x={122} y={44} width={14} height={11} rx={4} fill={SKIN} />
          {/* Fingers — spread naturally */}
          <rect x={121} y={36} width={3.2} height={10} rx={1.6} fill={SKIN} />
          <rect x={125} y={34} width={3.2} height={12} rx={1.6} fill={SKIN} />
          <rect x={129} y={34} width={3.2} height={12} rx={1.6} fill={SKIN} />
          <rect x={133} y={36} width={3.2} height={10} rx={1.6} fill={SKIN} />
          {/* Thumb — angled out */}
          <rect x={117} y={47} width={7} height={3.2} rx={1.6} fill={SKIN} />
        </g>
      </g>
      {/* Right arm relaxed (his right, our left) */}
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
    </Base>
  );
}

function Thinking() {
  return (
    <Base>
      <Head>
        <Glasses />
        <ellipse cx={70} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <ellipse cx={94} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <circle cx={71.5} cy={56.5} r={1.2} fill="white" />
        <circle cx={95.5} cy={56.5} r={1.2} fill="white" />
        <Brows />
        <line x1={74} y1={77} x2={86} y2={77} stroke={MOUTH} strokeWidth={1.5} strokeLinecap="round" />
      </Head>
      {/* Hand on chin */}
      <rect x={36} y={95} width={12} height={20} rx={6} fill={JACKET} />
      <path d="M42 68 L42 98" stroke={SKIN} strokeWidth={10} strokeLinecap="round" />
      <circle cx={42} cy={66} r={5} fill={SKIN} />
      <rect x={112} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={114} y={138} width={9} height={12} rx={4} fill={SKIN} />
      {/* Thought dots */}
      <circle cx={128} cy={38} r={3} fill={DARK_3} />
      <circle cx={136} cy={26} r={4.5} fill={DARK_3} />
      <circle cx={140} cy={12} r={2.5} fill={DARK_3} />
    </Base>
  );
}

function Success() {
  return (
    <Base>
      <Head>
        <Glasses />
        <path d="M62 57 Q68 52 74 57" stroke="#1A1A1A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M86 57 Q92 52 98 57" stroke="#1A1A1A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Brows />
        <path d="M72 76 Q80 82 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      {/* Upper arms */}
      <rect x={36} y={98} width={14} height={28} rx={6} fill={JACKET} />
      <rect x={110} y={98} width={14} height={28} rx={6} fill={JACKET} />
      {/* Left forearm crossing over (behind right) */}
      <path d="M50 110 Q58 106 80 108 Q95 110 105 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      {/* Right forearm crossing over (on top) */}
      <path d="M110 110 Q100 106 80 108 Q62 110 52 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      {/* Left hand gripping right upper arm */}
      <ellipse cx={105} cy={118} rx={7} ry={5} fill={SKIN} />
      <ellipse cx={108} cy={116} rx={3} ry={4} fill={SKIN} />
      {/* Right hand gripping left upper arm */}
      <ellipse cx={55} cy={118} rx={7} ry={5} fill={SKIN} />
      <ellipse cx={52} cy={116} rx={3} ry={4} fill={SKIN} />
      {/* Checkmark */}
      <g transform="translate(125, 75)">
        <circle cx={12} cy={12} r={12} fill={ACCENT} opacity={0.2} />
        <path d="M7 12 L10.5 15.5 L17 9" stroke={ACCENT} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </Base>
  );
}

function Alert() {
  return (
    <Base>
      <Head>
        <Glasses />
        {/* Raised eyebrow */}
        <path d="M59 44 Q64 41 77 45" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M83 46 Q96 43 101 46" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <ellipse cx={68} cy={57} rx={3.5} ry={4} fill="#1A1A1A" />
        <ellipse cx={92} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <circle cx={69.5} cy={56} r={1.3} fill="white" />
        <circle cx={93.5} cy={56} r={1.2} fill="white" />
        <line x1={74} y1={77} x2={86} y2={77} stroke={MOUTH} strokeWidth={2} strokeLinecap="round" />
      </Head>
      {/* Pointing — arm extended */}
      <rect x={112} y={92} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={112} y={85} width={10} height={16} rx={5} fill={SKIN} />
      <rect x={120} y={82} width={22} height={6} rx={3} fill={SKIN} />
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
      {/* Warning triangle */}
      <g transform="translate(134, 64)">
        <polygon points="10,0 20,18 0,18" fill={WARN} stroke={DARK} strokeWidth={1} />
        <line x1={10} y1={5} x2={10} y2={11} stroke={DARK} strokeWidth={2} strokeLinecap="round" />
        <circle cx={10} cy={15} r={1.2} fill={DARK} />
      </g>
    </Base>
  );
}

function Error() {
  return (
    <Base>
      <Head>
        {/* Glasses pushed up */}
        <Glasses y={38} />
        <line x1={62} y1={57} x2={75} y2={57} stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" />
        <line x1={85} y1={57} x2={98} y2={57} stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M61 50 Q68 47 75 51" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M85 51 Q92 47 99 50" stroke={HAIR} strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M74 77 Q80 74 86 77" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </Head>
      {/* Pinching bridge of nose */}
      <rect x={36} y={95} width={12} height={18} rx={6} fill={JACKET} />
      <rect x={44} y={52} width={8} height={15} rx={4} fill={SKIN} />
      <circle cx={48} cy={50} r={4} fill={SKIN} />
      <rect x={112} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={114} y={138} width={9} height={12} rx={4} fill={SKIN} />
    </Base>
  );
}

function Working() {
  return (
    <Base>
      <Head>
        <Glasses />
        <ellipse cx={68} cy={59} rx={3} ry={2.5} fill="#1A1A1A" />
        <ellipse cx={92} cy={59} rx={3} ry={2.5} fill="#1A1A1A" />
        <Brows />
        <line x1={74} y1={77} x2={86} y2={76} stroke={MOUTH} strokeWidth={1.5} strokeLinecap="round" />
      </Head>
      {/* Laptop */}
      <rect x={52} y={135} width={56} height={32} rx={3} fill={DARK_3} />
      <rect x={55} y={138} width={50} height={24} rx={2} fill={DARK} />
      <rect x={60} y={143} width={20} height={2.5} rx={1} fill={PRIMARY} opacity={0.5} />
      <rect x={60} y={148} width={15} height={2.5} rx={1} fill={ACCENT} opacity={0.4} />
      <rect x={60} y={153} width={25} height={2.5} rx={1} fill={PRIMARY} opacity={0.3} />
      <rect x={42} y={165} width={76} height={5} rx={2} fill={DARK_3} />
      {/* Hands on laptop */}
      <rect x={38} y={100} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={42} y={128} width={14} height={10} rx={5} fill={SKIN} />
      <rect x={110} y={100} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={104} y={128} width={14} height={10} rx={5} fill={SKIN} />
    </Base>
  );
}

function Celebrating() {
  return (
    <Base>
      <Head>
        <Glasses />
        <path d="M62 57 Q68 52 74 57" stroke="#1A1A1A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <path d="M86 57 Q92 52 98 57" stroke="#1A1A1A" strokeWidth={2.5} fill="none" strokeLinecap="round" />
        <Brows />
        <path d="M70 76 Q80 84 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      {/* Right arm */}
      <rect x={112} y={92} width={12} height={28} rx={6} fill={JACKET} />
      {/* Coffee cup */}
      <rect x={118} y={72} width={16} height={18} rx={3} fill={WHITE} opacity={0.9} />
      <rect x={118} y={70} width={16} height={4} rx={2} fill={GRAY} opacity={0.3} />
      <path d="M134 78 Q140 78 140 84 Q140 90 134 90" stroke={WHITE} strokeWidth={2} fill="none" opacity={0.6} />
      {/* Hand wrapping cup */}
      <path d="M116 76 Q114 76 114 80 L114 88 Q114 90 116 90" stroke={SKIN} strokeWidth={7} fill="none" strokeLinecap="round" />
      <path d="M132 76 Q134 76 134 80 L134 86 Q134 88 132 88" stroke={SKIN} strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* Thumb */}
      <ellipse cx={116} cy={78} rx={4} ry={3} fill={SKIN} />
      {/* Steam */}
      <path d="M124 66 Q126 60 124 54" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.3} />
      <path d="M129 68 Q131 62 129 56" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.2} />
      {/* Right arm relaxed */}
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
    </Base>
  );
}

function Sleeping() {
  return (
    <Base>
      <g transform="rotate(10, 80, 60)">
        <path d="M50 55 Q50 25 80 22 Q110 25 110 55 L108 72 Q105 88 80 90 Q55 88 52 72 Z" fill={SKIN} />
        <path d="M58 68 Q58 88 80 90 Q102 88 102 68 L100 75 Q98 85 80 87 Q62 85 60 75 Z" fill={BEARD} opacity={0.85} />
        <path d="M68 68 Q74 72 80 68 Q86 72 92 68" stroke={BEARD} strokeWidth={3} fill="none" strokeLinecap="round" />
        <path d="M52 45 Q50 22 80 18 Q110 22 108 45 L105 38 Q103 26 80 24 Q57 26 55 38 Z" fill={HAIR} />
        <rect x={51} y={48} width={5} height={14} rx={2} fill={HAIR} />
        <rect x={104} y={48} width={5} height={14} rx={2} fill={HAIR} />
        <Glasses />
        <line x1={62} y1={57} x2={74} y2={57} stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
        <line x1={86} y1={57} x2={98} y2={57} stroke="#1A1A1A" strokeWidth={2} strokeLinecap="round" />
        <path d="M74 76 Q80 78 86 76" stroke={MOUTH} strokeWidth={1.5} fill="none" strokeLinecap="round" />
      </g>
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
      <rect x={112} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={114} y={138} width={9} height={12} rx={4} fill={SKIN} />
      <text x={118} y={35} fontSize={16} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.5}>Z</text>
      <text x={130} y={22} fontSize={12} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.35}>z</text>
      <text x={138} y={12} fontSize={9} fill={GRAY} fontWeight={800} fontFamily="Inter" opacity={0.2}>z</text>
    </Base>
  );
}

function Teaching() {
  return (
    <Base>
      <Head>
        <Glasses />
        <ellipse cx={68} cy={57} rx={3} ry={3.5} fill="#1A1A1A" />
        <circle cx={69.5} cy={56} r={1.2} fill="white" />
        {/* Wink */}
        <line x1={86} y1={57} x2={98} y2={55} stroke="#1A1A1A" strokeWidth={2.5} strokeLinecap="round" />
        <Brows />
        <path d="M72 76 Q80 80 90 76" stroke={MOUTH} strokeWidth={2} fill="none" strokeLinecap="round" />
      </Head>
      {/* Right arm — index finger up */}
      <rect x={112} y={88} width={12} height={30} rx={6} fill={JACKET} />
      <rect x={114} y={80} width={10} height={14} rx={5} fill={SKIN} />
      <rect x={117} y={64} width={5} height={20} rx={2.5} fill={SKIN} />
      {/* Left arm — sleeve from shoulder, curving to clipboard */}
      <path d="M42 100 Q42 118 30 120" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M42 100 Q42 118 30 120" stroke={JACKET_SHADOW} strokeWidth={14} fill="none" strokeLinecap="round" opacity={0.15} />
      {/* Clipboard */}
      <rect x={4} y={98} width={28} height={38} rx={3} fill={WHITE} opacity={0.9} />
      <rect x={6} y={96} width={24} height={4} rx={2} fill={DARK_3} />
      <rect x={9} y={104} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.5} />
      <rect x={9} y={110} width={12} height={2} rx={1} fill={PRIMARY} opacity={0.3} />
      <rect x={9} y={116} width={14} height={2} rx={1} fill={ACCENT} opacity={0.4} />
      <rect x={9} y={122} width={10} height={2} rx={1} fill={PRIMARY} opacity={0.2} />
      <rect x={9} y={128} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.15} />
      {/* Palm gripping clipboard */}
      <rect x={26} y={110} width={7} height={14} rx={3} fill={SKIN} />
      {/* Thumb */}
      <ellipse cx={29} cy={109} rx={3} ry={2.5} fill={SKIN} />
      {/* Fingers over far edge */}
      <circle cx={5} cy={112} r={2.5} fill={SKIN} />
      <circle cx={4} cy={118} r={2.5} fill={SKIN} />
      <circle cx={5} cy={124} r={2.5} fill={SKIN} />
    </Base>
  );
}

const STATE_MAP: Record<CostiState, () => React.ReactElement> = {
  greeting: Greeting,
  thinking: Thinking,
  success: Success,
  alert: Alert,
  error: Error,
  working: Working,
  celebrating: Celebrating,
  sleeping: Sleeping,
  teaching: Teaching,
};

export function CostiMascot({ state = "greeting", size = 120, className }: CostiMascotProps) {
  const StateComponent = STATE_MAP[state];
  return (
    <svg
      width={size}
      height={size * 1.1875}
      viewBox="0 0 160 190"
      fill="none"
      className={className}
    >
      <StateComponent />
    </svg>
  );
}
