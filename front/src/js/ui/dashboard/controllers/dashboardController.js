import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, $state) {

            $rootScope.page.sectionTitle = '';

            //vars
            $scope.model = {
                title: 'Анализ сообщества',
                searchString: '',
                searchList: []
            };

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            //functions proto
            $scope.setGroup = setGroup;
            $scope.chooseAnotherGroup = chooseAnotherGroup;
            $scope.goToPublishStat = goToPublishStat;
            $scope.goToMainStat = goToMainStat;
            $scope.goToGroupsAnalog = goToGroupsAnalog;
            $scope.goToFindBots = goToFindBots;
            $scope.goToFindContent = goToFindContent;
            $scope.goToAuditoryCompare = goToAuditoryCompare;
            $scope.goToFindAdv = goToFindAdv;
            $scope.search = search;

            $scope.$watch('model.searchString', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.urlError = "";
            });

            //functions
            function setGroup(group) {
                getGroupInfo(group).then((groupInfo)=> {
                    $timeout(()=> {
                        $scope.model.searchVisible = false;
                        $scope.model.groupInfo = groupInfo;
                        $scope.model.title = "Выбрать действие для группы"
                    });
                });
            }

            function getGroupInfo(link) {
                return vkApiFactory.getGroupInfo(appState.getAuthData(), {
                    groupId: radCommonFunc.getGroupId(link.screen_name),
                    fields: 'photo'
                })
                    .then((groupInfo)=> {
                        return groupInfo;
                    });
            }

            function chooseAnotherGroup() {
                $timeout(()=>{
                    $scope.model.groupInfo = false;
                    $scope.model.title = "Анализ сообщества";
                });
            }

            function goToPublishStat() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.publishAnalysis', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
                });
            }

            function goToMainStat() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.stat', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
                });
            }

            function goToGroupsAnalog() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.groupsAnalog', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
                });
            }

            function goToFindBots() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.findBots', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
                });
            }

            function goToFindContent() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.findContent');
            }

            function goToAuditoryCompare() {
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.auditoryCompare', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
                });
            }

            function goToFindAdv(){
                if (!$scope.model.groupInfo) {

                    return;
                }
                $state.go('index.findAdv', {
                    getStatFromGroup: $scope.model.groupInfo.screen_name
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


            $scope.newsList = [];

            init();

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            function init() {
                $(".nano").nanoScroller();
                getNewsList();
                initTooltips();
            }

            function initTooltips() {
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                });
            }

            function getNewsList() {
                bus.request(topics.NEWS.GET_LIST)
                    .then((newsList)=> {
                        $timeout(()=> {
                            $scope.newsList = newsList;
                            $timeout(()=> {
                                $(".nano").nanoScroller();
                            });
                        });
                    })
                    .always(()=> {
                        $(".nano").nanoScroller();
                    });
            }

        }]);