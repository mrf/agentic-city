// Shared sketchy primitives for all the SimCity wireframes.
// Hand-drawn vibe: ink lines, jittered rects, handwritten labels.

const SK = {
  ink: '#1a1612',
  inkSoft: '#3a342e',
  inkFaint: 'rgba(26,22,18,0.45)',
  paper: '#fbf8f1',
  paperDark: '#f1ece0',
  red: '#d23a2c',
  redSoft: 'rgba(210,58,44,0.18)',
  green: '#3a8c4a',
  amber: '#d4933a',
  blue: '#3a6ea8',
  hand: '"Caveat", "Architects Daughter", "Comic Sans MS", cursive',
  handTight: '"Architects Daughter", "Caveat", cursive',
  mono: '"JetBrains Mono", "Courier New", monospace',
};

// Inject sketchy filter once per doc.
if (typeof document !== 'undefined' && !document.getElementById('sk-styles')) {
  const s = document.createElement('style');
  s.id = 'sk-styles';
  s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Architects+Daughter&family=JetBrains+Mono:wght@400;500&display=swap');

.sk-paper {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(180,150,100,.04), transparent 60%),
    radial-gradient(ellipse at 70% 80%, rgba(180,150,100,.05), transparent 50%),
    ${SK.paper};
  background-size: cover;
}
.sk-paper::before {
  content: '';
  position: absolute; inset: 0;
  background-image:
    repeating-linear-gradient(0deg, rgba(0,0,0,.012) 0 1px, transparent 1px 3px),
    repeating-linear-gradient(90deg, rgba(0,0,0,.012) 0 1px, transparent 1px 3px);
  pointer-events: none;
}
.sk-rough { filter: url(#sk-rough); }
.sk-wob   { filter: url(#sk-wobble); }

@keyframes sk-flash {
  0%,100% { opacity:0; }
  10%,30% { opacity:.7; }
  20% { opacity:.3; }
  50% { opacity:.5; }
}
.sk-flash { animation: sk-flash 1.6s ease-in-out infinite; }

@keyframes sk-pulse {
  0%,100% { transform: scale(1); opacity:.9; }
  50% { transform: scale(1.06); opacity:1; }
}
.sk-pulse { animation: sk-pulse 1.8s ease-in-out infinite; }

@keyframes sk-beam {
  0%,100% { opacity:.4; }
  50% { opacity:.85; }
}
.sk-beam { animation: sk-beam 1.4s ease-in-out infinite; }

@keyframes sk-hover {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
}
.sk-ufo { animation: sk-hover 2.6s ease-in-out infinite; }

@keyframes sk-dash {
  to { stroke-dashoffset: -20; }
}
.sk-road-anim { animation: sk-dash 1.4s linear infinite; }
`;
  document.head.appendChild(s);
}

// SVG filter defs (jitter + wobble) — drop once per artboard.
function SkDefs() {
  return (
    <svg width="0" height="0" style={{position:'absolute'}} aria-hidden>
      <defs>
        <filter id="sk-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
          <feDisplacementMap in="SourceGraphic" scale="1.4"/>
        </filter>
        <filter id="sk-wobble" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="7"/>
          <feDisplacementMap in="SourceGraphic" scale="2.5"/>
        </filter>
      </defs>
    </svg>
  );
}

// A handwritten-looking text element.
function H({ children, size=18, weight=500, color=SK.ink, style={}, className='', ...rest }) {
  return (
    <span className={className}
      style={{ fontFamily: SK.hand, fontSize:size, fontWeight:weight, color, lineHeight:1.05, ...style }}
      {...rest}>{children}</span>
  );
}

// Sketchy rectangle (slightly irregular border, 2 strokes for depth).
function SkBox({ x, y, w, h, fill='transparent', stroke=SK.ink, sw=1.6, dash=null, rough=true, opacity=1, children }) {
  // Build a slightly-imperfect rect path.
  const j = (n) => n + (Math.random()-0.5)*0.8;
  const x1=x, y1=y, x2=x+w, y2=y+h;
  const d = `M${j(x1)},${j(y1)} L${j(x2)},${j(y1)} L${j(x2)},${j(y2)} L${j(x1)},${j(y2)} Z`;
  return (
    <g opacity={opacity} filter={rough?'url(#sk-rough)':undefined}>
      {fill !== 'transparent' && <path d={d} fill={fill} stroke="none"/>}
      <path d={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinejoin="round"
        strokeDasharray={dash||undefined} strokeLinecap="round"/>
      {children}
    </g>
  );
}

// Sketchy building (a box with windows). Height/width in svg units.
function Building({ x, y, w, h, label, windows='dense', tint=null, status=null, style={} }) {
  const top = y;
  const left = x;
  const right = x+w;
  const bottom = y+h;

  // Window grid
  const winRows = Math.max(1, Math.floor(h/14));
  const winCols = Math.max(1, Math.floor(w/12));
  const winSize = 5;
  const winsArr = [];
  if (windows !== 'none') {
    for (let r=0; r<winRows; r++) {
      for (let c=0; c<winCols; c++) {
        const wx = left + 6 + c*((w-12)/Math.max(1,winCols-1||1));
        const wy = top + 8 + r*((h-16)/Math.max(1,winRows-1||1));
        if (winCols === 1) continue;
        if (windows === 'sparse' && (r+c)%2===0) continue;
        winsArr.push(<rect key={`${r}-${c}`} x={wx-winSize/2} y={wy-winSize/2}
          width={winSize} height={winSize*0.7}
          fill={status==='idle' ? 'rgba(0,0,0,0.15)' : (status==='hot'? '#ffd76a' : '#3a6ea8')}
          opacity={Math.random()*0.5+0.5} rx={0.5}/>);
      }
    }
  }

  return (
    <g filter="url(#sk-rough)" style={style}>
      {/* shadow */}
      <path d={`M${left+3},${bottom+1} L${right+3},${bottom+1} L${right+1},${bottom+3} L${left+1},${bottom+3} Z`}
        fill="rgba(0,0,0,0.12)"/>
      {/* fill */}
      <path d={`M${left},${top} L${right},${top} L${right},${bottom} L${left},${bottom} Z`}
        fill={tint||SK.paperDark} stroke={SK.ink} strokeWidth="1.6" strokeLinejoin="round"/>
      {/* roof line */}
      <path d={`M${left+1},${top+0.5} L${right-1},${top+0.5}`} stroke={SK.ink} strokeWidth="0.8" opacity="0.6"/>
      {winsArr}
      {label && (
        <text x={left+w/2} y={bottom+12} textAnchor="middle"
          fontFamily={SK.handTight} fontSize="10" fill={SK.inkSoft}>{label}</text>
      )}
    </g>
  );
}

// UFO agent. cx, cy = saucer center. beamTo = optional [x,y] for beam target.
function UFO({ cx, cy, color=SK.blue, label=null, beamTo=null, animate=true }) {
  const r = 11;
  return (
    <g className={animate?'sk-ufo':''} style={{transformOrigin:`${cx}px ${cy}px`}}>
      {beamTo && (
        <g className="sk-beam">
          <path d={`M${cx-r*0.7},${cy+2} L${beamTo[0]-6},${beamTo[1]} L${beamTo[0]+6},${beamTo[1]} L${cx+r*0.7},${cy+2} Z`}
            fill={color} opacity="0.18"/>
          <path d={`M${cx-r*0.7},${cy+2} L${beamTo[0]-6},${beamTo[1]}`} stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6"/>
          <path d={`M${cx+r*0.7},${cy+2} L${beamTo[0]+6},${beamTo[1]}`} stroke={color} strokeWidth="0.8" strokeDasharray="2 2" opacity="0.6"/>
        </g>
      )}
      <g filter="url(#sk-rough)">
        {/* dome */}
        <path d={`M${cx-r*0.6},${cy-1} Q${cx},${cy-r*0.9} ${cx+r*0.6},${cy-1}`}
          fill="rgba(180,210,240,0.7)" stroke={SK.ink} strokeWidth="1.2"/>
        {/* saucer body */}
        <ellipse cx={cx} cy={cy+1} rx={r} ry={r*0.32} fill={color} stroke={SK.ink} strokeWidth="1.3"/>
        <ellipse cx={cx} cy={cy+1} rx={r*0.7} ry={r*0.18} fill="rgba(255,255,255,0.25)" stroke="none"/>
        {/* lights */}
        <circle cx={cx-r*0.6} cy={cy+1.5} r="1.1" fill="#ffd76a"/>
        <circle cx={cx} cy={cy+2} r="1.1" fill="#ffd76a"/>
        <circle cx={cx+r*0.6} cy={cy+1.5} r="1.1" fill="#ffd76a"/>
      </g>
      {label && (
        <text x={cx} y={cy-r-3} textAnchor="middle"
          fontFamily={SK.hand} fontSize="11" fontWeight="600" fill={SK.ink}>{label}</text>
      )}
    </g>
  );
}

// Sketchy arrow for callouts/annotations.
function Arrow({ from, to, curve=20, color=SK.red, sw=1.4 }) {
  const [x1,y1] = from;
  const [x2,y2] = to;
  const mx = (x1+x2)/2 + (y2-y1)*curve/100;
  const my = (y1+y2)/2 - (x2-x1)*curve/100;
  // arrowhead
  const ang = Math.atan2(y2-my, x2-mx);
  const ah = 7;
  const ax1 = x2 - ah*Math.cos(ang-0.4);
  const ay1 = y2 - ah*Math.sin(ang-0.4);
  const ax2 = x2 - ah*Math.cos(ang+0.4);
  const ay2 = y2 - ah*Math.sin(ang+0.4);
  return (
    <g filter="url(#sk-rough)">
      <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"/>
      <path d={`M${ax1},${ay1} L${x2},${y2} L${ax2},${ay2}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"/>
    </g>
  );
}

// Annotation post-it text (no rotate, no fill — just handwriting).
function Note({ x, y, children, color=SK.ink, size=15, w=null }) {
  return (
    <foreignObject x={x} y={y} width={w||180} height={80} style={{overflow:'visible'}}>
      <div style={{fontFamily:SK.hand, fontSize:size, color, lineHeight:1.15}}>
        {children}
      </div>
    </foreignObject>
  );
}

Object.assign(window, { SK, SkDefs, H, SkBox, Building, UFO, Arrow, Note });
