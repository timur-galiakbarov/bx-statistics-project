import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('parsersController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState', 'vkApiFactory', 'memoryFactory', '$timeout', 'radCommonFunc', '$stateParams', 'notify',
        function ($rootScope, $scope, $state, bus, statPopupsFactory, appState, vkApiFactory, memoryFactory, $timeout, radCommonFunc, $stateParams, notify) {

            $scope.model = {
                state: ''
            };

            $scope.changeParser = function (state) {
                $scope.model.state = state;
            }

            init();

            function init(){
                $rootScope.setTitle("");
            }

        }

    ])
;