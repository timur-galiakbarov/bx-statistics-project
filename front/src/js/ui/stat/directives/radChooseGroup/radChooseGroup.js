import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';

angular
    .module('rad.ui.directives')
    .directive('radChooseGroup', radChooseGroup);

radChooseGroup.$inject = ['$timeout', 'vkApiFactory', 'appState', 'bus']

function radChooseGroup($timeout, vkApiFactory, appState, bus) {
    return {
        restrict: 'EA',
        templateUrl: './templates/js/ui/stat/directives/radChooseGroup/radChooseGroup.html',
        scope: {
            onAction: "=",
            onIndex: "=?"
        },
        link: function ($scope) {
            $scope.showList = showList;
            $scope.setLink = setLink;
            $scope.currentState = 'admin';

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            function getAdminGroups() {
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "moder",
                    count: 1000,
                    fields: ""
                }).then(function (res) {
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        $scope.adminGroups = res;
                    }
                });
            }

            function getMyGroups() {
                vkApiFactory.getUserGroups(authData, {
                    extended: 1,
                    filter: "",
                    count: 1000,
                    fields: ""
                }).then(function (res) {
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        $scope.myGroups = res;
                    }
                });
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

            function getBookmarkList() {
                bus.request(topics.BOOKMARK.GET_LIST)
                    .then((bookmarksList)=> {
                        var list = "";
                        if (!bookmarksList || !bookmarksList.bookmarks.length) {
                            return;
                        }
                        bookmarksList.bookmarks.forEach((item)=> {
                            list += item;
                            list += ",";
                        });
                        vkApiFactory.getGroupsInfo(authData, {
                            groupIds: list
                        }).then((groups)=> {
                            $timeout(()=> {
                                $scope.bookmarksList = groups;
                            });
                        });
                    });
            }

            function init() {
                getAdminGroups();
                getMyGroups();
                getBookmarkList();
            }

            function setLink(group){
                $scope.onAction(group, $scope.onIndex);
            }

            init();
        }
    };
}