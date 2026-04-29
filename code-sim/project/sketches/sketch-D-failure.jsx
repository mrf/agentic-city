// SKETCH D — Failure state. Bug strikes the city.
// Heavy red overlay, vignette, dependency lightning, alarm HUD.

function SketchD() {
  // Same iso layout as A but in alarm state.
  const districts = [
    { id:'auth', x:16, y:12, w:22, h:22, label:'AUTH/',  fail:false },
    { id:'api',  x:52, y:8,  w:28, h:22, label:'API/',   fail:true },
    { id:'ui',   x:16, y:42, w:30, h:22, label:'UI/',    fail:false },
    { id:'db',   x:52, y:40, w:26, h:22, label:'DATA/',  fail:false },
    { id:'test', x:18, y:66, w:46, h:10, label:'TESTS/', fail:true },
  ];

  const buildings = [
    { d:'auth', x:18, y:14, w:8, h:8, z:14, label:'login.tsx', s:'ok' },
    { d:'auth', x:18, y:24, w:10,h:6, z:18, label:'session.ts', s:'ok' },
    { d:'auth', x:30, y:22, w:5, h:8, z:6,  label:'jwt.ts', s:'ok' },
    { d:'api',  x:54, y:10, w:9, h:9, z:22, label:'router.ts', s:'warn' },
    { d:'api',  x:65, y:12, w:7, h:7, z:12, label:'middleware', s:'ok' },
    { d:'api',  x:54, y:21, w:6, h:7, z:10, label:'handlers', s:'err' },
    { d:'api',  x:62, y:21, w:8, h:6, z:14, label:'schema.ts', s:'CRIT' },
    { d:'api',  x:72, y:21, w:5, h:5, z:7,  label:'errors.ts', s:'err' },
    { d:'ui',   x:18, y:44, w:7, h:7, z:9,  label:'Button.tsx', s:'ok' },
    { d:'ui',   x:27, y:44, w:8, h:8, z:13, label:'Modal.tsx', s:'ok' },
    { d:'ui',   x:37, y:44, w:6, h:8, z:11, label:'Form.tsx', s:'warn' },
    { d:'db',   x:54, y:42, w:11,h:8, z:24, label:'schema.sql', s:'warn' },
    { d:'db',   x:67, y:44, w:7, h:6, z:10, label:'migrate.ts', s:'ok' },
    { d:'test', x:30, y:68, w:6, h:5, z:5,  label:'api.spec', s:'err' },
    { d:'test', x:38, y:68, w:6, h:5, z:5,  label:'ui.spec', s:'err' },
    { d:'test', x:46, y:68, w:6, h:5, z:5,  label:'db.spec', s:'warn' },
  ];

  const ox = 360, oy = 70, sc = 4.0;
  const project = (gx, gy, z=0) => {
    const [px, py] = iso(gx, gy, z);
    return [ox + px*sc, oy + py*sc];
  };

  const findB = (label) => {
    const b = buildings.find(x=>x.label===label);
    return [b.x+b.w/2, b.y+b.h/2, b.z];
  };

  // Lightning paths — error origin propagates
  const origin = findB('schema.ts');
  const targets = ['handlers','router.ts','api.spec','ui.spec'].map(findB);

  return (
    <div className="gb-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>

      {/* RED VIGNETTE — global failure overlay */}
      <div className="gb-vignette" style={{
        position:'absolute', inset:0, pointerEvents:'none', zIndex:50,
        background:`radial-gradient(ellipse at center, transparent 30%, rgba(255,58,74,0.25) 70%, rgba(255,58,74,0.55) 100%)`,
        boxShadow:`inset 0 0 120px rgba(255,58,74,0.6), inset 0 0 240px rgba(255,58,74,0.3)`,
      }}/>

      <div className="gb-content" style={{position:'absolute', inset:0}}>

        {/* TOP BAR — alarm */}
        <div style={{position:'absolute', top:0, left:0, right:0, height:30,
          borderBottom:`1px solid ${GB.red}`, display:'flex', alignItems:'center',
          padding:'0 12px', gap:14, fontFamily:GB.mono, fontSize:10, color:GB.red,
          background:'rgba(40,5,8,0.92)', zIndex:60}}>
          <span style={{fontWeight:700, letterSpacing:'0.2em'}} className="gb-blink">▲ CRITICAL</span>
          <span style={{opacity:.85}}>BUILD #285 :: FAILED</span>
          <span style={{opacity:.7}}>blast-radius=4 modules</span>
          <span style={{opacity:.7}}>since=00:00:14</span>
          <span style={{flex:1}}/>
          <span>tests=132/152</span>
          <span>cov=68.4%</span>
          <span style={{color:GB.amber}}>● 8 warn</span>
          <span style={{color:GB.red, fontWeight:700}} className="gb-blink">● 5 ERR</span>
        </div>

        {/* LEFT PANEL — bug report */}
        <div style={{position:'absolute', top:38, left:8, width:180, zIndex:55,
          display:'flex', flexDirection:'column', gap:8}}>

          <Panel title="◆ BUG ORIGIN" sub="api/schema.ts" color={GB.red}>
            <div style={{fontSize:9, color:GB.red, lineHeight:1.5}}>
              <div style={{fontWeight:700, marginBottom:3}}>TypeError</div>
              <div style={{fontSize:8, color:GB.ink, opacity:.85, lineHeight:1.4}}>
                cannot read property `id` of undefined
              </div>
              <div style={{borderTop:`1px dashed ${GB.red}50`, marginTop:5, paddingTop:5,
                fontSize:8, color:GB.ink, fontFamily:GB.mono}}>
                <div><span style={{opacity:.5}}>at</span> schema.ts:42:18</div>
                <div><span style={{opacity:.5}}>via</span> handlers/users.ts:88</div>
                <div><span style={{opacity:.5}}>via</span> router.ts:124</div>
              </div>
            </div>
          </Panel>

          <Panel title="BLAST RADIUS" sub="downstream" color={GB.red}>
            {[
              { f:'schema.ts',    type:'origin',  col:GB.red },
              { f:'handlers/',    type:'caller',  col:GB.red },
              { f:'router.ts',    type:'caller',  col:GB.amber },
              { f:'api.spec',     type:'test',    col:GB.red },
              { f:'ui.spec',      type:'test',    col:GB.red },
              { f:'db.spec',      type:'test',    col:GB.amber },
            ].map((b,i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between',
                fontSize:8.5, padding:'2px 0', borderBottom:`1px dotted ${GB.red}25`}}>
                <span style={{color:b.col}}>● {b.f}</span>
                <span style={{opacity:.55}}>{b.type}</span>
              </div>
            ))}
          </Panel>

          <Panel title="DISPATCH" color={GB.amber}>
            <div style={{fontSize:9, color:GB.ink, lineHeight:1.4}}>
              recommend agent →<br/>
              <span style={{color:GB.amber, fontWeight:700}}>fix-bug-specialist</span>
            </div>
            <button style={{width:'100%', marginTop:6, background:GB.red, color:'#fff',
              border:'none', fontFamily:GB.mono, fontSize:10, fontWeight:700, padding:'4px 0',
              cursor:'pointer', letterSpacing:'0.1em'}}>
              ► DISPATCH NOW
            </button>
          </Panel>
        </div>

        {/* RIGHT PANEL — alarm log */}
        <div style={{position:'absolute', top:38, right:8, width:184, zIndex:55,
          display:'flex', flexDirection:'column', gap:8}}>

          <Panel title="ALARMS" sub="LIVE" color={GB.red}>
            {[
              { t:'00:14', m:'TypeError schema.ts:42', col:GB.red },
              { t:'00:14', m:'cascading: handlers fail', col:GB.red },
              { t:'00:13', m:'api.spec FAIL 6/8', col:GB.red },
              { t:'00:12', m:'ui.spec FAIL 14/22', col:GB.red },
              { t:'00:11', m:'router.ts route 500', col:GB.amber },
              { t:'00:09', m:'db.spec timeout', col:GB.amber },
              { t:'00:08', m:'CI build #285 FAIL', col:GB.red },
              { t:'00:00', m:'A-02 dispatched', col:GB.cyan },
            ].map((e,i)=>(
              <div key={i} style={{display:'flex', gap:6, fontSize:8.5, padding:'2px 0',
                borderBottom:`1px dotted ${GB.red}20`, color:GB.ink, lineHeight:1.5}}>
                <span style={{opacity:.5, fontVariantNumeric:'tabular-nums'}}>−{e.t}</span>
                <span style={{flex:1, color:e.col}}>{e.m}</span>
              </div>
            ))}
          </Panel>

          <Panel title="HEALTH" color={GB.red}>
            <Stat k="errors"   v="5"  vColor={GB.red}/>
            <Stat k="warnings" v="8"  vColor={GB.amber}/>
            <Stat k="passing"  v="132/152" vColor={GB.amber}/>
            <Stat k="cov drop" v="−5.8%"   vColor={GB.red}/>
            <Stat k="last OK"  v="2m ago"/>
          </Panel>
        </div>

        {/* CITY VIEW */}
        <svg viewBox="0 0 800 460" preserveAspectRatio="xMidYMid meet"
          style={{position:'absolute', top:30, left:196, right:200, bottom:24}}>

          {/* districts */}
          {districts.map(d => {
            const A = project(d.x,        d.y,        0);
            const B = project(d.x+d.w,    d.y,        0);
            const C = project(d.x+d.w,    d.y+d.h,    0);
            const D = project(d.x,        d.y+d.h,    0);
            const lab = project(d.x+1, d.y+3, 0);
            const col = d.fail?GB.red:GB.cyan;
            return (
              <g key={d.id}>
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={col} fillOpacity={d.fail?0.10:0.04} stroke={col} strokeWidth="0.7"
                  strokeDasharray="3 2" opacity="0.7"
                  className={d.fail?'gb-flash':''}/>
                <text x={lab[0]} y={lab[1]} fontFamily={GB.mono} fontSize="9" fontWeight="700"
                  fill={col} letterSpacing="0.1em">{d.label}</text>
              </g>
            );
          })}

          {/* lightning from origin to downstream */}
          {(() => {
            const from = project(origin[0], origin[1], origin[2]);
            return targets.map((t,i)=>{
              const to = project(t[0], t[1], t[2]);
              // jagged path
              const mx = (from[0]+to[0])/2 + (Math.random()-0.5)*8;
              const my = (from[1]+to[1])/2 + (Math.random()-0.5)*8;
              return (
                <g key={i} className="gb-flash">
                  <path d={`M${from[0]},${from[1]} L${mx},${my} L${to[0]},${to[1]}`}
                    fill="none" stroke={GB.red} strokeWidth="1.6" strokeLinecap="round"
                    strokeLinejoin="round" opacity="0.85"/>
                  <path d={`M${from[0]},${from[1]} L${mx},${my} L${to[0]},${to[1]}`}
                    fill="none" stroke={GB.red} strokeWidth="4" strokeLinecap="round"
                    strokeLinejoin="round" opacity="0.25"/>
                </g>
              );
            });
          })()}

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
            const col = b.s==='CRIT'?GB.red : b.s==='err'?GB.red : b.s==='warn'?GB.amber : GB.cyan;
            const top = project(b.x+b.w/2, b.y+b.h/2, b.z);
            return (
              <g key={i}>
                {/* full red flash on err buildings */}
                {(b.s==='err' || b.s==='CRIT') && (
                  <g className="gb-flash">
                    <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${B2[0]},${B2[1]} L${A2[0]},${A2[1]} Z`}
                      fill={GB.red} opacity="0.55"/>
                    <path d={`M${A[0]},${A[1]} L${D[0]},${D[1]} L${D2[0]},${D2[1]} L${A2[0]},${A2[1]} Z`}
                      fill={GB.red} opacity="0.40"/>
                    <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                      fill={GB.red} opacity="0.55"/>
                  </g>
                )}
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={col} fillOpacity={b.s==='ok'?0.05:0.12} stroke={col} strokeWidth="0.9"/>
                <path d={`M${B[0]},${B[1]} L${C[0]},${C[1]} L${C2[0]},${C2[1]}`}
                  fill="none" stroke={col} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4"/>
                <path d={`M${A[0]},${A[1]} L${A2[0]},${A2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${B[0]},${B[1]} L${B2[0]},${B2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${D[0]},${D[1]} L${D2[0]},${D2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                  fill={col} fillOpacity={b.s==='CRIT'?0.25:0.10} stroke={col} strokeWidth="1"/>
                {/* CRIT: smoke/glitch lines rising */}
                {b.s==='CRIT' && (
                  <g className="gb-blink">
                    {[0,1,2].map(k=>{
                      const sx = top[0] + (k-1)*5;
                      return <path key={k}
                        d={`M${sx},${top[1]-4} L${sx-2},${top[1]-12} L${sx+1},${top[1]-22} L${sx-1},${top[1]-32}`}
                        stroke={GB.red} strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.7"/>;
                    })}
                  </g>
                )}
                <circle cx={top[0]} cy={top[1]-3} r={b.s==='CRIT'?3:2}
                  fill={col} className={(b.s==='err'||b.s==='CRIT')?'gb-blink':''}/>
                <text x={top[0]} y={top[1]-(b.s==='CRIT'?38:7)} textAnchor="middle"
                  fontFamily={GB.mono} fontSize={b.s==='CRIT'?7.5:6.5}
                  fontWeight={b.s==='CRIT'?700:400} fill={col}>
                  {b.s==='CRIT'?'▲ '+b.label:b.label}
                </text>
              </g>
            );
          })}

          {/* swarm of agents converging on schema.ts */}
          {(() => {
            const target = project(origin[0], origin[1], origin[2]);
            return [
              { off:[-30,-30], col:GB.red,    id:'A-02', t:'fix' },
              { off:[35,-25],  col:GB.amber,  id:'A-07', t:'analyze' },
              { off:[0,-50],   col:GB.magenta,id:'A-08', t:'rollback' },
            ].map((a,i)=>{
              const pos = [target[0]+a.off[0], target[1]+a.off[1]];
              return (
                <g key={i}>
                  <g className="gb-beam">
                    <path d={`M${pos[0]-7},${pos[1]+3} L${target[0]-5},${target[1]} L${target[0]+5},${target[1]} L${pos[0]+7},${pos[1]+3} Z`}
                      fill={a.col} fillOpacity="0.18" stroke={a.col} strokeWidth="0.6" strokeDasharray="1.5 1.5"/>
                  </g>
                  <g className="gb-ufo">
                    <path d={`M${pos[0]-5},${pos[1]-1} Q${pos[0]},${pos[1]-7} ${pos[0]+5},${pos[1]-1}`}
                      fill="none" stroke={a.col} strokeWidth="1"/>
                    <path d={`M${pos[0]-9},${pos[1]+1} L${pos[0]-5.5},${pos[1]-1} L${pos[0]+5.5},${pos[1]-1} L${pos[0]+9},${pos[1]+1} L${pos[0]+5.5},${pos[1]+3} L${pos[0]-5.5},${pos[1]+3} Z`}
                      fill={GB.bg} stroke={a.col} strokeWidth="1"/>
                    <circle cx={pos[0]} cy={pos[1]+2} r="0.8" fill={a.col} className="gb-blink"/>
                  </g>
                  <text x={pos[0]+11} y={pos[1]} fontFamily={GB.mono} fontSize="7" fontWeight="700" fill={a.col}>{a.id}</text>
                  <text x={pos[0]+11} y={pos[1]+6} fontFamily={GB.mono} fontSize="5.5" fill={a.col} opacity="0.7">{a.t}</text>
                </g>
              );
            });
          })()}

          {/* ALARM stamp */}
          <g transform="translate(60, 40)">
            <rect x="-4" y="-12" width="100" height="22" fill="none" stroke={GB.red} strokeWidth="1.5" className="gb-blink"/>
            <text x="46" y="2" textAnchor="middle" fontFamily={GB.mono} fontSize="11"
              fontWeight="800" fill={GB.red} letterSpacing="0.25em">! BREACH</text>
          </g>
        </svg>

        {/* bottom alarm ticker */}
        <div style={{position:'absolute', bottom:0, left:0, right:0, zIndex:60,
          background:'rgba(40,5,8,0.95)'}}>
          <Ticker color={GB.red} prefix="▲ " items={[
            'CRITICAL :: api/schema.ts:42 :: TypeError on .id access',
            'CASCADE :: handlers/users.ts:88',
            'CASCADE :: router.ts:124',
            'TEST FAIL :: api.spec 6/8',
            'TEST FAIL :: ui.spec 14/22',
            'CI BUILD #285 :: FAILED',
            'AGENTS DISPATCHED :: A-02, A-07, A-08',
          ]}/>
        </div>
      </div>
    </div>
  );
}

window.SketchD = SketchD;
