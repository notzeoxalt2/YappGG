(()=>{"use strict";var e,t,n,o={80136:(e,t,n)=>{var o=n(96540),r=n(5338),i=n(48344),a=n(20038),l=n(16561),s=n(87200);const c=(0,a.Z0)({name:"selectedApp",initialState:{},reducers:{appSettingKeyReceived:(e,t)=>{e.settingsAppKey=t.payload}}}),{appSettingKeyReceived:p}=c.actions,d=c.reducer;var g=n(45792);const u=(0,a.Nc)();u.startListening({actionCreator:g.N,effect:async e=>{window.api.overlay?.sendSetSettingToMain(e.payload)}}),(0,a.Nc)().startListening({actionCreator:g.M,effect:async e=>{window.api.overlay?.sendGGNavigateToMain(e.payload)}});const f=(0,a.U1)({reducer:{settings:l.A,position:s.A,selectedApp:d},middleware:e=>e().prepend(u.middleware)});var m=n(1448),h=n(38267),y=n(82932);const v=e=>e.settings.applicationSettings,w=e=>e.position.y,b=e=>e.selectedApp.settingsAppKey;var x=n(66255),C=n(5154),O=n(83197);const k=h.Ay.div.withConfig({displayName:"AppRightClickMenuItem__Container",componentId:"sc-14fpqa5"})`
  display: flex;
  align-items: center;
  gap: ${({theme:e})=>e["spacing-twelve"]}px;
  height: ${({theme:e})=>e["spacing-thirtyTwo"]}px;
  padding: ${({theme:e})=>e["spacing-four"]}px ${({theme:e})=>e["spacing-twelve"]}px;
  cursor: pointer;

  ${({theme:e})=>e.typography.body1}
  color: ${({theme:e})=>e.forgeColors.text.primary};

  &:hover {
    background-color: ${({theme:e})=>e.forgeColors.state.transparent.hover};
  }

  &:active {
    background-color: ${({theme:e})=>e.forgeColors.state.transparent.pressed};
  }
  box-sizing: border-box;
`;function E({className:e}){const t=(0,m.d4)(v),n=(0,m.d4)(b),r=(0,m.wA)(),i=!(!n||!t?.[n]);return o.createElement(k,{className:e,onClick:()=>{n&&(r((0,g.N)({key:n,value:!i})),window.api.overlay.hide(C.$q.RightClick))}},i?o.createElement(o.Fragment,null,o.createElement(O.bc,null),o.createElement("div",null,y.PE.getText("gg.apps.unpin"))):o.createElement(o.Fragment,null,o.createElement(x.A,null),o.createElement("div",null,y.PE.getText("gg.apps.pin"))))}const _=h.Ay.div.withConfig({displayName:"AppRightClickMenu__Container",componentId:"sc-uowa8w"})`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: stretch;
  overflow: hidden;
  font-family: ${({theme:e})=>e.font};
  width: 256px;
  height: ${({theme:e})=>e["spacing-fourtyEight"]}px;

  border: 2px solid ${({theme:e})=>e.forgeColors.stroke.border};
  border-radius: ${({theme:e})=>e["radius-eight"]}px;
  background-color: ${({theme:e})=>e.forgeColors.background.elevation2};
  box-shadow: 0 2px 2px ${({theme:e})=>e.forgeColors.stroke.divider};
  box-sizing: border-box;
`;function $({className:e}){return o.createElement(_,{className:e},o.createElement(E,null))}const A=new URLSearchParams(window.location.search),N=Number(A.get("x")??0),j=h.Ay.div.withConfig({displayName:"RightClickOverlay__Wrapper",componentId:"sc-1i8zup0"})`
  position: absolute;
  left: ${({x:e})=>e}px;
  top: ${({theme:e,y:t})=>t-e["spacing-twentyFour"]}px;
  user-select: none;
  width: fit-content;
  height: fit-content;
`,S=h.Ay.div.withConfig({displayName:"RightClickOverlay__Backdrop",componentId:"sc-1f8p8k2"})`
  position: fixed;
  inset: 0;
  background: transparent;
`;var P=n(74173);window.api.overlay.onSettingsUpdated((e=>{f.dispatch((0,l.P)(e))})),window.api.overlay.onLocalizationUpdated((e=>{(0,y.rs)(e)})),window.api.overlay.onYPositionUpdated((e=>{f.dispatch((0,s.I)(e))})),window.api.overlay.onAppSettingKeyUpdated((e=>{f.dispatch(p(e))}));const M=document.getElementById("ContentViewOverlay");(0,r.H)(M).render(o.createElement(m.Kq,{store:f},o.createElement(i.A,null,o.createElement((function(){const e=(0,m.d4)(w);return o.createElement(S,{onMouseDown:()=>{window.api.overlay.hide(C.$q.RightClick)}},o.createElement(j,{onMouseDown:e=>{e.stopPropagation()},x:N,y:e},o.createElement($,null)))}),null)))),(0,P.j)(M)}},r={};function i(e){var t=r[e];if(void 0!==t)return t.exports;var n=r[e]={exports:{}};return o[e](n,n.exports,i),n.exports}i.m=o,e=[],i.O=(t,n,o,r)=>{if(!n){var a=1/0;for(p=0;p<e.length;p++){for(var[n,o,r]=e[p],l=!0,s=0;s<n.length;s++)(!1&r||a>=r)&&Object.keys(i.O).every((e=>i.O[e](n[s])))?n.splice(s--,1):(l=!1,r<a&&(a=r));if(l){e.splice(p--,1);var c=o();void 0!==c&&(t=c)}}return t}r=r||0;for(var p=e.length;p>0&&e[p-1][2]>r;p--)e[p]=e[p-1];e[p]=[n,o,r]},i.n=e=>{var t=e&&e.__esModule?()=>e.default:()=>e;return i.d(t,{a:t}),t},n=Object.getPrototypeOf?e=>Object.getPrototypeOf(e):e=>e.__proto__,i.t=function(e,o){if(1&o&&(e=this(e)),8&o)return e;if("object"==typeof e&&e){if(4&o&&e.__esModule)return e;if(16&o&&"function"==typeof e.then)return e}var r=Object.create(null);i.r(r);var a={};t=t||[null,n({}),n([]),n(n)];for(var l=2&o&&e;"object"==typeof l&&!~t.indexOf(l);l=n(l))Object.getOwnPropertyNames(l).forEach((t=>a[t]=()=>e[t]));return a.default=()=>e,i.d(r,a),r},i.d=(e,t)=>{for(var n in t)i.o(t,n)&&!i.o(e,n)&&Object.defineProperty(e,n,{enumerable:!0,get:t[n]})},i.o=(e,t)=>Object.prototype.hasOwnProperty.call(e,t),i.r=e=>{"undefined"!=typeof Symbol&&Symbol.toStringTag&&Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),Object.defineProperty(e,"__esModule",{value:!0})},(()=>{var e={87:0};i.O.j=t=>0===e[t];var t=(t,n)=>{var o,r,[a,l,s]=n,c=0;if(a.some((t=>0!==e[t]))){for(o in l)i.o(l,o)&&(i.m[o]=l[o]);if(s)var p=s(i)}for(t&&t(n);c<a.length;c++)r=a[c],i.o(e,r)&&e[r]&&e[r][0](),e[r]=0;return i.O(p)},n=globalThis.webpackChunksteelseriesengine3_client=globalThis.webpackChunksteelseriesengine3_client||[];n.forEach(t.bind(null,0)),n.push=t.bind(null,n.push.bind(n))})(),i.nc=void 0;var a=i.O(void 0,[60,542,381,628,358],(()=>i(80136)));a=i.O(a)})();
//# sourceMappingURL=rightClickOverlay.js.map