function isAppleOS(i){if(!i){if("undefined"==typeof window)return!1;i=window}const{platform:n}=i.navigator;return-1!==n.indexOf("Mac")||["iPad","iPhone"].includes(n)}export{isAppleOS as i};
