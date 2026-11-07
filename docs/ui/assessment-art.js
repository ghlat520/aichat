/* Project-native editorial illustrations for the assessment prototype. */
(() => {
  const codes = ['INTJ','INTP','ENTJ','ENTP','INFJ','INFP','ENFJ','ENFP','ISTJ','ISFJ','ESTJ','ESFJ','ISTP','ISFP','ESTP','ESFP'];
  const palettes = [
    ['#3155d9','#dce5ff','#8fa8ef'], ['#247b70','#def0e7','#91c3a9'],
    ['#a5653d','#f7e7d7','#e6b18a'], ['#7454ad','#eee5fa','#b59cd9']
  ];
  const objects = [
    '<path d="m145 148 22-10 22 10-22 11Z" fill="#fff"/><path d="m167 138 0 21m-22-11 22 11 22-11" fill="none"/>',
    '<circle cx="166" cy="151" r="17" fill="#fff"/><ellipse cx="166" cy="151" rx="25" ry="8" fill="none" transform="rotate(-30 166 151)"/>',
    '<path d="m146 148 27-13v34l-27-12Z" fill="#fff"/><path d="m150 159 6 17h8l-3-14" fill="#fff"/>',
    '<path d="M154 151a14 14 0 1 1 24 0l-5 8h-14Z" fill="#f7d28c"/><path d="M160 165h12m-10 5h8m-21-34-6-4m42 4 6-4m-24-9v-7" fill="none"/>',
    '<path d="M150 148h32v28h-32Z" fill="#fff"/><path d="m155 148 11-15 11 15m-11-15v-8" fill="none"/><path d="M162 157h8v11h-8Z" fill="#f6d18c"/>',
    '<path d="M144 146q14-5 25 2v29q-14-6-25-1Zm25 2q12-7 24-2v30q-14-5-24 1Z" fill="#fff"/><path d="M169 148v29m-18-22h11m-11 7h10" fill="none"/>',
    '<circle cx="157" cy="143" r="8" fill="#fff"/><circle cx="178" cy="148" r="7" fill="#f7d28c"/><path d="M144 173v-8a13 13 0 0 1 26 0v8m0 0v-9a11 11 0 0 1 20 0v9" fill="#fff"/>',
    '<path d="m166 129 19 22-19 19-19-19Z" fill="#f7d28c"/><path d="M166 129v41l-19-19h38m-19 19q-12 10-3 19" fill="none"/>',
    '<rect x="146" y="138" width="40" height="39" rx="5" fill="#fff"/><path d="M146 149h40m-30-16v10m20-10v10m-22 15h8m8 0h8m-24 9h8m8 0h8" fill="none"/>',
    '<path d="M147 145h31v18a11 11 0 0 1-11 11h-9a11 11 0 0 1-11-11Z" fill="#fff"/><path d="M178 149h4a8 8 0 0 1 0 16h-5m-24-29q-4-5 1-10m11 10q-4-5 1-10" fill="none"/>',
    '<rect x="147" y="138" width="36" height="42" rx="5" fill="#fff"/><path d="M157 136h16v7h-16Z" fill="#f7d28c"/><path d="m155 155 3 3 5-6m-8 16 3 3 5-6m5-10h8m-8 13h8" fill="none"/>',
    '<path d="M166 174s-24-13-24-27c0-15 18-18 24-6 7-12 25-9 25 6 0 14-25 27-25 27Z" fill="#fff"/>',
    '<path d="m149 176 20-23a13 13 0 0 0 17-17l-10 11-8-7 10-11a13 13 0 0 0-17 17l-22 21Z" fill="#fff"/>',
    '<path d="m155 161 22-29 8 7-24 28Z" fill="#fff"/><path d="M155 161c-13-2-16 16-20 18 17 5 30-2 26-12" fill="#eab394"/>',
    '<rect x="140" y="155" width="54" height="13" rx="7" fill="#fff" transform="rotate(-12 167 161)"/><circle cx="151" cy="176" r="5" fill="#f7d28c"/><circle cx="184" cy="169" r="5" fill="#f7d28c"/>',
    '<rect x="158" y="130" width="18" height="27" rx="9" fill="#fff"/><path d="M151 147v4a16 16 0 0 0 32 0v-4m-16 21v13m-10 0h20" fill="none"/>'
  ];
  function person(code = 'INFP') {
    const i = Math.max(0, codes.indexOf(code)), [accent, pale, soft] = palettes[Math.floor(i / 4)];
    const skin = ['#edc6a7','#d99f7d','#c58c69','#f2cfb1'][i % 4];
    const hair = [
      'M75 93C61 47 129 42 130 91l-13-13-12-18c-3 16-16 24-30 33Z',
      'M72 100V80c0-47 62-44 62 0v33l-12-13V82c-11 1-22-7-27-15-4 16-12 22-23 24Z',
      'M72 90c-8-36 51-52 62-12l-5 17-11-18c-15 4-26-4-30-10l-5 24Z',
      'M73 102C52 74 73 43 102 48c32-8 52 30 27 57l-6-24c-16 3-31-3-35-12l-7 31Z'
    ][i % 4];
    return `<ellipse cx="111" cy="203" rx="72" ry="7" fill="${pale}"/><circle cx="109" cy="104" r="77" fill="${pale}"/><path d="M47 196v-36c0-35 29-47 57-47s57 13 57 47v36Z" fill="${accent}"/><path d="m85 119 19 27 19-27-9-8H94Z" fill="${skin}"/><path d="m85 123 19 23-17 11-13-28m49-6-19 23 17 11 14-28" fill="${soft}"/><path d="M96 147h16v49H96Z" fill="${pale}"/><ellipse cx="103" cy="86" rx="29" ry="35" fill="${skin}"/><path d="${hair}" fill="#2b3b51"/><path d="m86 87 7-2m19 0 7 2" fill="none" stroke="#2b3b51" stroke-width="2" stroke-linecap="round"/><circle cx="90" cy="92" r="2" fill="#2b3b51"/><circle cx="115" cy="92" r="2" fill="#2b3b51"/><path d="M98 105q6 5 12-1" fill="none" stroke="#975c51" stroke-width="2" stroke-linecap="round"/>${i % 3 === 0 ? '<g fill="none" stroke="#2b3b51" stroke-width="1.7"><rect x="80" y="85" width="20" height="15" rx="6"/><rect x="106" y="85" width="20" height="15" rx="6"/><path d="M100 90h6"/></g>' : ''}<path d="m63 164 5 28h81l7-27" fill="none" stroke="${soft}" stroke-width="3" stroke-linecap="round"/><g stroke="${accent}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${objects[i]}</g>`;
  }
  globalThis.assessmentArt = (kind, code = 'INFP') => {
    if (kind === 'feedback') return `<svg class="assessment-illustration" viewBox="0 0 240 220" aria-hidden="true"><circle cx="119" cy="106" r="85" fill="#e8eeff"/><ellipse cx="122" cy="199" rx="81" ry="8" fill="#dce3f1"/><path d="M34 50h112a15 15 0 0 1 15 15v54a15 15 0 0 1-15 15H92l-26 22 4-22H49a15 15 0 0 1-15-15V65a15 15 0 0 1 15-15Z" fill="#3155d9"/><path d="M57 76h79m-79 16h60m-60 16h43" stroke="#fff" stroke-width="5" stroke-linecap="round"/><path d="M118 113h74a14 14 0 0 1 14 14v42a14 14 0 0 1-14 14h-21l3 16-23-16h-33a14 14 0 0 1-14-14v-42a14 14 0 0 1 14-14Z" fill="#fff" stroke="#b9cfdf" stroke-width="2"/><path d="m126 147 10 10 20-24" fill="none" stroke="#247b70" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M164 140h23m-23 15h16" stroke="#91c3a9" stroke-width="4" stroke-linecap="round"/><circle cx="189" cy="55" r="18" fill="#eab394"/><path d="m182 55 6 6 9-12" fill="none" stroke="#80513c" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (kind === 'journal') return `<svg class="assessment-illustration" viewBox="0 0 240 220" aria-hidden="true"><ellipse cx="122" cy="197" rx="89" ry="9" fill="#d6e6e0"/><circle cx="120" cy="106" r="84" fill="#e2f3ed"/><g transform="rotate(-7 115 128)"><path d="M35 67q43-16 83 4v119q-43-20-83-4Z" fill="#fff" stroke="#b9cfdf" stroke-width="2"/><path d="M118 71q43-20 87-4v119q-43-16-87 4Z" fill="#f7fbfa" stroke="#b9cfdf" stroke-width="2"/><path d="M118 71v119" stroke="#3155d9" stroke-width="3"/><path d="M53 129h45m-45 12h38m-38 12h43m39-12h48m-48 12h39m-39 12h45" stroke="#9caed0" stroke-width="3" stroke-linecap="round"/><circle cx="77" cy="99" r="16" fill="#e8eeff"/><path d="M70 107v-14m14 0v14m-14-7h14" stroke="#3155d9" stroke-width="3" stroke-linecap="round"/><path d="M157 115V89m0 15c-24 1-26-20-26-20 19-2 26 9 26 20Zm0-9c-1-21 22-27 22-27 5 20-5 28-22 27Z" fill="#91c3a9" stroke="#247b70" stroke-width="2"/></g><path d="m185 29 5 12 13 5-13 5-5 13-5-13-12-5 12-5Z" fill="#eab394"/><path d="m44 46 3 7 8 3-8 3-3 8-3-8-7-3 7-3Z" fill="#8fa8ef"/></svg>`;
    if (kind === 'person') return `<svg class="assessment-person" viewBox="0 0 220 220" aria-hidden="true">${person(code)}</svg>`;
    if (kind === 'strength') return `<svg class="assessment-illustration" viewBox="0 0 240 220" aria-hidden="true"><ellipse cx="125" cy="201" rx="84" ry="8" fill="#dcebe5"/><circle cx="126" cy="104" r="83" fill="#e2f3ed"/><path d="M47 164h131v29H47Z" fill="#3155d9"/><path d="M55 173h121v15H55Z" fill="#fff"/><path d="M130 159V54" stroke="#247b70" stroke-width="4" stroke-linecap="round"/><path d="M129 116c-49 5-57-29-52-40 34-4 51 17 52 40Z" fill="#78b69b"/><path d="M131 91c-3-39 23-52 51-44 5 33-22 51-51 44Z" fill="#a3cb97"/><path d="M131 139c-1-34 25-46 51-33 1 29-24 43-51 33Z" fill="#247b70"/><path d="M108 146h47l-7 48h-34Z" fill="#eab394"/><path d="M107 147h50" stroke="#a5653d" stroke-width="3" stroke-linecap="round"/><circle cx="62" cy="62" r="16" fill="#f5d48e"/><path d="m181 155 8 8 16-19" fill="none" stroke="#3155d9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    if (kind === 'cross') return `<svg class="assessment-illustration" viewBox="0 0 240 220" aria-hidden="true"><circle cx="121" cy="109" r="85" fill="#e7edff"/><g transform="rotate(-12 86 107)"><rect x="32" y="47" width="100" height="135" rx="17" fill="#3155d9"/><path d="M52 77h60M52 88h42" stroke="#a6b9f3" stroke-width="3" stroke-linecap="round"/><circle cx="82" cy="124" r="23" fill="#a6b9f3"/><path d="m69 123 9 10 18-20" stroke="#fff" stroke-width="4" fill="none"/></g><g transform="rotate(11 158 124)"><rect x="111" y="69" width="97" height="125" rx="16" fill="#fff" stroke="#cdd8ef" stroke-width="2"/><path d="M159 155v-41m0 17c-27 2-30-22-30-22 20-2 30 11 30 22Zm0-9c0-27 27-30 27-30 5 22-8 31-27 30Z" fill="#91c3a9" stroke="#247b70" stroke-width="2.5"/><path d="M135 173h50" stroke="#d4dfef" stroke-width="3" stroke-linecap="round"/></g><circle cx="194" cy="44" r="12" fill="#eab394"/></svg>`;
    return `<svg class="assessment-illustration" viewBox="0 0 240 220" aria-hidden="true"><g transform="translate(-25 20) rotate(-9 110 110) scale(.82)">${person('INFP')}</g><g transform="translate(71 12) rotate(8 110 110) scale(.77)">${person('ENTP')}</g></svg>`;
  };
})();
