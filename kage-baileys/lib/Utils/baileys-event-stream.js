"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const Events = require("events")
const {
  promises, 
  createReadStream 
} = require("fs")
const { writeFile } = require("fs/promises")
const { createInterface } = require("readline")
const { delay } = require("./generics")
const { makeMutex } = require("./make-mutex")

 




const captureEventStream = (ev, filename) => {
    const oldEmit = ev.emit
     
    const writeMutex = makeMutex()
     
    ev.emit = function (...args) {
        const content = JSON.stringify({ timestamp: Date.now(), event: args[0], data: args[1] }) + '\n'
        const result = oldEmit.apply(ev, args)
        writeMutex.mutex(async () => {
            await promises.writeFile(filename, content, { flag: 'a' })
        })
        return result
    }
}

 




const readAndEmitEventStream = (filename, delayIntervalMs = 0) => {
    const ev = new Events()
    const fireEvents = async () => {
         
        const fileStream = createReadStream(filename)
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        })
         
         
        for await (const line of rl) {
            if (line) {
                const { event, data } = JSON.parse(line)
                ev.emit(event, data)
                delayIntervalMs && await delay(delayIntervalMs)
            }
        }
        fileStream.close()
    }
    return {
        ev,
        task: fireEvents()
    }
}

module.exports = {
  captureEventStream, 
  readAndEmitEventStream
}
 
const __kageModule58 = (() => {
const module = { exports: {} }; const exports = module.exports;
"use strict"

Object.defineProperty(exports, "__esModule", { value: true })

const Events = require("events")
const {
  promises, 
  createReadStream 
} = require("fs")
const { writeFile } = require("fs/promises")
const { createInterface } = require("readline")
const { delay } = require("./generics")
const { makeMutex } = require("./make-mutex")

 




const captureEventStream = (ev, filename) => {
    const oldEmit = ev.emit
     
    const writeMutex = makeMutex()
     
    ev.emit = function (...args) {
        const content = JSON.stringify({ timestamp: Date.now(), event: args[0], data: args[1] }) + '\n'
        const result = oldEmit.apply(ev, args)
        writeMutex.mutex(async () => {
            await promises.writeFile(filename, content, { flag: 'a' })
        })
        return result
    }
}

 




const readAndEmitEventStream = (filename, delayIntervalMs = 0) => {
    const ev = new Events()
    const fireEvents = async () => {
         
        const fileStream = createReadStream(filename)
        const rl = createInterface({
            input: fileStream,
            crlfDelay: Infinity
        })
         
         
        for await (const line of rl) {
            if (line) {
                const { event, data } = JSON.parse(line)
                ev.emit(event, data)
                delayIntervalMs && await delay(delayIntervalMs)
            }
        }
        fileStream.close()
    }
    return {
        ev,
        task: fireEvents()
    }
}

module.exports = {
  captureEventStream, 
  readAndEmitEventStream
}
return module.exports;
})();
for (const key of Object.keys(__kageModule58)) {
 if (key !== '__esModule' && !Object.prototype.hasOwnProperty.call(exports,key)) Object.defineProperty(exports,key,{enumerable:true,configurable:true,get:()=>__kageModule58[key]});
}
