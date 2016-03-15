import events from './../../../bl/events.js';

angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'radVkFactory',
        function($rootScope, $scope, bus, appState, radVkFactory) {

            $rootScope.page.sectionTitle = 'Главная';

            var vkData = appState.socAuthInfo.getVk();
            vkData.user = vkData.user ? vkData.user : {};

            $scope.isAnySocIncluded = vkData && vkData.isAuth;
            $scope.vkGroupList =

            $scope.vkInfo = {
                isAuth: vkData.isAuth,
                firstName: vkData.user.firstName || '',
                lastName: vkData.user.lastName || '',
                id: vkData.user.id || ''
            };

            bus.subscribe(events.ACCOUNT.VK.INFO_READY, function(){
                vkData = appState.socAuthInfo.getVk();
                setVkInfo();
            });

            bus.subscribe(events.ACCOUNT.VK.LOGOUT, function(){
                $scope.$apply(function(){
                    vkData.isAuth = false;
                });
                setVkInfo();
            });

            function setVkInfo(){
                $scope.$apply(function(){
                    $scope.vkInfo = {
                        isAuth: vkData.isAuth,
                        firstName: vkData.user.firstName || '',
                        lastName: vkData.user.lastName || '',
                        id: vkData.user.id || '',
                        token: vkData.user.token
                    };
                    radVkFactory.getGroupsList($scope.vkInfo.id, $scope.vkInfo.token).then(function(res){
                        console.log(res);
                        $scope.vkGroupList = res;
                    });
                    $scope.isAnySocIncluded = $scope.vkInfo && $scope.vkInfo.isAuth;
                });
            }

            $(".nano").nanoScroller();
        }]);