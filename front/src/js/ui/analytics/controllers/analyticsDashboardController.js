import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.stat')
    .controller('analyticsDashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, $state) {

            $scope.model = {
                searchString: '',
                searchList: [],
                compareList: []
            };

            var authData = appState.getAuthData();

            $scope.goToMainStat = goToMainStat;
            $scope.addToCompareGroup = addToCompareGroup;
            $scope.removeFromCompareGroup = removeFromCompareGroup;
            $scope.compare = compare;
            $scope.search = search;
            $scope.noActiveTariff = !appState.isActiveUser();
            $rootScope.setTitle("Подробная статистика сообщества");

            $scope.$watch('model.searchString', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.urlError = "";
            });

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            //functions

            function goToMainStat(group) {
                if (!group) {
                    return;
                }
                $state.go('index/analytics/common', {
                    gid: group.gid
                });
            }

            function search() {
                $timeout(()=> {
                    $scope.model.searchList = [];
                });

                if (!$scope.model.searchString) {
                    //Вывод ошибки
                    $scope.urlError = 'Пустой запрос';
                    $scope.isSearchGroup = false;
                    return;
                }

                $scope.model.searchString = $scope.model.searchString.replace("http://vk.com/", "");
                $scope.model.searchString = $scope.model.searchString.replace("https://vk.com/", "");
                $scope.model.searchString = $scope.model.searchString.replace("vk.com/", "");

                vkApiFactory.searchGroup(authData, {
                    q: $scope.model.searchString,
                    sort: "0"
                }).then(function (res) {

                    $timeout(()=> {
                        $scope.isSearchGroup = true;

                        var i = 0;
                        res.items.forEach((group, index)=> {
                            if (!$scope.model.searchList[i])
                                $scope.model.searchList[i] = [];

                            $scope.model.searchList[i].push(group);
                            if (index % 10 == 0 && index != 0)
                                i++;
                        });
                    });

                });

            }

            function addToCompareGroup(event, group) {
                event.stopPropagation();
                if (group) {
                    var foundGroup = $scope.model.compareList.filter((item)=> {
                        return item.gid == group.gid;
                    });
                    if (!foundGroup.length) {
                        $scope.model.compareList.push(group);
                        notify.success("Сообщество добавлено для сравнения");
                    } else {
                        notify.error("Сообщество уже находится в списке для сравнения");
                    }
                } else {
                    notify.error("Ошибка. Группа отсутствует");
                }
            }

            function removeFromCompareGroup(group) {
                $scope.model.compareList = $scope.model.compareList.filter((item)=> {
                    return item.gid != group.gid;
                });
            }

            function compare() {
                if ($scope.model.compareList && $scope.model.compareList.length){
                    $state.go('index/analytics/compare', {
                        list: $scope.model.compareList
                    });
                }
            }

        }]);
