import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radChooseGroup', radChooseGroup);

radChooseGroup.$inject = ['$timeout', 'vkApiFactory', 'appState', 'bus']

function radChooseGroup($timeout, vkApiFactory, appState, bus) {
    return {
        restrict: 'EA',
        templateUrl: '/js/ui/stat/directives/radChooseGroup/radChooseGroup.html',
        scope: {
            onAction: "=",
            onIndex: "=?"
        },
        link: function ($scope) {
            $scope.showList = showList;
            $scope.setLink = setLink;
            $scope.currentState = 'admin';
            $scope.groupLoading = false;

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

            init();
        }
    };
}
