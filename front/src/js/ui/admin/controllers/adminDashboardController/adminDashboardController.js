import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('adminDashboardController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState', '$timeout',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout) {
            $rootScope.page.sectionTitle = 'Dashboard';

            $scope.stat = {
                userAllToday: 0,
                userNewToday: 0,
                userOldToday: 0
            };

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function getAdminStat() {
                return bus.request(topics.ADMIN.GET_STAT)
                    .then((res)=> {
                        $timeout(()=> {
                            $scope.stat.userAllToday = res.data.usersAllToday || 0;
                            $scope.stat.userNewToday = res.data.usersNewToday || 0;
                            $scope.stat.userOldToday = res.data.usersOldToday || 0;
                            $scope.stat.usersAll = res.data.usersAll;
                            $scope.stat.usersList = res.data.usersList;
                            $scope.stat.payCount = res.data.payCount;

                            $scope.isLoading = false;
                        });
                    });
            }

            function init() {
                $scope.isLoading = true;
                getAdminStat();
            }

            init();

        }]);