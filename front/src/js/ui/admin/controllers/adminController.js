import {enums} from './../../../bl/module.js';
import events from './../../../bl/events.js';

angular
    .module('rad.stat')
    .controller('adminController', ['$rootScope', '$scope', '$state', 'bus', '$timeout', 'appState',
        function ($rootScope, $scope, $state, bus, $timeout, appState) {
            $scope.currentTab = 'admin';

            $scope.adminTab = '';

            $scope.isAdmin = appState.isAdmin();

            bus.subscribe(events.ADMIN.STATE_CHANGED, (tabEnum)=> {
                $timeout(()=>{
                    $scope.adminTab = tabEnum;
                });
            });

            function goToDefaultState() {
                if ($scope.isAdmin) {
                    $state.go('index/admin/dashboard');
                }
            }

            goToDefaultState();

            $rootScope.$on('$stateChangeSuccess', function (evt, toState) {
                if (toState.name === 'index/admin') {
                    goToDefaultState();
                }
            });

        }]);
