import events from './../../../bl/events.js';
import bus from './../../../bl/core/busModule.js';

angular
    .module('rad.menu')
    .directive('radProfile', radProfile);

radProfile.inject = ['appState', 'vkApiFactory', 'notify', '$rootScope', '$state'];

function radProfile(appState, vkApiFactory, notify, $rootScope, $state) {
    return {
        restrict: 'EA',
        templateUrl: '/js/ui/menu/radProfile/radProfile.html',
        controller: ['$scope', 'bus', 'appState', function ($scope, bus, appState) {

        }],
        link: function ($scope) {
            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var userData = appState.user();

            $scope.noActiveTariff = !appState.isActiveUser();

            $scope.model = {
                userName: '',
                userLastName: '',
                uid: '',
                photoUrl: '',
                tariff: userData.tariff,
                activeTo: userData.activeTo,
            };

            $scope.logout = function () {
                bus.publish(events.ACCOUNT.LOGOUT);
            };

            function init() {
                $scope.isLoadingUser = true;
                getUserData();

                VK.Observer.subscribe("widgets.subscribed", function f()
                {
                    $("#vk_subscribe").html("");
                });

                VK.Observer.subscribe("widgets.groups.joined", function f()
                {
                    $("#vk_subscribe").html("");
                });
            }

            init();

            function getUserData(iteration) {
                if (!iteration)
                    iteration = 0;

                if (iteration > 3) {
                    notify.error("Не удалось загрузить ваши имя и фамилию. Пожалуйста, перезагрузите страницу.");
                    $scope.isLoadingUser = false;
                    return;
                }

                iteration++;

                vkApiFactory.getCurrentUserInfo(authData, {
                    fields: 'photo_100'
                }).then(function (res) {

                    if (res && res[0]) {
                        $scope.$apply(()=> {
                            $scope.model.userName = res[0].first_name;
                            $scope.model.userLastName = res[0].last_name;
                            $scope.model.photoUrl = res[0].photo_100;
                            $scope.model.uid = res[0].uid;

                            $scope.isLoadingUser = false;

                            vkApiFactory.isMember(authData, {
                                groupId: "socstat_ru",
                                userId: res[0].uid
                            }).then((res)=> {
                                if (res == 0)
                                    VK.Widgets.Subscribe("vk_subscribe", {soft: 1}, -125792332);
                            });
                        });

                    } else {
                        setTimeout(()=>{
                            getUserData(iteration)
                        }, 500);
                    }
                }).fail((err)=> {
                    setTimeout(()=>{
                        getUserData(iteration)
                    }, 500);
                });
            }

        }
    };
}
