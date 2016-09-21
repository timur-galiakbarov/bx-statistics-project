import {enums} from './../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('adminController', ['$rootScope', '$scope', '$state', 'bus', 'statPopupsFactory', 'appState',
        function($rootScope, $scope, $state, bus, statPopupsFactory, appState) {
            $scope.currentTab = 'admin';


        }]);