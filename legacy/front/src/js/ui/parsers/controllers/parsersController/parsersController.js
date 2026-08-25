import events from './../../../..//bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.stat')
    .controller('parsersController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, $state) {

            var authData = appState.getAuthData();



        }]);