// SKETCH E — Assign agent flow.
// Shows the 3-step interaction: lasso → choose role → confirm.

function SketchE() {
  const ox = 280, oy = 60, sc = 3.6;
  const project = (gx, gy, z=0) => {
    const [px, py] = iso(gx, gy, z);
    return [ox + px*sc, oy + py*sc];
  };

  const buildings = [
    { x:18, y:14, w:8, h:8,  z:14, l:'login.tsx', s:'ok' },
    { x:18, y:24, w:10,h:6,  z:18, l:'session.ts', s:'warn', sel:true },
    { x:30, y:22, w:5, h:8,  z:6,  l:'jwt.ts', s:'ok', sel:true },
    { x:30, y:14, w:6, h:6,  z:8,  l:'oauth.ts', s:'ok', sel:true },
    { x:46, y:14, w:9, h:9,  z:22, l:'router.ts', s:'ok' },
    { x:46, y:26, w:7, h:7,  z:12, l:'middleware', s:'ok' },
    { x:18, y:42, w:7, h:7,  z:9,  l:'Button.tsx', s:'ok' },
    { x:28, y:42, w:8, h:8,  z:13, l:'Modal.tsx', s:'ok' },
  ];

  // Lasso bounds (around AUTH district)
  const lassoTL = project(16, 12, 0);
  const lassoBR = project(38, 32, 0);

  return (
    <div className="gb-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>
      <div className="gb-content" style={{position:'absolute', inset:0}}>

        {/* TOP BAR */}
        <div style={{position:'absolute', top:0, left:0, right:0, height:28,
          borderBottom:`1px solid ${GB.cyan}40`, display:'flex', alignItems:'center',
          padding:'0 12px', gap:14, fontFamily:GB.mono, fontSize:9, color:GB.ink,
          background:'rgba(5,8,14,0.9)', zIndex:10}}>
          <span style={{color:GB.amber, fontWeight:700, letterSpacing:'0.15em'}}>► DISPATCH</span>
          <span style={{opacity:.55}}>step 2 of 3 — choose role</span>
          <span style={{flex:1}}/>
          <span style={{color:GB.amber}}>3 buildings selected</span>
          <span style={{opacity:.55}}>~736 LOC</span>
        </div>

        {/* CITY VIEW */}
        <svg viewBox="0 0 540 380" preserveAspectRatio="xMidYMid meet"
          style={{position:'absolute', top:28, left:8, right:240, bottom:24}}>

          {/* districts */}
          {[
            { x:16, y:12, w:22, h:22, l:'AUTH/' },
            { x:42, y:12, w:18, h:22, l:'API/' },
            { x:16, y:40, w:24, h:18, l:'UI/' },
          ].map((d,i)=>{
            const A = project(d.x,     d.y,     0);
            const B = project(d.x+d.w, d.y,     0);
            const C = project(d.x+d.w, d.y+d.h, 0);
            const D = project(d.x,     d.y+d.h, 0);
            return (
              <g key={i}>
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={GB.cyan} fillOpacity="0.04" stroke={GB.cyan} strokeWidth="0.6"
                  strokeDasharray="3 2" opacity="0.6"/>
                <text x={A[0]+4} y={A[1]+10} fontFamily={GB.mono} fontSize="8"
                  fontWeight="700" fill={GB.cyan} letterSpacing="0.1em">{d.l}</text>
              </g>
            );
          })}

          {/* buildings */}
          {[...buildings].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map((b,i)=>{
            const A = project(b.x, b.y, 0);
            const B = project(b.x+b.w, b.y, 0);
            const C = project(b.x+b.w, b.y+b.h, 0);
            const D = project(b.x, b.y+b.h, 0);
            const A2= project(b.x, b.y, b.z);
            const B2= project(b.x+b.w, b.y, b.z);
            const C2= project(b.x+b.w, b.y+b.h, b.z);
            const D2= project(b.x, b.y+b.h, b.z);
            const col = b.sel ? GB.amber : (b.s==='warn'?GB.amber:GB.cyan);
            const op = b.sel ? 1 : 0.5;
            const top = project(b.x+b.w/2, b.y+b.h/2, b.z);
            return (
              <g key={i} opacity={op}>
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={col} fillOpacity={b.sel?0.18:0.05} stroke={col} strokeWidth="0.9"/>
                <path d={`M${A[0]},${A[1]} L${A2[0]},${A2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${B[0]},${B[1]} L${B2[0]},${B2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${D[0]},${D[1]} L${D2[0]},${D2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                  fill={col} fillOpacity={b.sel?0.2:0.1} stroke={col} strokeWidth="1"/>
                {/* selection corner brackets on roof */}
                {b.sel && (
                  <g>
                    {[A2,B2,C2,D2].map((p,j)=>(
                      <g key={j} className="gb-blink">
                        <circle cx={p[0]} cy={p[1]} r="2.5" fill="none" stroke={GB.amber} strokeWidth="1.2"/>
                      </g>
                    ))}
                  </g>
                )}
                <text x={top[0]} y={top[1]-5} textAnchor="middle"
                  fontFamily={GB.mono} fontSize="6.5" fontWeight={b.sel?700:400} fill={col}>{b.l}</text>
              </g>
            );
          })}

          {/* LASSO rectangle */}
          <g>
            <rect x={Math.min(lassoTL[0],lassoBR[0])-6} y={Math.min(lassoTL[1],lassoBR[1])-6}
              width={Math.abs(lassoBR[0]-lassoTL[0])+12} height={Math.abs(lassoBR[1]-lassoTL[1])+12}
              fill={GB.amber} fillOpacity="0.06"
              stroke={GB.amber} strokeWidth="1.2" strokeDasharray="4 3"
              className="gb-dash-anim"/>
            {/* lasso label */}
            <g transform={`translate(${Math.min(lassoTL[0],lassoBR[0])-6}, ${Math.min(lassoTL[1],lassoBR[1])-14})`}>
              <rect x="0" y="-10" width="86" height="11" fill={GB.amber} stroke="none"/>
              <text x="3" y="-2" fontFamily={GB.mono} fontSize="7" fontWeight="700" fill={GB.bg}>
                SEL · 3 bldg · 736 LOC
              </text>
            </g>
          </g>

          {/* Cursor reticle */}
          <g transform={`translate(${(lassoTL[0]+lassoBR[0])/2}, ${(lassoTL[1]+lassoBR[1])/2})`}>
            <path d="M-12,0 L-4,0 M4,0 L12,0 M0,-12 L0,-4 M0,4 L0,12" stroke={GB.amber} strokeWidth="1.2"/>
            <circle r="3" fill="none" stroke={GB.amber} strokeWidth="1"/>
            <circle r="1" fill={GB.amber}/>
          </g>

          {/* legend */}
          <g transform="translate(20, 365)">
            <text fontFamily={GB.mono} fontSize="7" fill={GB.cyan} opacity="0.7">
              ◇ SHIFT-DRAG: lasso · CLICK: pick · ⌘K: command palette · D: dispatch
            </text>
          </g>
        </svg>

        {/* RIGHT: dispatch flow */}
        <div style={{position:'absolute', top:34, right:8, width:226, zIndex:5,
          display:'flex', flexDirection:'column', gap:8}}>

          {/* Step 1 (done) */}
          <Panel title="① TARGET" sub="DONE" color={GB.cyanDim}>
            <div style={{fontSize:9, color:GB.ink, opacity:.7, lineHeight:1.5}}>
              <div>✓ session.ts <span style={{opacity:.5}}>· 412 LOC</span></div>
              <div>✓ jwt.ts <span style={{opacity:.5}}>· 88 LOC</span></div>
              <div>✓ oauth.ts <span style={{opacity:.5}}>· 142 LOC</span></div>
              <div style={{borderTop:`1px dashed ${GB.cyanDim}50`, marginTop:3, paddingTop:3,
                color:GB.cyanDim}}>scope = AUTH/ subset</div>
            </div>
          </Panel>

          {/* Step 2 (active) */}
          <Panel title="② ROLE" sub="CHOOSE" color={GB.amber}>
            <div style={{display:'flex', flexDirection:'column', gap:3}}>
              {[
                { l:'fix-bug',     d:'patch failures', sel:false },
                { l:'refactor',    d:'restructure code', sel:true  },
                { l:'review',      d:'audit & comment', sel:false },
                { l:'add-test',    d:'expand coverage', sel:false },
                { l:'docs',        d:'write/update docs', sel:false },
                { l:'optimize',    d:'perf pass',       sel:false },
                { l:'custom...',   d:'free-form prompt',sel:false },
              ].map(r => (
                <div key={r.l} style={{
                  display:'flex', justifyContent:'space-between', alignItems:'baseline',
                  padding:'3px 5px',
                  border:`1px solid ${r.sel?GB.amber:GB.cyan+'30'}`,
                  background: r.sel ? `${GB.amber}18` : 'transparent',
                  fontSize:9, color: r.sel?GB.amber:GB.ink, fontWeight:r.sel?700:400,
                  cursor:'pointer',
                }}>
                  <span>{r.sel?'▸':' '} {r.l}</span>
                  <span style={{opacity:.55, fontSize:8}}>{r.d}</span>
                </div>
              ))}
            </div>
          </Panel>

          {/* Step 3 */}
          <Panel title="③ AGENT" sub="auto-pick" color={GB.cyan}>
            <div style={{fontSize:9, color:GB.ink, lineHeight:1.5}}>
              <div style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{color:GB.amber, fontWeight:700}}>◇ A-09</span>
                <span style={{opacity:.6}}>idle</span>
              </div>
              <div style={{opacity:.6, fontSize:8}}>specialty: refactor / TS</div>
              <div style={{opacity:.6, fontSize:8}}>est: ~14m · ~$0.42</div>
            </div>
            <div style={{display:'flex', gap:4, marginTop:6}}>
              <button style={{flex:1, background:'transparent', color:GB.cyan,
                border:`1px solid ${GB.cyan}80`, fontFamily:GB.mono, fontSize:9, padding:'3px 0',
                cursor:'pointer'}}>change</button>
              <button style={{flex:2, background:GB.amber, color:GB.bg,
                border:'none', fontFamily:GB.mono, fontSize:10, fontWeight:700, padding:'3px 0',
                cursor:'pointer', letterSpacing:'0.1em'}}>► DISPATCH</button>
            </div>
          </Panel>

          {/* Command preview */}
          <Panel title="$ PREVIEW" color={GB.green}>
            <div style={{fontSize:8, fontFamily:GB.mono, color:GB.green, lineHeight:1.5,
              whiteSpace:'pre-wrap'}}>
{`> dispatch \\
  --role refactor \\
  --scope auth/{session,
           jwt,oauth} \\
  --agent A-09 \\
  --budget 14m
`}            </div>
          </Panel>
        </div>

        {/* bottom hint bar */}
        <div style={{position:'absolute', bottom:0, left:0, right:0, height:22, zIndex:6,
          background:'rgba(5,8,14,0.9)', borderTop:`1px solid ${GB.cyan}30`,
          display:'flex', alignItems:'center', padding:'0 12px', gap:14,
          fontFamily:GB.mono, fontSize:8.5, color:GB.ink}}>
          <span><span style={{color:GB.amber}}>[Esc]</span> cancel</span>
          <span><span style={{color:GB.amber}}>[Tab]</span> next role</span>
          <span><span style={{color:GB.amber}}>[Enter]</span> dispatch</span>
          <span style={{flex:1}}/>
          <span style={{opacity:.55}}>scope=auth/* · role=refactor · agent=A-09</span>
        </div>
      </div>
    </div>
  );
}

window.SketchE = SketchE;
