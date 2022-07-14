import moment from "moment";

import events from './../../../../bl/events.js';
import topics from './../../../../bl/topics.js';
import {enums} from './../../../../bl/module.js';

angular
    .module('rad.stat')
    .controller('statPublishAnalysisController', ['$rootScope', '$scope', '$state', 'bus', 'vkApiFactory', 'appState',
        '$timeout', 'memoryFactory', 'radCommonFunc', 'notify', '$stateParams', '$sce',
        function ($rootScope, $scope, $state, bus, vkApiFactory, appState, $timeout, memoryFactory, radCommonFunc,
                  notify, $stateParams, $sce) {
            $scope.currentTab = 'catalog';
            $rootScope.page.sectionTitle = 'Анализ публикаций';
            $scope.model = {
                groupAddress: '',
                title: 'Анализ публикаций',
                datePicker: {
                    dateFrom: '',
                    dateTo: '',
                    popupFrom: {
                        opened: false
                    },
                    popupTo: {
                        opened: false
                    }
                }
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
            $scope.getStatExample = getStatExample;
            $scope.getVideoUrl = getVideoUrl;
            $scope.isShowDetail = isShowDetail;
            $scope.openDatepickerPopupFrom = openDatepickerPopupFrom;
            $scope.openDatepickerPopupTo = openDatepickerPopupTo;

            $scope.wallCount = 0;
            $scope.wallList = [];
            $scope.wallListView = [];
            $scope.wallPage = 1;
            $scope.isLoading = false;
            $scope.dataIsLoaded = false;
            $scope.groupIsFinded = false;
            $scope.groupInfo = {};
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

            function getStat(isExample) {
                if (!appState.isActiveUser() && !isExample) {
                    bus.publish(events.ACCOUNT.SHOW_PERIOD_FINISHED_MODAL);
                    return;
                }

                if (!$scope.model.groupAddress) {
                    $scope.urlError = 'Укажите адрес или символьный код группы';
                    return;
                }

                /*Проверка дат*/
                var parseDate = getCheckedDate();
                if (!parseDate || (parseDate && parseDate.error)) {
                    return;
                }

                $scope.groupIsFinded = false;
                $scope.progressPercent = 0;
                $scope.isLoading = true;
                $scope.hiddenFilter = true;
                var allPostsCount = 0;

                var vkGroupId = radCommonFunc.getGroupId($scope.model.groupAddress);
                var vkGid;
                var groupInfo;
                var ER = parseFloat(0);

                vkApiFactory.getGroupInfo(authData, {
                    groupId: vkGroupId,
                    fields: "photo_big,photo_medium,photo,members_count,counters,description"
                }).then(function (res) {

                    if (res && res.error && res.error.error_code == 100) {
                        $scope.$apply(function () {
                            $scope.urlError = 'Введеная группа вконтакте не найдена';
                            $scope.isLoading = false;
                            $scope.dataIsLoaded = false;
                            $scope.hiddenFilter = false;
                        });
                        return;
                    }

                    $scope.$apply(()=> {
                        $scope.dataIsLoaded = true;
                        $scope.groupIsFinded = true;

                        vkGid = res.gid;
                        membersCount = res.members_count;
                        groupInfo = res;
                        $scope.groupInfo = res;
                        $scope.groupInfo.ER = 0;
                        $scope.groupInfo.wallAnalysisCount = 0;
                    });

                    $.when(
                        getWallStat().then(function (wall) {
                            $scope.wallList = wall;
                            var filterValue = $("input[name=filterPosts]:checked").val() || 'likes';
                            wallFilter(filterValue);

                            $scope.groupInfo.ER = (ER / $scope.groupInfo.wallAnalysisCount).toFixed(3);
                        })
                    )
                        .then(function () {
                            bus.publish(events.STAT.PUBLISH_ANALISYS.FINISHED, $scope.stat);
                            memoryFactory.setMemory('publishAnalyser', {
                                wallList: $scope.wallList,
                                groupAddress: $scope.model.groupAddress
                            });
                        })
                        .always(function () {
                            $scope.$apply(function () {
                                $scope.isLoading = false;
                                $scope.dataIsLoaded = true;
                            });
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

                            if (!$scope.groupInfo.wallCount) {
                                $timeout(()=> {
                                    $scope.groupInfo.wallCount = res[0];
                                });
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

                                $scope.nextProgressStep(iteration * 100);
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
                                    $scope.groupInfo.wallAnalysisCount += 1;
                                }
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
                /*console.log($scope.wallListView);*/
                $scope.$apply($scope.wallListView);
                $timeout(()=> {
                    $(".nano").nanoScroller();
                });
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
                    case "last500posts":
                        return {
                            lastPosts: 500
                        };
                        break;
                    case "allPosts":
                        return {
                            lastPosts: 5000
                        };
                        break;
                    case "datePicker":
                        if (!$scope.model.datePicker.dateFrom){
                            $scope.error.datePickerFromError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if (!$scope.model.datePicker.dateTo){
                            $scope.error.datePickerToError = "Неверная дата";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom > $scope.model.datePicker.dateTo){
                            $scope.error.datePickerFromError = "Дата начала превышает дату окончания";
                            return {
                                error: true
                            }
                        }
                        if ($scope.model.datePicker.dateFrom.getTime() == $scope.model.datePicker.dateTo.getTime()){
                            $scope.model.datePicker.dateTo = new Date($scope.model.datePicker.dateTo.getTime() + 24*60*60*1000);
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
                var lastData = memoryFactory.getMemory('publishAnalyser');

                if (lastData) {
                    $scope.wallList = lastData.wallList;
                    var filterValue = $("input[name=filterPosts]:checked").val() || 'likes';
                    $scope.model.groupAddress = lastData.groupAddress;
                    $timeout(()=> {
                        wallFilter(filterValue);
                        $scope.dataIsLoaded = true;
                    });
                }

                $timeout(()=> {
                    $scope.dataFromMemoryIsLoaded = true;
                });
            }

            function nextProgressStep(step) {
                $timeout(()=> {
                    $scope.progressPercent = step;
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
                getAdminGroups();
                getDataFromMemory();

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

            function getStatExample(urlOrScreenName) {
                if ($scope.isLoading) {
                    notify.info("Дождитесь завершения анализа");
                    return;
                }
                $scope.model.groupAddress = urlOrScreenName;
                getStat(true);
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
