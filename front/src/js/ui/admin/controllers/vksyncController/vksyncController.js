import {enums} from './../../../../bl/module.js';
import events from './../../../../bl/events.js';

angular
    .module('rad.stat')
    .controller('vksyncController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState', '$timeout',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout) {
            $rootScope.page.sectionTitle = 'Vk Sync';
            $scope.adminTab = 'vksync';

            $scope.categories = [];
            $scope.loadGroupsList = loadGroupsList;

            bus.publish(events.ADMIN.STATE_CHANGED, "vksync");

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function loadGroupsList(category) {
                vkApiFactory.getCategoryGroups(authData, params)
                    .then((res)=> {
                        /*$timeout(()=> {
                            $scope.categories = res.categories;
                        });*/
                    });
            }

            function getCategories() {
                vkApiFactory.getGroupCategories(authData)
                    .then((res)=> {
                        $timeout(()=> {
                            $scope.categories = res.categories;
                        });
                    });
            }

            function init() {
                getCategories();
            }

            init();

        }]);