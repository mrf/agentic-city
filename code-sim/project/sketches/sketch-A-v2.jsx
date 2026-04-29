// SKETCH A v2 — solarized-dark, action-on-screen.
// Hero isometric city. HUD compressed to slim left rail + slim right rail
// + thin bottom strip; the city fills almost the whole frame.
// Agents fly along visible paths between buildings.

function SketchAv2() {
  // ── city data ───────────────────────────────────────────────
  // Building.lang -> color tint
  const langCol = {
    ts:  SD.blue,
    tsx: SD.violet,
    sql: SD.cyan,
    css: SD.magenta,
    md:  SD.greenDim,
    spec:SD.yellow,
  };

  const districts = [
    { id:'auth', x:14, y:10, w:24, h:24, label:'AUTH/' },
    { id:'api',  x:42, y:8,  w:32, h:24, label:'API/' },
    { id:'ui',   x:14, y:38, w:34, h:24, label:'UI/' },
    { id:'db',   x:52, y:38, w:28, h:24, label:'DATA/' },
    { id:'test', x:14, y:66, w:66, h:12, label:'TESTS/' },
  ];

  const buildings = [
    // AUTH
    { id:'login',     d:'auth', x:16, y:12, w:8,  h:7,  z:14, l:'login.tsx',   lang:'tsx', cov:0.82, exp:1, st:'ok'   },
    { id:'oauth',     d:'auth', x:26, y:12, w:6,  h:6,  z:8,  l:'oauth.ts',    lang:'ts',  cov:0.74, exp:0, st:'ok'   },
    { id:'session',   d:'auth', x:16, y:22, w:10, h:6,  z:18, l:'session.ts',  lang:'ts',  cov:0.61, exp:1, st:'warn', editing:true },
    { id:'jwt',       d:'auth', x:28, y:20, w:5,  h:8,  z:6,  l:'jwt.ts',      lang:'ts',  cov:0.92, exp:0, st:'ok'   },
    { id:'guards',    d:'auth', x:16, y:30, w:8,  h:3,  z:4,  l:'guards.ts',   lang:'ts',  cov:0.55, exp:0, st:'ok'   },
    // API
    { id:'router',    d:'api',  x:44, y:10, w:9,  h:9,  z:22, l:'router.ts',   lang:'ts',  cov:0.78, exp:2, st:'ok'   },
    { id:'middleware',d:'api',  x:55, y:12, w:7,  h:7,  z:12, l:'middleware/', lang:'ts',  cov:0.70, exp:1, st:'ok'   },
    { id:'handlers',  d:'api',  x:44, y:21, w:6,  h:7,  z:10, l:'handlers/',   lang:'ts',  cov:0.66, exp:0, st:'ok'   },
    { id:'schema',    d:'api',  x:52, y:21, w:8,  h:6,  z:14, l:'schema.ts',   lang:'ts',  cov:0.34, exp:1, st:'err'  },
    { id:'errors',    d:'api',  x:62, y:21, w:5,  h:5,  z:7,  l:'errors.ts',   lang:'ts',  cov:0.81, exp:0, st:'ok'   },
    { id:'validators',d:'api',  x:64, y:11, w:5,  h:5,  z:8,  l:'validators',  lang:'ts',  cov:0.72, exp:0, st:'ok'   },
    // UI
    { id:'button',    d:'ui',   x:16, y:40, w:6,  h:6,  z:9,  l:'Button.tsx',  lang:'tsx', cov:0.88, exp:1, st:'ok'   },
    { id:'modal',     d:'ui',   x:24, y:40, w:8,  h:8,  z:13, l:'Modal.tsx',   lang:'tsx', cov:0.79, exp:1, st:'ok',   editing:true },
    { id:'form',      d:'ui',   x:34, y:40, w:6,  h:8,  z:11, l:'Form.tsx',    lang:'tsx', cov:0.42, exp:0, st:'warn' },
    { id:'theme',     d:'ui',   x:16, y:50, w:10, h:6,  z:16, l:'theme.ts',    lang:'ts',  cov:0.66, exp:1, st:'ok'   },
    { id:'icons',     d:'ui',   x:28, y:50, w:6,  h:5,  z:7,  l:'icons/',      lang:'tsx', cov:0.50, exp:0, st:'ok'   },
    { id:'tokens',    d:'ui',   x:36, y:50, w:5,  h:5,  z:6,  l:'tokens.ts',   lang:'ts',  cov:0.95, exp:1, st:'ok'   },
    { id:'pages',     d:'ui',   x:16, y:58, w:24, h:3,  z:4,  l:'pages/',      lang:'tsx', cov:0.60, exp:0, st:'ok'   },
    // DB
    { id:'sql',       d:'db',   x:54, y:40, w:11, h:8,  z:24, l:'schema.sql',  lang:'sql', cov:0.74, exp:2, st:'ok'   },
    { id:'migrate',   d:'db',   x:67, y:42, w:6,  h:6,  z:10, l:'migrate.ts',  lang:'ts',  cov:0.80, exp:0, st:'ok'   },
    { id:'queries',   d:'db',   x:54, y:50, w:8,  h:7,  z:14, l:'queries/',    lang:'ts',  cov:0.68, exp:1, st:'ok'   },
    { id:'pool',      d:'db',   x:64, y:50, w:6,  h:6,  z:9,  l:'pool.ts',     lang:'ts',  cov:0.72, exp:0, st:'ok'   },
    // TESTS
    { id:'authspec',  d:'test', x:16, y:68, w:6,  h:5,  z:5,  l:'auth.spec',   lang:'spec',cov:1,    exp:0, st:'ok'   },
    { id:'apispec',   d:'test', x:24, y:68, w:6,  h:5,  z:5,  l:'api.spec',    lang:'spec',cov:1,    exp:0, st:'err'  },
    { id:'uispec',    d:'test', x:32, y:68, w:6,  h:5,  z:5,  l:'ui.spec',     lang:'spec',cov:1,    exp:0, st:'warn' },
    { id:'dbspec',    d:'test', x:40, y:68, w:6,  h:5,  z:5,  l:'db.spec',     lang:'spec',cov:1,    exp:0, st:'ok'   },
    { id:'e2espec',   d:'test', x:48, y:68, w:6,  h:5,  z:5,  l:'e2e.spec',    lang:'spec',cov:1,    exp:0, st:'ok'   },
    { id:'loadspec',  d:'test', x:56, y:68, w:6,  h:5,  z:5,  l:'load.spec',   lang:'spec',cov:1,    exp:0, st:'ok'   },
    { id:'fuzzspec',  d:'test', x:64, y:68, w:6,  h:5,  z:5,  l:'fuzz.spec',   lang:'spec',cov:1,    exp:0, st:'ok'   },
    { id:'snapspec',  d:'test', x:72, y:68, w:6,  h:5,  z:5,  l:'snap.spec',   lang:'spec',cov:1,    exp:0, st:'ok'   },
  ];

  // ── iso projection ──────────────────────────────────────────
  // iso_x(gx,gy) = ox + (gx+gy)*cos30*sc
  // iso_y(gx,gy) = oy + (gy-gx)*sin30*sc - z*sc*0.55
  // Grid x:14→80, y:8→78.
  //   sx range: (14+8)..(80+78) = 22..158, span 136 (in grid·cos30 units = 117.8)
  //   sy range: (8-80)..(78-14) = -72..64, span 136 (in grid·sin30 units = 68)
  // SVG viewBox 760x480; want city centered with margins.
  // Try sc=4 → iso width = 117.8*4 = 471, iso height = 68*4 = 272. Fits with room for spires/UFOs.
  const sc = 4;
  const COS30 = Math.cos(Math.PI/6), SIN30 = Math.sin(Math.PI/6);
  // ox: left-most x is at (gx,gy)=(14,8), iso=22*COS30*sc=76.2. Want at ~70 → ox = -6.
  const ox = -6;
  // oy: smallest sy at (gx,gy)=(80,8), sy=(8-80)= -72 → iso_y = oy + -72*SIN30*sc = oy - 144.
  // Tallest building z=24 lifts further by 24*sc*0.55=53. Want top ~60 → oy = 60 + 144 + 53 = 257.
  const oy = 250;
  const ISO_X = [COS30, -SIN30];
  const ISO_Y = [COS30,  SIN30];
  const project = (gx, gy, z=0) => [
    ox + (gx*ISO_X[0] + gy*ISO_Y[0])*sc,
    oy + (gx*ISO_X[1] + gy*ISO_Y[1])*sc - z*sc*0.55,
  ];
  const buildingAt = (id) => buildings.find(b=>b.id===id);
  const roofTop = (b) => project(b.x+b.w/2, b.y+b.h/2, b.z);
  const roofCorner = (b, c) => {
    const [dx, dy] = c==='NW'?[0,0]:c==='NE'?[b.w,0]:c==='SE'?[b.w,b.h]:[0,b.h];
    return project(b.x+dx, b.y+dy, b.z);
  };

  // ── agents (8) — some on buildings, some flying paths ───────
  const agents = [
    // working agents (parked over a building)
    { id:'A-01', task:'refactor session.ts',   on:'session',  col:SD.yellow, prog:62, mode:'work' },
    { id:'A-02', task:'fix schema.ts test',    on:'schema',   col:SD.red,    prog:14, mode:'work', err:true },
    { id:'A-03', task:'review Modal.tsx',      on:'modal',    col:SD.green,  prog:88, mode:'work' },
    { id:'A-05', task:'docs schema.sql',       on:'sql',      col:SD.violet, prog:41, mode:'work' },
    // flying agents — moving between two buildings
    { id:'A-04', task:'router → handlers',     from:'router',   to:'handlers',  col:SD.blue,    mode:'fly', dir:1 },
    { id:'A-06', task:'tokens → theme',        from:'tokens',   to:'theme',     col:SD.cyan,    mode:'fly', dir:2 },
    { id:'A-07', task:'queries → migrate',     from:'queries',  to:'migrate',   col:SD.orange,  mode:'fly', dir:1 },
    { id:'A-08', task:'login → guards',        from:'login',    to:'guards',    col:SD.magenta, mode:'fly', dir:2 },
  ];

  // ── dependency edges (drawn faint) ──────────────────────────
  const depEdges = [
    ['login','session'], ['login','jwt'], ['oauth','session'], ['session','guards'],
    ['router','middleware'], ['router','handlers'], ['handlers','schema'],
    ['handlers','validators'], ['schema','errors'],
    ['modal','button'], ['form','modal'], ['theme','tokens'], ['icons','theme'],
    ['pages','modal'], ['pages','form'],
    ['queries','sql'], ['migrate','sql'], ['queries','pool'],
    ['handlers','queries'], ['session','queries'],
    ['authspec','session'], ['apispec','schema'], ['apispec','router'],
    ['uispec','modal'], ['uispec','form'], ['dbspec','queries'],
  ];

  return (
    <div className="sd-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>
      <div className="sd-scan" style={{top:'30%'}}/>
      <div className="sd-content" style={{position:'absolute', inset:0}}>

        {/* ────────── SLIM TOP BAR ────────── */}
        <div style={{position:'absolute', top:0, left:0, right:0, height:22,
          borderBottom:`1px solid ${SD.base01}`, display:'flex', alignItems:'center',
          padding:'0 10px', gap:14, fontFamily:SD.mono, fontSize:9, color:SD.base0,
          background:SD.base02, zIndex:30}}>
          <span style={{color:SD.base1, fontWeight:700, letterSpacing:'0.18em'}}>◈ CODE-SIM</span>
          <span style={{opacity:.55}}>app-monorepo</span>
          <span style={{opacity:.55}}>feat/agents</span>
          <span style={{opacity:.55}}>a3f29d1</span>
          <span style={{flex:1}}/>
          <span><span style={{color:SD.green}}>●</span> ci=ok</span>
          <span><span style={{color:SD.yellow}}>●</span> 147/152</span>
          <span><span style={{color:SD.red}}>●</span> 1 bug</span>
          <span style={{opacity:.55}}>cam:iso · z=1.0× · LOD=file</span>
        </div>

        {/* ────────── LEFT RAIL — slim agent roster ────────── */}
        <div style={{position:'absolute', top:22, left:0, bottom:18, width:96, zIndex:25,
          borderRight:`1px solid ${SD.base01}`, background:'rgba(13,16,20,0.7)',
          display:'flex', flexDirection:'column'}}>
          <div style={{padding:'4px 6px', borderBottom:`1px solid ${SD.base01}`,
            fontSize:8, color:SD.base1, fontWeight:600, letterSpacing:'0.15em',
            display:'flex', justifyContent:'space-between'}}>
            <span>AGENTS</span><span style={{opacity:.55}}>8/8</span>
          </div>
          <div style={{flex:1, overflow:'hidden'}}>
            {agents.map(a => (
              <div key={a.id} style={{padding:'3px 6px', borderBottom:`1px dotted ${SD.base01}80`,
                fontSize:8, lineHeight:1.35}}>
                <div style={{display:'flex', justifyContent:'space-between'}}>
                  <span style={{color:a.col, fontWeight:700}}>◇{a.id.slice(2)}</span>
                  <span style={{opacity:.55, fontSize:7.5}}>{a.mode==='fly'?'fly':a.prog+'%'}</span>
                </div>
                <div style={{color:SD.base0, opacity:.75, fontSize:7.5,
                  whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{a.task}</div>
                {a.mode==='work' && (
                  <div style={{height:1.5, background:SD.base01, marginTop:1}}>
                    <div style={{height:'100%', width:`${a.prog}%`, background:a.col}}/>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{padding:'4px 6px', borderTop:`1px solid ${SD.base01}`, fontSize:8,
            color:SD.yellow}}>
            [+] DISPATCH ⌘K
          </div>
        </div>

        {/* ────────── RIGHT RAIL — selected + activity + stats ────────── */}
        <div style={{position:'absolute', top:22, right:0, bottom:18, width:128, zIndex:25,
          borderLeft:`1px solid ${SD.base01}`, background:'rgba(13,16,20,0.7)',
          display:'flex', flexDirection:'column'}}>

          <div style={{padding:'4px 6px', borderBottom:`1px solid ${SD.base01}`,
            fontSize:8, color:SD.base1, fontWeight:600, letterSpacing:'0.15em',
            display:'flex', justifyContent:'space-between'}}>
            <span>SELECTED</span><span style={{color:SD.red, opacity:.85}}>schema.ts</span>
          </div>
          <div style={{padding:'4px 6px', borderBottom:`1px solid ${SD.base01}`, fontSize:8, lineHeight:1.5}}>
            {[
              ['path','api/'],['lang','ts'],['LOC','340'],
              ['cov','34%','red'],['tests','2/8','red'],['agent','A-02','red'],
            ].map(([k,v,c],i)=>(
              <div key={i} style={{display:'flex', justifyContent:'space-between'}}>
                <span style={{opacity:.55}}>{k}</span>
                <span style={{color: c==='red'?SD.red:SD.base0, fontVariantNumeric:'tabular-nums'}}>{v}</span>
              </div>
            ))}
            <div style={{borderTop:`1px dashed ${SD.red}50`, marginTop:3, paddingTop:3,
              color:SD.red, fontSize:7.5, lineHeight:1.4}}>
              ▲ TypeError: cannot read<br/>property `id` of undefined<br/>
              <span style={{opacity:.55, color:SD.base0}}>at line 42:18</span>
            </div>
          </div>

          <div style={{padding:'4px 6px', borderBottom:`1px solid ${SD.base01}`,
            fontSize:8, color:SD.base1, fontWeight:600, letterSpacing:'0.15em'}}>
            ACTIVITY
          </div>
          <div style={{flex:1, overflow:'hidden', padding:'2px 6px', fontSize:7.5, lineHeight:1.5}}>
            {[
              ['16:42:08','A-02','schema FAIL',SD.red],
              ['16:42:01','A-03','commit Modal',SD.green],
              ['16:41:54','A-01','edit session',SD.yellow],
              ['16:41:30','A-05','open sql',SD.violet],
              ['16:40:12','CI','build #284',SD.green],
              ['16:39:48','A-04','fly→handler',SD.blue],
              ['16:39:11','YOU','dispatch A-02',SD.base1],
              ['16:38:50','A-08','fly→guards',SD.magenta],
              ['16:38:22','A-06','fly→theme',SD.cyan],
              ['16:38:05','A-07','fly→migrate',SD.orange],
            ].map((e,i)=>(
              <div key={i} style={{display:'flex', gap:4, color:SD.base0,
                borderBottom:`1px dotted ${SD.base01}80`, padding:'1px 0'}}>
                <span style={{opacity:.45, fontVariantNumeric:'tabular-nums', fontSize:7}}>{e[0].slice(3)}</span>
                <span style={{color:e[3], fontWeight:600, minWidth:24, fontSize:7.5}}>{e[1]}</span>
                <span style={{flex:1, opacity:.85, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', fontSize:7.5}}>{e[2]}</span>
              </div>
            ))}
          </div>

          <div style={{padding:'4px 6px', borderTop:`1px solid ${SD.base01}`, fontSize:7.5, lineHeight:1.5,
            display:'grid', gridTemplateColumns:'1fr 1fr', columnGap:6}}>
            <span style={{opacity:.55}}>files</span><span style={{textAlign:'right'}}>1284</span>
            <span style={{opacity:.55}}>LOC</span><span style={{textAlign:'right'}}>86420</span>
            <span style={{opacity:.55}}>cov</span><span style={{textAlign:'right', color:SD.yellow}}>74.2%</span>
            <span style={{opacity:.55}}>PRs</span><span style={{textAlign:'right'}}>6</span>
          </div>

          {/* mini-map at bottom of right rail */}
          <div style={{borderTop:`1px solid ${SD.base01}`, padding:'4px 4px 6px'}}>
            <div style={{fontSize:7.5, color:SD.base1, opacity:.7, marginBottom:2}}>MAP</div>
            <svg viewBox="0 0 90 60" style={{width:'100%', height:50, display:'block'}}>
              {districts.map(d=>(
                <rect key={d.id} x={d.x*1.05-12} y={d.y*0.75-2} width={d.w*1.05} height={d.h*0.75}
                  fill="none" stroke={SD.base00} strokeWidth="0.5" opacity="0.6"/>
              ))}
              <rect x="2" y="6" width="80" height="48" fill="none" stroke={SD.yellow} strokeWidth="0.5" strokeDasharray="2 1"/>
              {agents.map((a,i)=>{
                const b = a.on ? buildingAt(a.on) : buildingAt(a.from);
                if (!b) return null;
                return <circle key={i} cx={b.x*1.05-12+b.w*0.5} cy={b.y*0.75-2+b.h*0.4}
                  r="0.9" fill={a.col}/>;
              })}
            </svg>
          </div>
        </div>

        {/* ────────── CITY (fills middle) ────────── */}
        <svg viewBox="0 0 760 480" preserveAspectRatio="xMidYMid meet"
          style={{position:'absolute', top:22, left:96, right:128, bottom:18}}>

          {/* district outlines */}
          {districts.map(d => {
            const A = project(d.x,d.y,0), B=project(d.x+d.w,d.y,0);
            const C = project(d.x+d.w,d.y+d.h,0), D=project(d.x,d.y+d.h,0);
            const lab = project(d.x+1, d.y+2, 0);
            return (
              <g key={d.id}>
                <path d={`M${A[0]},${A[1]} L${B[0]},${B[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={SD.base02} fillOpacity="0.6" stroke={SD.base01} strokeWidth="0.7"
                  strokeDasharray="3 2"/>
                <text x={lab[0]} y={lab[1]+4} fontFamily={SD.mono} fontSize="11" fontWeight="700"
                  fill={SD.base2} letterSpacing="0.18em" opacity="0.85">{d.label}</text>
              </g>
            );
          })}

          {/* faint dependency roads — between building tops */}
          <g style={{display:'var(--show-roads, inline)'}}>
            {depEdges.map(([f,t],i)=>{
              const fb = buildingAt(f), tb = buildingAt(t);
              if (!fb || !tb) return null;
              const a = project(fb.x+fb.w/2, fb.y+fb.h/2, 0);
              const b = project(tb.x+tb.w/2, tb.y+tb.h/2, 0);
              return <path key={i} d={`M${a[0]},${a[1]} L${b[0]},${b[1]}`}
                stroke={SD.base00} strokeWidth="0.4" opacity="0.32" strokeDasharray="2 3"/>;
            })}
          </g>

          {/* buildings (back-to-front) */}
          {[...buildings].sort((a,b)=>(a.x+a.y)-(b.x+b.y)).map(b => {
            const A = project(b.x, b.y, 0);
            const Bp= project(b.x+b.w, b.y, 0);
            const C = project(b.x+b.w, b.y+b.h, 0);
            const D = project(b.x, b.y+b.h, 0);
            const A2= project(b.x, b.y, b.z);
            const B2= project(b.x+b.w, b.y, b.z);
            const C2= project(b.x+b.w, b.y+b.h, b.z);
            const D2= project(b.x, b.y+b.h, b.z);
            const tint = langCol[b.lang] || SD.base00;
            const top = roofTop(b);
            const isErr = b.st==='err';
            const isWarn = b.st==='warn';
            const stroke = isErr ? SD.red : isWarn ? SD.yellow : SD.base0;

            return (
              <g key={b.id}>
                {/* footprint */}
                <path d={`M${A[0]},${A[1]} L${Bp[0]},${Bp[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill={tint} fillOpacity="0.05" stroke="none"/>
                {/* hidden back edges */}
                <path d={`M${Bp[0]},${Bp[1]} L${C[0]},${C[1]} L${C2[0]},${C2[1]}`}
                  fill="none" stroke={SD.base01} strokeWidth="0.5" strokeDasharray="2 2"/>
                {/* base outline */}
                <path d={`M${A[0]},${A[1]} L${Bp[0]},${Bp[1]} L${C[0]},${C[1]} L${D[0]},${D[1]} Z`}
                  fill="none" stroke={stroke} strokeWidth="0.85" opacity="0.85"/>
                {/* faces with subtle tint */}
                <path d={`M${A[0]},${A[1]} L${Bp[0]},${Bp[1]} L${B2[0]},${B2[1]} L${A2[0]},${A2[1]} Z`}
                  fill={tint} fillOpacity="0.10" stroke={stroke} strokeWidth="0.85"/>
                <path d={`M${A[0]},${A[1]} L${D[0]},${D[1]} L${D2[0]},${D2[1]} L${A2[0]},${A2[1]} Z`}
                  fill={tint} fillOpacity="0.06" stroke={stroke} strokeWidth="0.85"/>
                {/* roof */}
                <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                  fill={tint} fillOpacity="0.20" stroke={stroke} strokeWidth="0.95"/>

                {/* window density = test coverage; rows of dots on the front face */}
                {(() => {
                  const cov = b.cov;
                  const rows = Math.max(1, Math.floor(b.z/3.5));
                  const cols = Math.max(1, Math.floor(b.w*0.9));
                  const dots = [];
                  for (let r=0;r<rows;r++) {
                    for (let c=0;c<cols;c++) {
                      // skew along front face (A→B horizontally, A→A2 vertically)
                      const fx = c/(cols);
                      const fy = (r+0.5)/rows;
                      const px = A[0] + (Bp[0]-A[0])*fx + (A2[0]-A[0])*fy;
                      const py = A[1] + (Bp[1]-A[1])*fx + (A2[1]-A[1])*fy;
                      const lit = ((r*7+c*3+b.x+b.y) % 100) / 100 < cov;
                      if (!lit) continue;
                      dots.push(<rect key={`${r}-${c}`} x={px-0.6} y={py-0.4}
                        width="1.1" height="0.9" fill={tint} opacity={0.55}/>);
                    }
                  }
                  return dots;
                })()}

                {/* spires for exports — hidden for now */}
                {false && [...Array(b.exp)].map((_,i)=>{
                  const sx = top[0] + (i-(b.exp-1)/2)*3;
                  return <g key={i}>
                    <path d={`M${sx},${top[1]} L${sx},${top[1]-7}`} stroke={stroke} strokeWidth="0.9"/>
                    <circle cx={sx} cy={top[1]-7.5} r="0.9" fill={stroke}/>
                  </g>;
                })}

                {/* status flash overlay for err — modest, not screen-wide */}
                {isErr && (
                  <g className="sd-blink">
                    <path d={`M${A2[0]},${A2[1]} L${B2[0]},${B2[1]} L${C2[0]},${C2[1]} L${D2[0]},${D2[1]} Z`}
                      fill={SD.red} fillOpacity="0.28"/>
                  </g>
                )}

                {/* code-edit ring on roof for buildings being edited */}
                {b.editing && (
                  <g>
                    <circle cx={top[0]} cy={top[1]} r="1.2" fill={SD.yellow}/>
                    {[0,0.45,0.9].map(d=>(
                      <circle key={d} cx={top[0]} cy={top[1]} r="1" fill="none"
                        stroke={SD.yellow} strokeWidth="0.8" opacity="0.7"
                        className="sd-edit-ring" style={{animationDelay:`${d}s`}}/>
                    ))}
                  </g>
                )}

                {/* status pip */}
                <circle cx={top[0]} cy={top[1]-3} r="1.6"
                  fill={isErr?SD.red:isWarn?SD.yellow:SD.green}
                  className={isErr?'sd-blink':''}/>

                {/* floating label with backing plate */}
                <g style={{display:'var(--show-labels, inline)'}}>
                  <rect x={top[0] - b.l.length*2.6} y={top[1]-15}
                    width={b.l.length*5.2} height={8}
                    fill={SD.base03} fillOpacity="0.85"
                    stroke={isErr?SD.red:isWarn?SD.yellow:SD.base01} strokeWidth="0.4"/>
                  <text x={top[0]} y={top[1]-9} textAnchor="middle"
                    fontFamily={SD.mono} fontSize="5.6" fill={isErr?SD.red:isWarn?SD.yellow:SD.base2}
                    fontWeight={isErr?700:600} letterSpacing="0.04em">{b.l}</text>
                </g>
              </g>
            );
          })}

          {/* ============ FLYING AGENT TRAILS + AGENTS ============ */}
          {/* path defs */}
          <defs>
            {agents.filter(a=>a.mode==='fly').map(a => {
              const fb = buildingAt(a.from), tb = buildingAt(a.to);
              const f = project(fb.x+fb.w/2, fb.y+fb.h/2, fb.z+5);
              const t = project(tb.x+tb.w/2, tb.y+tb.h/2, tb.z+5);
              const mx = (f[0]+t[0])/2, my = Math.min(f[1], t[1]) - 28;
              return <path key={a.id} id={`path-${a.id}`}
                d={`M${f[0]},${f[1]} Q${mx},${my} ${t[0]},${t[1]}`} fill="none"/>;
            })}
          </defs>

          {/* visible trails */}
          {agents.filter(a=>a.mode==='fly').map(a => {
            const fb = buildingAt(a.from), tb = buildingAt(a.to);
            const f = project(fb.x+fb.w/2, fb.y+fb.h/2, fb.z+5);
            const t = project(tb.x+tb.w/2, tb.y+tb.h/2, tb.z+5);
            const mx = (f[0]+t[0])/2, my = Math.min(f[1], t[1]) - 28;
            return (
              <g key={a.id}>
                <path d={`M${f[0]},${f[1]} Q${mx},${my} ${t[0]},${t[1]}`}
                  fill="none" stroke={a.col} strokeWidth="0.6" opacity="0.45"
                  strokeDasharray="3 4" className="sd-trail"/>
                {/* end markers */}
                <circle cx={f[0]} cy={f[1]} r="1.3" fill="none" stroke={a.col} strokeWidth="0.7"/>
                <circle cx={t[0]} cy={t[1]} r="1.3" fill={a.col}/>
              </g>
            );
          })}

          {/* parked agents (working) — large, no animation */}
          {agents.filter(a=>a.mode==='work').map(a => {
            const b = buildingAt(a.on);
            const top = roofTop(b);
            const pos = [top[0], top[1]-44];  // higher above roof
            const S = 1; // scale multiplier
            return (
              <g key={a.id}>
                {/* tractor beam — thick trapezoid + scan lines */}
                <g>
                  <path d={`M${pos[0]-9},${pos[1]+4} L${top[0]-7},${top[1]} L${top[0]+7},${top[1]} L${pos[0]+9},${pos[1]+4} Z`}
                    fill={a.col} fillOpacity="0.10"/>
                  <path d={`M${pos[0]-9},${pos[1]+4} L${top[0]-7},${top[1]}`}
                    stroke={a.col} strokeWidth="0.6" opacity="0.6"/>
                  <path d={`M${pos[0]+9},${pos[1]+4} L${top[0]+7},${top[1]}`}
                    stroke={a.col} strokeWidth="0.6" opacity="0.6"/>
                  {/* horizontal beam scan lines */}
                  {[0.25,0.5,0.75].map((t,i) => {
                    const lx1 = pos[0]-9 + (top[0]-7 - (pos[0]-9))*t;
                    const lx2 = pos[0]+9 + (top[0]+7 - (pos[0]+9))*t;
                    const ly = pos[1]+4 + (top[1] - (pos[1]+4))*t;
                    return <path key={i} d={`M${lx1},${ly} L${lx2},${ly}`}
                      stroke={a.col} strokeWidth="0.4" opacity="0.45" strokeDasharray="1.5 1.5"/>;
                  })}
                  {/* impact ring on roof */}
                  <ellipse cx={top[0]} cy={top[1]} rx="7" ry="2" fill="none"
                    stroke={a.col} strokeWidth="0.7" opacity="0.85"/>
                  <ellipse cx={top[0]} cy={top[1]} rx="4" ry="1.1" fill={a.col} fillOpacity="0.55"/>
                </g>

                {/* UFO — disc + dome, ~3× larger */}
                <g>
                  {/* dome */}
                  <path d={`M${pos[0]-7},${pos[1]-2} Q${pos[0]},${pos[1]-11} ${pos[0]+7},${pos[1]-2} Z`}
                    fill={SD.base02} stroke={a.col} strokeWidth="1.2"/>
                  <path d={`M${pos[0]-4},${pos[1]-7.5} Q${pos[0]-1.5},${pos[1]-9.5} ${pos[0]+1},${pos[1]-9}`}
                    fill="none" stroke={a.col} strokeWidth="0.8" opacity="0.9"/>
                  {/* disc body — wide */}
                  <path d={`M${pos[0]-15},${pos[1]+1} L${pos[0]-9},${pos[1]-2.5} L${pos[0]+9},${pos[1]-2.5} L${pos[0]+15},${pos[1]+1} L${pos[0]+10},${pos[1]+4} L${pos[0]-10},${pos[1]+4} Z`}
                    fill={SD.base03} stroke={a.col} strokeWidth="1.3"/>
                  {/* top rim */}
                  <path d={`M${pos[0]-15},${pos[1]+1} L${pos[0]+15},${pos[1]+1}`}
                    stroke={a.col} strokeWidth="0.7" opacity="0.8"/>
                  {/* portholes */}
                  <circle cx={pos[0]-9} cy={pos[1]+2.5} r="1" fill={a.col} className={a.err?'sd-blink':''}/>
                  <circle cx={pos[0]-4.5} cy={pos[1]+2.5} r="1" fill={a.col}/>
                  <circle cx={pos[0]} cy={pos[1]+2.5} r="1" fill={a.col}/>
                  <circle cx={pos[0]+4.5} cy={pos[1]+2.5} r="1" fill={a.col}/>
                  <circle cx={pos[0]+9} cy={pos[1]+2.5} r="1" fill={a.col} className={a.err?'sd-blink':''}/>
                </g>

                {/* ID tag */}
                <rect x={pos[0]+17} y={pos[1]-5} width={a.id.length*4.2+4} height={8.5}
                  fill={SD.base03} fillOpacity="0.92" stroke={a.col} strokeWidth="0.5"/>
                <text x={pos[0]+19} y={pos[1]+1} fontFamily={SD.mono} fontSize="6.4" fontWeight="700" fill={a.col} letterSpacing="0.06em">{a.id}</text>
              </g>
            );
          })}

          {/* flying agents — animated along path via offset-path, larger UFO */}
          {agents.filter(a=>a.mode==='fly').map(a => {
            const fb = buildingAt(a.from), tb = buildingAt(a.to);
            const f = project(fb.x+fb.w/2, fb.y+fb.h/2, fb.z+10);
            const t = project(tb.x+tb.w/2, tb.y+tb.h/2, tb.z+10);
            const mx = (f[0]+t[0])/2, my = Math.min(f[1], t[1]) - 40;
            const dur = a.dir===1 ? 9 : 12;
            const animName = `sd-fly-${a.dir}`;
            const pathStr = `path("M${f[0]},${f[1]} Q${mx},${my} ${t[0]},${t[1]}")`;
            return (
              <g key={a.id} style={{
                offsetPath: pathStr,
                offsetRotate: '0deg',
                animation: `${animName} ${dur}s linear infinite`,
              }}>
                <g>
                  {/* dome */}
                  <path d={`M-7,-2 Q0,-11 7,-2 Z`} fill={SD.base02} stroke={a.col} strokeWidth="1.2"/>
                  <path d={`M-4,-7.5 Q-1.5,-9.5 1,-9`} fill="none" stroke={a.col} strokeWidth="0.8" opacity="0.9"/>
                  {/* disc body */}
                  <path d={`M-15,1 L-9,-2.5 L9,-2.5 L15,1 L10,4 L-10,4 Z`}
                    fill={SD.base03} stroke={a.col} strokeWidth="1.3"/>
                  <path d="M-15,1 L15,1" stroke={a.col} strokeWidth="0.7" opacity="0.8"/>
                  <circle cx="-9" cy="2.5" r="1" fill={a.col}/>
                  <circle cx="-4.5" cy="2.5" r="1" fill={a.col}/>
                  <circle cx="0" cy="2.5" r="1" fill={a.col}/>
                  <circle cx="4.5" cy="2.5" r="1" fill={a.col}/>
                  <circle cx="9" cy="2.5" r="1" fill={a.col}/>
                </g>
                <rect x="17" y="-5" width={a.id.length*4.2+4} height="8.5" fill={SD.base03} fillOpacity="0.92" stroke={a.col} strokeWidth="0.5"/>
                <text x="19" y="1" fontFamily={SD.mono} fontSize="6.4" fontWeight="700" fill={a.col} letterSpacing="0.06em">{a.id}</text>
              </g>
            );
          })}

          {/* compass + LOD readout in city */}
          <g transform="translate(720, 30)" opacity="0.55">
            <circle r="11" fill="none" stroke={SD.base00} strokeWidth="0.5"/>
            <path d="M0,-9 L-2.4,1.5 L0,0 L2.4,1.5 Z" fill={SD.base0}/>
            <text x="0" y="-13" textAnchor="middle" fontFamily={SD.mono} fontSize="5.5" fill={SD.base0}>N</text>
          </g>
          <g transform="translate(20, 470)" opacity="0.55">
            <text fontFamily={SD.mono} fontSize="6" fill={SD.base0}>
              cam=iso(30°) · pos[360,60] · zoom 1.0× · 5 districts · 30 files visible
            </text>
          </g>
        </svg>

        {/* ────────── BOTTOM STRIP ────────── */}
        <div style={{position:'absolute', bottom:0, left:0, right:0, height:18, zIndex:30,
          background:SD.base02, borderTop:`1px solid ${SD.base01}`,
          display:'flex', alignItems:'center', padding:'0 10px', gap:14,
          fontFamily:SD.mono, fontSize:8, color:SD.base0}}>
          <span><span style={{color:SD.yellow}}>[D]</span> dispatch</span>
          <span><span style={{color:SD.yellow}}>[L]</span> lasso</span>
          <span><span style={{color:SD.yellow}}>[Z]</span> zoom</span>
          <span><span style={{color:SD.yellow}}>[⌘K]</span> palette</span>
          <span style={{flex:1}}/>
          <span style={{opacity:.7}}>4 fly · 4 work · 1 bug · ★ all systems nominal except api/schema.ts</span>
        </div>
      </div>
    </div>
  );
}

window.SketchAv2 = SketchAv2;
