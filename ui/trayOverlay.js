(()=>{"use strict";var e,t,n,i={63766:(e,t,n)=>{var i=n(96540),o=n(5338),a=n(48344),r=n(38267),p=n(66255),l=n(28764),s=n(81702),d=n(1448),c=n(45792),g=n(82932),m=n(5154);const y=r.Ay.div.withConfig({displayName:"AppTrayMenuItem__Container",componentId:"sc-1ea3w32"})`
  display: flex;
  height: ${({theme:e})=>e["spacing-eighty"]}px;
  gap: ${({theme:e})=>e["spacing-twelve"]}px;
  cursor: ${({isSelectable:e})=>e?"pointer":"default"};

  &:hover {
    background-color:  ${({isSelectable:e,theme:t})=>e?t.forgeColors.state.transparent.hover:"inherit"};
  },

  &:active {
    background-color:  ${({isSelectable:e,theme:t})=>e?t.forgeColors.state.transparent.pressed:"inherit"};
  },
`,u=r.Ay.div.withConfig({displayName:"AppTrayMenuItem__ContentText",componentId:"sc-dj89q5"})`
  flex-grow: 1;

  display: flex;
  flex-direction: column;
  gap: ${({theme:e})=>e["spacing-eight"]}px;

  padding-top: ${({theme:e})=>e["spacing-eight"]}px;
  padding-bottom: ${({theme:e})=>e["spacing-eight"]}px;
  color: ${({theme:e})=>e.forgeColors.text.primary};
`,f=r.Ay.div.withConfig({displayName:"AppTrayMenuItem__ContentImg",componentId:"sc-4b2vjz"})`
  aspect-ratio: 2 / 1;
`,h=r.Ay.div.withConfig({displayName:"AppTrayMenuItem__ContentAction",componentId:"sc-yqrocr"})`
  margin-right: 10px;

  display: flex;
  justify-content: center;
  align-items: center;
`,b=r.Ay.div.withConfig({displayName:"AppTrayMenuItem__TextHead",componentId:"sc-zwi8te"})`
  display: flex;
  align-items: center;
  gap: ${({theme:e})=>e["spacing-eight"]}px;
`,v=r.Ay.span.withConfig({displayName:"AppTrayMenuItem__Title",componentId:"sc-di3qgj"})`
  ${({theme:e})=>e.typography.subtitle3}
`,w=r.Ay.span.withConfig({displayName:"AppTrayMenuItem__Description",componentId:"sc-72s4a9"})`
  ${({theme:e})=>e.typography.body2}
`;function A(e){const t=(0,d.wA)();return i.createElement(y,{isSelectable:!!e.route,onClick:()=>{e.route&&(t((0,c.M)(e.route)),window.api.overlay.hide(m.$q.Tray))}},i.createElement(f,null,i.createElement("img",{src:e.imageUrl,alt:e.titleKey+" thumbnail"})),i.createElement(u,null,i.createElement(b,null,e.logo,i.createElement(v,null,e.titleKey),e.isOff&&i.createElement(s.A,{label:"Off",chipStyle:s.c.TRANSPARENT})),i.createElement(w,null,g.PE.getText(e.descriptionKey))),i.createElement(h,null,e.qrCode?i.createElement("img",{src:e.qrCode,alt:e.titleKey+" QR"}):e.pinnnedSettingKey&&i.createElement(l.$n,{variant:l.Ak.OUTLINE,size:l.Mp.MEDIUM,startIcon:i.createElement(p.A,null),onClick:n=>{n.stopPropagation(),e.pinnnedSettingKey&&(t((0,c.N)({key:e.pinnnedSettingKey,value:!0})),e.addOffset())}})))}const S=n.p+"88abd2bc0083a478b429.webp",x=n.p+"41031d912e7fb65e2afa.webp",O=n.p+"609a0000175a31d2a2de.webp",E=n.p+"d2f49d49ece6c2e04299.webp",T=n.p+"45628cbd87118e8018bd.webp",C=n.p+"d64f9ecbb2d130623565.webp";var _=n(83197),I=n(27434);const N=e=>e.settings.applicationSettings,M=e=>e.ggSubApps.subApps,$=e=>e.position.y,k=r.Ay.div.withConfig({displayName:"AppTrayMenu__Container",componentId:"sc-19x645f"})`
  width: fit-content;
  height: fit-content;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  overflow: hidden;
  width: 616px;
  font-family: ${({theme:e})=>e.font};
  border: 2px solid ${({theme:e})=>e.forgeColors.stroke.border};
  border-radius: ${({theme:e})=>e["radius-eight"]}px;
  background-color: ${({theme:e})=>e.forgeColors.background.elevation2};
  box-shadow: 0 2px 2px ${({theme:e})=>e.forgeColors.stroke.divider};
`,K=[{id:"sonar",title:"Sonar",description:"gg.appsTray.sonar.description",imageUrl:C,logo:i.createElement(_.zS,null),pinnedSettingKey:"sonarPinned",idSubApps:I.O.Sonar,route:"/gg/sonar"},{id:"moments",title:"Moments",description:"gg.appsTray.moments.description",imageUrl:E,logo:i.createElement(_.lI,null),pinnedSettingKey:"momentsPinned",idSubApps:I.O.Moments,route:"/gg/moments"},{id:"aim-tools",title:"Aim Tools",description:"gg.appsTray.aimTools.description",imageUrl:S,logo:i.createElement(_.Ot,null),pinnedSettingKey:"threeDATPinned",idSubApps:I.O.ThreeDAT,route:"/gg/3dat"},{id:"giveaways",title:"Giveaways",description:"gg.appsTray.giveaways.description",imageUrl:O,logo:i.createElement(_.wJ,null),pinnedSettingKey:"giveawaysPinned",route:"/gg/giveaways"},{id:"arctis-companion-app",title:"Arctis Companion App",description:"gg.appsTray.companionApp.description",imageUrl:x,logo:i.createElement(_.A4,null),qrCode:T}];function P({className:e,addOffset:t}){const n=(0,d.d4)(N),o=(0,d.d4)(M),a=K.filter((e=>!e.pinnedSettingKey||!1===n?.[e.pinnedSettingKey])).map((e=>{if(!e.idSubApps)return{...e};const t=!1===o?.[e.idSubApps]?.isEnabled;return{...e,isOff:t}}));return i.createElement(k,{className:e},a.map(((e,n)=>i.createElement(i.Fragment,{key:e.id},0!==n&&i.createElement(l.cG,null),i.createElement(A,{descriptionKey:e.description,imageUrl:e.imageUrl,titleKey:e.title,logo:e.logo,qrCode:e.qrCode,isOff:e.isOff,pinnnedSettingKey:e.pinnedSettingKey,route:e.route,addOffset:t})))))}const j=new URLSearchParams(window.location.search),U=Number(j.get("x")??0),q=r.Ay.div.withConfig({displayName:"TrayOverlay__Wrapper",componentId:"sc-13ga2x5"})`
  position: absolute;
  left: ${({x:e})=>e}px;
  top: clamp(0px, ${({theme:e,y:t,offsetNb:n})=>t+n*e["spacing-eighty"]}px, 100%);
  user-select: none;
  width: fit-content;
  height: fit-content;
`,D=r.Ay.div.withConfig({displayName:"TrayOverlay__Backdrop",componentId:"sc-1o8mt2f"})`
  position: fixed;
  inset: 0;
  background: transparent;
`;var R=n(20038),z=n(16561);const G=(0,R.Z0)({name:"ggSubApps",initialState:{subApps:{}},reducers:{ggSubAppsReceived:(e,t)=>{e.subApps=t.payload}}}),{ggSubAppsReceived:L}=G.actions,B=G.reducer;var H=n(87200);const F=(0,R.Nc)();F.startListening({actionCreator:c.N,effect:async e=>{window.api.overlay?.sendSetSettingToMain(e.payload)}});const J=(0,R.Nc)();J.startListening({actionCreator:c.M,effect:async e=>{window.api.overlay?.sendGGNavigateToMain(e.payload)}});const Q=(0,R.U1)({reducer:{settings:z.A,ggSubApps:B,position:H.A},middleware:e=>e().prepend(F.middleware).prepend(J.middleware)});var V=n(74173);window.api.overlay.onSettingsUpdated((e=>{Q.dispatch((0,z.P)(e))})),window.api.overlay.onLocalizationUpdated((e=>{(0,g.rs)(e)})),window.api.overlay.onGgSubAppsUpdated((e=>{Q.dispatch(L(e))})),window.api.overlay.onYPositionUpdated((e=>{Q.dispatch((0,H.I)(e))}));const W=document.getElementById("ContentViewOverlay");(0,o.H)(W).render(i.createElement(d.Kq,{store:Q},i.createElement(a.A,null,i.createElement((function(){const e=(0,d.d4)($),[t,n]=(0,i.useState)(-1);return i.createElement(D,{onMouseDown:()=>{window.api.overlay.hide(m.$q.Tray),n(-1)}},i.createElement(q,{onMouseDown:e=>{e.stopPropagation()},x:U,y:e,offsetNb:t},i.createElement(P,{addOffset:()=>n(t+1)})))}),null)))),(0,V.j)(W)}},o={};function a(e){var t=o[e];if(void 0!==t)return t.exports;var n=o[e]={id:e,loaded:!1,exports:{}};return i[e].call(n.exports,n,n.exports,a),n.loaded=!0,n.exports}a.m=i,e=[],a.O=(t,n,i,o)=>{if(!n){var r=1/0;for(d=0;d<e.length;d++){for(var[n,i,o]=e[d],p=!0,l=0;l<n.length;l++)(!1&o||r>=o)&&Object.keys(a.O).every((e=>a.O[e](n[l])))?n.splice(l--,1):(p=!1,o<r&&(r=o));if(p){e.splice(d--,1);var s=i();void 0!==s&&(t=s)}}return t}o=o||0;for(var d=e.length;d>0&&e[d-1][2]>o;d--)e[d]=e[d-1];e[d]=[n,i,o]},a.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return a.d(t,{a:t}),t},n=Object.getPrototypeOf?e=>Object.getPrototypeOf(e):e=>e.__proto__,a.t=function(e,i){if(1&i&&(e=this(e)),8&i)return e;if("object"==typeof e&&e){if(4&i&&e.__esModule)return e;if(16&i&&"function"==typeof e.then)return e}var o=Object.create(null);a.r(o);var r={};t=t||[null,n({}),n([]),n(n)];for(var p=2&i&&e;"object"==typeof p&&!~t.indexOf(p);p=n(p))Object.getOwnPropertyNames(p).forEach((t=>r[t]=()=>e[t]));return r.default=()=>e,a.d(o,r),o},a.d=(e,t)=>{for(var n in t)a.o(t,n)&&!a.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},a.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),a.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},a.nmd=e=>(e.paths=[],e.children||(e.children=[]),e),a.p="",(()=>{var e={161:0};a.O.j=t=>0===e[t];var t=(t,n)=>{var i,o,[r,p,l]=n,s=0;if(r.some((t=>0!==e[t]))){for(i in p)a.o(p,i)&&(a.m[i]=p[i]);if(l)var d=l(a)}for(t&&t(n);s<r.length;s++)o=r[s],a.o(e,o)&&e[o]&&e[o][0](),e[o]=0;return a.O(d)},n=globalThis.webpackChunksteelseriesengine3_client=globalThis.webpackChunksteelseriesengine3_client||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))})(),a.nc=void 0;var r=a.O(void 0,[60,542,221,138,561,640,381,864,358],(()=>a(63766)));r=a.O(r)})();
//# sourceMappingURL=trayOverlay.js.map