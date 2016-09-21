import events from './../../../bl/events.js';
import topics from './../../../bl/topics.js';

angular
    .module('rad.dashboard')
    .controller('dashboardController', ['$rootScope', '$scope', 'bus', 'appState', 'vkApiFactory', '$timeout', 'radCommonFunc', 'notify', '$state',
        function ($rootScope, $scope, bus, appState, vkApiFactory, $timeout, radCommonFunc, notify, $state) {

            $rootScope.page.sectionTitle = 'Главная';

            $scope.adminGroups = [];
            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };
            $scope.showTab = showTab;
            $scope.activeTab = 'isMy';
            $scope.addBookmark = addBookmark;
            $scope.getBookmarkList = getBookmarkList;
            $scope.removeBookmark = removeBookmark;
            $scope.goToMainStat = goToMainStat;
            $scope.goToPublishStat = goToPublishStat;

            $scope.bookmarkGroupUrl = '';
            $scope.newsList = [];
            $scope.bookmarksList = [];
            $scope.bookmarkError = "";
            $scope.adminGroupsLoading = false;
            $scope.myGroupsLoading = false;

            init();

            $scope.$watch('bookmarkGroupUrl', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.bookmarkError = "";
            });

            $scope.$watch('isLoading', (newVal)=>{
                $rootScope.globalLoading = newVal;
            });

            function init() {
                $(".nano").nanoScroller();
                getAdminGroups();
                getMyGroups();
                getNewsList();
                getBookmarkList();

                initTooltips();
            }

            function initTooltips(){
                $(function () {
                    $('[data-toggle="tooltip"]').tooltip();
                });
            }

            function getAdminGroups(iteration) {
                if (!iteration)
                    iteration = 0;

                if (iteration > 3) {
                    notify.error("Не удалось загрузить данные об администрируемых группах. Попробуйте позже");
                    return;
                }
                $scope.adminGroupsLoading = true;
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "moder",
                    count: 1000,
                    fields: "members_count"
                })
                    .then(function (res) {
                        //console.log(res);
                        if (res && res[0] > 0) {
                            res = res.slice(1);
                            $timeout(()=> {
                                $scope.adminGroups = res;
                                $(".nano").nanoScroller();
                                setTimeout(()=>{
                                    initTooltips();
                                }, 300);
                            });
                        } else {
                            iteration++;
                            setTimeout(()=>{
                                getAdminGroups(iteration);
                            }, 500);
                        }
                        $scope.$apply(()=> {
                            $scope.adminGroupsLoading = false;
                        });
                    })
                    .fail((error)=> {
                        iteration++;
                        getAdminGroups(iteration);
                    })
                    .always(()=> {
                        $(".nano").nanoScroller();
                    });
            }

            function getMyGroups(iteration) {
                if (!iteration)
                    iteration = 0;

                if (iteration > 3) {
                    notify.error("Не удалось загрузить данные о ваших группах. Попробуйте позже");
                    return;
                }
                $scope.myGroupsLoading = true;
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "",
                    count: 1000,
                    fields: "members_count"
                })
                    .then(function (res) {
                        if (res && res[0] > 0) {
                            res = res.slice(1);
                            $timeout(()=> {
                                $scope.myGroups = res;
                                $(".nano").nanoScroller();
                                setTimeout(()=>{
                                    initTooltips();
                                }, 300);
                            });
                        } else {
                            iteration++;
                            setTimeout(()=>{
                                getMyGroups(iteration);
                            }, 500);
                        }
                        $scope.$apply(()=> {
                            $scope.myGroupsLoading = false;
                        });
                    })
                    .fail((error)=> {
                        iteration++;
                        getAdminGroups(iteration);
                    })
                    .always(()=> {
                        $(".nano").nanoScroller();
                    });
            }

            function showTab(tab) {
                switch (tab) {
                    case 'bookmark':
                        $scope.activeTab = 'bookmark';
                        break;
                    case 'admin':
                        $scope.activeTab = 'admin';
                        break;
                    case 'isMy':
                        $scope.activeTab = 'isMy';
                        break;
                }
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

            function addBookmark() {
                if (!$scope.bookmarkGroupUrl) {
                    $scope.bookmarkError = 'Укажите адрес или символьный код группы';
                    return;
                }
                $scope.isLoading = true;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: radCommonFunc.getGroupId($scope.bookmarkGroupUrl)
                })
                    .then((groupInfo)=> {
                        if (groupInfo.error) {
                            $timeout(()=> {
                                $scope.bookmarkError = "Введеная группа вконтакте не найдена";
                                $scope.isLoading = false;
                            });
                            return;
                        }
                        addBookmarkRequest(groupInfo)
                            .then(()=> {
                                getBookmarkList();
                            });
                    });

                function addBookmarkRequest(groupInfo) {
                    return bus.request(topics.BOOKMARK.ADD, {
                        screenName: groupInfo.screen_name
                    })
                        .then((res)=> {
                            $timeout(()=> {
                                $scope.bookmarkGroupUrl = '';
                            });
                        });
                }
            }

            function getBookmarkList() {
                $scope.isLoading = true;
                bus.request(topics.BOOKMARK.GET_LIST)
                    .then((bookmarksList)=> {
                        var list = "";
                        if (!bookmarksList || !bookmarksList.bookmarks.length) {
                            $scope.isLoading = false;
                            return;
                        }
                        bookmarksList.bookmarks.forEach((item)=> {
                            list += item;
                            list += ",";
                        });
                        vkApiFactory.getGroupsInfo(authData, {
                            groupIds: list
                        }).then((groups)=> {
                            /*console.log(groups);*/
                            $timeout(()=> {
                                $scope.bookmarksList = groups;
                            });
                        })
                            .always(()=> {
                                $scope.isLoading = false;
                            });
                    })
                    .fail(()=> {
                        $scope.isLoading = false;
                    });
            }

            function removeBookmark(index) {
                $scope.isLoading = true;
                bus.request(topics.BOOKMARK.REMOVE, {
                    index: index
                })
                    .then((res)=> {
                        if (res.success) {
                            getBookmarkList();
                        }
                    });
            }

            function goToMainStat(groupInfo) {
                $state.go('index.stat', {
                    getStatFromGroup: groupInfo.screen_name
                });
            }

            function goToPublishStat(groupInfo) {
                $state.go('index.publishAnalysis', {
                    getStatFromGroup: groupInfo.screen_name
                });
            }
        }]);