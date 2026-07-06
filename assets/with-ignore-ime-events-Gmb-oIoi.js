function withIgnoreIMEEvents(n){return e=>{const{isComposing:t}="nativeEvent"in e?e.nativeEvent:e;t||229===e.keyCode||n(e)}}export{withIgnoreIMEEvents as w};
