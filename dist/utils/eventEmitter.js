"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
class SystemEventEmitter extends events_1.EventEmitter {
}
const systemEvents = new SystemEventEmitter();
exports.default = systemEvents;
