import { EventEmitter } from 'events';

class SystemEventEmitter extends EventEmitter { }

const systemEvents = new SystemEventEmitter();

export default systemEvents;

