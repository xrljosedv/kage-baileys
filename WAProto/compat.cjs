'use strict';
module.exports = function applyCompatibility(proto) {
    const aliases = [
      [proto.Message.ExtendedTextMessage,'faviconMmsMetadata','faviconMMSMetadata'],
      [proto.SyncActionValue.AgentAction,'deviceId','deviceID'],
      [proto.SyncActionValue.StatusPrivacyAction,'shareToFb','shareToFB'],
      [proto.SyncActionValue.StatusPrivacyAction,'shareToIg','shareToIG']
    ];
    for(const [T,alias,canonical] of aliases){
      Object.defineProperty(T.prototype,alias,{configurable:true,get(){return this[canonical]},set(v){this[canonical]=v}});
      const from=T.fromObject;
      T.fromObject=function(o){if(o&&o[canonical]==null&&o[alias]!=null)o={...o,[canonical]:o[alias]};return from.call(this,o)};
      const encode=T.encode;T.encode=function(o,w){if(o&&o[canonical]==null&&o[alias]!=null)o={...o,[canonical]:o[alias]};return encode.call(this,o,w)};
    }
    const Type = proto.Message.MessageHistoryMetadata;
    Object.defineProperty(Type.prototype, 'oldestMessageTimestamp', {
        configurable: true,
        get() { return this.oldestMessageTimestampInWindow; },
        set(value) { this.oldestMessageTimestampInWindow = value; }
    });
    const fromObject = Type.fromObject;
    Type.fromObject = function (object) {
        if (object && object.oldestMessageTimestampInWindow == null && object.oldestMessageTimestamp != null) {
            object = { ...object, oldestMessageTimestampInWindow: object.oldestMessageTimestamp };
        }
        return fromObject.call(this, object);
    };
};
