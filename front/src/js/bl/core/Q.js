import Q from 'promise';
import bus from './busModule.js';

var promisePrototype = Q.makePromise.prototype;

promisePrototype.thenPublish = function thenPublish(eventName){
    return this.then(publishEvent);

    function publishEvent(data){
        bus.publish(eventName, data);
        return data;
    };
};

export default Q;