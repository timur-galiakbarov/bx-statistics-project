import topics from './../../../../bl/topics.js';
import events from './../../../../bl/events.js';

(function (module, angular) {

    module.factory('memoryFactory', memoryFactory);

    memoryFactory.$inject = ['bus', 'appState'];

    function memoryFactory(bus, appState) {

        var memory = {

        };

        var api = {
            setMemory: function(memoName, data){
                memory[memoName] = data;
            },
            getMemory: function(memoName){
                return memory[memoName] || undefined;
            }
        };

        return api;

    }

})(angular.module("rad.stat"), angular);