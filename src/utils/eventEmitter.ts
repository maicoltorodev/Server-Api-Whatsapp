const EventEmitter = require('events');
class SystemEventEmitter extends EventEmitter {}
module.exports = new SystemEventEmitter();
