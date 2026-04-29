// SKETCH A — Isometric "Gibson" city overview.
// The hero view: agentic UI as wireframe city. Dense HUD all around.

function SketchA() {
  // Each district = a folder. Buildings within = files.
  // Footprint = file size; height = LOC; status pip = build/test state.
  const buildings = [
    // AUTH district (top-left)
    { d:'auth', x:18, y:14, w:8, h:8, z:14, label:'login.tsx',  status:'ok' },
    { d:'auth', x:28, y:14, w:6, h:6, z:8,  label:'oauth.ts',   status:'ok' },
    { d:'auth', x:18, y:24, w:10,h:6, z:18, label:'session.ts', status:'warn' },
    { d:'auth', x:30, y:22, w:5, h:8, z:6,  label:'jwt.ts',     status:'ok' },

    // API district (top-right)
    { d:'api',  x:54, y:10, w:9, h:9, z:22, label:'router.ts',  status:'ok' },
    { d:'api',  x:65, y:12, w:7, h:7, z:12, label:'middleware', status:'ok' },
    { d:'api',  x:54, y:21, w:6, h:7, z:10, label:'handlers',   status:'ok' },
    { d:'api',  x:62, y:21, w:8, h:6, z:14, label:'schema.ts',  status:'err' },
    { d:'api',  x:72, y:21, w:5, h:5, z:7,  label:'errors.ts',  status:'ok' },

    // UI district (mid-bottom)
    { d:'ui',   x:18, y:44, w:7, h:7, z:9,  label:'Button.tsx', status:'ok' },
    { d:'ui',   x:27, y:44, w:8, h:8, z:13, label:'Modal.tsx',  status:'ok' },
    { d:'ui',   x:37, y:44, w:6, h:8, z:11, label:'Form.tsx',   status:'warn' },
    { d:'ui',   x:18, y:54, w:10,h:6, z:16, label:'theme.ts',   status:'ok' },
    { d:'ui',   x:30, y:54, w:7, h:6, z:8,  label:'icons',      status:'ok' },
    { d:'ui',   x:39, y:54, w:5, h:6, z:6,  label:'tokens.ts',  status:'ok' },

    // DB district (mid-right)
    { d:'db',   x:54, y:42, w:11,h:8, z:24, label:'schema.sql', status:'ok' },
    { d:'db',   x:67, y:44, w:7, h:6, z:10, label:'migrate.ts', status:'ok' },
    { d:'db',   x:54, y:52, w:8, h:7, z:14, label:'queries',    status:'ok' },
    { d:'db',   x:64, y:52, w:6, h:7, z:9,  label:'pool.ts',    status:'ok' },

    // TESTS district (bottom-strip)
    { d:'test', x:22, y:68, w:6, h:5, z:5, label:'auth.spec',  status:'ok' },
    { d:'test', x:30, y:68, w:6, h:5, z:5, label:'api.spec',   status:'err' },
    { d:'test', x:38, y:68, w:6, h:5, z:5, label:'ui.spec',    status:'warn' },
    { d:'test', x:46, y:68, w:6, h:5, z:5, label:'db.spec',    status:'ok' },
    { d:'test', x:54, y:68, w:6, h:5, z:5, label:'e2e.spec',   status:'ok' },
  ];

  const districts = [
    { id:'auth', x:16, y:12, w:22, h:22, label:'AUTH/',     color:GB.cyan },
    { id:'api',  x:52, y:8,  w:28, h:22, label:'API/',      color:GB.cyan },
    { id:'ui',   x:16, y:42, w:30, h:22, label:'UI/',       color:GB.cyan },
    { id:'db',   x:52, y:40, w:26, h:22, label:'DATA/',     color:GB.cyan },
    { id:'test', x:18, y:66, w:46, h:10, label:'TESTS/',    color:GB.cyanDim },
  ];

  // Agents — flying UFOs, some beaming down to specific buildings.
  // Coordinates here are POST-isometric-projection screen offsets.
  const agents = [
    { name:'A-01', task:'refactor', color:GB.amber,
      bldg:{ x:18+9, y:24+3, z:18 }, off:[0,-22] },
    { name:'A-02', task:'fix-test', color:GB.red,
      bldg:{ x:62+4, y:21+3, z:14 }, off:[0,-26], err:true },
    { name:'A-03', task:'review',   color:GB.green,
      bldg:{ x:27+4, y:44+4, z:13 }, off:[2,-20] },
    { name:'A-04', task:'idle',     color:GB.cyan,
      bldg:null, free:[300, 70] },
    { name:'A-05', task:'docs',     color:GB.magenta,
      bldg:{ x:54+5, y:42+4, z:24 }, off:[0,-28] },
  ];

  // Origin offset for the iso projection.
  const ox = 380, oy = 80;
  const sc = 4.2;
  const project = (gx, gy, z=0) => {
    const [px, py] = iso(gx, gy, z);
    return [ox + px*sc, oy + py*sc];
  };

  return (
    <div className="gb-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>
      <div className="gb-scan"/>
      <div className="gb-content" style={{position:'absolute', inset:0}}>

        {/* ===== TOP BAR ===== */}
        <div style={{position:'absolute', top:0, left:0, right:0, height:32,
          borderBottom:`1px solid ${GB.cyan}40`, display:'flex', alignItems:'center',
          padding:'0 12px', gap:18, fontFamily:GB.mono, fontSize:10, color:GB.ink,
          background:'rgba(5,8,14,0.85)', zIndex:10}}>
          <span style={{color:GB.cyan, fontWeight:700, letterSpacing:'0.15em'}}>◈ CITY-OS</span>
          <span style={{opacity:.5}}>repo://app-monorepo</span>
          <span style={{opacity:.5}}>branch=feat/agents</span>
          <span style={{opacity:.5}}>head=a3f29d1</span>
          <span style={{flex:1}}/>
          <span><span style={{color:GB.green}}>●</span> ci=passing</span>
          <span><span style={{color:GB.amber}}>●</span> tests=147/152</span>
          <span><span style={{color:GB.red}}>●</span> bugs=3</span>
          <span style={{opacity:.5}}>16:42:09</span>
        </div>

        {/* ===== LEFT PANEL: AGENT ROSTER ===== */}
        <div style={{position:'absolute', top:40, left:8, width:170, zIndex:5}}>
          <Panel title="AGENTS" sub="5/8 active" color={GB.cyan}>
            {[
              { id:'A-01', task:'refactor session.ts', col:GB.amber, prog:62 },
              { id:'A-02', task:'fix schema.ts test',  col:GB.red,   prog:14 },
              { id:'A-03', task:'review Modal.tsx',    col:GB.green, prog:88 },
              { id:'A-04', task:'idle — awaiting',     col:GB.cyan,  prog:0  },
              { id:'A-05', task:'docs schema.sql',     col:GB.magenta,prog:41},
            ].map(a => (
              <div key={a.id} style={{display:'flex', flexDirection:'column', gap:2, padding:'4px 0',
                borderBottom:`1px dashed ${GB.cyan}25`}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:9}}>
                  <span style={{color:a.col, fontWeight:600}}>◇ {a.id}</span>
                  <span style={{opacity:.55}}>{a.prog}%</span>
                </div>
                <div style={{fontSize:8, opacity:.7, color:GB.ink}}>{a.task}</div>
                <div style={{height:2, background:`${a.col}25`, position:'relative'}}>
                  <div style={{position:'absolute', inset:0, width:`${a.prog}%`, background:a.col}}/>
                </div>
              </div>
            ))}
            <div style={{marginTop:6, fontSize:9, color:GB.cyan, opacity:.7}}>
              [+] DISPATCH AGENT  [⌘K]
            </div>
          </Panel>

          <div style={{height:8}}/>

          <Panel title="MINI-MAP" color={GB.cyan}>
            <svg viewBox="0 0 100 70" style={{width:'100%', height:90, display:'block'}}>
              {districts.map(d=>(
                <g key={d.id}>
                  <rect x={d.x*0.95} y={d.y*0.85} width={d.w*0.95} height={d.h*0.85}
                    fill="none" stroke={d.color} strokeWidth="0.6" opacity="0.6"/>
                  <text x={d.x*0.95+1.5} y={d.y*0.85+4} fontFamily={GB.mono} fontSize="3.5"
                    fill={d.color} opacity="0.85">{d.label}</text>
                </g>
              ))}
              {/* viewport rect */}
              <rect x="15" y="10" width="65" height="50" fill="none" stroke={GB.amber}
                strokeWidth="0.8" strokeDasharray="2 1"/>
              {/* agent dots */}
              {[[24,22],[60,22],[33,46],[58,46],[40,67]].map(([x,y],i)=>(
                <circle key={i} cx={x} cy={y} r="0.9" fill={[GB.amber,GB.red,GB.green,GB.magenta,GB.cyan][i]}/>
              ))}
            </svg>
          </Panel>
        </div>

        {/* ===== RIGHT PANEL: ACTIVITY + STATS ===== */}
        <div style={{position:'absolute', top:40, right:8, width:180, zIndex:5}}>
          <Panel title="STATS" color={GB.cyan}>
            <Stat k="files"      v="1,284"/>
            <Stat k="LOC"        v="86,420"/>
            <Stat k="modules"    v="12"/>
            <Stat k="coverage"   v="74.2%" vColor={GB.amber}/>
            <Stat k="open PRs"   v="6"/>
            <Stat k="bugs"       v="3 NEW" vColor={GB.red}/>
          </Panel>
          <div style={{height:8}}/>
          <Panel title="ACTIVITY" sub="live" color={GB.cyan}>
            {[
              { t:'16:42:08', who:'A-02', msg:'schema test FAIL', col:GB.red },
              { t:'16:42:01', who:'A-03', msg:'committed Modal', col:GB.green },
              { t:'16:41:54', who:'A-01', msg:'edit session.ts', col:GB.amber },
              { t:'16:41:30', who:'A-05', msg:'open schema.sql', col:GB.magenta },
              { t:'16:40:12', who:'CI',   msg:'build #284 OK',   col:GB.green },
              { t:'16:39:48', who:'A-02', msg:'spawned',         col:GB.cyan },
              { t:'16:39:11', who:'YOU',  msg:'dispatched A-02', col:GB.cyan },
            ].map((e,i)=>(
              <div key={i} style={{display:'flex', gap:5, fontSize:8.5, lineHeight:1.5,
                color:GB.ink, borderBottom:`1px dotted ${GB.cyan}20`, padding:'2px 0'}}>
                <span style={{opacity:.5, fontVariantNumeric:'tabular-nums'}}>{e.t}</span>
                <span style={{color:e.col, fontWeight:600, minWidth:30}}>{e.who}</span>
                <span style={{flex:1, opacity:.85}}>{e.msg}</span>
              </div>
            ))}
          </Panel>
          <div style={{height:8}}/>
          <Panel title="ASSIGN" sub="drag agent → bldg" color={GB.amber}>
            <div style={{fontSize:8.5, opacity:.7, lineHeight:1.4}}>
              click building → assign agent<br/>
              shift-drag → lasso district<br/>
              ⌘K → command palette
            </div>
          </Panel>
        </div>

        {/* ===== CENTER: ISOMETRIC CITY ===== */}
        <svg viewBox="0 0 800 480" preserveAspectRatio="xMidYMid meet"
          style={{position:'absolute', top:32, left:184, right:192, bottom:24, width:'auto', height:'auto'}}>

          {/* district outlines (footprint on ground) */}
          {districts.map(d => {
            const A = project(d.x,        d.y,        0);
            const B = project(d.x+d.w,    d.y,        0);
            const C = project(d.x+d.w,    d.y+d.h,    0);
            const D = project(d.x,        d.y+d.h,    0);
            const lab = project(d.x+1, d.y+3, 0);
            return (
              <g key={d.id}>
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={d.color} fillOpacity="0.04" stroke={d.color} strokeWidth="0.7"
                  strokeDasharray="3 2" opacity="0.7"/>
                <text x={lab[0]} y={lab[1]} fontFamily={GB.mono} fontSize="9" fontWeight="700"
                  fill={d.color} letterSpacing="0.1em" opacity="0.85">{d.label}</text>
              </g>
            );
          })}

          {/* "roads" (import dependency lines between district centers) */}
          {(() => {
            const center = (d) => project(d.x+d.w/2, d.y+d.h/2, 0);
            const links = [
              ['ui','api'], ['api','db'], ['auth','api'], ['auth','db'],
              ['test','auth'],['test','api'],['test','ui'],['test','db'],
            ];
            return links.map((l,i)=>{
              const a = center(districts.find(d=>d.id===l[0]));
              const b = center(districts.find(d=>d.id===l[1]));
              return <path key={i} d={`M${a[0]},${a[1]} L${b[0]},${b[1]}`}
                stroke={GB.cyan} strokeWidth="0.5" strokeDasharray="2 3" opacity="0.35"/>;
            });
          })()}

          {/* buildings, sorted back-to-front by gx+gy */}
          {[...buildings].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map((b,i)=>{
            const A = project(b.x, b.y, 0);
            const B = project(b.x+b.w, b.y, 0);
            const C = project(b.x+b.w, b.y+b.h, 0);
            const D = project(b.x, b.y+b.h, 0);
            const A2= project(b.x, b.y, b.z);
            const B2= project(b.x+b.w, b.y, b.z);
            const C2= project(b.x+b.w, b.y+b.h, b.z);
            const D2= project(b.x, b.y+b.h, b.z);
            const col = b.status==='err'?GB.red : b.status==='warn'?GB.amber : GB.cyan;
            const top = project(b.x+b.w/2, b.y+b.h/2, b.z);
            return (
              <g key={i}>
                {/* base */}
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={col} fillOpacity="0.05" stroke="none"/>
                {/* hidden back edges */}
                <path d={`M${B[0]},${B[1]} L${C[0]},${C[1]} L${C2[0]},${C2[1]}`}
                  fill="none" stroke={col} strokeWidth="0.5" strokeDasharray="2 2" opacity="0.35"/>
                {/* base outline */}
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill="none" stroke={col} strokeWidth="0.9" opacity="0.9"/>
                {/* verticals */}
                <path d={`M${A[0]},${A[1]} L${A2[0]},${A2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${B[0]},${B[1]} L${B2[0]},${B2[1]}`} stroke={col} strokeWidth="1"/>
                <path d={`M${D[0]},${D[1]} L${D2[0]},${D2[1]}`} stroke={col} strokeWidth="1"/>
                {/* top */}
                <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                  fill={col} fillOpacity="0.10" stroke={col} strokeWidth="1"/>
                {/* floor lines */}
                {[...Array(Math.max(1,Math.floor(b.z/4)))].map((_,j)=>{
                  const z = (j+1)*4;
                  if (z >= b.z) return null;
                  const F = project(b.x, b.y, z), G = project(b.x+b.w, b.y, z);
                  const H2 = project(b.x, b.y+b.h, z);
                  return <g key={j} opacity="0.35">
                    <path d={`M${F[0]},${F[1]} L${G[0]},${G[1]}`} stroke={col} strokeWidth="0.4"/>
                    <path d={`M${F[0]},${F[1]} L${H2[0]},${H2[1]}`} stroke={col} strokeWidth="0.4"/>
                  </g>;
                })}
                {/* status pip */}
                {b.status==='err' && (
                  <g className="gb-flash">
                    <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                      fill={GB.red} opacity="0.45"/>
                  </g>
                )}
                <circle cx={top[0]} cy={top[1]-3} r="2"
                  fill={b.status==='err'?GB.red:b.status==='warn'?GB.amber:b.status==='ok'?GB.green:col}
                  className={b.status==='err'?'gb-blink':''}/>
                {/* label */}
                <text x={top[0]} y={top[1]-7} textAnchor="middle"
                  fontFamily={GB.mono} fontSize="6.5" fill={col} opacity="0.92">{b.label}</text>
              </g>
            );
          })}

          {/* agents */}
          {agents.map((a,i) => {
            const target = a.bldg ? project(a.bldg.x, a.bldg.y, a.bldg.z) : null;
            const pos = a.bldg
              ? [target[0]+a.off[0], target[1]+a.off[1]]
              : a.free;
            return (
              <g key={a.name}>
                {target && (() => {
                  // beam pulses around the building (top center)
                  const top = project(a.bldg.x, a.bldg.y, a.bldg.z);
                  return (
                    <g className="gb-beam">
                      <path d={`M${pos[0]-7},${pos[1]+3} L${top[0]-5},${top[1]} L${top[0]+5},${top[1]} L${pos[0]+7},${pos[1]+3} Z`}
                        fill={a.color} fillOpacity="0.13" stroke={a.color} strokeWidth="0.5" strokeDasharray="1.5 1.5"/>
                    </g>
                  );
                })()}
                <g className="gb-ufo">
                  {/* dome */}
                  <path d={`M${pos[0]-5},${pos[1]-1} Q${pos[0]},${pos[1]-7} ${pos[0]+5},${pos[1]-1}`}
                    fill="none" stroke={a.color} strokeWidth="1"/>
                  <path d={`M${pos[0]-9},${pos[1]+1} L${pos[0]-5.5},${pos[1]-1} L${pos[0]+5.5},${pos[1]-1} L${pos[0]+9},${pos[1]+1} L${pos[0]+5.5},${pos[1]+3} L${pos[0]-5.5},${pos[1]+3} Z`}
                    fill={GB.bg} stroke={a.color} strokeWidth="1"/>
                  <path d={`M${pos[0]-9},${pos[1]+1} L${pos[0]+9},${pos[1]+1}`} stroke={a.color} strokeWidth="0.6" opacity="0.7"/>
                  <circle cx={pos[0]-5} cy={pos[1]+2} r="0.8" fill={a.color} className={a.err?'gb-blink':''}/>
                  <circle cx={pos[0]} cy={pos[1]+2.2} r="0.8" fill={a.color}/>
                  <circle cx={pos[0]+5} cy={pos[1]+2} r="0.8" fill={a.color} className={a.err?'gb-blink':''}/>
                </g>
                <text x={pos[0]+11} y={pos[1]-1} fontFamily={GB.mono} fontSize="7"
                  fontWeight="700" fill={a.color}>{a.name}</text>
                <text x={pos[0]+11} y={pos[1]+5} fontFamily={GB.mono} fontSize="5.5"
                  fill={a.color} opacity="0.7">{a.task}</text>
              </g>
            );
          })}

          {/* compass */}
          <g transform="translate(720, 30)">
            <circle r="14" fill="none" stroke={GB.cyan} strokeWidth="0.6" opacity="0.5"/>
            <path d="M0,-12 L0,12 M-12,0 L12,0" stroke={GB.cyan} strokeWidth="0.5" opacity="0.4"/>
            <path d="M0,-10 L-3,2 L0,0 L3,2 Z" fill={GB.cyan}/>
            <text x="0" y="-15" textAnchor="middle" fontFamily={GB.mono} fontSize="6" fill={GB.cyan}>N</text>
          </g>

          {/* coords readout */}
          <g transform="translate(20, 460)">
            <text fontFamily={GB.mono} fontSize="7" fill={GB.cyan} opacity="0.7">
              CAM iso(30°) · ZOOM 1.0× · POS [380, 80] · LOD=file
            </text>
          </g>
        </svg>

        {/* ===== BOTTOM TICKER ===== */}
        <div style={{position:'absolute', bottom:0, left:0, right:0, zIndex:6,
          background:'rgba(5,8,14,0.9)'}}>
          <Ticker color={GB.cyan} items={[
            'A-02 :: schema.ts:42 :: TypeError: cannot read property `id` of undefined',
            'A-01 :: session.ts :: refactoring auth flow (62%)',
            'CI #284 :: 147/152 tests pass :: 12.4s',
            'A-03 :: Modal.tsx :: ready for review',
            'NEW BUG :: api/handlers :: rate-limit overflow',
            'A-04 :: idle :: awaiting dispatch',
          ]}/>
        </div>
      </div>
    </div>
  );
}

window.SketchA = SketchA;
