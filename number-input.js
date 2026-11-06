(function(root){
  "use strict";
  const arabicDigits="٠١٢٣٤٥٦٧٨٩",persianDigits="۰۱۲۳۴۵۶۷۸۹";
  function normalize(value){
    return String(value??"").replace(/[٠-٩۰-۹]/g,d=>{
      const arabic=arabicDigits.indexOf(d);
      return String(arabic>=0?arabic:persianDigits.indexOf(d));
    }).trim();
  }
  function parse(value){
    const normalized=normalize(value);
    if(!/^\d+$/.test(normalized))return null;
    const parsed=Number(normalized);
    return Number.isSafeInteger(parsed)?parsed:null;
  }
  const api=Object.freeze({normalize,parse});
  if(typeof root!=="undefined")root.SuwadNumberInput=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
