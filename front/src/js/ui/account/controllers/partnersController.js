import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.account')
    .controller('partnersController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, $state) {

            //vars
            $scope.model = {
                title: 'Бесплатные тарифы'
            };

            function init(){

            }

            init();

        }]);