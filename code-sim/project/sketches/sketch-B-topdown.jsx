// SKETCH B — Top-down 2D blueprint view.
// More schematic, denser, easier to skim. Districts as nested rectangles.

function SketchB() {
  const districts = [
    { id:'auth', x:24, y:50, w:170, h:120, label:'AUTH/', files:[
      { x:8, y:18, w:42, h:28, l:'login.tsx',   loc:284, st:'ok' },
      { x:54,y:18, w:36, h:24, l:'oauth.ts',    loc:142, st:'ok' },
      { x:94,y:18, w:32, h:32, l:'session.ts',  loc:412, st:'warn' },
      { x:130,y:18,w:32, h:24, l:'jwt.ts',      loc:88,  st:'ok' },
      { x:8, y:54, w:60, h:46, l:'middleware/', loc:520, st:'ok' },
      { x:72,y:54, w:54, h:46, l:'providers/',  loc:380, st:'ok' },
      { x:130,y:54,w:32, h:46, l:'utils.ts',    loc:96,  st:'ok' },
    ]},
    { id:'api', x:210, y:50, w:220, h:120, label:'API/', files:[
      { x:8, y:18, w:48, h:36, l:'router.ts',     loc:602, st:'ok' },
      { x:60,y:18, w:42, h:28, l:'middleware',    loc:240, st:'ok' },
      { x:106,y:18,w:46, h:32, l:'handlers/',     loc:884, st:'ok' },
      { x:156,y:18,w:54, h:32, l:'schema.ts',     loc:340, st:'err' },
      { x:8, y:58, w:42, h:42, l:'errors.ts',     loc:120, st:'ok' },
      { x:54,y:58, w:48, h:42, l:'validators/',   loc:280, st:'ok' },
      { x:106,y:58,w:48, h:42, l:'serializers/',  loc:204, st:'ok' },
      { x:158,y:58,w:52, h:42, l:'rate-limit.ts', loc:96,  st:'warn' },
    ]},
    { id:'ui', x:24, y:184, w:230, h:140, label:'UI/', files:[
      { x:8, y:18, w:36, h:28, l:'Button.tsx', loc:64,  st:'ok' },
      { x:48,y:18, w:42, h:34, l:'Modal.tsx',  loc:220, st:'ok' },
      { x:94,y:18, w:38, h:28, l:'Form.tsx',   loc:184, st:'warn' },
      { x:136,y:18,w:38, h:28, l:'Table.tsx',  loc:312, st:'ok' },
      { x:178,y:18,w:42, h:34, l:'theme.ts',   loc:96,  st:'ok' },
      { x:8, y:56, w:54, h:36, l:'pages/',     loc:1240,st:'ok' },
      { x:66,y:56, w:42, h:36, l:'hooks/',     loc:540, st:'ok' },
      { x:112,y:56,w:42, h:36, l:'icons/',     loc:88,  st:'ok' },
      { x:158,y:56,w:62, h:36, l:'tokens.ts',  loc:142, st:'ok' },
      { x:8, y:96, w:212, h:36, l:'styles/',   loc:680, st:'ok' },
    ]},
    { id:'db', x:270, y:184, w:160, h:140, label:'DATA/', files:[
      { x:8, y:18, w:74, h:38, l:'schema.sql', loc:480, st:'ok' },
      { x:86,y:18, w:64, h:38, l:'migrations/',loc:340, st:'ok' },
      { x:8, y:60, w:50, h:34, l:'queries/',   loc:280, st:'ok' },
      { x:62,y:60, w:42, h:34, l:'pool.ts',    loc:140, st:'ok' },
      { x:108,y:60,w:42, h:34, l:'cache.ts',   loc:96,  st:'ok' },
      { x:8, y:98, w:142, h:34, l:'fixtures/', loc:204, st:'ok' },
    ]},
    { id:'tests', x:24, y:338, w:406, h:64, label:'TESTS/', files:[
      { x:8, y:18, w:46, h:36, l:'auth.spec',  loc:142, st:'ok' },
      { x:58,y:18, w:46, h:36, l:'api.spec',   loc:208, st:'err' },
      { x:108,y:18,w:46, h:36, l:'ui.spec',    loc:164, st:'warn' },
      { x:158,y:18,w:46, h:36, l:'db.spec',    loc:120, st:'ok' },
      { x:208,y:18,w:46, h:36, l:'e2e.spec',   loc:340, st:'ok' },
      { x:258,y:18,w:46, h:36, l:'load.spec',  loc:96,  st:'ok' },
      { x:308,y:18,w:46, h:36, l:'fuzz.spec',  loc:88,  st:'ok' },
      { x:358,y:18,w:42, h:36, l:'snap.spec',  loc:148, st:'ok' },
    ]},
  ];

  // Roads / dependencies between district centers (top-down).
  const districtCenter = (d) => [d.x + d.w/2, d.y + d.h/2];

  // Agents on top of specific files.
  const agents = [
    { id:'A-01', col:GB.amber,  on:{ d:'auth', file:'session.ts' }, task:'refactor' },
    { id:'A-02', col:GB.red,    on:{ d:'api',  file:'schema.ts' },  task:'fix-test', err:true },
    { id:'A-03', col:GB.green,  on:{ d:'ui',   file:'Modal.tsx' },  task:'review' },
    { id:'A-05', col:GB.magenta,on:{ d:'db',   file:'schema.sql' }, task:'docs' },
    { id:'A-04', col:GB.cyan,   free:[460, 30], task:'idle' },
    { id:'A-06', col:GB.cyan,   free:[480, 240], task:'idle' },
  ];

  const findFile = (dId, label) => {
    const d = districts.find(x=>x.id===dId);
    const f = d.files.find(x=>x.l===label);
    return [d.x + f.x + f.w/2, d.y + f.y + f.h/2];
  };

  return (
    <div className="gb-paper" style={{position:'absolute', inset:0, overflow:'hidden'}}>
      <div className="gb-content" style={{position:'absolute', inset:0}}>

        {/* ===== TOP BAR ===== */}
        <div style={{position:'absolute', top:0, left:0, right:0, height:30,
          borderBottom:`1px solid ${GB.cyan}40`, display:'flex', alignItems:'center',
          padding:'0 12px', gap:14, fontFamily:GB.mono, fontSize:9, color:GB.ink,
          background:'rgba(5,8,14,0.9)', zIndex:10}}>
          <span style={{color:GB.cyan, fontWeight:700, letterSpacing:'0.15em'}}>◫ TOP-DOWN</span>
          <span style={{opacity:.5}}>view=blueprint</span>
          <span style={{opacity:.5}}>lod=file</span>
          <span style={{opacity:.5}}>1284 files · 86,420 LOC</span>
          <span style={{flex:1}}/>
          <span><span style={{color:GB.amber}}>●</span> 2 warn</span>
          <span><span style={{color:GB.red}}>●</span> 1 err</span>
          <span><span style={{color:GB.green}}>●</span> 6 agents</span>
        </div>

        {/* main blueprint */}
        <svg viewBox="0 0 540 420" preserveAspectRatio="xMidYMid meet"
          style={{position:'absolute', top:30, left:8, right:188, bottom:24}}>

          {/* dependency roads (drawn first, behind buildings) */}
          {(() => {
            const links = [
              ['ui','api'], ['api','db'], ['auth','api'], ['auth','db'],
              ['tests','auth'], ['tests','api'], ['tests','ui'], ['tests','db'],
            ];
            return links.map(([a,b],i)=>{
              const A = districtCenter(districts.find(d=>d.id===a));
              const B = districtCenter(districts.find(d=>d.id===b));
              return <path key={i}
                d={`M${A[0]},${A[1]} L${B[0]},${B[1]}`}
                stroke={GB.cyan} strokeWidth="0.6" strokeDasharray="3 3" opacity="0.3"/>;
            });
          })()}

          {/* districts */}
          {districts.map(d => {
            const hasErr = d.files.some(f=>f.st==='err');
            return (
              <g key={d.id}>
                {hasErr && (
                  <rect x={d.x-2} y={d.y-2} width={d.w+4} height={d.h+4}
                    fill="none" stroke={GB.red} strokeWidth="0.8" opacity="0.5"
                    className="gb-blink"/>
                )}
                <rect x={d.x} y={d.y} width={d.w} height={d.h}
                  fill={GB.cyan} fillOpacity="0.025"
                  stroke={GB.cyan} strokeWidth="1" opacity="0.85"/>
                {/* district label tab */}
                <rect x={d.x} y={d.y-12} width={d.label.length*6+6} height={12}
                  fill={GB.cyan} fillOpacity="0.18" stroke={GB.cyan} strokeWidth="0.6"/>
                <text x={d.x+3} y={d.y-3} fontFamily={GB.mono} fontSize="8"
                  fontWeight="700" fill={GB.cyan} letterSpacing="0.1em">{d.label}</text>
                {/* file count tag */}
                <text x={d.x+d.w-2} y={d.y-3} textAnchor="end" fontFamily={GB.mono}
                  fontSize="7" fill={GB.cyan} opacity="0.6">
                  {d.files.length} files · {d.files.reduce((a,f)=>a+f.loc,0)} LOC
                </text>
                {/* files */}
                {d.files.map((f,i)=>{
                  const col = f.st==='err'?GB.red : f.st==='warn'?GB.amber : GB.cyan;
                  return (
                    <g key={i}>
                      {f.st==='err' && (
                        <rect x={d.x+f.x} y={d.y+f.y} width={f.w} height={f.h}
                          fill={GB.red} fillOpacity="0.35" className="gb-flash"/>
                      )}
                      <rect x={d.x+f.x} y={d.y+f.y} width={f.w} height={f.h}
                        fill={col} fillOpacity="0.05"
                        stroke={col} strokeWidth="0.7" opacity="0.9"/>
                      {/* corner ticks */}
                      {[[0,0],[f.w,0],[f.w,f.h],[0,f.h]].map(([cx,cy],ci)=>(
                        <circle key={ci} cx={d.x+f.x+cx} cy={d.y+f.y+cy} r="0.7" fill={col}/>
                      ))}
                      <text x={d.x+f.x+3} y={d.y+f.y+9}
                        fontFamily={GB.mono} fontSize="7" fontWeight="500" fill={col}>{f.l}</text>
                      <text x={d.x+f.x+3} y={d.y+f.y+f.h-3}
                        fontFamily={GB.mono} fontSize="5.5" fill={col} opacity="0.6">
                        {f.loc} LOC
                      </text>
                      {f.st !== 'ok' && (
                        <circle cx={d.x+f.x+f.w-4} cy={d.y+f.y+4} r="1.5"
                          fill={col} className={f.st==='err'?'gb-blink':''}/>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* agents on top of files */}
          {agents.map(a => {
            const pos = a.on ? findFile(a.on.d, a.on.file) : a.free;
            return (
              <g key={a.id}>
                {a.on && (
                  <g className="gb-beam">
                    {/* beam circle around target file */}
                    <circle cx={pos[0]} cy={pos[1]} r="14"
                      fill={a.col} fillOpacity="0.10"
                      stroke={a.col} strokeWidth="0.6" strokeDasharray="2 1.5"/>
                  </g>
                )}
                <g className="gb-ufo">
                  <path d={`M${pos[0]-4},${pos[1]-1.5} Q${pos[0]},${pos[1]-5} ${pos[0]+4},${pos[1]-1.5}`}
                    fill="none" stroke={a.col} strokeWidth="0.9"/>
                  <path d={`M${pos[0]-7},${pos[1]} L${pos[0]-4.5},${pos[1]-1.5} L${pos[0]+4.5},${pos[1]-1.5} L${pos[0]+7},${pos[1]} L${pos[0]+4.5},${pos[1]+1.5} L${pos[0]-4.5},${pos[1]+1.5} Z`}
                    fill={GB.bg} stroke={a.col} strokeWidth="0.9"/>
                  <circle cx={pos[0]-4} cy={pos[1]+0.5} r="0.6" fill={a.col} className={a.err?'gb-blink':''}/>
                  <circle cx={pos[0]} cy={pos[1]+0.7} r="0.6" fill={a.col}/>
                  <circle cx={pos[0]+4} cy={pos[1]+0.5} r="0.6" fill={a.col} className={a.err?'gb-blink':''}/>
                </g>
                <text x={pos[0]+9} y={pos[1]-1} fontFamily={GB.mono} fontSize="6"
                  fontWeight="700" fill={a.col}>{a.id}</text>
                <text x={pos[0]+9} y={pos[1]+5} fontFamily={GB.mono} fontSize="5"
                  fill={a.col} opacity="0.7">{a.task}</text>
              </g>
            );
          })}

          {/* scale bar */}
          <g transform="translate(20, 410)">
            <path d="M0,0 L60,0 M0,-3 L0,3 M30,-2 L30,2 M60,-3 L60,3" stroke={GB.cyan}
              strokeWidth="0.6" opacity="0.7"/>
            <text x="0" y="9" fontFamily={GB.mono} fontSize="6" fill={GB.cyan} opacity="0.7">0</text>
            <text x="30" y="9" textAnchor="middle" fontFamily={GB.mono} fontSize="6" fill={GB.cyan} opacity="0.7">~500 LOC</text>
            <text x="60" y="9" textAnchor="end" fontFamily={GB.mono} fontSize="6" fill={GB.cyan} opacity="0.7">1k</text>
          </g>
        </svg>

        {/* RIGHT: zoom levels + assign */}
        <div style={{position:'absolute', top:38, right:8, width:172, zIndex:5,
          display:'flex', flexDirection:'column', gap:8}}>

          <Panel title="ZOOM" sub="LOD=file" color={GB.cyan}>
            {[
              { l:'fn',     n:'function',  active:false },
              { l:'file',   n:'file',      active:true  },
              { l:'mod',    n:'module',    active:false },
              { l:'repo',   n:'codebase',  active:false },
            ].map(z => (
              <div key={z.l} style={{display:'flex', justifyContent:'space-between',
                fontSize:9, padding:'3px 0', borderBottom:`1px dotted ${GB.cyan}25`,
                color: z.active?GB.amber:GB.ink, fontWeight:z.active?700:400}}>
                <span>{z.active?'▸':' '} {z.n}</span>
                <span style={{opacity:.6}}>{z.l}</span>
              </div>
            ))}
            <div style={{display:'flex', gap:4, marginTop:6}}>
              {['−','+','⤢'].map(b => (
                <button key={b} style={{flex:1, background:'transparent', color:GB.cyan,
                  border:`1px solid ${GB.cyan}80`, fontFamily:GB.mono, fontSize:11, padding:'2px 0',
                  cursor:'pointer'}}>{b}</button>
              ))}
            </div>
          </Panel>

          <Panel title="SELECTED" sub="schema.ts" color={GB.red}>
            <Stat k="path"   v="api/" color={GB.ink}/>
            <Stat k="LOC"    v="340"/>
            <Stat k="status" v="FAIL" vColor={GB.red}/>
            <Stat k="tests"  v="2/8"  vColor={GB.red}/>
            <Stat k="cov"    v="34%"  vColor={GB.amber}/>
            <Stat k="agent"  v="A-02" vColor={GB.red}/>
            <div style={{borderTop:`1px dashed ${GB.red}50`, marginTop:4, paddingTop:4,
              fontSize:8, color:GB.red, lineHeight:1.4}}>
              ▲ TypeError: cannot read<br/>property `id` of undefined<br/>
              <span style={{opacity:.6}}>at line 42:18</span>
            </div>
          </Panel>

          <Panel title="ASSIGN" color={GB.amber}>
            <div style={{fontSize:8.5, color:GB.ink, lineHeight:1.5}}>
              <div>1. lasso area or click bldg</div>
              <div>2. press <span style={{color:GB.amber}}>[D]</span> to dispatch</div>
              <div>3. choose agent profile</div>
            </div>
            <div style={{display:'flex', gap:3, marginTop:6, flexWrap:'wrap'}}>
              {['fix-bug','review','refactor','docs','test'].map(t => (
                <span key={t} style={{fontSize:7.5, padding:'2px 4px',
                  border:`1px solid ${GB.amber}80`, color:GB.amber}}>{t}</span>
              ))}
            </div>
          </Panel>
        </div>

        {/* bottom ticker */}
        <div style={{position:'absolute', bottom:0, left:0, right:0, zIndex:6,
          background:'rgba(5,8,14,0.9)'}}>
          <Ticker color={GB.amber} prefix="⚠ " items={[
            'BUG :: api/schema.ts:42 :: TypeError on .id access',
            'TEST FAIL :: api.spec :: 6/8 passing',
            'WARN :: rate-limit.ts :: threshold near max',
            'WARN :: session.ts :: stale token logic',
            'WARN :: Form.tsx :: missing validation',
          ]}/>
        </div>
      </div>
    </div>
  );
}

window.SketchB = SketchB;
