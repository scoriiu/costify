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
      {/* Pointing arm (his left, our right) */}
      <rect x={112} y={92} width={12} height={30} rx={6} fill={JACKET} />
      {/* Hand — fist with index finger */}
      <rect x={114} y={85} width={10} height={11} rx={5} fill={SKIN} />
      {/* Index finger pointing */}
      <rect x={122} y={84} width={14} height={4} rx={2} fill={SKIN} />
      <circle cx={136} cy={86} r={2.2} fill={SKIN} />
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
      {/* Warning triangle — near fingertip */}
      <g transform="translate(120, 60)">
        <polygon points="12,0 24,22 0,22" fill={WARN} stroke={DARK} strokeWidth={1} />
        <line x1={12} y1={6} x2={12} y2={13} stroke={DARK} strokeWidth={2.5} strokeLinecap="round" />
        <circle cx={12} cy={18} r={1.5} fill={DARK} />
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
      {/* Left hand pinching nose bridge (his right, our left) */}
      <g>
        <path d="M50 100 Q42 98 38 90" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        <path d="M38 90 Q36 78 42 64" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
        {/* Thumb on left side of bridge */}
        <ellipse cx={54} cy={54} rx={3} ry={2.2} fill={SKIN} />
        {/* Index finger on right side of bridge */}
        <ellipse cx={60} cy={52} rx={2.2} ry={3} fill={SKIN} />
        {/* Knuckles behind glasses */}
        <circle cx={50} cy={56} r={3.5} fill={SKIN} />
      </g>
      {/* Right arm relaxed (his left, our right) */}
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
      {/* Left arm relaxed (his right, our left) */}
      <rect x={36} y={100} width={12} height={42} rx={6} fill={JACKET} />
      <rect x={38} y={138} width={9} height={12} rx={4} fill={SKIN} />
      {/* Right arm — jacket sleeve curves out from shoulder */}
      <path d="M110 100 Q120 106 124 96" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      {/* Forearm — skin, angled to hold cup */}
      <path d="M124 96 Q128 88 126 80" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
      {/* Coffee cup — behind hand */}
      <rect x={116} y={68} width={18} height={22} rx={4} fill={WHITE} opacity={0.9} />
      <rect x={116} y={66} width={18} height={4} rx={2} fill={GRAY} opacity={0.3} />
      {/* Cup handle */}
      <path d="M134 74 Q141 74 141 81 Q141 88 134 88" stroke={WHITE} strokeWidth={2} fill="none" opacity={0.6} />
      {/* Hand gripping cup — fingers wrap the near side */}
      <rect x={114} y={74} width={5} height={14} rx={2.5} fill={SKIN} />
      {/* Finger tips curling over onto the front face */}
      <circle cx={118} cy={76} r={2.2} fill={SKIN} />
      <circle cx={118} cy={80} r={2.2} fill={SKIN} />
      <circle cx={118} cy={84} r={2.2} fill={SKIN} />
      {/* Thumb on far side */}
      <ellipse cx={132} cy={78} rx={2.5} ry={4} fill={SKIN} />
      {/* Steam */}
      <path d="M122 62 Q124 56 122 50" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.3} />
      <path d="M128 64 Q130 58 128 52" stroke={GRAY} strokeWidth={1.5} fill="none" strokeLinecap="round" opacity={0.2} />
      {/* Confetti */}
      <rect x={28} y={18} width={5} height={5} rx={1} fill={PRIMARY} opacity={0.6} transform="rotate(20, 30, 20)" />
      <rect x={48} y={8} width={4} height={4} rx={1} fill={ACCENT} opacity={0.5} transform="rotate(-15, 50, 10)" />
      <rect x={105} y={12} width={5} height={5} rx={1} fill={WARN} opacity={0.6} transform="rotate(35, 107, 14)" />
      <rect x={130} y={30} width={4} height={4} rx={1} fill="#E63946" opacity={0.5} transform="rotate(-25, 132, 32)" />
      <circle cx={40} cy={30} r={2.5} fill={WARN} opacity={0.4} />
      <circle cx={118} cy={20} r={2} fill={PRIMARY} opacity={0.45} />
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
      {/* Left arm — thumbs up (his left, our right) */}
      <g>
        {/* Upper arm sleeve — curves outward from shoulder */}
        <path d="M110 100 Q122 105 128 92" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
        {/* Forearm — curves upward */}
        <path d="M128 92 Q134 78 130 60" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
        {/* Fist — closed, same scale as greeting palm */}
        <g transform="rotate(-10, 130, 56)">
          <rect x={123} y={50} width={14} height={11} rx={5} fill={SKIN} />
          {/* Curled fingers */}
          <rect x={123} y={56} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={127} y={57} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={131} y={57} width={3.2} height={5} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          <rect x={135} y={56} width={3.2} height={4} rx={1.6} fill={SKIN_DARK} opacity={0.25} />
          {/* Thumb — pointing up, snug against fist */}
          <rect x={124} y={46} width={5} height={8} rx={2.5} fill={SKIN} />
          <ellipse cx={126.5} cy={46} rx={3} ry={2.2} fill={SKIN} />
        </g>
      </g>
      {/* Right arm holding notebook (his right, our left) */}
      <path d="M50 100 Q46 110 38 118" stroke={JACKET} strokeWidth={13} fill="none" strokeLinecap="round" />
      {/* Forearm — skin, angled to hold notebook */}
      <path d="M38 118 Q34 124 30 128" stroke={SKIN} strokeWidth={9} fill="none" strokeLinecap="round" />
      {/* Notebook */}
      <rect x={10} y={106} width={26} height={34} rx={3} fill={WHITE} opacity={0.9} />
      <rect x={12} y={110} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.5} />
      <rect x={12} y={115} width={12} height={2} rx={1} fill={PRIMARY} opacity={0.3} />
      <rect x={12} y={120} width={14} height={2} rx={1} fill={ACCENT} opacity={0.4} />
      <rect x={12} y={125} width={10} height={2} rx={1} fill={PRIMARY} opacity={0.2} />
      <rect x={12} y={130} width={16} height={2} rx={1} fill={PRIMARY} opacity={0.15} />
      {/* Hand gripping side — fingers wrap near edge (behind notebook) */}
      <rect x={34} y={114} width={5} height={14} rx={2.5} fill={SKIN} />
      {/* Finger tips curling over the near edge onto the front */}
      <circle cx={11} cy={116} r={2.2} fill={SKIN} />
      <circle cx={11} cy={121} r={2.2} fill={SKIN} />
      <circle cx={11} cy={126} r={2.2} fill={SKIN} />
      {/* Thumb on front face */}
      <ellipse cx={32} cy={118} rx={2.5} ry={4} fill={SKIN} />
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
