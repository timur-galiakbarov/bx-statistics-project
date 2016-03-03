var channel = postal.channel('app.channel');
import requertResponse from 'postal.request-response';
import Q from './Q.js'

requertResponse(postal);

postal.configuration.promise.createDeferred = function () {
    return new $.Deferred();
};
postal.configuration.promise.getPromise = function (dfd) {
    return dfd.promise();
};

var wrapper = function (func) {
    if (func === undefined)
        return func;

    return function () {
        var envelope = arguments[arguments.length - 1];
        if (envelope.reply) {
            try {
                return Q(func.apply(null, arguments[0])).then(function (result) {
                    envelope.reply(null, result);
                }, function (error) {
                    error = !!error ? error : 'unknown error';
                    console.warn(error);
                    envelope.reply(error);
                });
            }
            catch (e) {
                console.error(e);
                return envelope.reply(e);
            }
        }
        return func.apply(null, arguments);
    }
};

export default {

    publish(event, data){
        channel.publish(event, data);
    },

    document(event, data){
        channel.document(event, data);
    },

    subscribe(event, func) {
        if (typeof func !== 'function') {
            throw '`func` parameter must be function';
        }
        return channel.subscribe(event, wrapper(func));
    },
    unsubscribe(subscription) {
        if (subscription.unsubscribe)
            subscription.unsubscribe();
    },
    request() {
        return channel.request({topic: arguments[0], data: Array.prototype.slice.call(arguments, 1)});
    }
}