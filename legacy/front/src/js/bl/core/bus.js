import busModule from './busModule.js';

(function (module) {
    module.factory('bus', [
            function () {
                return busModule;
            }
        ])
})(angular.module('app'));
