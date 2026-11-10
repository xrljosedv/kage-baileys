'use strict';
 
 
 
 
 
 
 
 
 
(function () {
    var b64 = $protobuf.util.base64;
    if (b64.__kageTolerant)
        return;
    var nativeDecode = b64.decode;
    var nativeLength = b64.length;
    var clean = function (string) {
        var s = $String(string).replace(/[\r\n\t\s]/g, "").replace(/-/g, "+").replace(/_/g, "/");
        var rem = s.length % 4;
        if (rem === 2)
            s += "==";
        else if (rem === 3)
            s += "=";
        else if (rem === 1)
            s = s.slice(0, -1);  
        return s;
    };
    b64.length = function (string) {
        if (typeof string !== "string")
            return nativeLength(string);
        return nativeLength(clean(string));
    };
    b64.decode = function (string, buffer, start) {
        if (typeof string !== "string")
            return nativeDecode(string, buffer, start);
        var s = clean(string);
        try {
            return nativeDecode(s, buffer, start);
        } catch (e) {
             
            return nativeDecode(s.replace(/[^A-Za-z0-9+/=]/g, ""), buffer, start);
        }
    };
    b64.__kageTolerant = true;
})();
