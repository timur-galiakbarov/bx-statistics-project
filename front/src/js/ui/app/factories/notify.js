import topics from './../../../bl/topics.js';
import events from './../../../bl/events.js';

(function (module, angular) {

    module.factory('notify', notify);

    notify.$inject = ['$uibModal', 'bus', 'appState'];

    function notify($uibModal, bus, appState) {
        var logIt;

        toastr.options = {
            "closeButton": true,
            "positionClass": "toast-bottom-right",
            "timeOut": "4000"
        };

        logIt = function(message, type) {
            return toastr[type](message);
        };

        var api = {
            success: function (text) {
                logIt(text, 'success');
            },
            info: function (text) {
                logIt(text, 'info');
            },
            error: function (text) {
                logIt(text, 'error');
            }
        };

        return api;

    }

})(angular.module("rad.ui.directives"), angular);