(function(global){
  async function toDataUrl(text, size){
    const value = String(text || "").trim();
    if(!value || !global.QRCode || typeof global.QRCode.toDataURL !== "function"){
      return "";
    }
    try{
      return await global.QRCode.toDataURL(value, {
        width: Number(size) > 0 ? Number(size) : 100,
        margin: 1,
        errorCorrectionLevel: "M"
      });
    }catch(error){
      return "";
    }
  }

  global.EstimateQr = {
    toDataUrl: toDataUrl
  };
})(typeof window !== "undefined" ? window : globalThis);
