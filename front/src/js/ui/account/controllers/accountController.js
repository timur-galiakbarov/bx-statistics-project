import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.account')
    .controller('accountController', ['$rootScope', '$scope', 'bus', 'appState', '$timeout', 'radCommonFunc', 'notify', 'vkApiFactory',
        function ($rootScope, $scope, bus, appState, $timeout, radCommonFunc, notify, vkApiFactory) {

            //vars
            $scope.model = {
                title: 'Мои данные',
                vkUserInfo: "",
                freeList: [],
                freeWithSubscribe: [],
                addGroupInfo: {}
            };

            $scope.logout = logout;

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function init() {
                $rootScope.setTitle("Профиль и оплата");
                $scope.model.vkUserInfo = appState.getUserVkInfo();
                if (!$scope.model.vkUserInfo) {
                    getMeInfo();
                }

            }

            function getMeInfo() {
                bus.request(topics.VK.USERS_GET, authData, {
                    user_ids: undefined,
                    fields: "photo_200,photo_100"
                }).then((res)=> {
                    $scope.model.vkUserInfo = res;
                    $scope.$apply($scope.model.vkUserInfo);
                }).fail(()=> {
                    notify.error("Не удалось получить данные по профилю ВКонтакте")
                });
            }

            function logout() {
                bus.request(topics.ACCOUNT.LOGOUT).always(()=> {
                    location.href = "/";
                });
            }

            init();

        }]);