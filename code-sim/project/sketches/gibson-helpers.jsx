// Hackers / Gibson-inspired wireframe primitives.
// Dark void, neon line-art buildings, dense overlay HUDs, monospace labels.
// No fills — everything is silhouette + edges. Information density first.

const GB = {
  bg: '#05060a',
  bgGrid: 'rgba(80,200,255,0.05)',
  bgGridStrong: 'rgba(80,200,255,0.12)',
  cyan: '#5cf0ff',
  cyanDim: '#2a8a99',
  green: '#7dff8a',
  greenDim: '#2a7a35',
  amber: '#ffc04d',
  red: '#ff3a4a',
  redDim: '#8a1a22',
  magenta: '#ff5ce0',
  white: '#e8f4ff',
  ink: '#9ad8e8',
  inkFaint: 'rgba(154,216,232,0.45)',
  paper: '#0a0c12',
  mono: '"JetBrains Mono", "IBM Plex Mono", "Courier New", monospace',
  monoCond: '"JetBrains Mono", "Courier New", monospace',
};

if (typeof document !== 'undefined' && !document.getElementById('gb-styles')) {
  const s = document.createElement('style');
  s.id = 'gb-styles';
  s.textContent = `
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.gb-paper { background: ${GB.bg}; color: ${GB.ink}; font-family: ${GB.mono}; }
.gb-paper::before {
  content:''; position:absolute; inset:0; pointer-events:none;
  background-image:
    linear-gradient(${GB.bgGrid} 1px, transparent 1px),
    linear-gradient(90deg, ${GB.bgGrid} 1px, transparent 1px),
    linear-gradient(${GB.bgGridStrong} 1px, transparent 1px),
    linear-gradient(90deg, ${GB.bgGridStrong} 1px, transparent 1px);
  background-size: 12px 12px, 12px 12px, 60px 60px, 60px 60px;
  background-position: 0 0;
  z-index: 0;
}
.gb-paper::after {
  content:''; position:absolute; inset:0; pointer-events:none;
  background:
    radial-gradient(ellipse at 50% 50%, transparent 30%, rgba(0,0,0,.4) 100%);
  z-index: 1;
}
.gb-content { position:relative; z-index:2; }

.gb-glow-cyan { filter: drop-shadow(0 0 1.5px ${GB.cyan}) drop-shadow(0 0 4px rgba(92,240,255,.45)); }
.gb-glow-green { filter: drop-shadow(0 0 1.5px ${GB.green}) drop-shadow(0 0 4px rgba(125,255,138,.45)); }
.gb-glow-amber { filter: drop-shadow(0 0 1.5px ${GB.amber}) drop-shadow(0 0 4px rgba(255,192,77,.45)); }
.gb-glow-red { filter: drop-shadow(0 0 2px ${GB.red}) drop-shadow(0 0 6px rgba(255,58,74,.6)); }
.gb-glow-magenta { filter: drop-shadow(0 0 1.5px ${GB.magenta}) drop-shadow(0 0 4px rgba(255,92,224,.45)); }

@keyframes gb-blink { 0%,49%{opacity:1} 50%,100%{opacity:.25} }
.gb-blink { animation: gb-blink 1s steps(1) infinite; }

@keyframes gb-flash {
  0%, 100% { opacity: 0; }
  6% { opacity: .85; }
  12% { opacity: .15; }
  20% { opacity: .7; }
  40% { opacity: 0; }
}
.gb-flash { animation: gb-flash 1.4s ease-out infinite; }

@keyframes gb-vignette-flash {
  0%, 100% { opacity: 0; }
  10% { opacity: 1; }
  30% { opacity: .3; }
  50% { opacity: .8; }
  70% { opacity: 0; }
}
.gb-vignette { animation: gb-vignette-flash 2s ease-in-out infinite; }

@keyframes gb-beam {
  0%, 100% { opacity: .3; }
  50% { opacity: 1; }
}
.gb-beam { animation: gb-beam 1.2s ease-in-out infinite; }

@keyframes gb-hover {
  0%,100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}
.gb-ufo { animation: gb-hover 2.4s ease-in-out infinite; }

@keyframes gb-dash { to { stroke-dashoffset: -24; } }
.gb-dash-anim { animation: gb-dash 1.2s linear infinite; }

@keyframes gb-scan {
  0% { transform: translateY(-100%); }
  100% { transform: translateY(2000%); }
}
.gb-scan {
  position: absolute; left:0; right:0; height: 2px;
  background: linear-gradient(180deg, transparent, ${GB.cyan}, transparent);
  opacity: .35; pointer-events: none;
  animation: gb-scan 8s linear infinite;
}

@keyframes gb-ticker {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}
.gb-ticker-track { display: inline-flex; gap: 32px; animation: gb-ticker 40s linear infinite; white-space: nowrap; }
`;
  document.head.appendChild(s);
}

