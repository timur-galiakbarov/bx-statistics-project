import events from './../../../../bl/events.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statPublishAnalisysController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Анализ публикаций';
            $scope.model = {
                groupAddress: ''
            };
            $scope.adminGroups = [];
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.isHiddenMenu = true;
            $scope.setGroupLink = setGroupLink;
            $scope.getStat = getStat;
            $scope.showNextPosts = showNextPosts;
            $scope.getDate = getDate;
            $scope.wallFilter = wallFilter;

            $scope.wallCount = 0;
            $scope.wallList = [];
            $scope.wallListView = [];
            $scope.wallPage = 1;

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
                    console.log(res);
                    if (res && res[0] > 0) {
                        res = res.slice(1);
                        $scope.adminGroups = res;
                    }
                });
            }

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function setGroupLink(group) {
                $scope.model.groupAddress = "https://vk.com/" + group.screen_name;
                $scope.isHiddenMenu = true;
            }

            function getStat() {
                if (!$scope.model.groupAddress) {
                    return;
                }

                var parseDate = getCheckedDate();
                var vkGroupId = $scope.model.groupAddress.replace("https://vk.com/", "");
                var vkGid;
                var groupInfo;

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId
                }).then(function (res) {
                    vkGid = res.gid;
                    groupInfo = res;

                    $.when(
                        getWallStat().then(function (wall) {
                            $scope.wallList = wall;
                            wallFilter('likes');
                        })
                    )
                        .then(function () {
                            bus.publish(events.STAT.PUBLISH_ANALISYS.FINISHED, $scope.stat);
                        });
                });
                //Получение статистик по стене группы
                function getWallStat() {
                    var deferr = $.Deferred();
                    var iteration = 0;
                    var wallStat = [];
                    var postCounter = 0;

                    getWall();

                    function getWall() {
                        if (iteration >= 100)
                            return;

                        vkApiFactory.getWall(authData, {
                            groupId: vkGid,
                            offset: iteration * 100,
                            count: 100,
                            extended: 1,
                            fields: ''
                        }).then(function (res) {
                            var flagStop = false;
                            if (!res || res.error && res.error && res.error.error_code == 6) {
                                setTimeout(function () {
                                    getWall();
                                }, 400);
                                return;
                            }

                            if (res && res.length > 1) {
                                $scope.wallCount = res[0];//Количество постов за период
                                if (parseDate.lastPosts && parseDate.lastPosts == "all") {
                                    parseDate.lastPosts = res[0];
                                }
                                res.forEach(function (post, j) {
                                    if (parseDate.lastPosts) {//Фильтр за последние посты
                                        if (j != 0 && postCounter <= parseDate.lastPosts) {
                                            wallStat.push(post);
                                            postCounter++;
                                        }
                                        if (postCounter > parseDate.lastPosts) {
                                            flagStop = true;
                                        }
                                    } else {//Фильтр за время
                                        if (post.date > parseDate.unixFrom && post.date < parseDate.unixTo) {
                                            wallStat.push(post);
                                        } else if (post.date <= parseDate.unixFrom && !post.is_pinned) {
                                            flagStop = true;
                                        }
                                    }
                                });
                            } else {
                                flagStop = true;
                            }

                            if (!flagStop) {
                                iteration++;
                                getWall();
                            } else {
                                //console.log(wallStat);
                                deferr.resolve(wallStat);
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }
            }

            function wallFilter(filter) {
                if (!filter) {
                    filter = $('input[name=filterPosts]:checked').val();
                }
                if (filter == 'likes') {//Фильтр по лайкам
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.likes.count)
                            return o.likes.count;
                        else
                            return 0;
                    }).reverse();
                    $scope.wallListView = [];
                    $scope.wallPage = 1;
                    for (var i = 0; i < 10; i++) {
                        if ($scope.wallList[i])
                            $scope.wallListView.push($scope.wallList[i]);
                        else i = 10;
                    }

                    return;
                }
                if (filter == 'reposts') {//Фильтр по лайкам
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.reposts.count)
                            return o.reposts.count;
                        else
                            return 0;
                    }).reverse();
                    $scope.wallListView = [];
                    $scope.wallPage = 1;
                    for (var i = 0; i < 10; i++) {
                        if ($scope.wallList[i])
                            $scope.wallListView.push($scope.wallList[i]);
                        else i = 10;
                    }

                    return;
                }
                if (filter == 'comments') {//Фильтр по лайкам
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.comments.count)
                            return o.comments.count;
                        else
                            return 0;
                    }).reverse();
                    $scope.wallListView = [];
                    $scope.wallPage = 1;
                    for (var i = 0; i < 10; i++) {
                        if ($scope.wallList[i])
                            $scope.wallListView.push($scope.wallList[i]);
                        else i = 10;
                    }

                    return;
                }
            }

            function showNextPosts() {
                for (var i = $scope.wallPage * 10; i < ($scope.wallPage + 1) * 10; i++) {
                    if ($scope.wallList[i])
                        $scope.wallListView.push($scope.wallList[i]);
                    else i = ($scope.wallPage + 1) * 10;
                }
                $scope.wallPage++;
            }

            function getCheckedDate() {
                var checkDate = $('input[name=checkDate]:checked').val();
                var currDate = new Date();
                var dateTo;
                var dateFrom;

                switch (checkDate) {
                    case "last30days":
                        dateTo = new Date();
                        dateFrom = currDate.setDate(currDate.getDate() - 29);
                        return {
                            from: moment(dateFrom).format("YYYY-MM-DD"),
                            to: moment(dateTo).format("YYYY-MM-DD"),
                            unixFrom: dateFrom / 1000,
                            unixTo: dateTo / 1000
                        };
                        break;
                    case "last100posts":
                        return {
                            lastPosts: 100
                        };
                        break;
                    case "allPosts":
                        return {
                            lastPosts: "all"
                        };
                        break;
                }
            }

            function getDate(date) {
                return moment(date * 1000).format("DD.MM.YYYY HH:mm")
            }

            getAdminGroups();

            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_flat-blue',
                radioClass: 'iradio_flat-blue'
            });

        }]);