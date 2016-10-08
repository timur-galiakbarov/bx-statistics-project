import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radChooseGroupMain', radChooseGroupMain);

radChooseGroupMain.$inject = ['$timeout', 'vkApiFactory', 'appState', 'bus', 'radCommonFunc'];

function radChooseGroupMain($timeout, vkApiFactory, appState, bus, radCommonFunc) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/stat/directives/radChooseGroupMain/radChooseGroupMain.html',
        scope: {
            onAction: "=",
            onIndex: "=?"
        },
        link: function ($scope) {
            $scope.showList = showList;
            $scope.setLink = setLink;
            $scope.addBookmark = addBookmark;
            $scope.removeBookmark = removeBookmark;

            $scope.currentState = 'isMy';
            $scope.groupsLoading;
            $scope.bookmarkGroupUrl = '';
            $scope.bookmarksList = [];
            $scope.bookmarkError = "";

            $scope.$watch('bookmarkGroupUrl', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.bookmarkError = "";
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function getAdminGroups(iteration) {
                if (!iteration)
                    iteration = 0;
                var deferr = $.Deferred();

                if (iteration > 3) {
                    deferr.reject();
                    return deferr.promise();
                }

                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "moder",
                    count: 100,
                    fields: "members_count"
                }).then(function (res) {
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        deferr.resolve();
                        $timeout(()=> {
                            $scope.adminGroups = res;
                        });
                    } else {
                        setTimeout(()=> {
                            getAdminGroups(iteration + 1);
                        }, 300);
                    }
                }).fail(()=> {
                    setTimeout(()=> {
                        getAdminGroups(iteration + 1);
                    }, 300);
                });

                return deferr.promise();
            }

            function getMyGroups(iteration) {
                if (!iteration)
                    iteration = 0;

                var deferr = $.Deferred();

                if (iteration > 3) {
                    deferr.reject();
                    return deferr.promise();
                }

                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "",
                    count: 100,
                    fields: "members_count"
                }).then(function (res) {
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        deferr.resolve();
                        $timeout(()=> {
                            $scope.myGroups = res;
                        });
                    } else {
                        setTimeout(()=> {
                            getMyGroups(iteration + 1);
                        }, 300);
                    }
                }).fail(()=> {
                    setTimeout(()=> {
                        getMyGroups(iteration + 1);
                    }, 300);
                });

                return deferr.promise();
            }

            function showList(list) {
                switch (list) {
                    case 'admin':
                        $scope.currentState = 'admin';
                        break;
                    case 'bookmark':
                        $scope.currentState = 'bookmark';
                        break;
                    case 'isMy':
                        $scope.currentState = 'isMy';
                        break;
                }
            }

            function getBookmarkList(iteration) {
                if (!iteration)
                    iteration = 0;

                var deferr = $.Deferred();

                if (iteration > 3) {
                    deferr.reject();
                    return deferr.promise();
                }

                bus.request(topics.BOOKMARK.GET_LIST)
                    .then((bookmarksList)=> {
                        var list = "";
                        if (!bookmarksList || !bookmarksList.bookmarks.length) {
                            $scope.isLoading = false;
                            deferr.resolve();
                            return deferr.promise();
                        }
                        bookmarksList.bookmarks.forEach((item)=> {
                            list += item;
                            list += ",";
                        });

                        getBookMarkRequest(0, list)

                    });

                function getBookMarkRequest(requestIteration, list){
                    if (requestIteration > 3) {
                        deferr.reject();
                        return;
                    }

                    vkApiFactory.getGroupsInfo(authData, {
                        groupIds: list,
                        fields: "members_count,counters,photo"
                    }).then((groups)=> {
                        if (groups && groups.length) {
                            deferr.resolve();
                            $timeout(()=> {
                                $scope.bookmarksList = groups;
                            });
                        } else {
                            setTimeout(()=> {
                                getBookMarkRequest(iteration + 1, list);
                            }, 300);
                        }
                    }).fail(()=> {
                        setTimeout(()=> {
                            getBookMarkRequest(iteration + 1, list);
                        }, 300);
                    });
                }

                return deferr.promise();
            }

            function init() {
                $scope.groupsLoading = true;
                $.when(
                    getAdminGroups(),
                    getMyGroups(),
                    getBookmarkList()
                ).then(()=> {
                        $timeout(()=> {
                            $scope.groupsLoading = false;
                        });
                    })
                    .fail(()=> {
                        $timeout(()=> {
                            $scope.groupsLoading = false;
                        });
                    });
            }

            function setLink(group) {
                $scope.onAction(group, $scope.onIndex);
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

            init();
        }
    };
}