// Monospace label.
function M({ children, size=10, weight=400, color=GB.ink, style={}, ...rest }) {
  return (
    <span style={{ fontFamily: GB.mono, fontSize: size, fontWeight: weight, color,
      letterSpacing: '0.02em', lineHeight: 1, ...style }} {...rest}>{children}</span>
  );
}

// Iso-projection helpers (true isometric: 30° axes).
const ISO_X = [Math.cos(Math.PI/6), -Math.sin(Math.PI/6)]; // east axis on screen
const ISO_Y = [Math.cos(Math.PI/6),  Math.sin(Math.PI/6)]; // south axis on screen
function iso(x, y, z=0) {
  return [
    x*ISO_X[0] + y*ISO_Y[0],
    x*ISO_X[1] + y*ISO_Y[1] - z,
  ];
}

// Wireframe building (isometric box). Pure line, transparent fill.
// Footprint at (gx, gy) with size (gw, gd), height gh. All values in
// "grid units" (1 grid unit = 1 svg unit).
function GBuilding({ gx, gy, gw, gd, gh, color=GB.cyan, sw=1, dim=false, label=null, status=null, dashed=false }) {
  const c = dim ? GB.cyanDim : color;
  // 8 corners
  const A = iso(gx,        gy,        0);
  const B = iso(gx+gw,     gy,        0);
  const C = iso(gx+gw,     gy+gd,     0);
  const D = iso(gx,        gy+gd,     0);
  const A2= iso(gx,        gy,        gh);
  const B2= iso(gx+gw,     gy,        gh);
  const C2= iso(gx+gw,     gy+gd,     gh);
  const D2= iso(gx,        gy+gd,     gh);
  const ds = dashed ? '3 2' : null;

  // Hidden lines (back edges) — drawn with low opacity dashed.
  // Visible edges (front).
  const path = (pts, opacity=1, dash=null) =>
    <path d={pts.map((p,i)=> (i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}
      fill="none" stroke={c} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
      opacity={opacity} strokeDasharray={dash||ds||undefined}/>;

  // floor outline
  return (
    <g>
      {/* hidden back edges */}
      {path([B, C, C2], 0.35, '2 2')}
      {/* base */}
      {path([A, B, C, D, A], 0.85)}
      {/* verticals */}
      {path([A, A2], 1)}
      {path([B, B2], 1)}
      {path([D, D2], 1)}
      {/* top */}
      {path([A2, B2, C2, D2, A2], 1)}
      {/* a few cross-hatch "windows" — horizontal floor lines */}
      {gh > 8 && [...Array(Math.floor(gh/4))].map((_,i)=>{
        const z = (i+1)*4;
        if (z >= gh) return null;
        const F = iso(gx, gy, z), G = iso(gx+gw, gy, z);
        const H = iso(gx, gy+gd, z);
        return <g key={i} opacity="0.35">
          <path d={`M${F[0]},${F[1]} L${G[0]},${G[1]}`} stroke={c} strokeWidth="0.5"/>
          <path d={`M${F[0]},${F[1]} L${H[0]},${H[1]}`} stroke={c} strokeWidth="0.5"/>
        </g>;
      })}
      {/* status pip on roof */}
      {status && (() => {
        const p = iso(gx+gw/2, gy+gd/2, gh+1);
        const col = status==='err'?GB.red : status==='warn'?GB.amber : status==='ok'?GB.green : GB.cyan;
        return <g>
          <circle cx={p[0]} cy={p[1]} r="1.6" fill={col} className={status==='err'?'gb-blink':''}/>
        </g>;
      })()}
      {/* label hovering above */}
      {label && (() => {
        const p = iso(gx+gw/2, gy+gd/2, gh+4);
        return <text x={p[0]} y={p[1]} textAnchor="middle"
          fontFamily={GB.mono} fontSize="6" fill={c} opacity="0.85">{label}</text>;
      })()}
    </g>
  );
}

// Top-down 2D building (just a rectangle silhouette + label).
function GBuilding2D({ x, y, w, h, color=GB.cyan, label=null, sub=null, status=null, sw=1, dashed=false, fill=true }) {
  const dash = dashed ? '3 2' : null;
  return (
    <g>
      {fill && <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity="0.06" stroke="none"/>}
      <rect x={x} y={y} width={w} height={h} fill="none" stroke={color} strokeWidth={sw}
        strokeDasharray={dash||undefined} shapeRendering="crispEdges"/>
      {/* corner ticks */}
      {[[x,y],[x+w,y],[x+w,y+h],[x,y+h]].map(([cx,cy],i)=>(
        <g key={i}>
          <circle cx={cx} cy={cy} r="0.8" fill={color}/>
        </g>
      ))}
      {label && (
        <text x={x+3} y={y+9} fontFamily={GB.mono} fontSize="7" fontWeight="500" fill={color}>{label}</text>
      )}
      {sub && (
        <text x={x+3} y={y+17} fontFamily={GB.mono} fontSize="5.5" fill={color} opacity="0.65">{sub}</text>
      )}
      {status && (
        <circle cx={x+w-3.5} cy={y+3.5} r="1.6"
          fill={status==='err'?GB.red:status==='warn'?GB.amber:status==='ok'?GB.green:color}
          className={status==='err'?'gb-blink':''}/>
      )}
    </g>
  );
}

// UFO agent — wireframe diamond/saucer. cx,cy is screen pixels.
function GUfo({ cx, cy, color=GB.amber, label=null, beamTo=null, beamColor=null, sw=1, animate=true, idTag=null }) {
  const r = 9;
  const beamCol = beamColor || color;
  return (
    <g className={animate?'gb-ufo':''}>
      {beamTo && (
        <g className="gb-beam">
          <path d={`M${cx-r*0.7},${cy+1} L${beamTo[0]-4},${beamTo[1]} L${beamTo[0]+4},${beamTo[1]} L${cx+r*0.7},${cy+1} Z`}
            fill={beamCol} fillOpacity="0.10" stroke={beamCol} strokeWidth="0.5" strokeDasharray="2 1.5"/>
        </g>
      )}
      <g>
        {/* dome */}
        <path d={`M${cx-r*0.5},${cy-1} Q${cx},${cy-r*0.7} ${cx+r*0.5},${cy-1}`}
          fill="none" stroke={color} strokeWidth={sw}/>
        {/* body — flat diamond profile */}
        <path d={`M${cx-r},${cy+1} L${cx-r*0.6},${cy-1} L${cx+r*0.6},${cy-1} L${cx+r},${cy+1} L${cx+r*0.6},${cy+3} L${cx-r*0.6},${cy+3} Z`}
          fill="none" stroke={color} strokeWidth={sw}/>
        {/* center line */}
        <path d={`M${cx-r},${cy+1} L${cx+r},${cy+1}`} stroke={color} strokeWidth={sw*0.6} opacity="0.7"/>
        {/* lights */}
        <circle cx={cx-r*0.55} cy={cy+2} r="0.7" fill={color}/>
        <circle cx={cx} cy={cy+2.2} r="0.7" fill={color}/>
        <circle cx={cx+r*0.55} cy={cy+2} r="0.7" fill={color}/>
      </g>
      {label && (
        <g>
          <text x={cx+r+3} y={cy} fontFamily={GB.mono} fontSize="6" fontWeight="600" fill={color}>{label}</text>
          {idTag && <text x={cx+r+3} y={cy+6} fontFamily={GB.mono} fontSize="5" fill={color} opacity="0.7">{idTag}</text>}
        </g>
      )}
    </g>
  );
}

// Leader line + tag (annotation).
function Leader({ from, to, color=GB.cyan, label, side='right', sw=0.8 }) {
  const [x1,y1] = from, [x2,y2] = to;
  return (
    <g>
      <path d={`M${x1},${y1} L${x2},${y2}`} stroke={color} strokeWidth={sw} fill="none"/>
      <circle cx={x1} cy={y1} r="1" fill={color}/>
      <circle cx={x2} cy={y2} r="1.2" fill="none" stroke={color} strokeWidth={sw}/>
      {label && (
        <text x={x2 + (side==='right'?3:-3)} y={y2+2}
          textAnchor={side==='right'?'start':'end'}
          fontFamily={GB.mono} fontSize="6" fill={color}>{label}</text>
      )}
    </g>
  );
}

// Ticker bar (horizontal scrolling text strip).
function Ticker({ items, color=GB.cyan, prefix='> ', height=18 }) {
  const repeated = [...items, ...items];
  return (
    <div style={{
      position:'relative', height, overflow:'hidden',
      borderTop:`1px solid ${color}40`, borderBottom:`1px solid ${color}40`,
      fontFamily: GB.mono, fontSize: 9, color, lineHeight: `${height}px`,
      whiteSpace:'nowrap',
    }}>
      <div className="gb-ticker-track">
        {repeated.map((t,i)=>(
          <span key={i} style={{display:'inline-flex', gap:6}}>
            <span style={{opacity:.5}}>{prefix}</span>{t}
          </span>
        ))}
      </div>
    </div>
  );
}

// HUD panel (bordered, titled, content slot).
function Panel({ title, sub, children, color=GB.cyan, style={}, dense=true, corner='all' }) {
  return (
    <div style={{
      position:'relative', border:`1px solid ${color}`, color,
      fontFamily: GB.mono, fontSize: 10, padding: dense?'4px 6px':'6px 8px',
      background:'rgba(5,8,14,0.65)',
      ...style,
    }}>
      {/* corner brackets */}
      {['tl','tr','bl','br'].map(c => (corner==='all'||corner===c) && (
        <span key={c} style={{
          position:'absolute', width:6, height:6, borderColor:color, borderStyle:'solid', borderWidth:0,
          ...(c[0]==='t'?{top:-1, borderTopWidth:1.5}:{bottom:-1, borderBottomWidth:1.5}),
          ...(c[1]==='l'?{left:-1, borderLeftWidth:1.5}:{right:-1, borderRightWidth:1.5}),
        }}/>
      ))}
      {title && (
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline',
          borderBottom:`1px solid ${color}40`, paddingBottom:2, marginBottom:4,
          fontSize:9, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase'}}>
          <span>{title}</span>
          {sub && <span style={{opacity:.6, fontWeight:400, textTransform:'none', letterSpacing:0}}>{sub}</span>}
        </div>
      )}
      {children}
    </div>
  );
}

// Coordinate readout / stat row.
function Stat({ k, v, color=GB.ink, vColor=null }) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', gap:8, fontSize:9, lineHeight:1.5, color}}>
      <span style={{opacity:.55}}>{k}</span>
      <span style={{color: vColor||color, fontWeight:500, fontVariantNumeric:'tabular-nums'}}>{v}</span>
    </div>
  );
}

Object.assign(window, { GB, M, iso, GBuilding, GBuilding2D, GUfo, Leader, Ticker, Panel, Stat });
