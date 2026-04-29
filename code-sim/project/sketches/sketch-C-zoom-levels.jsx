// SKETCH C — Zoom levels: function → file → module → codebase.
// 4 sub-views in one artboard showing how buildings combine as you zoom out.

function SketchC() {
  return (
    <div className="gb-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>
      <div className="gb-content" style={{position:'absolute', inset:0, padding:'8px 8px 0'}}>

        {/* header */}
        <div style={{height:24, display:'flex', alignItems:'center', gap:14,
          fontFamily:GB.mono, fontSize:9, color:GB.ink,
          borderBottom:`1px solid ${GB.cyan}40`, paddingBottom:4, marginBottom:6}}>
          <span style={{color:GB.cyan, fontWeight:700, letterSpacing:'0.15em'}}>◇ ZOOM LEVELS</span>
          <span style={{opacity:.55}}>buildings combine as you zoom out</span>
          <span style={{flex:1}}/>
          <span style={{opacity:.55}}>scroll-wheel · pinch · ⌘+/⌘−</span>
        </div>

        {/* 4-up grid */}
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gridTemplateRows:'1fr 1fr',
          gap:6, height:'calc(100% - 38px)'}}>

          {/* L1 — FUNCTION (most zoomed in) */}
          <Quad title="L1 · FUNCTION" sub="loginUser()" color={GB.amber} loc="284 LOC · session.ts">
            <svg viewBox="0 0 300 200" style={{width:'100%', height:'100%'}}>
              {/* function body as huge floor plan with rooms = blocks */}
              <rect x="20" y="20" width="260" height="160" fill={GB.amber} fillOpacity="0.04"
                stroke={GB.amber} strokeWidth="1.2"/>
              <text x="24" y="32" fontFamily={GB.mono} fontSize="8" fill={GB.amber}
                fontWeight="700">▸ loginUser(creds)</text>
              {/* sub-blocks: code blocks */}
              {[
                {x:30,y:42,w:120,h:34,l:'validate()', s:'ok'},
                {x:158,y:42,w:114,h:34,l:'hashPassword()', s:'ok'},
                {x:30,y:82,w:90,h:30,l:'lookupUser()', s:'ok'},
                {x:128,y:82,w:64,h:30,l:'compare()', s:'warn'},
                {x:200,y:82,w:72,h:30,l:'genToken()', s:'ok'},
                {x:30,y:118,w:140,h:32,l:'session.create()', s:'ok'},
                {x:178,y:118,w:94,h:32,l:'audit.log()', s:'ok'},
                {x:30,y:156,w:242,h:18,l:'return res', s:'ok'},
              ].map((b,i)=>{
                const c = b.s==='warn'?GB.red:GB.amber;
                return (
                  <g key={i}>
                    <rect x={b.x} y={b.y} width={b.w} height={b.h}
                      fill={c} fillOpacity="0.08" stroke={c} strokeWidth="0.8"/>
                    <text x={b.x+3} y={b.y+9} fontFamily={GB.mono} fontSize="6.5" fill={c}>{b.l}</text>
                    {b.s==='warn' && <circle cx={b.x+b.w-3} cy={b.y+3} r="1.2" fill={GB.red} className="gb-blink"/>}
                  </g>
                );
              })}
              {/* agent at function level */}
              <g transform="translate(180,98)" className="gb-ufo">
                <path d="M-3,-1 Q0,-4 3,-1" fill="none" stroke={GB.amber} strokeWidth="0.8"/>
                <path d="M-5,0 L-3,-1 L3,-1 L5,0 L3,1 L-3,1 Z" fill={GB.bg} stroke={GB.amber} strokeWidth="0.8"/>
                <text x="7" y="0" fontFamily={GB.mono} fontSize="5" fill={GB.amber}>A-01</text>
              </g>
            </svg>
          </Quad>

          {/* L2 — FILE */}
          <Quad title="L2 · FILE" sub="auth/" color={GB.cyan} loc="7 files · 1,632 LOC">
            <svg viewBox="0 0 300 200" style={{width:'100%', height:'100%'}}>
              <rect x="14" y="14" width="272" height="172" fill={GB.cyan} fillOpacity="0.025"
                stroke={GB.cyan} strokeWidth="1"/>
              <text x="18" y="26" fontFamily={GB.mono} fontSize="8" fill={GB.cyan}
                fontWeight="700" letterSpacing="0.1em">AUTH/</text>
              {[
                {x:24,y:36,w:60,h:40,l:'login.tsx', loc:284, s:'ok'},
                {x:88,y:36,w:50,h:34,l:'oauth.ts', loc:142, s:'ok'},
                {x:142,y:36,w:64,h:48,l:'session.ts', loc:412, s:'warn', agent:'A-01'},
                {x:210,y:36,w:64,h:34,l:'jwt.ts', loc:88, s:'ok'},
                {x:24,y:90,w:80,h:54,l:'middleware/', loc:520, s:'ok'},
                {x:108,y:90,w:74,h:54,l:'providers/', loc:380, s:'ok'},
                {x:186,y:90,w:88,h:54,l:'utils.ts', loc:96, s:'ok'},
              ].map((f,i)=>{
                const c = f.s==='warn'?GB.amber:GB.cyan;
                return (
                  <g key={i}>
                    <rect x={f.x} y={f.y} width={f.w} height={f.h}
                      fill={c} fillOpacity="0.06" stroke={c} strokeWidth="0.8"/>
                    {[[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([cx,cy],j)=>(
                      <circle key={j} cx={f.x+cx} cy={f.y+cy} r="0.6" fill={c}/>
                    ))}
                    <text x={f.x+3} y={f.y+8} fontFamily={GB.mono} fontSize="6" fill={c} fontWeight="500">{f.l}</text>
                    <text x={f.x+3} y={f.y+f.h-3} fontFamily={GB.mono} fontSize="5" fill={c} opacity="0.6">{f.loc} LOC</text>
                    {f.agent && (
                      <g transform={`translate(${f.x+f.w/2},${f.y+f.h/2})`} className="gb-ufo">
                        <path d="M-2,-1 Q0,-3 2,-1" fill="none" stroke={GB.amber} strokeWidth="0.7"/>
                        <path d="M-3.5,0 L-2,-1 L2,-1 L3.5,0 L2,0.7 L-2,0.7 Z" fill={GB.bg} stroke={GB.amber} strokeWidth="0.7"/>
                      </g>
                    )}
                  </g>
                );
              })}
              <text x="270" y="178" textAnchor="end" fontFamily={GB.mono} fontSize="6" fill={GB.cyan} opacity="0.6">1 agent on-site</text>
            </svg>
          </Quad>

          {/* L3 — MODULE */}
          <Quad title="L3 · MODULE" sub="all districts" color={GB.cyan} loc="5 modules · 86,420 LOC">
            <svg viewBox="0 0 300 200" style={{width:'100%', height:'100%'}}>
              {[
                {x:18,y:18,w:80,h:60,l:'AUTH/', n:7, s:'warn'},
                {x:104,y:18,w:128,h:60,l:'API/', n:8, s:'err'},
                {x:238,y:18,w:48,h:60,l:'CFG/', n:3, s:'ok'},
                {x:18,y:84,w:128,h:54,l:'UI/', n:10, s:'warn'},
                {x:152,y:84,w:90,h:54,l:'DATA/', n:6, s:'ok'},
                {x:248,y:84,w:38,h:54,l:'LIB/', n:4, s:'ok'},
                {x:18,y:144,w:268,h:38,l:'TESTS/', n:8, s:'err'},
              ].map((d,i)=>{
                const c = d.s==='err'?GB.red : d.s==='warn'?GB.amber : GB.cyan;
                return (
                  <g key={i}>
                    {d.s==='err' && (
                      <rect x={d.x} y={d.y} width={d.w} height={d.h}
                        fill={GB.red} fillOpacity="0.18" className="gb-flash"/>
                    )}
                    <rect x={d.x} y={d.y} width={d.w} height={d.h}
                      fill={c} fillOpacity="0.05" stroke={c} strokeWidth="1"/>
                    {/* hatched windows pattern (representing combined buildings) */}
                    {[...Array(Math.floor(d.w/8))].map((_,j)=>(
                      <path key={`v${j}`} d={`M${d.x+8+j*8},${d.y+4} L${d.x+8+j*8},${d.y+d.h-4}`}
                        stroke={c} strokeWidth="0.3" opacity="0.3"/>
                    ))}
                    <text x={d.x+4} y={d.y+10} fontFamily={GB.mono} fontSize="8" fontWeight="700"
                      fill={c} letterSpacing="0.1em">{d.l}</text>
                    <text x={d.x+d.w-3} y={d.y+10} textAnchor="end" fontFamily={GB.mono} fontSize="6" fill={c} opacity="0.65">{d.n} files</text>
                    {/* mini agents */}
                    {d.s !== 'ok' && (
                      <circle cx={d.x+d.w-6} cy={d.y+d.h-5} r="1.5"
                        fill={d.s==='err'?GB.red:GB.amber} className="gb-blink"/>
                    )}
                  </g>
                );
              })}
              {/* agent dots scattered */}
              {[[58,46],[140,46],[268,38],[80,108],[180,108],[260,108],[60,162],[180,162]].map(([x,y],i)=>(
                <g key={i} transform={`translate(${x},${y})`} className="gb-ufo">
                  <path d="M-2,-0.5 Q0,-2 2,-0.5" fill="none" stroke={[GB.amber,GB.red,GB.cyan,GB.green,GB.cyan,GB.cyan,GB.red,GB.magenta][i]} strokeWidth="0.6"/>
                  <path d="M-3,0.5 L-2,-0.5 L2,-0.5 L3,0.5 L2,1.2 L-2,1.2 Z"
                    fill={GB.bg} stroke={[GB.amber,GB.red,GB.cyan,GB.green,GB.cyan,GB.cyan,GB.red,GB.magenta][i]} strokeWidth="0.6"/>
                </g>
              ))}
            </svg>
          </Quad>

          {/* L4 — CODEBASE */}
          <Quad title="L4 · CODEBASE" sub="orbit view" color={GB.cyan} loc="full repo · god mode">
            <svg viewBox="0 0 300 200" style={{width:'100%', height:'100%'}}>
              {/* concentric rings */}
              {[60,80,100].map(r=>(
                <circle key={r} cx="150" cy="100" r={r} fill="none" stroke={GB.cyan}
                  strokeWidth="0.4" strokeDasharray="2 3" opacity="0.4"/>
              ))}
              <circle cx="150" cy="100" r="42" fill={GB.cyan} fillOpacity="0.1" stroke={GB.cyan} strokeWidth="1"/>
              <text x="150" y="98" textAnchor="middle" fontFamily={GB.mono} fontSize="9"
                fontWeight="700" fill={GB.cyan} letterSpacing="0.15em">CORE</text>
              <text x="150" y="108" textAnchor="middle" fontFamily={GB.mono} fontSize="6"
                fill={GB.cyan} opacity="0.6">86,420 LOC</text>
              {/* satellite modules */}
              {[
                {a:-90, l:'AUTH', s:'warn'},
                {a:-30, l:'API', s:'err'},
                {a:30, l:'DATA', s:'ok'},
                {a:90, l:'TESTS', s:'err'},
                {a:150, l:'UI', s:'warn'},
                {a:210, l:'LIB', s:'ok'},
              ].map((m,i)=>{
                const rad = (m.a*Math.PI)/180;
                const x = 150 + Math.cos(rad)*80;
                const y = 100 + Math.sin(rad)*60;
                const c = m.s==='err'?GB.red : m.s==='warn'?GB.amber : GB.cyan;
                return (
                  <g key={i}>
                    <path d={`M${150+Math.cos(rad)*42},${100+Math.sin(rad)*32} L${x},${y}`}
                      stroke={GB.cyan} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.5"/>
                    <circle cx={x} cy={y} r="14" fill={c} fillOpacity="0.06" stroke={c} strokeWidth="1"/>
                    {m.s==='err' && <circle cx={x} cy={y} r="14" fill={GB.red} fillOpacity="0.25" className="gb-flash"/>}
                    <text x={x} y={y+1} textAnchor="middle" fontFamily={GB.mono} fontSize="7"
                      fontWeight="700" fill={c}>{m.l}</text>
                    {m.s!=='ok' && <circle cx={x+11} cy={y-9} r="1.5" fill={c} className={m.s==='err'?'gb-blink':''}/>}
                  </g>
                );
              })}
              {/* agents orbiting */}
              {[0,72,144,216,288].map((a,i)=>{
                const rad = (a*Math.PI)/180;
                const x = 150 + Math.cos(rad)*100;
                const y = 100 + Math.sin(rad)*78;
                const c = [GB.amber,GB.red,GB.green,GB.cyan,GB.magenta][i];
                return (
                  <g key={i} transform={`translate(${x},${y})`} className="gb-ufo">
                    <path d="M-2,-0.5 Q0,-2 2,-0.5" fill="none" stroke={c} strokeWidth="0.6"/>
                    <path d="M-3,0.5 L-2,-0.5 L2,-0.5 L3,0.5 L2,1.2 L-2,1.2 Z" fill={GB.bg} stroke={c} strokeWidth="0.6"/>
                  </g>
                );
              })}
              <text x="150" y="190" textAnchor="middle" fontFamily={GB.mono} fontSize="6" fill={GB.cyan} opacity="0.6">
                5 agents · orbital view
              </text>
            </svg>
          </Quad>
        </div>
      </div>
    </div>
  );
}

