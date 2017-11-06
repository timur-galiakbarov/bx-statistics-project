import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radChooseGroupMain', radChooseGroupMain);

radChooseGroupMain.$inject = ['$timeout', 'vkApiFactory', 'appState', 'bus', 'radCommonFunc'];

function radChooseGroupMain($timeout, vkApiFactory, appState, bus, radCommonFunc) {
    return {
        restrict: 'EA',
        templateUrl: 'js/ui/stat/directives/radChooseGroupMain/radChooseGroupMain.html',
        scope: {
            onAction: "=?",
            onIndex: "=?",
            onAddAction: "=?",
            view: "=?"
        },
        link: function ($scope) {
            $scope.showList = showList;
            $scope.setLink = setLink;
            $scope.addBookmark = addBookmark;
            $scope.removeBookmark = removeBookmark;

            $scope.currentState = 'admin';
            $scope.groupsLoading;
            $scope.bookmarkGroupUrl = '';
            $scope.bookmarksList = [];
            $scope.bookmarkError = "";
            $scope.addActionTooltipText = '';
            $scope.groupIsFree = groupIsFree;

            $scope.$watch('bookmarkGroupUrl', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.bookmarkError = "";
            });

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function getAdminGroups() {
                var deferr = $.Deferred();
                getRecursive(0);
                return deferr.promise();

                function getRecursive(iteration){
                    if (!iteration)
                        iteration = 0;

                    if (iteration > 9) {
                        deferr.reject();
                        return;
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
                            $timeout(()=> {
                                getRecursive(iteration + 1);
                            }, 300);
                        }
                    }).fail(()=> {
                        $timeout(()=> {
                            getRecursive(iteration + 1);
                        }, 300);
                    });
                }
            }

            function getMyGroups() {
                var deferr = $.Deferred();
                getRecursive(0);
                return deferr.promise();

                function getRecursive(iteration){
                    if (!iteration)
                        iteration = 0;

                    if (iteration > 9) {
                        deferr.reject();
                        return;
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
                            $timeout(()=> {
                                getRecursive(iteration + 1);
                            }, 300);
                        }
                    }).fail(()=> {
                        $timeout(()=> {
                            getRecursive(iteration + 1);
                        }, 300);
                    });
                }
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
                            $scope.groupsLoading = false;
                            deferr.resolve();
                            return deferr.promise();
                        }
                        bookmarksList.bookmarks.forEach((item)=> {
                            list += item;
                            list += ",";
                        });

                        getBookMarkRequest(0, list, deferr);

                    });

                function getBookMarkRequest(requestIteration, list, def) {
                    if (requestIteration > 3) {
                        def.reject();
                        return;
                    }

                    vkApiFactory.getGroupsInfo(authData, {
                        groupIds: list,
                        fields: "members_count,counters,photo"
                    }).then((groups)=> {
                        if (groups && groups.length) {
                            $timeout(()=> {
                                $scope.bookmarksList = groups;
                            });
                            def.resolve();
                        } else {
                            $timeout(()=> {
                                getBookMarkRequest(requestIteration + 1, list, def);
                            }, 300);
                        }
                    }).fail(()=> {
                        $timeout(()=> {
                            getBookMarkRequest(requestIteration + 1, list, def);
                        }, 300);
                    });
                }

                return deferr.promise();
            }

            function init() {
                $scope.groupsLoading = true;

                switch ($scope.view) {
                    case 'posts':
                        $scope.addActionTooltipText = 'Нажмите, чтобы добавить группу к списку анализируемых';
                        break;
                    case 'compare':
                        $scope.addActionTooltipText = 'Нажмите, чтобы добавить группу к сравнению';
                        break;
                    case 'payment':
                        $scope.addActionTooltipText = 'Нажмите, чтобы добавить группу для бесплатной аналитики';
                        break;
                }

                $.when(
                    getAdminGroups(),
                    getMyGroups(),
                    getBookmarkList()
                )
                    .then(()=> {
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
                if ($scope.onAction)
                    $scope.onAction(group, $scope.onIndex);
            }

            function addBookmark() {
                if (!$scope.bookmarkGroupUrl) {
                    $scope.bookmarkError = 'Укажите адрес или символьный код группы';
                    return;
                }
                $scope.groupsLoading = true;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: radCommonFunc.getGroupId($scope.bookmarkGroupUrl)
                })
                    .then((groupInfo)=> {
                        if (groupInfo.error) {
                            $timeout(()=> {
                                $scope.bookmarkError = "Введеная группа вконтакте не найдена";
                                $scope.groupsLoading = false;
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
                $scope.groupsLoading = true;
                bus.request(topics.BOOKMARK.REMOVE, {
                    index: index
                })
                    .then((res)=> {
                        if (res.success) {
                            getBookmarkList();
                        }
                    });
            }

            function groupIsFree(item) {
                return appState.groupIsFree(item);
            }

            init();
        }
    };
}