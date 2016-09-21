/*
import events from './../../../bl/events.js';

angular
    .module('rad.settings')
    .controller('settingsController', ['$rootScope', '$scope', '$state', 'bus', 'appState',
        function ($rootScope, $scope, $state, bus, appState) {

            $rootScope.page.sectionTitle = 'Настройки';

            $scope.userInfo = {
                firstName: appState.getUserName(),
                lastName: appState.getLastName(),
                userMail: appState.getEmail()
            };

            var vkData = appState.socAuthInfo.getVk();
            vkData.user = vkData.user ? vkData.user : {};

            $scope.vkInfo = {
                isAuth: vkData.isAuth,
                firstName: vkData.user.firstName || '',
                lastName: vkData.user.lastName || '',
                id: vkData.user.id || ''
            };

            bus.subscribe(events.ACCOUNT.VK.INFO_READY, function(){
                vkData = appState.socAuthInfo.getVk();
                $scope.$apply(function(){
                    $scope.vkInfo = {
                        isAuth: vkData.isAuth,
                        firstName: vkData.user.firstName || '',
                        lastName: vkData.user.lastName || '',
                        id: vkData.user.id || ''
                    };
                });
            });

            $(".nano").nanoScroller();
        }]);*/