function Quad({ title, sub, color, loc, children }) {
  return (
    <div style={{position:'relative', border:`1px solid ${color}80`, padding:'4px',
      background:'rgba(5,8,14,0.5)', display:'flex', flexDirection:'column'}}>
      {['tl','tr','bl','br'].map(c => (
        <span key={c} style={{
          position:'absolute', width:8, height:8, borderColor:color, borderStyle:'solid', borderWidth:0,
          ...(c[0]==='t'?{top:-1, borderTopWidth:2}:{bottom:-1, borderBottomWidth:2}),
          ...(c[1]==='l'?{left:-1, borderLeftWidth:2}:{right:-1, borderRightWidth:2}),
        }}/>
      ))}
      <div style={{display:'flex', alignItems:'baseline', gap:8, marginBottom:3,
        borderBottom:`1px dashed ${color}40`, paddingBottom:3}}>
        <span style={{fontFamily:GB.mono, fontSize:9, fontWeight:700, color, letterSpacing:'0.1em'}}>{title}</span>
        <span style={{fontFamily:GB.mono, fontSize:8, color, opacity:.6}}>{sub}</span>
        <span style={{flex:1}}/>
        <span style={{fontFamily:GB.mono, fontSize:7, color, opacity:.55}}>{loc}</span>
      </div>
      <div style={{flex:1, position:'relative'}}>{children}</div>
    </div>
  );
}

window.SketchC = SketchC;
