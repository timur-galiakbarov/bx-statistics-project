import moment from "moment";

import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('findContentController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState',
        '$timeout', 'memoryFactory', 'radCommonFunc', 'notify', '$stateParams', '$sce',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout, memoryFactory, radCommonFunc,
                  notify, $stateParams, $sce) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Поиск контента для сообщества';
            $scope.model = {
                groupAddress: '',
                title: 'Поиск контента для сообщества',
                datePicker: {
                    dateFrom: '',
                    dateTo: '',
                    popupFrom: {
                        opened: false
                    },
                    popupTo: {
                        opened: false
                    }
                },
                sections: [],
                groupsList: []
            };
            $scope.error = {};
            $scope.adminGroups = [];
            $scope.showGroupsMenu = showGroupsMenu;
            $scope.isHiddenMenu = true;
            $scope.setGroupLink = setGroupLink;
            $scope.getStat = getStat;
            $scope.showNextPosts = showNextPosts;
            $scope.getDate = getDate;
            $scope.wallFilter = wallFilter;
            $scope.nextProgressStep = nextProgressStep;
            $scope.isShowAnotherPictures = isShowAnotherPictures;
            $scope.isShowGif = isShowGif;
            $scope.showCurrentPicture = showCurrentPicture;
            $scope.addToFavorite = addToFavorite;
            $scope.getVideoUrl = getVideoUrl;
            $scope.isShowDetail = isShowDetail;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;
            $scope.getContent = getContent;

            $scope.wallCount = 0;
            $scope.wallList = [];
            $scope.wallListView = [];
            $scope.wallPage = 1;
            $scope.isLoading = false;
            $scope.dataIsLoaded = false;
            $scope.groupIsFinded = false;
            $scope.progressPercent = 0;
            $scope.hiddenFilter = false;

            $scope.dateOptions = {
                formatYear: 'yy',
                maxDate: new Date(),
                minDate: new Date((new Date()).getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
                startingDay: 1,
                showWeeks: false,
                isRTL: false
            };

            var authData = {
                token: appState.getUserVkToken(),
                login: appState.getUserVkLogin()
            };

            var membersCount = 0;

            var needGetStatFromParams = $stateParams.getStatFromGroup ? $stateParams.getStatFromGroup : false;

            $scope.$watch('wallList');

            $scope.$watch('model.groupAddress', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.urlError = "";
            });

            $scope.$watch('model.datePicker.dateFrom', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.error.datePickerFromError = "";
            });

            $scope.$watch('model.datePicker.dateTo', (newVal, oldVal)=> {
                if (newVal != oldVal)
                    $scope.error.datePickerToError = "";
            });

            $scope.$watch('isLoading', (newVal)=> {
                $rootScope.globalLoading = newVal;
            });

            $scope.trustSrc = function (src) {
                return $sce.trustAsResourceUrl(src);
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

            function showGroupsMenu() {
                $scope.isHiddenMenu = !$scope.isHiddenMenu;
            }

            function setGroupLink(group) {
                $scope.model.groupAddress = "https://vk.com/" + group.screen_name;
                $scope.isHiddenMenu = true;
            }

            function getContent(section) {
                $scope.progressPercent = 0;
                $scope.isLoading = true;
                $scope.hiddenFilter = true;
                $scope.wallList = [];
                $scope.wallListView = [];
                $scope.model.groupsList = [];
                var step = (1 / section.groups.length) * 100;
                getContentPromise(0);

                function getContentPromise(index) {
                    if (section.groups.length) {
                        getStat(section.groups[index])
                            .then((result)=> {
                                result.wallList.forEach((item)=> {
                                    item.group = {
                                        name: result.name,
                                        photo: result.photo,
                                        photo_big: result.photo_big,
                                        photo_medium: result.photo_medium,
                                        url: result.url,
                                        screen_name: result.screen_name
                                    };
                                    $scope.wallList.push(item);
                                });
                                if (index + 1 < section.groups.length) {
                                    nextProgressStep(step);
                                    getContentPromise(index + 1);
                                } else {
                                    $timeout(()=> {
                                        wallFilter('likes');
                                        $scope.progressPercent = 100;
                                        $scope.dataIsLoaded = true;
                                        $scope.isLoading = false;
                                    });
                                }
                            })
                            .fail(()=> {
                                notify.error("Произошла ошибка при получении данных. Пожалуйста, повторите операцию позже");
                            });
                    }
                }

                memoryFactory.setMemory('getContent', {
                    wallList: $scope.wallList,
                    model: $scope.model
                });
            }

            function getStat(url) {
                var statDeferr = $.Deferred();
                if (!appState.isActiveUser()) {
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    statDeferr.reject();
                    return statDeferr.promise();
                }

                var groupInfo = {};
                var vkGroupId = radCommonFunc.getGroupId(url);
                var vkGid;
                var ER = parseFloat(0);
                var parseDate = getCheckedDate("last200posts");

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {

                    $scope.$apply(()=> {
                        vkGid = res.gid;
                        membersCount = res.members_count;
                        groupInfo = res;
                        groupInfo.ER = 0;
                        groupInfo.wallAnalysisCount = 0;
                        $scope.model.groupsList.push(groupInfo);
                    });

                    $.when(
                        getWallStat().then(function (wall) {
                            groupInfo.wallList = wall;
                            groupInfo.ER = (ER / groupInfo.wallAnalysisCount).toFixed(3);
                        })
                    )
                        .then(function () {
                            groupInfo.url = url;
                            statDeferr.resolve(groupInfo);
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

                            if (!groupInfo.wallCount) {
                                groupInfo.wallCount = res[0];
                            }

                            if (res && res.length > 1) {
                                groupInfo.wallCount = res[0];//Количество постов за период
                                res.forEach(function (post, j) {

                                    if (parseDate.lastPosts) {//Фильтр за последние посты
                                        if (j != 0 && postCounter <= parseDate.lastPosts) {
                                            wallStat.push(post);
                                            calcER(post);
                                            postCounter++;
                                        }
                                        if (postCounter > parseDate.lastPosts) {
                                            flagStop = true;
                                        }
                                    } else {//Фильтр за время
                                        if (post.date > parseDate.unixFrom && post.date < parseDate.unixTo) {
                                            wallStat.push(post);
                                            calcER(post);
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

                            function calcER(post) {
                                if (membersCount && post.likes && post.reposts && post.comments) {
                                    post.ER = (post.likes.count + post.reposts.count + post.comments.count) / membersCount * 100;
                                    post.ER = post.ER.toFixed(3);

                                    ER += parseFloat(post.ER);
                                    groupInfo.wallAnalysisCount += 1;
                                }
                            }
                        }).fail(function () {
                            deferr.reject();
                        });
                    }

                    return deferr.promise();
                }

                return statDeferr.promise();
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
                }
                if (filter == 'reposts') {//Фильтр по лайкам
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.reposts.count)
                            return o.reposts.count;
                        else
                            return 0;
                    }).reverse();
                }
                if (filter == 'comments') {//Фильтр по лайкам
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.comments.count)
                            return o.comments.count;
                        else
                            return 0;
                    }).reverse();
                }

                if (filter == 'ER') {//Фильтр по ER
                    $scope.wallList = _.sortBy($scope.wallList, function (o) {
                        if (o.likes && o.ER)
                            return o.ER;
                        else
                            return 0;
                    }).reverse();
                }

                $scope.wallListView = [];
                $scope.wallPage = 1;
                for (var i = 0; i < 20; i++) {
                    if ($scope.wallList[i])
                        $scope.wallListView.push($scope.wallList[i]);
                    else i = 20;
                }

                $scope.$apply($scope.wallListView);
            }

            function showNextPosts() {
                for (var i = $scope.wallPage * 20; i < ($scope.wallPage + 1) * 20; i++) {
                    if ($scope.wallList[i])
                        $scope.wallListView.push($scope.wallList[i]);
                    else i = ($scope.wallPage + 1) * 20;
                }
                $scope.wallPage++;
                $timeout(()=> {
                    $(".nano").nanoScroller();
                });
            }

            function getCheckedDate(checkDate) {
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
                    case "last200posts":
                        return {
                            lastPosts: 200
                        };
                        break;
                    case "allPosts":
                        return {
                            lastPosts: 5000
                        };
                        break;
                    case "datePicker":
                        if (!$scope.model.datePicker.dateFrom) {
                            $scope.error.datePickerFromError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if (!$scope.model.datePicker.dateTo) {
                            $scope.error.datePickerToError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom > $scope.model.datePicker.dateTo) {
                            $scope.error.datePickerFromError = "Дата начала превышает дату окончания";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom.getTime() == $scope.model.datePicker.dateTo.getTime()) {
                            $scope.model.datePicker.dateTo = new Date($scope.model.datePicker.dateTo.getTime() + 24 * 60 * 60 * 1000);
                        }

                        dateFrom = $scope.model.datePicker.dateFrom;
                        dateTo = $scope.model.datePicker.dateTo;

                        return {
                            from: moment(dateFrom).format("YYYY-MM-DD"),
                            to: moment(dateTo).format("YYYY-MM-DD"),
                            unixFrom: dateFrom / 1000,
                            unixTo: dateTo / 1000
                        };
                        break;
                }
            }

            function getDate(date) {
                return moment(date * 1000).format("DD.MM.YYYY HH:mm")
            }

            function getDataFromMemory() {
                var lastData = memoryFactory.getMemory('getContent');

                if (lastData) {
                    $scope.wallList = lastData.wallList;
                    var filterValue = $("input[name=filterPosts]:checked").val() || 'likes';
                    $timeout(()=> {
                        $scope.model = lastData.model;
                        wallFilter(filterValue);
                        $scope.dataIsLoaded = true;
                    });
                }

                $timeout(()=> {
                    $scope.dataFromMemoryIsLoaded = true;
                });
            }

            function nextProgressStep(step) {
                if (step == 0 || !step) {
                    return;
                }

                var progressPercent = parseFloat($scope.progressPercent);
                progressPercent += parseFloat(step);
                progressPercent = progressPercent.toFixed(2);

                $timeout(()=> {
                    if (progressPercent < 100) {
                        $scope.progressPercent = progressPercent;
                    }
                });
            }

            function isShowAnotherPictures(arr) {
                if (!(arr && arr.length)) {
                    return false;
                }
                var filteredArr = arr.filter((i)=> {
                    return i.type == 'photo';
                });
                return filteredArr.length > 1;
            }

            function isShowGif(arr) {
                if (!(arr && arr.length)) {
                    return false;
                }
                var filteredArr = arr.filter((i)=> {
                    return i.type == 'doc' && i.doc && i.doc.ext == "gif";
                });
                return filteredArr.length > 0;
            }

            function showCurrentPicture(url, index) {
                $(".publishItem" + index + " .image img").attr("src", url);
            }

            function addToFavorite(post, index) {
                if (!post) {
                    return;
                }

                bus.request(topics.FAVORITE.ADD, {
                    postData: post
                })
                    .then((result)=> {
                        if (result && result.success) {
                            $timeout(()=> {
                                $scope.wallList[index].isAddedToFavorite = true;
                            });
                            notify.success("Пост сохранен в отложенные записи");
                        } else {
                            if (result && result.exceptionType == 'AlreadyExist') {
                                $timeout(()=> {
                                    $scope.wallList[index].isAddedToFavorite = true;
                                });
                                notify.error("Этот пост уже есть в ваших отложенных записях");
                            }
                        }
                    });
            }

            function init() {
                $scope.sectionIsAvailable = appState.isAdmin();
                //getAdminGroups();
                getDataFromMemory();
                getSectionsList();

                $('.icheck').iCheck({
                    checkboxClass: 'icheckbox_flat-blue',
                    radioClass: 'iradio_flat-blue'
                });

                $("#listSort input").on("ifChanged", function (res) {
                    if (res.currentTarget.checked == true) {
                        wallFilter();
                    }
                });

                $(".nano").nanoScroller();

                if (needGetStatFromParams) {
                    $scope.model.groupAddress = needGetStatFromParams;
                    getStat();
                }
            }

            function getSectionsList() {
                bus.request(topics.GET_CONTENT.GET_LIST).then((res)=> {
                    $timeout(()=> {
                        $scope.model.sections = res.data;
                    });
                });
            }

            function getVideoUrl(video) {
                video = video.video ? video.video : video;
                return vkApiFactory.getVideo(authData, {
                    videos: video.owner_id + "_" + video.vid + "_" + video.access_key
                })
                    .then((result)=> {
                        if (result && result.items && result.items[0]) {
                            $timeout(()=> {
                                video.url = result.items[0].player;
                            });
                        }
                        else {
                            notify.error("Не удалось получить видеозапись.");
                        }
                    });
            }

            function isShowDetail(index) {
                return $('.publishItem' + index + ' .post-info-area').height() > 200;
            }

            function openDatepickerPopupFrom() {
                $scope.model.datePicker.popupFrom.opened = !$scope.model.datePicker.popupFrom.opened;
            }

            function openDatepickerPopupTo() {
                $scope.model.datePicker.popupTo.opened = !$scope.model.datePicker.popupTo.opened;
            }

            init();

        }]);
