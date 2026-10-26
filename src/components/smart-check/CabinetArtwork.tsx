export function CabinetArtwork(){return <svg viewBox="0 0 360 320" role="img" aria-label="Illustration eines Zählerschranks mit Scan-Rahmen">
  <defs><linearGradient id="sc-cabinet" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#6d8596"/><stop offset=".4" stopColor="#283e51"/><stop offset="1" stopColor="#112236"/></linearGradient><linearGradient id="sc-scan"><stop stopColor="#00dccb" stopOpacity="0"/><stop offset=".5" stopColor="#9aff73"/><stop offset="1" stopColor="#00dccb" stopOpacity="0"/></linearGradient><radialGradient id="sc-glow"><stop stopColor="#19d2b8" stopOpacity=".32"/><stop offset="1" stopColor="#19d2b8" stopOpacity="0"/></radialGradient></defs>
  <ellipse cx="194" cy="181" rx="164" ry="145" fill="url(#sc-glow)"/>
  <path d="M97 43L238 29L260 45V286L113 300L97 284Z" fill="url(#sc-cabinet)" stroke="#78919e"/>
  <path d="M111 58L241 46V273L111 285Z" fill="#0b1d2d" stroke="#8aa4b0"/>
  <path d="M124 76L226 66V126L124 136Z" fill="#395262" stroke="#627d8e"/>
  <path d="M135 86L181 82V116L135 120Z" fill="#092638" stroke="#4de4c7"/><path d="M144 94h24m-24 8h16" stroke="#73ffb6" strokeWidth="3"/>
  <path d="M190 82h24v32h-24z" fill="#64808c"/>
  {[155,201,247].map((y,i)=><g key={y}><path d={`M124 ${y}l102 -10v26l-102 10z`} fill="#506572"/>{[0,1,2,3,4,5].map(n=><path key={n} d={`M${133+n*15} ${y+2-n*1.5}v17`} stroke={i===0?'#b8d3dc':'#9eafb3'} strokeWidth="8"/>)}</g>)}
  <path d="M77 80V38h38m113 -14h40v37M80 247v48h39m117 -3h38v-49" stroke="#39e7d0" strokeWidth="3" fill="none"/>
  <path d="M38 175L301 149" stroke="url(#sc-scan)" strokeWidth="5"/><path d="M38 180L301 154" stroke="url(#sc-scan)" strokeWidth="18" opacity=".13"/>
  <g stroke="#6fe9ce" fill="#09283b"><rect x="279" y="65" width="48" height="48" rx="12"/><path d="M292 100l5-22h20l-5 22zm1-11h22m-10-11l-5 22" fill="none"/><rect x="285" y="139" width="48" height="48" rx="12"/><path d="M301 151h15v25h-15zM305 147h7m-7 17h7m-3-4v8" fill="none"/><rect x="275" y="213" width="48" height="48" rx="12"/><path d="M290 225h17v21h-17zM307 233h7v17m-18-19v7m-3-3h6" fill="none"/></g>
</svg>}
